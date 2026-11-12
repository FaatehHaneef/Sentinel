import { GameLobby } from "@/components/sentinel/GameLobby";
import { LobbyBackdrop } from "@/components/sentinel/LobbyBackdrop";

export default function ArrivalPage() {
  return (
    <main id="main" className="relative isolate mx-auto w-full max-w-6xl flex-1 px-4 py-10">
      <LobbyBackdrop />
      <header className="text-center">
        <p className="font-display text-sm uppercase tracking-[0.3em] text-amber">
          The Checkout Trials
        </p>
        <h1 className="font-display mt-2 text-6xl font-bold text-parchment sm:text-7xl">
          Sentinel
        </h1>
        <p className="mx-auto mt-3 max-w-xl text-xl text-parchment">
          Your checkout isn&apos;t broken. It&apos;s just broken for someone you&apos;ve never met.
        </p>
      </header>
      <div className="mt-4">
        <GameLobby start="circle" />
      </div>
      <p className="mt-10 text-center text-sm text-mist">
        A defensive testing tool. Trials run only on our demo store and on sites whose owner
        installed Sentinel. Payments use a sandbox, so no real money moves.
      </p>
    </main>
  );
}
