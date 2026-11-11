import { findByText } from "../core/dom";
import type { Journey } from "./types";

/**
 * The road through Tallowmere, the demo store: shop front, product, cart,
 * details, payment, confirmation. The shopper buys one Dusk Ember candle.
 */

const PRODUCT_PATH = "/store/product/dusk-ember";
const CART_KEY = "tallowmere-cart";

const productLink = () => document.querySelector<HTMLElement>(`a[href="${PRODUCT_PATH}"]`);
const addToCart = () => findByText<HTMLElement>("button", /^add to cart$/i);
const viewCart = () => findByText<HTMLElement>("a", /^view cart$/i);
const checkoutLink = () => document.querySelector<HTMLElement>('main a[href="/store/checkout"]');
const continueButton = () => findByText<HTMLElement>("button", /continue to payment/i);
const paymentHeading = () => findByText("h2", /^payment$/i);
const sandboxPay = () => findByText<HTMLButtonElement>("button", /sandbox test card/i);
const detailFields = () =>
  Array.from(document.querySelectorAll<HTMLInputElement>("main form input")).slice(0, 2);

function present<T>(items: (T | null)[]): T[] {
  return items.filter((item): item is T => item !== null);
}

export const tallowmere: Journey = {
  cartCents: 1800,
  startPath: "/store",

  prepare() {
    try {
      window.localStorage.removeItem(CART_KEY);
    } catch {
      // Storage may be unavailable. The walk still works with an empty in-memory cart.
    }
  },

  orderId() {
    return window.location.pathname.split("/").pop() ?? "";
  },

  scenes: [
    {
      id: "shop",
      name: "Shop front",
      funnel: 0.5,
      match: () => window.location.pathname === "/store" && productLink() !== null,
      path: () => present([productLink()]),
      async advance(actor) {
        const link = productLink();
        if (link) await actor.click(link, "Chooses the Dusk Ember candle");
      },
    },
    {
      id: "product",
      name: "Product page",
      funnel: 0.75,
      match: () => window.location.pathname === PRODUCT_PATH && addToCart() !== null,
      path: () => present([addToCart()]),
      async advance(actor) {
        const button = addToCart();
        if (button) await actor.click(button, "Adds it to the cart");
        const link = await actor.waitFor(viewCart, 5000);
        if (link) await actor.click(link, "Opens the cart");
      },
    },
    {
      id: "cart",
      name: "Cart",
      funnel: 1,
      match: () => window.location.pathname === "/store/cart" && checkoutLink() !== null,
      path: () => present([checkoutLink()]),
      async advance(actor) {
        const link = checkoutLink();
        if (link) await actor.click(link, "Goes to checkout");
      },
    },
    {
      id: "details",
      name: "Your details",
      funnel: 1.25,
      match: () => window.location.pathname === "/store/checkout" && continueButton() !== null,
      path: () => [...detailFields(), ...present([continueButton()])],
      async advance(actor) {
        const [name, email] = detailFields();
        if (name) await actor.type(name, actor.shopper.name, "Types a name");
        if (email) await actor.type(email, actor.shopper.email, "Types an email address");
        const button = continueButton();
        if (button) await actor.click(button, "Continues to payment");
      },
    },
    {
      id: "payment",
      name: "Payment",
      funnel: 1.5,
      match: () => window.location.pathname === "/store/checkout" && paymentHeading() !== null,
      path: () => present([sandboxPay()]),
      async advance(actor) {
        const button = await actor.waitFor(() => {
          const candidate = sandboxPay();
          return candidate && !candidate.disabled ? candidate : null;
        }, 20000);
        if (button) await actor.click(button, "Pays with the sandbox test card");
        await actor.waitFor(() => window.location.pathname.startsWith("/store/thanks/"), 30000);
      },
    },
    {
      id: "thanks",
      name: "Order confirmed",
      funnel: 1.5,
      final: true,
      match: () =>
        window.location.pathname.startsWith("/store/thanks/") &&
        findByText("h1", /^thank you$/i) !== null,
      path: () => [],
      async advance() {},
    },
  ],
};
