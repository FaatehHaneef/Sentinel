import type { Metadata } from "next";
import { Suspense } from "react";
import { RunResults } from "@/components/sentinel/RunResults";

export const metadata: Metadata = {
  title: "Trial results | Sentinel",
};

export default function RunPage() {
  return (
    <main id="main" className="mx-auto w-full max-w-4xl flex-1 px-4 py-12">
      <Suspense fallback={<p className="text-lg text-mist">Reading the trial record…</p>}>
        <RunResults />
      </Suspense>
    </main>
  );
}
