# Sentinel: The Checkout Trials

> Your checkout isn't broken. It's just broken for someone you've never met.

Sentinel is a defensive testing tool for online stores, presented as a pixel-art game. Seven
characters, each standing for a real kind of customer, walk through a store's actual pages and
try to buy something. You watch where each one struggles, see what it costs, get a fix, and run
the trial again.

Built for the PayPal AI Hackathon. Payments run through the Braintree sandbox, a PayPal service,
so no real money ever moves.

**Status:** in active development. This README grows with the project.

## The shoppers

| Character    | Stands for                            |
| ------------ | ------------------------------------- |
| Grandma Iris | An older shopper with low vision      |
| Tobin        | A shopper with a hand tremor          |
| Pell         | A shopper on a slow rural connection  |
| Knock        | A shopper who uses only a keyboard    |
| Echo         | A shopper who uses a screen reader    |
| Dash         | An impatient shopper on a cheap phone |
| Cog          | An AI shopping agent                  |

## What Sentinel will and will not do

- Trials run only on Sentinel's own demo store and on sites whose owner installed the Sentinel
  script. This is enforced in code by an allow-list (`lib/guards/allow-list.ts`).
- Payments use a sandbox only. A live payments setting makes the app refuse to run
  (`lib/guards/sandbox.ts`).
- Measurements come from the browser: contrast ratios, target sizes, timings, focus order.
  AI is used for the characters' voices, the explanations and the suggested fixes.

## Run it locally

Requires Node.js 22 or later.

```bash
npm install
cp .env.example .env.local   # then fill in the values
npm run dev
```

Open http://localhost:3000.

## Checks

```bash
npm run check          # lint, type checks and unit tests
npm run format:check   # formatting
npm run build          # production build
```

## Licence

[MIT](LICENSE)
