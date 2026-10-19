# EV vs Fuel Cost

Static calculator comparing the cost of driving electric vs petrol/diesel in South Africa, part of the PsyPhin site. Started 2026-10-13 at the owner's request ("must be useful to current drivers and prospective buyers"; defaults filled in for a quick comparison, all changeable).

Repo `psyphin234/ev-cost` (public), GitHub Pages from `main` / root. Push to `main` to deploy; check with `gh api repos/psyphin234/ev-cost/pages/builds/latest`.

**Address: https://evcost.psyphin.co.za/** since 2026-10-13 (the `CNAME` file here, plus the Afrihost CNAME `evcost.psyphin.co.za` → `psyphin234.github.io`). Card on psyphin.co.za (Tools, amber "In testing") since 2026-10-13; its image, `assets/img/projects/ev-cost.jpg` there, is a crop of this page's "Cost per 100 km" card at the default figures (900 px window, 2x; since 2026-10-19 a 16:9 area from the card's top with the race finished) and is also this page's Open Graph image.

Plain HTML/CSS/vanilla JS, classic scripts, no build step: `index.html` opens straight from disk. Inputs are kept in the visitor's `localStorage` (key `ev-cost-v1`).

**Status: finished** (owner, 2026-10-14). `noindex` removed 2026-10-14, so Google may list the page. The amber `.construction` banner was removed the same day (its CSS is kept); the psyphin.co.za card is green "Actively maintained".

## Prices

