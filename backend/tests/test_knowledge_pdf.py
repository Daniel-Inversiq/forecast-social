"""Tests for PDF knowledge dependency detection and parsing errors."""

from __future__ import annotations

import sys
from unittest.mock import MagicMock, patch

import pytest

from app.forecasting.services.creator_forecaster import knowledge as knowledge_mod


def test_pdf_processing_available_when_pypdf_imports():
    assert knowledge_mod.pdf_processing_available() is True
    assert knowledge_mod.pdf_processing_import_error() is None


def test_pdf_processing_unavailable_when_import_fails():
    with patch.dict(sys.modules, {"pypdf": None}):
        with patch.object(
            knowledge_mod,
            "_import_pdf_reader",
            return_value=(None, ImportError("No module named 'pypdf'")),
        ):
            assert knowledge_mod.pdf_processing_available() is False
            err = knowledge_mod.pdf_processing_import_error()
            assert err is not None
            assert "pypdf" in str(err).lower()


def test_extract_pdf_text_parse_failure_not_dependency_message():
    fake_reader = MagicMock(side_effect=OSError("corrupt pdf"))
    with patch.object(knowledge_mod, "_require_pdf_processing", return_value=fake_reader):
        with pytest.raises(ValueError, match=knowledge_mod.PDF_PARSE_FAILED_MSG):
            knowledge_mod.extract_pdf_text(b"%PDF-1.4 fake")


def test_require_pdf_processing_raises_runtime_error_when_missing():
    with patch.object(
        knowledge_mod,
        "_import_pdf_reader",
        return_value=(None, ImportError("No module named 'pypdf'")),
    ):
        with pytest.raises(RuntimeError, match=knowledge_mod.PDF_PROCESSING_UNAVAILABLE_MSG):
            knowledge_mod._require_pdf_processing()
