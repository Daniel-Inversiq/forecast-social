import { Suspense } from "react";
import { BenchmarkPageClient } from "./BenchmarkPageClient";
import { BenchmarkPageFallback } from "./BenchmarkPageFallback";

export default function BenchmarkPage() {
  return (
    <Suspense fallback={<BenchmarkPageFallback />}>
      <BenchmarkPageClient />
    </Suspense>
  );
}
