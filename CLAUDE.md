# EV vs Fuel Cost

Static calculator comparing the cost of driving electric vs petrol/diesel in South Africa, part of the PsyPhin site. Started 2026-10-13 at the owner's request ("must be useful to current drivers and prospective buyers"; defaults filled in for a quick comparison, all changeable).

Repo `psyphin234/ev-cost` (public), GitHub Pages from `main` / root. Push to `main` to deploy; check with `gh api repos/psyphin234/ev-cost/pages/builds/latest`.

**Address: https://evcost.psyphin.co.za/** since 2026-10-13 (the `CNAME` file here, plus the Afrihost CNAME `evcost.psyphin.co.za` → `psyphin234.github.io`). Card on psyphin.co.za (Tools, amber "In testing") since 2026-10-13; its image, `assets/img/projects/ev-cost.jpg` there, is a crop of this page's "Cost per 100 km" card at the default figures (900 px window, 2x) and is also this page's Open Graph image.

Plain HTML/CSS/vanilla JS, classic scripts, no build step: `index.html` opens straight from disk. Inputs are kept in the visitor's `localStorage` (key `ev-cost-v1`).

**Status: new.** The amber `.construction` banner and `<meta name="robots" content="noindex">` stay until the owner says otherwise.

## Prices

- **Fuel is live:** `app.js` fetches `https://fuel.psyphin.co.za/data/status.json` (the BFP_Website repo's hourly output; GitHub Pages sends `Access-Control-Allow-Origin: *`). It reads `latest_official_report.current_price` (c/l, Gauteng = inland) and `predictions.<fuel>.predicted_pump_price_change_c_per_l` for the "Next month" card. Coastal = inland − `liveFeed.coastalGap` (R0.87 in Oct 2026, the same gap for 95 and diesel). If the fetch fails, `fuelFallback` in data.js is used: **update it each month** (first Wednesday) along with `checked`. If the fuel site's JSON shape changes, update `fetchLive()` here.
- Diesel is the regulated **wholesale** price (pump prices are set by retailers); the page says so.
- Electricity and charging defaults, each with its source in `data.js`: Eskom Homepower 4 R3.56/kWh (MyBroadband, 5 Oct 2026), metro R4.50 (middle of Tshwane's R4–5), GridCars AC R5.88 / DC R7.35. CHARGE (formerly Zero Carbon Charge) hasn't published its N3 tariff (Reitz exit 107, Tugela exit 207, opened May 2026), so the highway price defaults to GridCars' DC rate and the page says so.
- Car-size presets, car prices, servicing, charger cost and the 20% highway extra are **example figures, not from a source**, and the page labels them that way. Keep it like that unless a citable figure is found.

## How it works out (calc.js)

- An EV figure is either **spec-sheet (WLTP)**, measured at the wall so it already includes charging losses, or **trip computer**, measured at the battery, so losses are added. `evPer100()` returns both sides: `wall` (what you pay for) and `battery` (what range uses).
- Trip: battery use = battery-side consumption × (1 + highway %). Leaves home at the start %, drives to the reserve, then each stop charges reserve → charge-to %; the last stop only takes enough to arrive on the reserve. Billed kWh = battery kWh ÷ (1 − losses). Charging time = kWh ÷ average kW.
- Ownership: year 0 = prices (+ home charger for the EV); each year adds energy (with the yearly rises compounding) + servicing; break-even is interpolated between years. Insurance, finance and resale are left out (the page says so).

## Structure

```
index.html     The page: 1 everyday driving, 2 road trip, 3 thinking of buying, 4 good to know, sources, disclaimer
js/data.js     THE data file: sources, fuel fallback, live feed settings, tariffs, size presets, routes, N3 chargers, defaults, assumptions
js/calc.js     Pure calculations (no DOM): evPer100, running, trip, tripProfile, ownership
js/app.js      State + localStorage, live fuel fetch, inputs, rendering, the two SVG charts, the sources section, the phones' bottom bar
css/style.css  The winch/towing tools' base (header, pill, colours) + this tool's section at the end
tests/         index.html + calc.test.js; run.ps1 runs them in headless Edge
```

## Preview and test

- Open `index.html` from disk, or `python -m http.server`.
- Tests: `powershell -ExecutionPolicy Bypass -File tests\run.ps1`.
- Headless Edge won't render narrower than about 490 px; to check 390 px, screenshot a `*.tmp.html` page (gitignored) that iframes `index.html` at 390 px. Edge's `--screenshot` returns before the file is written: wait a few seconds before reading it.

## Conventions

- Same header as the other tools (`.brand-bar`, "← More PsyPhin tools" pill to `https://psyphin.co.za/#tools`). Favicons and `logo.jpg` are copies from the winch tool; change them together.
- Inputs are blue boxes with a pencil; worked-out figures are plain. Fuel car = orange (`--fuel`), EV = blue (`--ev`) everywhere.
- GoatCounter tag with the host-prefix snippet, as on the other tools.
- Brand is written **PsyPhin**. Commit identity: `74655215+psyphin234@users.noreply.github.com`. The repo will be public: no personal names or private notes in committed files.

## Ideas not done yet

- CO₂ comparison (needs a citable Eskom grid emission factor).
- Time-of-use (Homeflex) peak/off-peak split for home charging.
- Model-specific EV presets from makers' WLTP figures.
