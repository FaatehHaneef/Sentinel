import Link from "next/link";
import { Banner } from "@/components/store/Banner";
import { CandleArt } from "@/components/store/CandleArt";
import { ClubPopup } from "@/components/store/ClubPopup";
import { formatPrice, PRODUCTS } from "@/lib/store/catalogue";

export default function StorePage() {
  return (
    <>
      <div className="mb-8 aspect-[8/3] w-full overflow-hidden rounded-lg bg-indigo">
        <Banner />
      </div>
      <ClubPopup />
      <h1 className="font-display text-4xl font-bold">Candles for the road home</h1>
      <p className="mt-3 max-w-2xl text-lg text-ink-soft">
        Hand-poured in small batches at the stall where the road ends.
      </p>
      <ul className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {PRODUCTS.map((product) => (
          <li key={product.id}>
            <Link
              href={`/store/product/${product.id}`}
              className="flex h-full flex-col items-center gap-3 rounded-lg border border-line bg-card p-5 text-center hover:border-wax"
            >
              <CandleArt product={product} size={128} />
              <span className="font-display text-xl font-bold">{product.name}</span>
              <span className="text-ink-soft">{product.blurb}</span>
              <span className="mt-auto text-lg font-bold text-wax">
                {formatPrice(product.priceCents)}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
}
