import type { Metadata } from "next";
import Link from "next/link";
import { SiteTrial } from "@/components/sentinel/SiteTrial";

export const metadata: Metadata = {
  title: "Your own site | Sentinel",
};

export default function SitesPage() {
  return (
    <main id="main" className="mx-auto w-full max-w-3xl flex-1 px-4 py-12">
      <Link href="/lobby" className="text-mist underline underline-offset-4 hover:text-parchment">
        Back to the shoppers
      </Link>
      <h1 className="font-display mt-6 text-4xl font-bold text-parchment sm:text-5xl">
        Try it on your own site
      </h1>
      <p className="mt-3 text-lg text-mist">
        Sentinel only runs where its owner has put it. Add one line to your site, and the shoppers
        can visit it.
      </p>
      <p className="mt-2 text-mist">
        This version works on public pages without a login. Pages behind logins or bot checks, sites
        whose security settings block outside scripts, and mobile apps come later.
      </p>
      <div className="mt-8">
        <SiteTrial />
      </div>
    </main>
  );
}
