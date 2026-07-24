# Berinoh community wedding fund - interactive models

Prepared for the Berinoh committee. Live at <https://berinoh.provaris.co.uk>.

Two designs for a community wedding-finance mutual, each with its own interactive
simulator, plus a landing page that compares them on shared assumptions. A
committee can change every rule and watch the consequence over fifty years or more.

- **Model A, Gemach Hakehiloh.** A per-family pot inside a credit-union framework.
  A family saves together and pays a small monthly fee. When a child marries, the
  fund lends what it can afford that year, on the wedding date, and the loan grows
  toward the full amount as the fund matures and reserves build.
- **Model B, the Queue Scheme (Contract Savings Loan Scheme).** Per child, rationed
  by time. A family saves for each child and joins a waiting list; when its turn
  comes it receives the full interest-free loan, and its repayments help the next
  family in line. Once mature it largely funds itself.

## URLs

```
/                landing page and side-by-side comparison
/model-a/        Gemach Hakehiloh simulator (English)
/model-b/        Queue Scheme simulator (English)
/model-b/he/     Queue Scheme simulator (Hebrew, right to left)
/he.html         redirect stub -> /model-b/he/ (kept: an earlier reviewer holds this link)
```

## Layout

```
index.html            Landing and comparison page. Markup only.
he.html               Redirect stub to /model-b/he/. Do not delete.
model-a/index.html    Model A page (English). Markup only.
model-b/index.html    Model B page (English). Markup only.
model-b/he/index.html Model B page (Hebrew, RTL). Markup only.

css/app.css           One stylesheet for every page, both directions.

js/engine-a.js        Model A simulation. No DOM, no language.
js/engine-b.js        Model B simulation. No DOM, no language.
js/seed-500.js        Household seed data for Model A.
js/charts.js          SVG chart renderer.
js/cycle.js           Model B money-cycle diagram.
js/format.js          Number, currency and duration formatting.
js/strings-a-en.js    Model A English runtime strings.
js/strings-en.js      Model B English runtime strings.
js/strings-he.js      Model B Hebrew runtime strings.
js/app-a.js           Model A state, presets, wiring, rendering.
js/app.js             Model B state, presets, wiring, rendering.
js/compare.js         Landing page: runs both engines on shared inputs.

tests/engine-a.test.js  Model A regression checks (49).
tests/engine.test.js    Model B regression checks (25).
CNAME                 Custom domain. Do not delete.
```

All pages load assets by absolute path (`/css/...`, `/js/...`), so they work at any
depth.

## The one rule worth knowing

Both engines **touch no DOM and contain no language**. Each takes a settings object
and returns arrays of numbers. That is what makes them testable in node, portable
into Excel or Python, and reviewable by an actuary who does not care about the
interface. Keep it that way. Everything a user reads at runtime lives in the
`strings-*` files; static page copy sits in the HTML so it is readable without
JavaScript and easy to proofread in place.

## Running the tests

```
node tests/engine.test.js
node tests/engine-a.test.js
```

Each exits non-zero on failure. Run them after any change to the matching engine.

## Model A base case

Three years of collecting before lending begins, a modest start-up capital left
after set-up costs, roughly 35,000 pounds a year of fundraising to cover the capital
shortfall, and no losses or withdrawals assumed. The loan starts near 10,000 pounds
and is lifted only when the fund can hold the higher figure while keeping its capital
and liquidity above their floors, so it only ever rises. Growth is by reproduction,
measured against member data, not assumed.

## Model B base case

Over fifty years: 335,080 weddings funded, 55.8% of enrollees served, average wait
22 years 1 month, 88.4% of final-year money coming from repayments rather than new
savers, with repayments overtaking new money in year 11. Reproduces an independently
built model to within 0.01%.

## Deployment

GitHub Pages from `main`, root folder. Push and the live site updates within about a
minute. There is no build step and no server. Do not delete `CNAME`; the custom
domain stops working if you do.

## Scope

These models set out the mechanics of each scheme as described. They are not a
recommendation, a forecast, or a substitute for actuarial or legal review. Every
figure moves with the assumptions entered on the page.
