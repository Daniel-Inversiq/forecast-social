"""Creator forecaster knowledge layer — PDF upload and management."""

from __future__ import annotations

import os
import shutil

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from sqlalchemy.orm import Session

from app.auth.dependencies import get_current_user
from app.database import get_db
from app.forecasting.models import CreatorForecaster, ForecasterKnowledgeSource, User
from app.forecasting.services.creator_forecaster.knowledge import (
    PDF_PARSE_FAILED_MSG,
    PDF_PROCESSING_UNAVAILABLE_MSG,
    pdf_processing_available,
    process_pdf_content,
    sanitize_filename,
    serialize_source_public,
)
from app.settings import (
    knowledge_max_pdfs_per_forecaster,
    knowledge_pdf_max_bytes,
    knowledge_storage_dir,
)

router = APIRouter(tags=["forecaster-knowledge"])

ALLOWED_CONTENT_TYPES = frozenset({"application/pdf", "application/x-pdf", "application/octet-stream"})


def _get_owned_forecaster(db: Session, forecaster_id: int, user: User) -> CreatorForecaster:
    cf = db.query(CreatorForecaster).filter(CreatorForecaster.id == forecaster_id).first()
    if not cf:
        raise HTTPException(status_code=404, detail="Forecaster not found")
    if cf.owner_user_id != user.id:
        raise HTTPException(status_code=403, detail="Not your forecaster")
    return cf


def _source_dir(owner_id: int, forecaster_id: int) -> str:
    path = os.path.join(knowledge_storage_dir(), str(owner_id), str(forecaster_id))
    os.makedirs(path, exist_ok=True)
    return path


def _delete_storage_file(storage_path: str) -> None:
    if storage_path and os.path.isfile(storage_path):
        try:
            os.remove(storage_path)
        except OSError:
            pass


@router.post("/forecasters/{forecaster_id}/knowledge/upload")
async def upload_knowledge_pdf(
    forecaster_id: int,
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    cf = _get_owned_forecaster(db, forecaster_id, current_user)

    if not pdf_processing_available():
        raise HTTPException(status_code=503, detail=PDF_PROCESSING_UNAVAILABLE_MSG)

    existing_count = (
        db.query(ForecasterKnowledgeSource)
        .filter(ForecasterKnowledgeSource.forecaster_id == cf.id)
        .count()
    )
    if existing_count >= knowledge_max_pdfs_per_forecaster():
        raise HTTPException(
            status_code=400,
            detail=f"Maximum {knowledge_max_pdfs_per_forecaster()} PDFs per forecaster",
        )

    filename = sanitize_filename(file.filename or "document.pdf")
    if not filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="PDF files only")

    content_type = (file.content_type or "").lower()
    if content_type and content_type not in ALLOWED_CONTENT_TYPES:
        raise HTTPException(status_code=400, detail="PDF files only")

    content = await file.read()
    if not content:
        raise HTTPException(status_code=400, detail="Empty file")
    if len(content) > knowledge_pdf_max_bytes():
        max_mb = knowledge_pdf_max_bytes() / (1024 * 1024)
        raise HTTPException(status_code=400, detail=f"File exceeds {max_mb:.0f}MB limit")

    if not content[:5].startswith(b"%PDF"):
        raise HTTPException(status_code=400, detail="Invalid PDF file")

    source = ForecasterKnowledgeSource(
        forecaster_id=cf.id,
        owner_user_id=current_user.id,
        source_type="pdf",
        filename=filename,
        storage_path="",
        status="processing",
    )
    db.add(source)
    db.flush()

    dest_dir = _source_dir(current_user.id, cf.id)
    storage_path = os.path.join(dest_dir, f"{source.id}.pdf")
    with open(storage_path, "wb") as f:
        f.write(content)
    source.storage_path = storage_path

    try:
        result = process_pdf_content(content)
        source.extracted_text = result["extracted_text"]
        source.summary = result["summary"]
        source.key_claims_json = result["key_claims"]
        source.status = "ready"
    except RuntimeError as exc:
        db.rollback()
        if str(exc) == PDF_PROCESSING_UNAVAILABLE_MSG:
            raise HTTPException(status_code=503, detail=PDF_PROCESSING_UNAVAILABLE_MSG) from exc
        raise HTTPException(status_code=500, detail=str(exc)) from exc
    except ValueError as exc:
        source.status = "failed"
        msg = str(exc)
        if msg != PDF_PARSE_FAILED_MSG and not msg.startswith("No extractable text"):
            msg = PDF_PARSE_FAILED_MSG
        source.summary = msg[:480]
        source.key_claims_json = []

    db.commit()
    db.refresh(source)
    return {
        **serialize_source_public(source),
        "pdf_processing_available": pdf_processing_available(),
    }


@router.get("/forecasters/{forecaster_id}/knowledge")
def list_knowledge_sources(
    forecaster_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    cf = _get_owned_forecaster(db, forecaster_id, current_user)
    rows = (
        db.query(ForecasterKnowledgeSource)
        .filter(ForecasterKnowledgeSource.forecaster_id == cf.id)
        .order_by(ForecasterKnowledgeSource.created_at.asc())
        .all()
    )
    return {
        "sources": [serialize_source_public(row) for row in rows],
        "limits": {
            "max_pdfs": knowledge_max_pdfs_per_forecaster(),
            "max_bytes": knowledge_pdf_max_bytes(),
        },
        "pdf_processing_available": pdf_processing_available(),
    }


@router.delete("/forecasters/{forecaster_id}/knowledge/{source_id}")
def delete_knowledge_source(
    forecaster_id: int,
    source_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    cf = _get_owned_forecaster(db, forecaster_id, current_user)
    source = (
        db.query(ForecasterKnowledgeSource)
        .filter(
            ForecasterKnowledgeSource.id == source_id,
            ForecasterKnowledgeSource.forecaster_id == cf.id,
        )
        .first()
    )
    if not source:
        raise HTTPException(status_code=404, detail="Knowledge source not found")

    storage_path = source.storage_path
    db.delete(source)
    db.commit()
    _delete_storage_file(storage_path)

    remaining = (
        db.query(ForecasterKnowledgeSource)
        .filter(ForecasterKnowledgeSource.forecaster_id == cf.id)
        .count()
    )
    if remaining == 0:
        dir_path = _source_dir(current_user.id, cf.id)
        if os.path.isdir(dir_path):
            try:
                shutil.rmtree(dir_path, ignore_errors=True)
            except OSError:
                pass

    return {"status": "deleted", "source_id": source_id}
