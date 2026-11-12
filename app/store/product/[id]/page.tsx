import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AddToCart } from "@/components/store/AddToCart";
import { CandleArt } from "@/components/store/CandleArt";
import { ProductData } from "@/components/store/ProductData";
import { findProduct, formatPrice, PRODUCTS } from "@/lib/store/catalogue";

export function generateStaticParams() {
  return PRODUCTS.map((product) => ({ id: product.id }));
}

export async function generateMetadata(props: PageProps<"/store/product/[id]">): Promise<Metadata> {
  const { id } = await props.params;
  const product = findProduct(id);
  return { title: product ? `${product.name} | Tallowmere Candles` : "Tallowmere Candles" };
}

export default async function ProductPage(props: PageProps<"/store/product/[id]">) {
  const { id } = await props.params;
  const product = findProduct(id);
  if (!product) notFound();

  return (
    <>
      <Link href="/store" className="text-ink-soft underline underline-offset-4">
        All candles
      </Link>
      <div className="mt-6 grid gap-10 md:grid-cols-2">
        <div className="flex items-center justify-center rounded-lg border border-line bg-card p-8">
          <CandleArt product={product} size={288} />
        </div>
        <div className="flex flex-col gap-5">
          <h1 className="font-display text-4xl font-bold">{product.name}</h1>
          <p className="text-2xl font-bold text-wax">{formatPrice(product.priceCents)}</p>
          <p className="text-lg">{product.description}</p>
          {/*
            Deliberate snag for the trials: on phone-sized screens this line
            refuses to wrap and is wider than the screen, so the whole page
            scrolls sideways. From 640 pixels up it wraps normally.
          */}
          <p className="min-w-[34rem] whitespace-nowrap rounded border border-line bg-card px-3 py-2 text-sm sm:min-w-0 sm:whitespace-normal">
            Free delivery on orders over $40 · Order by 3pm for same-day dispatch
          </p>
          <AddToCart productId={product.id} productName={product.name} />
          <ProductData product={product} />
        </div>
      </div>
    </>
  );
}