- **Fuel is live:** `app.js` fetches `https://fuel.psyphin.co.za/data/status.json` (the BFP_Website repo's hourly output; GitHub Pages sends `Access-Control-Allow-Origin: *`). It reads `latest_official_report.current_price` (c/l, Gauteng = inland) and `predictions.<fuel>.predicted_pump_price_change_c_per_l` for the "Next month" card. Coastal = inland − `liveFeed.coastalGap` (R0.87 in Oct 2026, the same gap for 95 and diesel). If the fetch fails, `fuelFallback` in data.js is used: **update it each month** (first Wednesday) along with `checked`. If the fuel site's JSON shape changes, update `fetchLive()` here.
- Diesel is the regulated **wholesale** price (pump prices are set by retailers); the page says so.
- Electricity and charging defaults, each with its source in `data.js`: Eskom Homepower 4 R3.56/kWh (Eskom's 2026/27 tariff booklet, page 27: energy 322.06 + network demand 32.98 + ancillary 0.52 = 355.56 c/kWh incl. VAT; the fixed daily charges are left out because an EV doesn't change them), metro R4.50 (a middle figure: Tshwane's blocks run R3.73 to R5.12 per GridPulse's NERSA capture, eThekwini is a flat R4.17; an EV's kWh land in the top block, and the hints say to use that), GridCars AC R5.88 / DC R7.35. CHARGE (formerly Zero Carbon Charge; N3 sites Reitz exit 107 and Tugela exit 207, opened May 2026) doesn't publish its tariff online; CHARGE emailed it to the owner on 2026-10-14 after finding the page: **DC R9.15/kWh incl. VAT, AC free until the end of May 2027**. That's the highway price default (`n3Dc`, source `chargeTariff`, which has no URL: `sourceLink()` and the reference list show such a source as plain text). Visitors with the old R7.35 default saved are moved to the new one in `load()`. Ask CHARGE again before June 2027, when the free AC ends.
- **EV consumption scale** (owner's request, 2026-10-13: "average / good / bad general figures, so perspective"): under the EV consumption box, a bar from EV Database's real-world best (13.0, Tesla Model 3 RWD) to worst (29.4, Mercedes-Benz G 580) with their 18.9 average, a dot for the typed figure and a line saying where it sits. Figures in `evScale` (data.js). The four bands (under 15 / 20 / 25 / above) are this page's own grouping around that average, not from the source. Recheck the cheatsheet now and then; its average moves as models are added.
- **Highway extra** (owner's request, 2026-10-13: explain why the extra is needed): `highway` in data.js holds EV Database's real-world figures for five cars (Model 3 RWD, Dolphin Surf 30 kWh, Atto 3, iX1 eDrive20, Hilux Electric): steady 110 km/h mild weather against WLTP vehicle consumption (+29 to +47%) and real mixed driving (+23 to +29%). The suggestions are the medians rounded to 5%: **40%** for a spec-sheet figure (the default; it was an unsourced 20% at first, which the data showed was too low) and **25%** for a trip-computer figure. The hint under the field follows the "where's that figure from" choice, with a "Use x%" button; "Why does an EV need more at highway speed?" folds out the physics (drag ∝ speed², NASA Glenn) and the table. A test checks the quoted ranges and suggestions against the data, so changing a car means updating the wording in `assumptions` too.
- **Spec sheet vs real driving:** the WLTP hint and the `realWorld` assumption say real mixed driving is 0 to 14% above WLTP (about 10% in the middle) for the five `highway` cars, worked out from their `combined` / `wltp` figures; a test checks the wording. The calculation itself doesn't add it: the visitor chooses which figure to type, as for the fuel car.
- Car-size presets, car prices, servicing and charger cost are **example figures, not from a source**, and the page labels them that way. Keep it like that unless a citable figure is found.

## How it works out (calc.js)

- An EV figure is either **spec-sheet (WLTP)**, measured at the wall so it already includes charging losses, or **trip computer**, measured at the battery, so losses are added. `evPer100()` returns both sides: `wall` (what you pay for) and `battery` (what range uses).
- Trip: battery use = battery-side consumption × (1 + highway %). Leaves home at the start %, drives to the reserve, then each stop charges reserve → charge-to %; the last stop only takes enough to arrive on the reserve. Billed kWh = battery kWh ÷ (1 − losses). Charging time = kWh ÷ average kW.
- **Keep your car, or finance an EV?** (section 3, owner's request 2026-10-13: "we want to buy a new car or keep the old one, but if the new one's fuel savings can cover the new monthly cost, then it's worth considering"). The current car is section 1's fuel car. Keep = fuel + its servicing and repairs a month (R800 example). Finance = instalment + electricity + EV servicing + extra insurance (both default 0). `instalment` is `null` = worked out by `C.instalment()` (ordinary amortisation, monthly interest, optional balloon as % of price) from the shared EV price, deposit/trade-in, rate (default prime 10.75%, from 25 Sept 2026, `finance` in data.js) and term (72 months), plus the bank's fees (`finance.fees`: R1 207.50 initiation added to the loan, R69 a month, the National Credit Act maximums the banks charge as standard); typing a quote overrides it, with a "Use that" button back, like the fuel price. The EV price box here (`finPrice`) and section 4's (`evPrice`) are the same state. Results: what share of the instalment the savings cover, the biggest instalment they'd cover and the car price that buys (`C.priceFor`, the inverse), the km a month at which it breaks even, what it saves once paid off, the interest and fees paid beyond the price, and a stacked monthly bar. While extra insurance is 0 a fact line warns that insurance isn't counted (banks require comprehensive cover). **Update the prime rate when the SARB changes the repo rate.**
- **Charging kit** (inputs in section 3's form, used only by section 4's ownership sums; since 2026-10-19, owner's request): tick boxes for whether a wall-box charger, a portable charger and a V2L cable come with the EV; each one not included shows its price box (`chargerCost` = the wall box installed R15 000, `portableCost` R8 000, `v2lCost` R5 000; example figures, not from a source), and `kitCost()` in app.js adds those up and passes the total to `C.ownership()` as `chargerCost` (the table row is "Charging kit"). Defaults: wall box not included, the other two included, so the default total is the old R15 000.
- Ownership: year 0 = prices (+ the charging kit for the EV); each year adds energy (with the yearly rises compounding) + servicing; break-even is interpolated between years. Insurance, finance and resale are left out (the page says so).

## Structure

```
index.html     The page: 1 everyday driving, 2 road trip, 3 keep your car or finance an EV, 4 buying outright: total cost, 5 good to know, sources, disclaimer
js/data.js     THE data file: sources, fuel fallback, live feed settings, tariffs, size presets, routes, N3 chargers, defaults, assumptions
js/calc.js     Pure calculations (no DOM): evPer100, running, trip, tripProfile, ownership
js/app.js      State + localStorage, live fuel fetch, inputs, rendering, the two SVG charts, the sources section, the phones' bottom bar
js/circuit.js  The glowing circuit board behind the page. IDENTICAL on every PsyPhin site (psyphin.co.za js/circuit.js,
               fuel site docs/circuit.js, towing js/circuit.js): change one, copy it to all
js/fx.js       Decoration only: the header's engine vs motor animation, fade-ins for the fieldsets and "good to know" cards
js/viz.js      The four animated diagrams (window.EVViz, loaded before app.js; app.js calls them with its figures)
css/style.css  The winch/towing tools' base (header, pill, colours) + this tool's section, then the "deep space finish" block at the end
tests/         index.html + calc.test.js; run.ps1 runs them in headless Edge
```

## Cache-busting

GitHub Pages serves files with `max-age=600`, so after a deploy a browser can pair the new `index.html` with an old cached script (on 2026-10-13 that left the new highway "why" panel empty for the owner). `index.html` loads every CSS/JS file with `?v=<date><letter>`: **bump all seven together whenever any of them changes** (a stale cached app.js is easy to miss: on 2026-10-19 it hid the new diagrams in the preview).

## Preview and test

- Open `index.html` from disk, or `python -m http.server`.
- Tests: `powershell -ExecutionPolicy Bypass -File tests\run.ps1`.
- Headless Edge won't render narrower than about 490 px; to check 390 px, screenshot a `*.tmp.html` page (gitignored) that iframes `index.html` at 390 px. Edge's `--screenshot` returns before the file is written: wait a few seconds before reading it.

## Conventions

- Same header as the other tools (`.brand-bar`, "← More PsyPhin tools" pill to `https://psyphin.co.za/#tools`). Favicons and `logo.jpg` are copies from the winch tool; change them together.
- **Look** ("deep space", since 2026-10-19, owner's request: the same as psyphin.co.za, the fuel site and the towing checker): navy `--bg`, Sora for headings, cyan accent, the circuit board from `js/circuit.js`. Like the towing checker, **nothing moves behind the text** (the owner found it distracting there): `<html data-circuit="still">` draws the board once, dimmed, and the blue/violet light doesn't drift. The header (`brand-bar--hero`) has `js/fx.js`'s animation on `canvas.hero-fx` (owner's choice): a four-cylinder petrol engine (pistons on a turning crank, each cylinder flashing as it fires in order 1-3-4-2, valves, exhaust puffs) beside an EV traction motor in cutaway (both in the same blue since 2026-10-19, owner's request; drawn from a reference picture the owner sent: a laminated stator drum seen three-quarter on, copper windings round its front face lighting up in turn, the rotor spinning with bright swirls, the shaft towards you, blue arcs crackling round the windings, the inverter on top with high-voltage cables carrying current). No figures; faint behind the text on narrow screens; still under prefers-reduced-motion. Everything else is in the **"deep space finish" block at the end of style.css, inside `@media screen`**: glass fieldsets and cards with HUD corner brackets, glowing section numbers and titles, fuel/EV tiles glowing in their colours, gradient chips, a glow on the entry being typed in, glowing chart lines, and one-off fade-ins.
- **Animated diagrams** (since 2026-10-19, owner's request), `js/viz.js`, all from app.js's figures (nothing worked out there). Each keeps one canvas in its box (re-attached if app.js clears the box), so a change animates from where it was: **race** (`#race`, top of "Cost per 100 km": the two cars drive 100 km in the same time on a track measured in rand (owner: a distance axis meant nothing when both go 100 km), so each moves at the rate it spends and stops at its own cost per 100 km, rand meters counting, the saving at the finish; plays when scrolled into view and again 0.8 s after the figures stop changing); **trip** (replaces the SVG in "Battery along the way": the battery line drawn as the car drives it, pausing to charge at each stop with a callout of that stop's kWh, minutes and rand, worked out from the profile points and the same losses / N3 price / charger kW as calc.js; **loops while on screen**, the only continuous animation besides the header); **jar** (`#keep-jar`, above the monthly stack: the saving poured into a jar the size of the instalment, "covers N%", drips down the outside if it covers it all; hidden with no instalment); **payback** (replaces the SVG in "Buying outright": the cost lines drawn across the years, a glowing marker and callout at the break-even). Under prefers-reduced-motion each is drawn finished. The old SVG drawing in `drawTrip()` / `drawOwnership()` remains as the fallback without viz.js. The tag `before-redesign` marks the state before.
- Inputs are blue boxes with a pencil; worked-out figures are plain. Fuel car = orange (`--fuel`), EV = blue (`--ev`) everywhere.
- GoatCounter tag with the host-prefix snippet, as on the other tools.
- Brand is written **PsyPhin**. Commit identity: `74655215+psyphin234@users.noreply.github.com`. The repo will be public: no personal names or private notes in committed files.

## Ideas not done yet

- CO₂ comparison (needs a citable Eskom grid emission factor).
- Time-of-use (Homeflex) peak/off-peak split for home charging.
- Model-specific EV presets from makers' WLTP figures.

## Search (SEO)

**Common questions** (since 2026-10-14): a `#faq` block of five `<details class="faq-item">` between Good to know and the sources, for the words people search. The text is static (it repeats Good to know) except the charging-price answer, which `buildSources()` fills from `D.tariffs`, so it follows price updates. To remove it, revert that commit (`git revert`; the tag `before-faq` marks the state before).


Set up 2026-10-13, following the [Runbook: SEO for Small Sites & Tools](https://claude.ai/code/artifact/0e4d5503-7f20-4cb5-a25b-840f4caa3545). The `<title>` leads with the tool's name and adds the words people search for; the meta description is at most 155 characters (Google cuts the rest). The page has a `WebApplication` JSON-LD block (keep its description the same as the meta description). The fuel site's footer links here. `robots.txt` and `sitemap.xml` are at the site root: **update the sitemap's `lastmod` when a page's content changes.** Indexable since 2026-10-14 (the `noindex` meta tag was removed).
