/* eslint-disable @next/next/no-img-element */

const CASES = [
  {
    who: "A small shop owner",
    when: "Before opening the doors",
    text: "Send all seven shoppers through your checkout before your first customer does. See who gets stuck, where, and what it would cost you each month.",
    image: "/showcase/results.png",
    alt: "The results summary: each shopper's outcome, coins kept and lost, and their worst problems in plain words",
  },
  {
    who: "An agency or freelancer",
    when: "Handing over a client's shop",
    text: "Paste one line into the client's site and run the shoppers on it. Hand over a clear list of problems, how serious each is, and the code that fixes it.",
    image: "/showcase/ledger.png",
    alt: "The ledger: every problem across trials, sorted by how serious it is and whether it is fixed yet",
  },
  {
    who: "A developer",
    when: "Before every release",
    text: "Try the suggested fixes on the page in seconds, run the same shoppers again, and see the problems go away before anything ships.",
    image: "/showcase/trial.png",
    alt: "A trial in progress: Grandma Iris on the checkout page, with the problem she found outlined",
  },
];

/** Who Sentinel is for, each with a picture of the part of Sentinel they would use most. */
export function UseCases() {
  return (
    <section aria-labelledby="use-cases" className="pixel-panel mb-8">
      <h2 id="use-cases" className="font-display text-2xl font-bold text-parchment">
        Who it&apos;s for
      </h2>
      <div className="mt-5 grid gap-6 lg:grid-cols-3">
        {CASES.map((entry) => (
          <article key={entry.who} className="flex flex-col gap-3">
            <img
              src={entry.image}
              alt={entry.alt}
              width={640}
              height={400}
              className="aspect-[16/10] w-full border-2 border-slate object-cover object-top"
            />
            <p className="font-display text-sm uppercase tracking-widest text-amber">
              {entry.when}
            </p>
            <h3 className="text-xl font-bold text-parchment">{entry.who}</h3>
            <p className="text-parchment">{entry.text}</p>
          </article>
        ))}
      </div>
    </section>
  );
}
