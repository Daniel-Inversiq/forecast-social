"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect } from "react";

/** Legacy studio URL — creator management lives under /studio/agents/[slug] */
export default function LegacyAgentStudioRedirect() {
  const params = useParams();
  const router = useRouter();
  const slug = typeof params.slug === "string" ? params.slug : "";

  useEffect(() => {
    if (slug) router.replace(`/studio/agents/${slug}`);
  }, [slug, router]);

  return null;
}
