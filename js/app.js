/* EV vs Fuel Cost: state, inputs, live fuel price, rendering. */
(function () {
  "use strict";

  var D = window.EV;
  var C = window.Calc;
  var STORE = "ev-cost-v1";
  var SVGNS = "http://www.w3.org/2000/svg";

  function $(id) {
    return document.getElementById(id);
  }

  /* ------------------------------------------------------------ formatting */
  var NB = " ";

  function groupThousands(s) {
    return s.replace(/\B(?=(\d{3})+(?!\d))/g, NB);
  }

  // R1 234 (whole rand) or R30.25 (with cents)
  function rand(v, cents) {
    if (v == null || !isFinite(v)) return "–";
    var neg = v < 0;
    v = Math.abs(v);
    var s = cents ? v.toFixed(2) : String(Math.round(v));
    var parts = s.split(".");
    return (neg ? "−" : "") + "R" + groupThousands(parts[0]) + (parts[1] ? "." + parts[1] : "");
  }

  function num(v, dp) {
    if (v == null || !isFinite(v)) return "–";
    var s = v.toFixed(dp || 0).split(".");
    return groupThousands(s[0]) + (s[1] ? "." + s[1] : "");
  }

  function pct(v) {
    return Math.round(v * 100) + "%";
  }

  function el(tag, attrs, children) {
    var e = document.createElement(tag);
    if (attrs) {
      Object.keys(attrs).forEach(function (k) {
        if (k === "text") e.textContent = attrs[k];
        else if (k === "class") e.className = attrs[k];
        else e.setAttribute(k, attrs[k]);
      });
    }
    (children || []).forEach(function (c) {
      if (c == null) return;
      e.appendChild(typeof c === "string" ? document.createTextNode(c) : c);
    });
    return e;
  }

  function svg(tag, attrs, text) {
    var e = document.createElementNS(SVGNS, tag);
    Object.keys(attrs || {}).forEach(function (k) {
      e.setAttribute(k, attrs[k]);
    });
    if (text != null) e.textContent = text;
    return e;
  }

  function clear(node) {
    while (node.firstChild) node.removeChild(node.firstChild);
    return node;
  }

  function sourceLink(id) {
    if (Array.isArray(id)) {
      var span = el("span");
      id.forEach(function (one, i) {
        if (i) span.appendChild(document.createTextNode(" · "));
        span.appendChild(sourceLink(one));
      });
      return span;
    }
    var s = D.sources[id];
    if (!s) return null;
    return el("a", { href: s.url, target: "_blank", rel: "noopener", text: s.publisher + " ↗" });
  }

  /* ------------------------------------------------------------ state */
  var state = load();
  var live = null; // { inland: {petrol95,...}, effective, change: {petrol95: c/l, ...} }
  var liveStatus = "loading"; // loading | ok | failed

  function load() {
    var s = JSON.parse(JSON.stringify(D.defaults));
    try {
      var saved = JSON.parse(localStorage.getItem(STORE) || "null");
      if (saved && typeof saved === "object") {
        Object.keys(s).forEach(function (k) {
          if (k in saved && typeof saved[k] === typeof s[k]) s[k] = saved[k];
          else if ((k === "fuelPrice" || k === "instalment") && typeof saved[k] === "number") s[k] = saved[k];
        });
      }
    } catch (e) { /* storage blocked: use defaults */ }
    return s;
  }

  function save() {
    try {
      localStorage.setItem(STORE, JSON.stringify(state));
    } catch (e) { /* ignore */ }
  }

  function prices() {
    if (live) {
      var p = live.inland;
      var gap = D.liveFeed.coastalGap;
      return {
        inland: p,
        coastal: { petrol95: p.petrol95 - gap, petrol93: p.petrol93 - gap, diesel005: p.diesel005 - gap },
        effective: live.effective,
        live: true
      };
    }
    return { inland: D.fuelFallback.inland, coastal: D.fuelFallback.coastal, effective: D.fuelFallback.effective, live: false };
  }

  function currentFuelPrice() {
    return prices()[state.region][state.fuel];
  }

  function fuelPrice() {
    return typeof state.fuelPrice === "number" ? state.fuelPrice : currentFuelPrice();
  }

  /* ------------------------------------------------------------ live fuel price from fuel.psyphin.co.za */
  function fetchLive() {
    var ctrl = window.AbortController ? new AbortController() : null;
    var timer = setTimeout(function () {
      if (ctrl) ctrl.abort();
    }, 8000);
    fetch(D.liveFeed.url, { cache: "no-cache", signal: ctrl ? ctrl.signal : undefined })
      .then(function (r) {
        if (!r.ok) throw new Error("HTTP " + r.status);
        return r.json();
      })
      .then(function (j) {
        clearTimeout(timer);
        var rep = j.latest_official_report;
        var cur = rep && rep.current_price;
        if (!cur || !(cur.petrol95 > 1000)) throw new Error("no prices");
        var inland = {};
        var change = {};
        Object.keys(D.liveFeed.fuels).forEach(function (k) {
          var key = D.liveFeed.fuels[k];
          inland[k] = Math.round(cur[key]) / 100;
          var pr = j.predictions && j.predictions[key];
          if (pr && isFinite(pr.predicted_pump_price_change_c_per_l)) change[k] = pr.predicted_pump_price_change_c_per_l;
        });
        live = { inland: inland, effective: rep.pump_price_effective, change: change };
        liveStatus = "ok";
        render();
      })
      .catch(function () {
        clearTimeout(timer);
        live = null;
        liveStatus = "failed";
        render();
      });
  }

  function longDate(iso) {
    var d = new Date(iso + "T12:00:00");
    if (isNaN(d)) return iso;
    return d.toLocaleDateString("en-ZA", { day: "numeric", month: "long", year: "numeric" });
  }

  /* ------------------------------------------------------------ building controls */
  function chip(label, attrs, onClick) {
    var b = el("button", Object.assign({ type: "button", class: "chip" }, attrs || {}), [label]);
    b.addEventListener("click", onClick);
    return b;
  }

  function build() {
    var cc = $("class-chips");
    D.classes.forEach(function (c) {
      cc.appendChild(chip(c.label, { "data-class": c.id }, function () {
        state.sizeClass = c.id;
        state.lPer100 = c.lPer100;
        state.kwhPer100 = c.kwhPer100;
        state.battery = c.battery;
        state.fuel = c.fuel;
        state.figureFrom = "spec";
        state.fuelPrice = null;
        changed();
      }));
    });

    var fc = $("fuel-chips");
    Object.keys(D.fuels).forEach(function (k) {
      fc.appendChild(chip(D.fuels[k].label, { "data-fuel": k }, function () {
        state.fuel = k;
        state.fuelPrice = null;
        changed();
      }));
    });

    document.querySelectorAll("#region-chips .chip").forEach(function (b) {
      b.addEventListener("click", function () {
        state.region = b.getAttribute("data-region");
        state.fuelPrice = null;
        changed();
      });
    });

    document.querySelectorAll("[data-figure]").forEach(function (b) {
      b.addEventListener("click", function () {
        state.figureFrom = b.getAttribute("data-figure");
        changed();
      });
    });

    var hc = $("home-chips");
    D.tariffs.home.forEach(function (t) {
      hc.appendChild(chip(t.label + " " + rand(t.value, true), { "data-home": t.id }, function () {
        state.homeTariff = t.id;
        state.homePrice = t.value;
        changed();
      }));
    });

    document.querySelectorAll("#mix-chips .chip").forEach(function (b) {
      b.addEventListener("click", function () {
        var m = b.getAttribute("data-mix").split(",").map(Number);
        state.mixHome = m[0];
        state.mixAc = m[1];
        state.mixDc = m[2];
        changed();
      });
    });

    var rc = $("route-chips");
    D.routes.forEach(function (r) {
      rc.appendChild(chip(r.label, { "data-route": r.id }, function () {
        state.route = r.id;
        state.tripKm = r.km;
        changed();
      }));
    });

    // number inputs: id = state key
    ["kmMonth", "fuelPrice", "lPer100", "kwhPer100", "lossPct", "homePrice", "acPrice", "dcPrice",
      "tripKm", "battery", "highwayPct", "startPct", "chargeToPct", "reservePct", "n3Price", "dcKw",
      "evPrice", "fuelCarPrice", "chargerCost", "evService", "fuelService", "years", "fuelRise", "elecRise",
      "instalment", "finPrice", "finDeposit", "finRate", "finMonths", "finBalloon", "oldRepairsMonth", "evServiceMonth", "evIns"
    ].forEach(function (id) {
      var input = $(id);
      var k = id === "finPrice" ? "evPrice" : id; // the EV price box appears in two sections
      input.addEventListener("input", function () {
        var v = parseFloat(input.value.replace(",", "."));
        if (!isFinite(v)) {
          if (k === "fuelPrice" || k === "instalment") state[k] = null;
          return;
        }
        state[k] = v;
        if (k === "homePrice") state.homeTariff = matchTariff(v);
        if (k === "lPer100" || k === "kwhPer100") state.sizeClass = "";
        if (k === "tripKm") state.route = "";
        changed(id);
      });
      input.addEventListener("blur", function () {
        render();
      });
    });

    $("returnTrip").addEventListener("change", function () {
      state.returnTrip = $("returnTrip").checked;
      changed();
    });

    // the three mix sliders always add up to 100: moving one shares the rest between the others in proportion
    var mixKeys = ["mixHome", "mixAc", "mixDc"];
    mixKeys.forEach(function (k) {
      $(k).addEventListener("input", function () {
        var v = Number($(k).value);
        var others = mixKeys.filter(function (o) { return o !== k; });
        var rest = 100 - v;
        var a = state[others[0]];
        var b = state[others[1]];
        if (a + b <= 0) {
          a = 1;
          b = 1;
        }
        var na = Math.round(rest * a / (a + b) / 5) * 5;
        state[k] = v;
        state[others[0]] = na;
        state[others[1]] = rest - na;
        changed(k);
      });
    });

    $("reset").addEventListener("click", function () {
      state = JSON.parse(JSON.stringify(D.defaults));
      try { localStorage.removeItem(STORE); } catch (e) { /* ignore */ }
      render();
    });

    $("year").textContent = new Date().getFullYear();
    buildHighwayWhy();
    buildSources();
  }

  function matchTariff(v) {
    var t = D.tariffs.home.filter(function (h) { return Math.abs(h.value - v) < 0.005; })[0];
    return t ? t.id : "";
  }

  var editing = null;
  function changed(fromInput) {
    editing = fromInput || null;
    save();
    render();
    editing = null;
  }

  /* ------------------------------------------------------------ render */
  function setInput(id, v, dp) {
    if (editing === id) return; // don't fight the person typing
    var input = $(id);
    if (document.activeElement === input && editing) return;
    var s = v == null || !isFinite(v) ? "" : (dp != null ? Number(v).toFixed(dp) : String(Math.round(v * 100) / 100));
    if (input.value !== s) input.value = s;
  }

  function pressed(selector, attr, value) {
    document.querySelectorAll(selector).forEach(function (b) {
      b.setAttribute("aria-pressed", String(b.getAttribute(attr) === value));
    });
  }

  function render() {
    var fp = fuelPrice();
    var s = Object.assign({}, state, { fuelPrice: fp });

    // inputs
    setInput("kmMonth", state.kmMonth);
    setInput("fuelPrice", fp, 2);
    setInput("lPer100", state.lPer100);
    setInput("kwhPer100", state.kwhPer100);
    setInput("lossPct", state.lossPct);
    setInput("homePrice", state.homePrice, 2);
    setInput("acPrice", state.acPrice, 2);
    setInput("dcPrice", state.dcPrice, 2);
    setInput("tripKm", state.tripKm);
    setInput("battery", state.battery);
    setInput("highwayPct", state.highwayPct);
    setInput("startPct", state.startPct);
    setInput("chargeToPct", state.chargeToPct);
    setInput("reservePct", state.reservePct);
    setInput("n3Price", state.n3Price, 2);
    setInput("dcKw", state.dcKw);
    setInput("evPrice", state.evPrice);
    setInput("fuelCarPrice", state.fuelCarPrice);
    setInput("chargerCost", state.chargerCost);
    setInput("evService", state.evService);
    setInput("fuelService", state.fuelService);
    setInput("years", state.years);
    setInput("fuelRise", state.fuelRise);
    setInput("elecRise", state.elecRise);
    setInput("instalment", instalmentValue());
    setInput("finPrice", state.evPrice);
    setInput("finDeposit", state.finDeposit);
    setInput("finRate", state.finRate);
    setInput("finMonths", state.finMonths);
    setInput("finBalloon", state.finBalloon);
    setInput("oldRepairsMonth", state.oldRepairsMonth);
    setInput("evServiceMonth", state.evServiceMonth);
    setInput("evIns", state.evIns);
    $("returnTrip").checked = !!state.returnTrip;
    ["mixHome", "mixAc", "mixDc"].forEach(function (k) {
      $(k).value = state[k];
      $(k + "-out").textContent = Math.round(state[k]) + "%";
    });

    pressed("#class-chips .chip", "data-class", state.sizeClass);
    pressed("#region-chips .chip", "data-region", state.region);
    pressed("#fuel-chips .chip", "data-fuel", state.fuel);
    pressed("[data-figure]", "data-figure", state.figureFrom);
    pressed("#home-chips .chip", "data-home", state.homeTariff);
    pressed("#mix-chips .chip", "data-mix", [state.mixHome, state.mixAc, state.mixDc].join(","));
    pressed("#route-chips .chip", "data-route", state.route);

    renderLiveLine();
    renderHints(fp);
    var run = C.running(s);
    renderRunning(s, run);
    renderTrip(s);
    renderKeep(s, run);
    renderOwnership(s, run);
  }

  function renderLiveLine() {
    var p = prices();
    var line = clear($("live-line"));
    var fuelLabel = D.fuels[state.fuel].label;
    if (p.live) {
      line.appendChild(el("span", { class: "live-dot", "aria-hidden": "true" }));
      line.appendChild(document.createTextNode("Today's official prices (from " + longDate(p.effective) + "): Petrol 95 " + rand(p.inland.petrol95, true) + " inland, " + rand(p.coastal.petrol95, true) + " coastal; diesel " + rand(p.inland.diesel005, true) + " wholesale. Live from "));
      line.appendChild(el("a", { href: "https://fuel.psyphin.co.za/", text: "SA Fuel Price Preview" }));
      line.appendChild(document.createTextNode("."));
    } else if (liveStatus === "loading") {
      line.textContent = "Fetching today's fuel price…";
    } else {
      line.appendChild(document.createTextNode("Couldn't reach the live fuel price, so this uses the official prices from " + longDate(p.effective) + " (" + fuelLabel + " " + rand(currentFuelPrice(), true) + "). "));
      line.appendChild(sourceLink(D.fuelFallback.source));
    }
  }

  function renderHints(fp) {
    $("km-year").textContent = num(state.kmMonth * 12) + " km a year.";

    var cur = currentFuelPrice();
    var h = clear($("fuel-price-hint"));
    var regionLabel = state.region === "inland" ? "inland" : "at the coast";
    if (typeof state.fuelPrice === "number" && Math.abs(state.fuelPrice - cur) > 0.004) {
      h.appendChild(document.createTextNode("Your price. Today's official " + D.fuels[state.fuel].label + " " + regionLabel + " is " + rand(cur, true) + ". "));
      var b = el("button", { type: "button", class: "link-button", text: "Use it" });
      b.addEventListener("click", function () {
        state.fuelPrice = null;
        changed();
      });
      h.appendChild(b);
    } else {
      h.textContent = "Today's official " + D.fuels[state.fuel].label + " " + regionLabel + (prices().live ? " (live)." : ".") + (state.fuel === "diesel005" ? " Diesel is the wholesale price; pumps charge a little more." : "");
    }

    renderEvScale();
    renderHighwayHint();

    $("figure-hint").textContent = state.figureFrom === "dash"
      ? "The trip computer shows what the battery gave, so the charging losses below are added to what you pay for."
      : "Spec-sheet (WLTP) figures are measured at the wall, so they already include charging losses: nothing extra is added to the bill. They're optimistic for real driving, though: " + realWorldText() + ".";

    var t = D.tariffs.home.filter(function (x) { return x.id === state.homeTariff; })[0];
    var hh = clear($("home-hint"));
    if (t) {
      hh.appendChild(document.createTextNode(t.note + " "));
      if (t.source) hh.appendChild(sourceLink(t.source));
    } else {
      hh.textContent = "Your price. Use your bill's price per kWh including VAT, and on a block tariff the price of your highest block: that's what the EV's extra kWh cost. Leave out fixed monthly charges: you pay them anyway.";
    }

    var mix = C.normaliseMix(state.mixHome, state.mixAc, state.mixDc);
    var bar = clear($("mix-bar"));
    [["home", "mix-seg--home"], ["ac", "mix-seg--ac"], ["dc", "mix-seg--dc"]].forEach(function (m) {
      if (mix[m[0]] > 0) bar.appendChild(el("span", { class: "mix-seg " + m[1], style: "flex-grow:" + mix[m[0]] }));
    });
  }

  /* how far real mixed driving is above WLTP, from the trip planner's cars */
  function realWorldText() {
    var ex = D.highway.cars.map(function (c) { return Math.round((c.combined / c.wltp - 1) * 100); }).sort(function (a, b) { return a - b; });
    var mid = ex[Math.floor(ex.length / 2)];
    return "real mixed driving is " + ex[0] + " to " + ex[ex.length - 1] + "% higher for five cars on EV Database (about " + Math.round(mid / 5) * 5 + "% in the middle), so add about that for a fair comparison";
  }

  /* where this EV's consumption sits among all EVs: a scale from best to worst, the average marked */
  function renderEvScale() {
    var sc = D.evScale;
    var lo = 10;
    var hi = 32;
    var k = state.kwhPer100;
    var at = function (v) { return Math.max(0, Math.min(100, (v - lo) / (hi - lo) * 100)) + "%"; };
    var box = clear($("ev-scale"));
    var track = el("div", { class: "scale-track" });
    [[sc.best.value, "Best " + num(sc.best.value, 1)], [sc.average, "Average " + num(sc.average, 1)], [sc.worst.value, "Worst " + num(sc.worst.value, 1)]].forEach(function (m, i) {
      track.appendChild(el("span", { class: "scale-tick scale-tick--" + i, style: "left:" + at(m[0]) }));
      box.appendChild(el("span", { class: "scale-label scale-label--" + i, style: "left:" + at(m[0]), text: m[1] }));
    });
    if (k > 0) track.appendChild(el("span", { class: "scale-you", style: "left:" + at(k), title: "Yours" }));
    box.insertBefore(track, box.firstChild);

    var note = clear($("ev-scale-note"));
    if (k > 0) {
      var band = sc.bands.filter(function (b) { return k < b.upTo; })[0];
      var diff = (k - sc.average) / sc.average;
      note.appendChild(el("strong", { text: num(k, 1) + " kWh/100 km is " + band.label + " " }));
      note.appendChild(document.createTextNode("(typical of " + band.note + "; " +
        (Math.abs(diff) < 0.03 ? "right on" : pct(Math.abs(diff)) + (diff < 0 ? " below" : " above")) +
        " the " + num(sc.average, 1) + " average). Real-world figures across all EVs run from " + num(sc.best.value, 1) + " (" + sc.best.car + ") to " + num(sc.worst.value, 1) + " (" + sc.worst.car + "). Expect more on the highway and in the cold. "));
      note.appendChild(sourceLink(sc.source));
    }
  }

  /* the highway extra: a suggestion that follows where the EV figure comes from, and the why */
  function renderHighwayHint() {
    var hw = D.highway;
    var sug = hw.suggest[state.figureFrom === "dash" ? "dash" : "spec"];
    var h = clear($("highway-hint"));
    h.appendChild(document.createTextNode(state.figureFrom === "dash"
      ? "Suggested " + sug + "% for a trip-computer figure from everyday driving. "
      : "Suggested " + sug + "% for a spec-sheet (WLTP) figure. "));
    if (Math.round(state.highwayPct) !== sug) {
      var b = el("button", { type: "button", class: "link-button", text: "Use " + sug + "%" });
      b.addEventListener("click", function () {
        state.highwayPct = sug;
        changed();
      });
      h.appendChild(b);
      h.appendChild(document.createTextNode(" "));
    }
    h.appendChild(document.createTextNode("Add more for 120 km/h, a roof rack, a trailer or a headwind."));
  }

  function buildHighwayWhy() {
    var hw = D.highway;
    var body = $("highway-why-body");
    function extra(a, b) {
      return "+" + Math.round((a / b - 1) * 100) + "%";
    }
    body.appendChild(el("p", null, ["Mostly air drag. The force of the air on the car rises with the ", el("strong", { text: "square of speed" }), ", so at 120 km/h the car pushes against " + Math.round((Math.pow(120 / 100, 2) - 1) * 100) + "% more drag than at 100 km/h, and " + Math.round((Math.pow(120 / 110, 2) - 1) * 100) + "% more than at 110 km/h. ", sourceLink("dragEq")]));
    body.appendChild(el("p", null, ["Fuel cars hide this: their engines waste a lot of energy in town and are at their most efficient cruising. EVs are the other way round. They waste little in town and get energy back when braking, so their spec-sheet figure (WLTP, mostly town and medium speeds) looks good and the highway shows a bigger jump."]));
    body.appendChild(el("p", null, ["EV Database's real-world figures at a steady " + hw.speed + " km/h in mild weather (23\u00a0\u00b0C, no air-con), against each car's WLTP figure (from the battery) and its real mixed-driving figure, in Wh per km:"]));
    var tb = el("tbody");
    hw.cars.forEach(function (c) {
      tb.appendChild(el("tr", null, [
        el("th", { scope: "row" }, [el("a", { href: c.url, target: "_blank", rel: "noopener", text: c.car })]),
        el("td", { class: "raw", text: String(c.wltp) }),
        el("td", { class: "raw", text: String(c.combined) }),
        el("td", { class: "raw", text: String(c.highway) }),
        el("td", { text: extra(c.highway, c.wltp) }),
        el("td", { text: extra(c.highway, c.combined) })
      ]));
    });
    body.appendChild(el("div", { class: "table-wrap" }, [el("table", { class: "why-table" }, [
      el("thead", null, [el("tr", null, ["Car", "WLTP", "Mixed", hw.speed + " km/h", "vs WLTP", "vs mixed"].map(function (t, i) { return el("th", { class: i >= 1 && i <= 3 ? "raw" : "", text: t }); }))]),
      tb
    ])]));
    body.appendChild(el("p", null, ["So the suggestion is " + hw.suggest.spec + "% over a spec-sheet figure and " + hw.suggest.dash + "% over a trip-computer figure from everyday driving, both at " + hw.speed + " km/h. At \u221210\u00a0\u00b0C with the heater on, the same cars use roughly another quarter on top. ", sourceLink(hw.source)]));
  }

  /* ------------------------------------------------------------ 1. everyday */
  function renderRunning(s, r) {
    var fuelLabel = D.fuels[state.fuel].label;
    $("tile-fuel-label").textContent = "Fuel car (" + fuelLabel + ")";
    $("tile-fuel-month").textContent = rand(r.fuelMonth) + " /month";
    $("tile-fuel-sub").textContent = rand(r.fuelPerKm, true) + " per km · " + num(state.lPer100, 1) + " l/100 km at " + rand(s.fuelPrice, true);
    $("tile-ev-month").textContent = rand(r.evMonth) + " /month";
    $("tile-ev-sub").textContent = rand(r.evPerKm, true) + " per km · " + num(r.evWallPer100, 1) + " kWh/100 km at " + rand(r.mixPerKwh, true) + " avg";

    var head = $("headline");
    var save = $("save");
    if (r.fuel100 <= 0 || r.ev100 < 0) {
      head.textContent = "Fill in both cars' consumption to compare.";
      save.textContent = "";
    } else if (r.saveMonth >= 0) {
      head.textContent = r.ev100 === 0
        ? "Charged for free, the EV's energy costs nothing."
        : "The EV costs " + pct(r.ratio) + " of what the fuel car does per km (" + (r.ratio < 1 ? "about " + num(1 / r.ratio, 1) + "× cheaper" : "the same") + ").";
      save.textContent = "You'd save " + rand(r.saveMonth) + " a month, " + rand(r.saveYear) + " a year, on energy alone.";
      save.className = "save save--good";
    } else {
      head.textContent = "With this charging mix the EV costs more per km than the fuel car.";
      save.textContent = "It would cost " + rand(-r.saveMonth) + " a month more (" + rand(-r.saveYear) + " a year).";
      save.className = "save save--bad";
    }

    // the phones' bottom bar
    $("q-fuel").textContent = "Fuel " + rand(r.fuelMonth) + "/mo";
    $("q-ev").textContent = "EV " + rand(r.evMonth) + "/mo";
    $("q-save").textContent = (r.saveMonth >= 0 ? "Save " : "Costs ") + rand(Math.abs(r.saveMonth));
    $("q-save").className = "q-save" + (r.saveMonth < 0 ? " bad" : "");

    // bars: cost per 100 km
    var rows = [
      { label: "Fuel car · " + fuelLabel, value: r.fuel100, cls: "bar--fuel" },
      { label: "EV · your mix", value: r.ev100, cls: "bar--ev", strong: true },
      { label: "EV · at home", value: r.by.home, cls: "bar--ev-soft" },
      { label: "EV · public AC", value: r.by.ac, cls: "bar--ev-soft" },
      { label: "EV · fast DC", value: r.by.dc, cls: "bar--ev-soft" }
    ];
    var max = Math.max.apply(null, rows.map(function (x) { return x.value; })) || 1;
    var bars = clear($("bars"));
    rows.forEach(function (row) {
      var w = Math.max(0.5, row.value / max * 100);
      bars.appendChild(el("div", { class: "bar-row" + (row.strong ? " bar-row--strong" : "") }, [
        el("span", { class: "bar-label", text: row.label }),
        el("span", { class: "bar-track" }, [el("span", { class: "bar " + row.cls, style: "width:" + w + "%" })]),
        el("span", { class: "bar-value", text: rand(row.value) })
      ]));
    });

    // tipping points
    var facts = clear($("facts"));
    function fact(strong, rest) {
      facts.appendChild(el("li", null, [el("strong", { text: strong }), " " + rest]));
    }
    if (state.lPer100 > 0 && r.evWallPer100 > 0) {
      fact("Charging at home is like paying " + rand(r.equivFuelPriceHome, true) + " a litre", "for this fuel car's " + fuelLabel.toLowerCase() + " (your mix: " + rand(r.equivFuelPrice, true) + ").");
      fact("The EV only costs more per km above " + rand(r.breakEvenKwh, true) + " per kWh,", "about " + num(r.breakEvenKwh / Math.max(0.01, state.dcPrice), 1) + "× today's fast-charger price.");
      var dcRatio = r.by.dc / r.fuel100;
      fact("Fast chargers only: " + rand(r.by.dc / 100, true) + " per km,", dcRatio < 1 ? pct(dcRatio) + " of the fuel car's cost." : pct(dcRatio - 1) + " more than the fuel car.");
    }

    // next month's fuel price, from the fuel site's projection
    var nm = $("next-month");
    var ch = live && live.change && live.change[state.fuel];
    if (ch != null && isFinite(ch) && Math.abs(ch) >= 1) {
      var perL = ch / 100;
      var extraMonth = perL * state.lPer100 / 100 * state.kmMonth;
      nm.hidden = false;
      var t = clear($("next-month-text"));
      t.appendChild(document.createTextNode(fuelLabel + " is projected to go " + (perL > 0 ? "up" : "down") + " about " + rand(Math.abs(perL), true) + " a litre at the next adjustment (an estimate, not official yet: "));
      t.appendChild(el("a", { href: "https://fuel.psyphin.co.za/", text: "SA Fuel Price Preview" }));
      t.appendChild(document.createTextNode("). That's " + (perL > 0 ? "+" : "−") + rand(Math.abs(extraMonth)) + " a month for this fuel car" + (typeof state.fuelPrice === "number" ? "." : ", and the EV is unaffected.")));
    } else {
      nm.hidden = true;
    }
  }

  /* ------------------------------------------------------------ 2. road trip */
  function renderTrip(s) {
    var tr = C.trip({
      km: state.tripKm, returnTrip: state.returnTrip, battery: state.battery, startPct: state.startPct,
      reservePct: state.reservePct, chargeToPct: state.chargeToPct, highwayPct: state.highwayPct, dcKw: state.dcKw,
      kwhPer100: state.kwhPer100, figureFrom: state.figureFrom, lossPct: state.lossPct,
      homePrice: state.homePrice, n3Price: state.n3Price, lPer100: state.lPer100, fuelPrice: s.fuelPrice
    });

    $("trip-fuel").textContent = rand(tr.fuelCost);
    $("trip-fuel-sub").textContent = num(tr.fuelLitres, 0) + " litres for " + num(tr.km) + " km";
    if (!tr.possible) {
      $("trip-ev").textContent = "–";
      $("trip-ev-sub").textContent = "Check the battery and charge levels: there's nothing to drive on.";
      $("trip-headline").textContent = "The EV can't do this trip with these settings.";
      $("trip-save").textContent = "";
      clear($("trip-chart"));
      $("trip-chart-note").textContent = "";
      return;
    }
    $("trip-ev").textContent = rand(tr.evCost);
    var sub = tr.stops
      ? rand(tr.homeCost) + " at home + " + rand(tr.dcCost) + " at " + tr.stops + " fast-charge stop" + (tr.stops > 1 ? "s" : "")
      : "All from home: no charging stop";
    $("trip-ev-sub").textContent = sub;

    var hl = $("trip-headline");
    if (tr.stops) {
      hl.textContent = tr.stops + " charging stop" + (tr.stops > 1 ? "s" : "") + ", about " + duration(tr.chargeMinutes) + " plugged in. Highway range from home: about " + num(tr.rangeFirst) + " km.";
    } else {
      hl.textContent = "No charging stop needed: you'd arrive with about " + Math.round(tr.arrivePct) + "%.";
    }
    var sv = $("trip-save");
    var diff = tr.fuelCost - tr.evCost;
    sv.textContent = (diff >= 0 ? "The EV saves " + rand(diff) : "The EV costs " + rand(-diff) + " more") +
      " on this trip. Charged only on fast chargers (none at home) it would be " + rand(tr.allDcCost) + ".";
    sv.className = "save " + (diff >= 0 ? "save--good" : "save--bad");

    drawTrip(C.tripProfile(state, tr), tr);
    $("trip-chart-note").textContent = "Uses " + num(tr.perKm * 100, 1) + " kWh per 100 km from the battery at highway speed (" + num(state.kwhPer100, 1) + " + " + Math.round(state.highwayPct) + "%" + (state.figureFrom === "spec" ? ", less charging losses, since the spec figure is at the wall" : "") + "). Real stops depend on where the chargers are.";

    var list = clear($("n3-list"));
    D.n3Chargers.forEach(function (c) {
      list.appendChild(el("li", null, [
        el("strong", { text: c.name }), " · " + c.where + ". " + c.what + ". ",
        sourceLink(c.source)
      ]));
    });
    $("n3-card").hidden = !(D.routes.filter(function (r) { return r.id === state.route && r.n3; }).length || !state.route);
  }

  function duration(min) {
    min = Math.round(min / 5) * 5;
    if (min < 60) return min + " min";
    var h = Math.floor(min / 60);
    var m = min % 60;
    return h + " h" + (m ? " " + m + " min" : "");
  }

  function drawTrip(pts, tr) {
    var box = clear($("trip-chart"));
    if (!pts.length) return;
    var W = Math.max(280, box.clientWidth || 520);
    var H = 190;
    var m = { l: 40, r: 14, t: 14, b: 30 };
    var iw = W - m.l - m.r;
    var ih = H - m.t - m.b;
    var x = function (km) { return m.l + km / Math.max(1, tr.km) * iw; };
    var y = function (p) { return m.t + (1 - Math.max(0, Math.min(100, p)) / 100) * ih; };
    var s = svg("svg", { viewBox: "0 0 " + W + " " + H, width: W, height: H, role: "img", "aria-label": "Battery level along the trip" });

    [0, 50, 100].forEach(function (p) {
      s.appendChild(svg("line", { x1: m.l, x2: W - m.r, y1: y(p), y2: y(p), class: "grid" }));
      s.appendChild(svg("text", { x: m.l - 6, y: y(p) + 4, "text-anchor": "end", class: "axis" }, p + "%"));
    });
    // reserve band
    s.appendChild(svg("rect", { x: m.l, y: y(state.reservePct), width: iw, height: Math.max(0, y(0) - y(state.reservePct)), class: "reserve" }));
    // the line
    var d = pts.map(function (p, i) { return (i ? "L" : "M") + x(p.km).toFixed(1) + " " + y(p.pct).toFixed(1); }).join(" ");
    var area = d + " L" + x(tr.km).toFixed(1) + " " + y(0) + " L" + x(0) + " " + y(0) + " Z";
    s.appendChild(svg("path", { d: area, class: "batt-area" }));
    s.appendChild(svg("path", { d: d, class: "batt-line" }));
    // stops
    pts.filter(function (p) { return p.stop; }).forEach(function (p, i) {
      var cx = x(p.km);
      s.appendChild(svg("line", { x1: cx, x2: cx, y1: m.t, y2: y(0), class: "stop-line" }));
      s.appendChild(svg("circle", { cx: cx, cy: y(p.pct), r: 4.5, class: "stop-dot" }));
      s.appendChild(svg("text", { x: cx, y: m.t + 10, "text-anchor": cx > W - 60 ? "end" : "middle", class: "stop-label" }, "⚡ " + num(p.km) + " km"));
    });
    // x axis
    s.appendChild(svg("text", { x: m.l, y: H - 8, class: "axis" }, "Start"));
    s.appendChild(svg("text", { x: W - m.r, y: H - 8, "text-anchor": "end", class: "axis" }, num(tr.km) + " km"));
    box.appendChild(s);
  }

  /* ------------------------------------------------------------ 3. buying */
  /* ------------------------------------------------------------ 3. keep or finance */
  function workedInstalment() {
    return Math.round(C.instalment(state.evPrice, state.finDeposit, state.finRate, state.finMonths, state.finBalloon, D.finance.fees));
  }

  function instalmentValue() {
    return typeof state.instalment === "number" ? state.instalment : workedInstalment();
  }

  function renderKeep(s, run) {
    var worked = workedInstalment();
    var pay = instalmentValue();
    var typed = typeof state.instalment === "number" && Math.abs(state.instalment - worked) >= 1;

    var ih = clear($("instalment-hint"));
    if (typed) {
      ih.appendChild(document.createTextNode("Your figure. The finance below works out to " + rand(worked) + " a month. "));
      var b = el("button", { type: "button", class: "link-button", text: "Use that" });
      b.addEventListener("click", function () {
        state.instalment = null;
        changed();
      });
      ih.appendChild(b);
    } else {
      ih.textContent = "Worked out from the finance below. Got a quote from the bank or dealer? Type its instalment here instead.";
    }
    var fh = clear($("finance-hint"));
    fh.appendChild(document.createTextNode("Prime is " + num(D.finance.prime, 2) + "% (since " + D.finance.since + "); your bank may offer more or less. "));
    fh.appendChild(sourceLink(D.finance.source));
    fh.appendChild(document.createTextNode(" Includes the bank's " + rand(D.finance.fees.monthly) + " monthly fee and " + rand(D.finance.fees.initiation, true) + " initiation fee. "));
    fh.appendChild(sourceLink(D.finance.fees.source));
    fh.appendChild(document.createTextNode(" A balloon lowers the instalment, but you owe it at the end."));

    var k = C.keepOrBuy(Object.assign({}, state, { instalment: pay, finFees: D.finance.fees }), run);
    $("keep-total").textContent = rand(k.keep.total) + " /month";
    $("keep-sub").textContent = rand(k.keep.energy) + " fuel + " + rand(k.keep.upkeep) + " servicing";
    $("buy-total").textContent = rand(k.buy.total) + " /month";
    $("buy-sub").textContent = rand(k.buy.instalment) + " instalment + " + rand(k.buy.energy) + " electricity" +
      (k.buy.upkeep ? " + " + rand(k.buy.upkeep) + " servicing" : "") + (k.buy.insurance ? " + " + rand(k.buy.insurance) + " insurance" : "");

    var hl = $("keep-headline");
    var sv = $("keep-save");
    if (k.buy.instalment <= 0) {
      hl.textContent = "No instalment: the EV saves " + rand(k.saving) + " a month to run.";
      sv.textContent = "";
    } else if (k.difference <= 0) {
      hl.textContent = "The savings pay for it: what you'd stop spending covers the whole instalment.";
      sv.textContent = "You'd be " + rand(-k.difference) + " a month better off, even while paying the EV off.";
      sv.className = "save save--good";
    } else {
      hl.textContent = k.saving > 0
        ? "The savings cover " + pct(Math.min(1, k.covers)) + " of the instalment (" + rand(k.saving) + " of " + rand(k.buy.instalment) + ")."
        : "The EV costs as much or more to run here, so nothing goes towards the instalment.";
      sv.textContent = "Financing the EV would cost you " + rand(k.difference) + " a month more than keeping your car.";
      sv.className = "save save--bad";
    }

    drawStack(k);

    var facts = clear($("keep-facts"));
    function fact(strong, rest) {
      facts.appendChild(el("li", null, [el("strong", { text: strong }), " " + rest]));
    }
    if (k.buy.instalment > 0 && !(state.evIns > 0)) {
      fact("Insurance isn't counted yet:", "a bank requires comprehensive cover on a car it finances, and a new car costs more to insure. Get a quote and enter the extra over what you pay now.");
    }
    if (k.saving > 0) {
      fact("The savings would cover an instalment of up to " + rand(k.maxInstalment) + " a month,",
        isFinite(k.maxPrice) ? "which on these finance terms buys a car of about " + rand(Math.round(k.maxPrice / 1000) * 1000) + "." : "");
      if (k.kmToBreakEven != null && k.difference > 0) {
        fact("Or you'd need to drive about " + num(Math.round(k.kmToBreakEven / 100) * 100) + " km a month", "(you put in " + num(state.kmMonth) + ") for the savings to cover it.");
      }
      fact("Once the instalments end, after " + yearsText(state.finMonths / 12) + ",", "the EV keeps saving you about " + rand(k.afterFinance) + " a month at today's prices" + (k.balloon > 0 ? ", once the balloon is paid." : "."));
    } else {
      fact("Try charging at home:", "the EV's running cost depends most on where it charges (section 1).");
    }
    if (k.buy.instalment > 0) {
      fact("Over the " + num(state.finMonths) + " months you'd pay " + rand(k.totalPaid) + " in instalments,",
        (state.finBalloon > 0 ? "plus a " + rand(state.evPrice * state.finBalloon / 100) + " balloon at the end" : "") +
        (state.finDeposit > 0 ? (state.finBalloon > 0 ? " and " : "on top of ") + "the " + rand(state.finDeposit) + " deposit." : (state.finBalloon > 0 ? "." : "with no deposit.")) +
        (k.costOfCredit > 0 ? " That's " + rand(k.costOfCredit) + " more than the car's price, in interest and fees." : ""));
    }
  }

  function drawStack(k) {
    var box = clear($("keep-stack"));
    var max = Math.max(k.keep.total, k.buy.total) || 1;
    var parts = [
      ["energy", "Fuel / electricity"],
      ["upkeep", "Servicing"],
      ["insurance", "Extra insurance"],
      ["instalment", "Instalment"]
    ];
    [["Keep your car", k.keep], ["Finance the EV", k.buy]].forEach(function (row) {
      var bar = el("div", { class: "stack-bar" });
      parts.forEach(function (p) {
        var v = row[1][p[0]];
        if (v > 0) bar.appendChild(el("span", { class: "stack-seg stack-seg--" + p[0], style: "width:" + (v / max * 100) + "%", title: p[1] + " " + rand(v) }));
      });
      box.appendChild(el("div", { class: "stack-row" }, [
        el("span", { class: "stack-label", text: row[0] }),
        el("span", { class: "stack-track" }, [bar]),
        el("span", { class: "stack-value", text: rand(row[1].total) })
      ]));
    });
    var legend = el("div", { class: "legend stack-legend" });
    parts.forEach(function (p) {
      legend.appendChild(el("span", null, [el("i", { class: "sq stack-seg--" + p[0] }), " " + p[1]]));
    });
    box.appendChild(legend);
  }

  function renderOwnership(s, run) {
    var o = C.ownership(s, run);
    var hl = $("buy-headline");
    if (o.breakEven === 0) {
      hl.textContent = "The EV costs no more to buy here, and " + (o.difference >= 0 ? "it's " + rand(o.difference) + " cheaper after " + o.years + " years." : "still costs " + rand(-o.difference) + " more after " + o.years + " years.");
    } else if (o.breakEven != null) {
      hl.textContent = "The EV pays back its extra " + rand(o.premium) + " in about " + yearsText(o.breakEven) + ", and is " + rand(o.difference) + " ahead after " + o.years + " years.";
    } else if (o.roughPayback != null) {
      hl.textContent = "Not paid back within " + o.years + " years: still " + rand(-o.difference) + " behind. At this rate, about " + yearsText(o.roughPayback) + " to pay back the extra " + rand(o.premium) + ".";
    } else {
      hl.textContent = "With these figures the EV doesn't pay back its extra " + rand(o.premium) + ": it costs as much or more to run.";
    }
    drawOwnership(o);

    $("own-table-title").textContent = "After " + o.years + " year" + (o.years > 1 ? "s" : "") + " (" + num(state.kmMonth * 12 * o.years) + " km)";
    var t = clear($("own-table"));
    var thead = el("thead", null, [el("tr", null, [el("th", { text: "" }), el("th", { text: "Fuel car" }), el("th", { text: "Electric car" })])]);
    var tb = el("tbody");
    function row(label, a, b, total) {
      tb.appendChild(el("tr", total ? { class: "total" } : null, [el("th", { scope: "row", text: label }), el("td", { text: rand(a) }), el("td", { text: rand(b) })]));
    }
    row("Buying", s.fuelCarPrice, s.evPrice);
    row("Home charger", 0, s.chargerCost);
    row("Fuel / electricity", o.fuelEnergy, o.evEnergy);
    row("Servicing", s.fuelService * o.years, s.evService * o.years);
    row("Total", o.fuel[o.years], o.ev[o.years], true);
    t.appendChild(thead);
    t.appendChild(tb);
  }

  function yearsText(y) {
    if (y < 1) return Math.max(1, Math.round(y * 12)) + " months";
    var r = Math.round(y * 2) / 2;
    return (r % 1 ? num(r, 1) : String(r)) + " year" + (r === 1 ? "" : "s");
  }

  function drawOwnership(o) {
    var box = clear($("own-chart"));
    var W = Math.max(280, box.clientWidth || 520);
    var H = 220;
    var m = { l: 58, r: 14, t: 12, b: 28 };
    var iw = W - m.l - m.r;
    var ih = H - m.t - m.b;
    var all = o.ev.concat(o.fuel);
    var lo = Math.min.apply(null, all);
    var hi = Math.max.apply(null, all);
    lo = Math.max(0, lo - (hi - lo) * 0.1);
    var step = niceStep((hi - lo) / 4);
    lo = Math.floor(lo / step) * step;
    hi = Math.ceil(hi / step) * step;
    var x = function (yr) { return m.l + yr / o.years * iw; };
    var y = function (v) { return m.t + (1 - (v - lo) / Math.max(1, hi - lo)) * ih; };
    var s = svg("svg", { viewBox: "0 0 " + W + " " + H, width: W, height: H, role: "img", "aria-label": "Total cost of each car, year by year" });
    for (var v = lo; v <= hi + 1; v += step) {
      s.appendChild(svg("line", { x1: m.l, x2: W - m.r, y1: y(v), y2: y(v), class: "grid" }));
      s.appendChild(svg("text", { x: m.l - 6, y: y(v) + 4, "text-anchor": "end", class: "axis" }, short(v)));
    }
    var every = o.years > 8 ? 2 : 1;
    for (var yr = 0; yr <= o.years; yr += every) {
      s.appendChild(svg("text", { x: x(yr), y: H - 8, "text-anchor": "middle", class: "axis" }, yr === 0 ? "Buy" : "Yr " + yr));
    }
    function line(arr, cls) {
      var d = arr.map(function (v2, i) { return (i ? "L" : "M") + x(i).toFixed(1) + " " + y(v2).toFixed(1); }).join(" ");
      s.appendChild(svg("path", { d: d, class: "own-line " + cls }));
      arr.forEach(function (v2, i) {
        s.appendChild(svg("circle", { cx: x(i), cy: y(v2), r: 3, class: "own-dot " + cls }));
      });
    }
    line(o.fuel, "own--fuel");
    line(o.ev, "own--ev");
    if (o.breakEven != null && o.breakEven > 0) {
      var bx = x(o.breakEven);
      s.appendChild(svg("line", { x1: bx, x2: bx, y1: m.t, y2: y(lo), class: "be-line" }));
      s.appendChild(svg("text", { x: bx + (bx > W - 90 ? -6 : 6), y: m.t + 12, "text-anchor": bx > W - 90 ? "end" : "start", class: "be-label" }, "Break-even"));
    }
    box.appendChild(s);
  }

  function niceStep(raw) {
    if (!(raw > 0)) return 1;
    var p = Math.pow(10, Math.floor(Math.log10(raw)));
    var f = raw / p;
    return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10) * p;
  }

  function short(v) {
    if (Math.abs(v) >= 1e6) return "R" + num(v / 1e6, Math.abs(v) % 1e6 ? 2 : 0) + "m";
    if (Math.abs(v) >= 1e3) return "R" + num(v / 1e3) + "k";
    return "R" + num(v);
  }

  /* ------------------------------------------------------------ sources */
  function buildSources() {
    var ps = $("price-sources");
    var fb = D.fuelFallback;
    function item(list, strong, rest, src) {
      list.appendChild(el("li", null, [el("strong", { text: strong }), " " + rest + " ", src ? sourceLink(src) : null]));
    }
    item(ps, "Fuel:", "live from SA Fuel Price Preview (the Central Energy Fund's official figures, inland = Gauteng; coastal is " + rand(D.liveFeed.coastalGap, true) + " less). If that can't be reached: " + longDate(fb.effective) + " prices, 95 " + rand(fb.inland.petrol95, true) + " inland / " + rand(fb.coastal.petrol95, true) + " coastal. " + fb.note, fb.source);
    D.tariffs.home.forEach(function (t) {
      item(ps, "Home, " + t.label + ": " + rand(t.value, true) + "/kWh.", t.note, t.source);
    });
    item(ps, "Public AC: " + rand(D.tariffs.publicAc.value, true) + "/kWh.", D.tariffs.publicAc.note, D.tariffs.publicAc.source);
    item(ps, "Fast DC: " + rand(D.tariffs.publicDc.value, true) + "/kWh.", D.tariffs.publicDc.note, D.tariffs.publicDc.source);
    item(ps, "N3 fast charger: " + rand(D.tariffs.n3Dc.value, true) + "/kWh.", D.tariffs.n3Dc.note, D.tariffs.n3Dc.source);
    item(ps, "Finance interest: " + num(D.finance.prime, 2) + "%,", "the prime lending rate since " + D.finance.since + ". Banks quote car loans around prime, higher or lower depending on the buyer.", D.finance.source);
    item(ps, "Car sizes, consumption, prices and servicing:", "examples to start from, not from a source. Type in your own.", null);

    var op = $("other-prices");
    D.tariffs.examples.forEach(function (x) {
      item(op, x.label + ":", x.value + " per kWh.", x.source);
    });

    var as = $("assumptions");
    D.assumptions.forEach(function (a) {
      as.appendChild(el("li", null, [a.text + " ", a.source ? sourceLink(a.source) : null]));
    });

    var refs = $("refs");
    Object.keys(D.sources).forEach(function (k) {
      var s = D.sources[k];
      refs.appendChild(el("li", null, [
        el("a", { href: s.url, target: k === "fuelLive" ? "_self" : "_blank", rel: "noopener", text: s.title }),
        " · " + s.publisher + (s.date ? ", " + s.date : "")
      ]));
    });
    $("checked").textContent = "Prices checked " + longDate(D.checked) + ".";
  }

  /* phones: show the bottom bar while the everyday inputs are on screen but its results aren't */
  function watchQuickbar() {
    if (!("IntersectionObserver" in window)) return;
    var formIn = false;
    var resultsIn = false;
    var bar = $("quickbar");
    function update() {
      bar.hidden = !(formIn && !resultsIn);
    }
    new IntersectionObserver(function (es) {
      formIn = es[0].isIntersecting;
      update();
    }).observe($("form"));
    new IntersectionObserver(function (es) {
      resultsIn = es[0].isIntersecting;
      update();
    }, { threshold: 0.15 }).observe($("results"));
  }

  /* ------------------------------------------------------------ go */
  build();
  watchQuickbar();
  render();
  fetchLive();

  var resizeTimer;
  window.addEventListener("resize", function () {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(render, 150);
  });
})();
