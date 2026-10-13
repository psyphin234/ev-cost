/* EV vs Fuel Cost: pure calculations (no DOM). Prices R incl. VAT, energy kWh, distance km. */
window.Calc = (function () {
  "use strict";

  function clamp(v, lo, hi) {
    return Math.min(hi, Math.max(lo, v));
  }

  /* An EV figure is either from the spec sheet (WLTP: measured at the wall,
     losses included) or from the car's own display (what the battery gave).
     Returns both sides: wall = what you pay for, battery = what range uses. */
  function evPer100(kwhPer100, figureFrom, lossPct) {
    var keep = 1 - clamp(lossPct, 0, 50) / 100;
    if (figureFrom === "dash") return { wall: kwhPer100 / keep, battery: kwhPer100 };
    return { wall: kwhPer100, battery: kwhPer100 * keep };
  }

  /* Charging mix: shares in any units, normalised to 1. All zero = all at home. */
  function normaliseMix(home, ac, dc) {
    home = Math.max(0, home || 0);
    ac = Math.max(0, ac || 0);
    dc = Math.max(0, dc || 0);
    var sum = home + ac + dc;
    if (sum <= 0) return { home: 1, ac: 0, dc: 0 };
    return { home: home / sum, ac: ac / sum, dc: dc / sum };
  }

  function mixPrice(prices, mix) {
    return prices.home * mix.home + prices.ac * mix.ac + prices.dc * mix.dc;
  }

  /* Everyday running costs. s: lPer100, fuelPrice, kwhPer100, figureFrom, lossPct,
     homePrice, acPrice, dcPrice, mixHome, mixAc, mixDc, kmMonth */
  function running(s) {
    var ev = evPer100(s.kwhPer100, s.figureFrom, s.lossPct);
    var mix = normaliseMix(s.mixHome, s.mixAc, s.mixDc);
    var perKwh = mixPrice({ home: s.homePrice, ac: s.acPrice, dc: s.dcPrice }, mix);
    var fuel100 = s.lPer100 * s.fuelPrice;
    var ev100 = ev.wall * perKwh;
    var kmMonth = Math.max(0, s.kmMonth);
    var r = {
      mix: mix,
      evWallPer100: ev.wall,
      evBatteryPer100: ev.battery,
      mixPerKwh: perKwh,
      fuel100: fuel100,
      ev100: ev100,
      fuelPerKm: fuel100 / 100,
      evPerKm: ev100 / 100,
      fuelMonth: fuel100 / 100 * kmMonth,
      evMonth: ev100 / 100 * kmMonth,
      by: {
        home: ev.wall * s.homePrice,
        ac: ev.wall * s.acPrice,
        dc: ev.wall * s.dcPrice
      }
    };
    r.saveMonth = r.fuelMonth - r.evMonth;
    r.saveYear = r.saveMonth * 12;
    r.ratio = fuel100 > 0 ? ev100 / fuel100 : null;
    // EV cost per 100 km expressed as a fuel price for this fuel car
    r.equivFuelPrice = s.lPer100 > 0 ? ev100 / s.lPer100 : null;
    r.equivFuelPriceHome = s.lPer100 > 0 ? r.by.home / s.lPer100 : null;
    // the electricity price at which the EV costs the same per km as the fuel car
    r.breakEvenKwh = ev.wall > 0 ? fuel100 / ev.wall : null;
    // the fuel price at which the fuel car costs the same as the EV on this mix
    r.breakEvenFuel = r.equivFuelPrice;
    return r;
  }

  /* Road trip. s: km, returnTrip, battery, startPct, reservePct, chargeToPct, highwayPct,
     dcKw, kwhPer100, figureFrom, lossPct, homePrice, n3Price, lPer100, fuelPrice */
  function trip(s) {
    var ev = evPer100(s.kwhPer100, s.figureFrom, s.lossPct);
    var keep = 1 - clamp(s.lossPct, 0, 50) / 100;
    var km = Math.max(0, s.km) * (s.returnTrip ? 2 : 1);
    var perKm = ev.battery * (1 + Math.max(0, s.highwayPct) / 100) / 100; // battery kWh per km at highway speed
    var bat = Math.max(0, s.battery);
    var start = clamp(s.startPct, 0, 100);
    var reserve = clamp(s.reservePct, 0, 100);
    var chargeTo = clamp(s.chargeToPct, 0, 100);
    var need = km * perKm;
    var avail = Math.max(0, bat * (start - reserve) / 100);
    var perStop = Math.max(0, bat * (chargeTo - reserve) / 100);
    var r = {
      km: km,
      need: need,
      perKm: perKm,
      rangeFirst: perKm > 0 ? avail / perKm : 0,
      rangePerStop: perKm > 0 ? perStop / perKm : 0,
      stops: 0,
      homeKwh: 0,
      dcKwh: 0,
      possible: true,
      stopsAt: []
    };
    if (need <= avail) {
      r.homeKwh = need;
    } else if (perStop <= 0 || perKm <= 0) {
      r.homeKwh = avail;
      r.possible = false;
    } else {
      r.homeKwh = avail;
      r.dcKwh = need - avail;
      r.stops = Math.ceil(r.dcKwh / perStop - 1e-9);
      for (var i = 0; i < r.stops; i++) r.stopsAt.push(r.rangeFirst + i * r.rangePerStop);
    }
    // billed energy is what left the wall: battery energy over the charging efficiency
    r.homeCost = r.homeKwh / keep * s.homePrice;
    r.dcCost = r.dcKwh / keep * s.n3Price;
    r.evCost = r.homeCost + r.dcCost;
    r.allDcCost = need / keep * s.n3Price;
    r.chargeMinutes = s.dcKw > 0 ? r.dcKwh / s.dcKw * 60 : 0;
    r.fuelLitres = km * s.lPer100 / 100;
    r.fuelCost = r.fuelLitres * s.fuelPrice;
    // the last stop only takes enough to arrive with the reserve
    r.arrivePct = bat > 0 ? (r.stops ? reserve : start - need / bat * 100) : 0;
    return r;
  }

  /* Battery level along the trip, for the chart: [{km, pct}] with a jump at each stop. */
  function tripProfile(s, t) {
    var bat = Math.max(0, s.battery);
    if (!bat || !t.perKm) return [];
    var pts = [{ km: 0, pct: s.startPct }];
    var pctPerKm = t.perKm / bat * 100;
    var pct = s.startPct;
    var at = 0;
    t.stopsAt.forEach(function (stopKm, i) {
      pct -= (stopKm - at) * pctPerKm;
      pts.push({ km: stopKm, pct: pct });
      // the last stop only needs enough to arrive with the reserve
      var remaining = t.km - stopKm;
      var target = i === t.stopsAt.length - 1 ? Math.min(s.chargeToPct, s.reservePct + remaining * pctPerKm) : s.chargeToPct;
      pct = target;
      pts.push({ km: stopKm, pct: pct, stop: true });
      at = stopKm;
    });
    pct -= (t.km - at) * pctPerKm;
    pts.push({ km: t.km, pct: pct });
    return pts;
  }

  /* Ownership over the years. s: evPrice, fuelCarPrice, years, evService, fuelService,
     chargerCost, fuelRise, elecRise, kmMonth; run = running(s). Returns cumulative totals per year. */
  function ownership(s, run) {
    var years = clamp(Math.round(s.years), 1, 15);
    var kmYear = Math.max(0, s.kmMonth) * 12;
    var ev = [s.evPrice + s.chargerCost];
    var fuel = [s.fuelCarPrice];
    var evEnergy = 0;
    var fuelEnergy = 0;
    for (var y = 1; y <= years; y++) {
      var fe = run.fuelPerKm * kmYear * Math.pow(1 + s.fuelRise / 100, y - 1);
      var ee = run.evPerKm * kmYear * Math.pow(1 + s.elecRise / 100, y - 1);
      fuelEnergy += fe;
      evEnergy += ee;
      fuel.push(fuel[y - 1] + fe + s.fuelService);
      ev.push(ev[y - 1] + ee + s.evService);
    }
    // first point where the EV's running total drops to the fuel car's (linear between years)
    var breakEven = null;
    if (ev[0] <= fuel[0]) breakEven = 0;
    else {
      for (var i = 1; i <= years; i++) {
        var d0 = ev[i - 1] - fuel[i - 1];
        var d1 = ev[i] - fuel[i];
        if (d1 <= 0) {
          breakEven = i - 1 + d0 / (d0 - d1);
          break;
        }
      }
    }
    // beyond the chart: years to pay back at the first year's saving rate (rough)
    var yearlySave = (run.fuelPerKm - run.evPerKm) * kmYear + s.fuelService - s.evService;
    var premium = ev[0] - fuel[0];
    return {
      years: years,
      ev: ev,
      fuel: fuel,
      evEnergy: evEnergy,
      fuelEnergy: fuelEnergy,
      breakEven: breakEven,
      roughPayback: premium > 0 && yearlySave > 0 ? premium / yearlySave : null,
      premium: premium,
      difference: fuel[years] - ev[years]
    };
  }

  return {
    clamp: clamp,
    evPer100: evPer100,
    normaliseMix: normaliseMix,
    mixPrice: mixPrice,
    running: running,
    trip: trip,
    tripProfile: tripProfile,
    ownership: ownership
  };
})();
