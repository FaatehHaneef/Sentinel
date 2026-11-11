import Link from "next/link";

export default function ArrivalPage() {
  return (
    <main
      id="main"
      className="mx-auto flex w-full max-w-3xl flex-1 flex-col items-center justify-center gap-8 px-4 py-16 text-center"
    >
      <p className="font-display text-sm uppercase tracking-[0.3em] text-amber">
        The Checkout Trials
      </p>
      <h1 className="font-display text-6xl font-bold text-parchment sm:text-7xl">Sentinel</h1>
      <p className="max-w-xl text-xl text-parchment">
        Your checkout isn&apos;t broken. It&apos;s just broken for someone you&apos;ve never met.
      </p>
      <p className="max-w-xl text-lg text-mist">
        Send seven kinds of customer through your store. Watch where each one struggles, see what it
        costs you, and fix it.
      </p>
      <Link
        href="/lobby"
        className="font-display rounded border-b-4 border-ember bg-amber px-8 py-4 text-xl font-bold text-indigo transition-transform hover:-translate-y-0.5 active:translate-y-0.5 active:border-b-2"
      >
        Meet the shoppers
      </Link>
      <p className="text-sm text-mist">
        A defensive testing tool. Trials run only on our demo store and on sites whose owner
        installed Sentinel. Payments use a sandbox, so no real money moves.
      </p>
    </main>
  );
}
