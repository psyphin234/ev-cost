# EV vs Fuel Cost

**New, being checked.** A static calculator for South African drivers and EV buyers: what it costs per kilometre to drive electric versus petrol or diesel.

- **Everyday driving:** today's official fuel price (live from [SA Fuel Price Preview](https://fuel.psyphin.co.za/)), home electricity, public AC and fast DC prices, and a home / AC / DC charging mix. Shows the cost per month and per 100 km, the electricity price at which the EV stops being cheaper, what home charging works out to per litre of fuel, and next month's projected fuel price change.
- **Road trip:** N3 and other routes: charging stops, time plugged in, a battery-level chart, and the N3's CHARGE fast-charging sites.
- **Keep your car, or finance an EV?:** can the fuel saving pay the EV's monthly instalment? The instalment is worked out from price, deposit, interest and term, or typed from a quote. Shows how much of it the savings cover, the biggest instalment (and car price) they would cover, and the distance a month at which it pays.
- **Buying outright: total cost:** purchase price, home charger, servicing and yearly price rises, giving a break-even year and the total over the years you keep the car.

Everything runs in the browser; inputs stay in the visitor's own `localStorage`. Open `index.html`. Tests: `powershell -ExecutionPolicy Bypass -File tests\run.ps1`.

Part of [PsyPhin](https://psyphin.co.za/).
