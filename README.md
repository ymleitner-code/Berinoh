# The Contract Savings Loan Scheme - interactive model

Prepared for the Berinoh committee. Live at <https://berinoh.provaris.co.uk>
(English at `/`, Hebrew at `/he.html`).

A community wedding-finance mutual. Families pay a small amount monthly for years,
receive a large interest-free loan when a wedding comes, and repay it so the next
family can be helped. This page lets a committee change every rule and see the
consequence over fifty years or more.

## Layout

```
index.html          English page. Markup only.
he.html             Hebrew page, right to left. Markup only.
css/app.css         One stylesheet for both languages.
js/engine-b.js      The simulation. No DOM, no language.
js/charts.js        SVG chart renderer.
js/cycle.js         Generates the money-cycle diagram.
js/format.js        Number, currency and duration formatting.
js/strings-en.js    English runtime strings.
js/strings-he.js    Hebrew runtime strings.
js/app.js           State, presets, wiring, rendering.
tests/engine.test.js  Regression checks.
CNAME               Custom domain. Do not delete.
```

## The one rule worth knowing

`js/engine-b.js` **touches no DOM and contains no language**. It takes a settings
object and returns arrays of numbers. That is what makes it testable in node,
portable into Excel or Python, and reviewable by an actuary who does not care
about the interface. Keep it that way.

Everything the user reads at runtime lives in `strings-en.js` and `strings-he.js`.
Static page copy (headings, control labels, the assumptions list, the footer) sits
in the two HTML files, because it is easier to proofread in place and the page
should still be readable without JavaScript. So a translator edits two files per
language, not one. That is a deliberate trade.

## Running the tests

```
node tests/engine.test.js
```

Exits non-zero on failure. Run it after any change to the engine. It checks the
per-member arithmetic, the base-case headline figures, the invariants that must
never break (cash never negative, unlent cash never exceeds one loan, loans always
whole), scale invariance, and the run-off scenario.

## How the engine works

One month at a time, repeating seven steps:

1. New children enrol and join the back of the queue
2. If exits are on, a fraction of those waiting leave and are refunded their savings
3. Everyone still waiting, and still inside their contribution period, pays in
4. Repayments arrive, reduced by the default rate, with recoveries after their lag
5. Running costs come off
6. **The lending loop.** Take the family at the front, add the top-up they owe, and
   ask whether the cash covers a whole loan while leaving the reserve intact. If
   yes, issue and repeat. If no, stop for the month
7. Leftover cash carries into next month

Step 6 is the whole scheme. Waiting times, coverage and run-off survivability all
fall out of how many times that loop turns each month.

Defaults and exits are **expected values, not random draws**. A 2% annual default
rate removes exactly 2% of the surviving balance. The engine is therefore
deterministic: identical inputs always give identical outputs, with no sampling
noise. The trade-off is that it gives a central estimate rather than a
distribution, so it will not tell you the odds of a bad decade. Adding that means a
Monte Carlo layer on top, which is a contained piece of work and a reasonable ask
from an actuary.

## Validation

Reproduces an independently built model to within 0.01%. Headline base case over
fifty years: 335,080 weddings funded, 55.8% of enrollees served, average wait 22
years 1 month, 88.4% of final-year money coming from repayments rather than new
savers, with repayments overtaking new money in year 11.

## Deployment

GitHub Pages from `main`, root folder. Push and the live site updates within about
a minute. There is no build step and no server. Do not delete `CNAME`; the custom
domain stops working if you do.

## Scope

This model sets out the mechanics of the scheme as described. It is not a
recommendation, a forecast, or a substitute for actuarial review. Every figure
moves with the assumptions entered on the page.
