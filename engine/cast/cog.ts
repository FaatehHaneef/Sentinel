import { COG_FRAMES, COG_PALETTE } from "../art/cog";
import { readProductData, runCogChecks } from "../checks/cog";
import type { EngineCharacter } from "./types";

type AgentReply = {
  ok: boolean;
  orderId?: string;
  reason: string;
  decidedBy: "ai" | "rules";
};

export const cog: EngineCharacter = {
  id: "cog",
  frames: COG_FRAMES,
  palette: COG_PALETTE,
  checks: runCogChecks,
  lines: {
    "cog.product-data": "No product data. I cannot confirm the price, so I cannot buy.",
    "cog.price-match": "The data and the page disagree on the price. I will not guess.",
    "cog.real-controls":
      "This does not declare itself as a control. I cannot tell it can be pressed.",
  },
  reactions: {
    "cog.product-data": "worry",
    "cog.price-match": "fuss",
    "cog.real-controls": "fuss",
  },
  greeting: "Task: buy one Dusk Ember candle, under $25. Reading the shop.",
  onPurchase: "Order placed and confirmed. Task complete.",
  onAbandon: "Task abandoned. This shop is not readable by agents.",
  onFixed: "Product data found. That is what I needed.",
  shopper: { name: "Cog Agent", email: "cog@example.com", quantity: 1 },

  /**
   * On a product page with readable data, Cog does not click through the
   * checkout. It hands the product data to its agent, which decides whether
   * to buy, and the shop's server places a sandbox order.
   */
  async takeOver(scene, actor) {
    if (scene.id !== "product") return false;
    const product = readProductData();
    if (!product) return false;

    actor.say("Product data found. Asking my agent whether to buy.");
    actor.note(`Reads the data: ${product.name}, ${product.price} ${product.currency}`);
    await actor.pause(600);

    let reply: AgentReply;
    try {
      const response = await fetch(`${actor.apiBase}/api/agent/order`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          product,
          quantity: actor.shopper.quantity,
          customer: { name: actor.shopper.name, email: actor.shopper.email },
        }),
      });
      reply = (await response.json()) as AgentReply;
    } catch {
      actor.note("The agent could not be reached, so Cog uses the checkout instead", "bad");
      return false;
    }

    const who = reply.decidedBy === "ai" ? "Agent (Gemini)" : "Agent (rules, AI unavailable)";
    actor.note(`${who}: ${reply.reason}`, reply.ok ? "good" : "bad");
    if (!reply.ok || !reply.orderId) {
      actor.say("My agent declined. I will try the checkout like everyone else.");
      return false;
    }
    actor.say("Order placed through the sandbox. Checking the confirmation.");
    await actor.pause(600);
    // The engine runs inside the shop's page, so it navigates with the browser itself.
    const confirmation = new URL(
      `/store/thanks/${encodeURIComponent(reply.orderId)}`,
      window.location.origin,
    );
    window.location.assign(confirmation.toString());
    return true;
  },
};
