/**
 * The dusk market behind the lobby: the store's own banner art, softly
 * darkened. It sits behind the page's content but in front of the page's
 * background, because the page's main element isolates it.
 */
export function LobbyBackdrop() {
  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/store/banner.png"
        alt=""
        width={1000}
        height={375}
        className="pixelated absolute inset-0 h-full w-full object-cover opacity-45"
      />
      <div className="absolute inset-0 bg-gradient-to-b from-night/70 via-night/40 to-night" />
    </div>
  );
}
