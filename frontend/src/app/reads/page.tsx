import { Suspense } from "react";
import { PublicReadsPageClient } from "./PublicReadsPageClient";

function PublicReadsPageFallback() {
  return (
    <div className="min-h-[40vh] flex items-center justify-center text-zinc-500 text-sm">
      Loading reads…
    </div>
  );
}

export default function PublicReadsPage() {
  return (
    <Suspense fallback={<PublicReadsPageFallback />}>
      <PublicReadsPageClient />
    </Suspense>
  );
}
