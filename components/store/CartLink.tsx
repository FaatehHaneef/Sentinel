"use client";

import Link from "next/link";
import { useCart } from "./cart";

export function CartLink() {
  const count = useCart().reduce((sum, item) => sum + item.quantity, 0);

  // Deliberate snag for the trials: an icon-only link with no name.
  return (
    <Link href="/store/cart" className="flex items-center gap-1 rounded px-2 py-1 text-ink">
      <svg viewBox="0 0 16 16" width="28" height="28" shapeRendering="crispEdges">
        <path
          fill="currentColor"
          d="M1 2h3v1H1zM4 3h1v6H4zM5 4h9v1H5zM13 5h1v3h-1zM5 8h8v1H5zM5 10h9v1H5zM5 12h2v2H5zM11 12h2v2h-2z"
        />
      </svg>
      <span className="text-sm font-bold">{count}</span>
    </Link>
  );
}
