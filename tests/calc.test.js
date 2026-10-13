/*
 * Tests for data.js and calc.js. Runs in the browser via tests/index.html
 * (open it, or run tests/run.ps1 for a headless run).
 */
(function () {
  "use strict";

  const D = window.EV;
  const C = window.Calc;
  const results = [];
  window.addEventListener("error", (e) => {
    document.getElementById("summary").textContent = "FAILED: script error: " + e.message;
  });

  function test(name, fn) {
    try {
      fn();
      results.push({ name, ok: true });
    } catch (e) {
      results.push({ name, ok: false, error: e.message });
    }
  }

  function eq(actual, expected, what) {
    if (actual !== expected) throw new Error(`${what || "value"}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }

  function near(actual, expected, tol, what) {
    if (!(Math.abs(actual - expected) <= tol)) throw new Error(`${what || "value"}: expected ${expected} ± ${tol}, got ${actual}`);
  }

  const base = Object.assign({}, D.defaults, { fuelPrice: 30.25 });

  // ------------------------------------------------------------ data
  test("every source referenced exists", () => {
    const refs = [D.fuelFallback.source, D.tariffs.publicAc.source, D.tariffs.publicDc.source, D.tariffs.n3Dc.source]
      .concat(D.tariffs.home.map((t) => t.source), D.tariffs.examples.map((t) => t.source),
        D.n3Chargers.map((c) => c.source), D.assumptions.map((a) => a.source));
    refs.filter(Boolean).forEach((id) => {
      if (!D.sources[id]) throw new Error("unknown source " + id);
    });
  });

  test("defaults match the presets they name", () => {
    const cls = D.classes.find((c) => c.id === D.defaults.sizeClass);
    eq(D.defaults.lPer100, cls.lPer100, "l/100");
    eq(D.defaults.kwhPer100, cls.kwhPer100, "kWh/100");
    eq(D.defaults.battery, cls.battery, "battery");
    eq(D.defaults.homePrice, D.tariffs.home.find((t) => t.id === D.defaults.homeTariff).value, "home price");
    eq(D.defaults.tripKm, D.routes.find((r) => r.id === D.defaults.route).km, "route km");
    eq(D.defaults.dcPrice, D.tariffs.publicDc.value, "dc");
    eq(D.defaults.acPrice, D.tariffs.publicAc.value, "ac");
  });

  // ------------------------------------------------------------ everyday
  test("fuel cost per 100 km = litres x price", () => {
    const r = C.running(Object.assign({}, base, { lPer100: 8, fuelPrice: 30 }));
    near(r.fuel100, 240, 1e-9);
    near(r.fuelMonth, 240 * base.kmMonth / 100, 1e-6);
  });

  test("WLTP figure is at the wall: no losses added; dash figure gets them", () => {
    const spec = C.evPer100(18, "spec", 10);
    near(spec.wall, 18, 1e-9, "spec wall");
    near(spec.battery, 16.2, 1e-9, "spec battery");
    const dash = C.evPer100(18, "dash", 10);
    near(dash.battery, 18, 1e-9, "dash battery");
    near(dash.wall, 20, 1e-9, "dash wall");
  });

  test("charging mix weights the prices and normalises", () => {
    const m = C.normaliseMix(2, 1, 1);
    near(m.home, 0.5, 1e-9);
    near(C.mixPrice({ home: 4, ac: 6, dc: 8 }, m), 5.5, 1e-9);
    eq(C.normaliseMix(0, 0, 0).home, 1, "empty mix = home");
  });

  test("break-even electricity price makes the two equal", () => {
    const s = Object.assign({}, base, { mixHome: 100, mixAc: 0, mixDc: 0 });
    const r = C.running(s);
    const r2 = C.running(Object.assign({}, s, { homePrice: r.breakEvenKwh }));
    near(r2.ev100, r2.fuel100, 1e-6);
  });

  test("equivalent fuel price: the fuel car at that price costs what the EV does", () => {
    const r = C.running(base);
    const r2 = C.running(Object.assign({}, base, { fuelPrice: r.equivFuelPrice }));
    near(r2.fuel100, r.ev100, 1e-6);
  });

  // ------------------------------------------------------------ trip
  const tripBase = {
    km: 570, returnTrip: false, battery: 60, startPct: 100, reservePct: 10, chargeToPct: 80,
    highwayPct: 20, dcKw: 60, kwhPer100: 17, figureFrom: "dash", lossPct: 10,
    homePrice: 3.56, n3Price: 7.35, lPer100: 7.5, fuelPrice: 30.25
  };

  test("trip: energy, stops and costs add up", () => {
    const t = C.trip(tripBase);
    near(t.need, 570 * 0.17 * 1.2, 1e-9, "battery kWh");
    near(t.homeKwh, 54, 1e-9, "from home: 100% to 10% of 60");
    near(t.dcKwh, t.need - 54, 1e-9, "bought on the road");
    eq(t.stops, 2, "two stops (62.3 kWh to buy, each stop adds 42 kWh)");
    near(t.evCost, 54 / 0.9 * 3.56 + t.dcKwh / 0.9 * 7.35, 1e-9, "cost");
    near(t.fuelCost, 5.7 * 7.5 * 30.25, 1e-9, "fuel");
    near(t.arrivePct, 10, 1e-9, "arrive on the reserve");
  });

  test("trip: short trip needs no stop", () => {
    const t = C.trip(Object.assign({}, tripBase, { km: 40 }));
    eq(t.stops, 0);
    eq(t.dcKwh, 0);
    near(t.arrivePct, 100 - 40 * 0.204 / 60 * 100, 1e-9);
  });

  test("trip: long trip needs several stops; return doubles it", () => {
    const one = C.trip(Object.assign({}, tripBase, { km: 1400 }));
    const back = C.trip(Object.assign({}, tripBase, { returnTrip: true }));
    near(back.km, 1140, 1e-9);
    eq(one.stops, Math.ceil((1400 * 0.204 - 54) / 42));
  });

  test("trip profile starts at the start level and ends on the arrival level", () => {
    const t = C.trip(tripBase);
    const p = C.tripProfile(tripBase, t);
    near(p[0].pct, 100, 1e-9);
    near(p[p.length - 1].pct, 10, 1e-6, "arrives on reserve");
    eq(p.filter((x) => x.stop).length, t.stops, "stops drawn");
  });

  test("trip: no battery to use is reported, not divided by zero", () => {
    const t = C.trip(Object.assign({}, tripBase, { chargeToPct: 10 }));
    eq(t.possible, false);
  });

  // ------------------------------------------------------------ ownership
  test("ownership: cumulative totals and break-even", () => {
    const s = Object.assign({}, base, {
      evPrice: 120000, fuelCarPrice: 100000, chargerCost: 0, evService: 0, fuelService: 0,
      fuelRise: 0, elecRise: 0, years: 5, kmMonth: 1000
    });
    const run = { fuelPerKm: 2, evPerKm: 0.5 };
    const o = C.ownership(s, run);
    eq(o.ev.length, 6);
    near(o.fuel[1] - o.fuel[0], 24000, 1e-6, "fuel year 1");
    near(o.ev[1] - o.ev[0], 6000, 1e-6, "ev year 1");
    near(o.breakEven, 20000 / 18000, 1e-9, "pays back in 1.11 years");
  });

  test("ownership: rising prices compound", () => {
    const s = Object.assign({}, base, {
      evPrice: 0, fuelCarPrice: 0, chargerCost: 0, evService: 0, fuelService: 0,
      fuelRise: 10, elecRise: 0, years: 2, kmMonth: 100
    });
    const o = C.ownership(s, { fuelPerKm: 1, evPerKm: 1 });
    near(o.fuel[2] - o.fuel[1], 1320, 1e-9, "second year +10%");
  });

  // ------------------------------------------------------------ report
  const failed = results.filter((r) => !r.ok);
  const list = document.getElementById("results");
  results.forEach((r) => {
    const li = document.createElement("li");
    li.className = r.ok ? "ok" : "bad";
    li.textContent = (r.ok ? "PASS  " : "FAIL  ") + r.name + (r.ok ? "" : "  -> " + r.error);
    list.appendChild(li);
  });
  document.getElementById("summary").textContent = failed.length
    ? `FAILED: ${failed.length} of ${results.length} tests`
    : `ALL PASSED: ${results.length} tests`;
})();
