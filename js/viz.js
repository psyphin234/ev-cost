/* Animated diagrams driven by the visitor's own figures (owner's request,
   2026-10-19). app.js calls these on every render with the figures. Each keeps
   one canvas in its box, so a change animates from where it was instead of
   starting over:
   - race: the fuel car and the EV drive 100 km side by side, rand meters
     counting up as they go, on a track measured in rand, so each stops at its
     own cost per 100 km ("Cost per 100 km"). Plays when
     it scrolls into view, and again a moment after the figures change;
   - trip: the road trip's battery chart with the car driving along it, the
     battery charging at each stop with that stop's kWh, time and cost
     ("Battery along the way"). Loops while it's on screen;
   - jar: the monthly saving poured into a jar the size of the EV instalment,
     overflowing if it covers it ("Where the money goes each month");
   - payback: the buying-outright cost lines drawn across the years, with a
     glowing marker where the EV pays back.
   Under prefers-reduced-motion each is drawn once, finished. Nothing here
   works anything out: the figures all come from calc.js via app.js. */
(function () {
  "use strict";

  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var fmt = {};
  var COL = null;

  function colours() {
    if (COL) return COL;
    var css = getComputedStyle(document.documentElement);
    // the page's colour tokens (6-digit hex), or the fallback if one isn't
    var rgb = function (name, fallback) {
      var m = /^#([0-9a-f]{6})$/i.exec(css.getPropertyValue(name).trim()) || /^#([0-9a-f]{6})$/i.exec(fallback);
      var n = parseInt(m[1], 16);
      return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
    };
    COL = {
      fuel: rgb("--fuel", "#ff9a4d"),
      ev: rgb("--ev", "#4cc9ff"),
      good: rgb("--good", "#2ee6a6"),
      bad: rgb("--bad", "#ff5d73"),
      text: [234, 242, 255],
      muted: [168, 183, 214]
    };
    return COL;
  }

  function rgba(c, a) {
    return "rgba(" + c[0] + ", " + c[1] + ", " + c[2] + ", " + a + ")";
  }

  function ease(t) {
    t = Math.max(0, Math.min(1, t));
    return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  }

  function font(weight, px, display) {
    return weight + " " + px + "px " + (display ? "Sora, Inter, system-ui, sans-serif" : "Inter, system-ui, sans-serif");
  }

  function roundRect(ctx, x, y, w, h, r) {
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  // A small side-on car, wheels on (x, y), facing right; length about 34.
  function car(ctx, x, y, c, spin, electric) {
    ctx.save();
    ctx.translate(x, y);
    ctx.beginPath();
    ctx.moveTo(0, -5);
    ctx.lineTo(1, -10);
    ctx.lineTo(8, -11);
    ctx.lineTo(13, -17);
    ctx.lineTo(25, -17);
    ctx.lineTo(31, -11);
    ctx.lineTo(34, -10);
    ctx.lineTo(34, -5);
    ctx.closePath();
    ctx.fillStyle = rgba(c, 0.25);
    ctx.fill();
    ctx.strokeStyle = rgba(c, 1);
    ctx.lineWidth = 1.4;
    ctx.shadowColor = rgba(c, 0.9);
    ctx.shadowBlur = 8;
    ctx.stroke();
    ctx.beginPath();
    [8, 26].forEach(function (wx) {
      ctx.moveTo(wx + 4, -4); ctx.arc(wx, -4, 4, 0, Math.PI * 2);
      ctx.moveTo(wx, -4); ctx.lineTo(wx + Math.cos(spin) * 3.4, -4 + Math.sin(spin) * 3.4);
    });
    ctx.stroke();
    if (electric) {
      // a little bolt on the door
      ctx.beginPath();
      ctx.moveTo(19, -15); ctx.lineTo(16, -11); ctx.lineTo(19, -11); ctx.lineTo(17, -7);
      ctx.stroke();
    }
    ctx.shadowBlur = 0;
    ctx.restore();
  }

  // ------------------------------------------------------------ the stage
  // One canvas, sized to its box, that animates only while it's on screen and
  // has something to animate: until a given time, or for good (forever).
  function Stage(box, height, cls, label) {
    var self = this;
    this.box = box;
    this.height = height;
    this.canvas = document.createElement("canvas");
    this.canvas.className = "viz " + cls;
    this.canvas.setAttribute("role", "img");
    this.canvas.setAttribute("aria-label", label);
    this.canvas.style.height = height + "px";
    this.ctx = this.canvas.getContext("2d");
    this.w = 0;
    this.h = height;
    this.visible = false;
    this.seen = false;
    this.until = 0;
    this.forever = false;
    this.running = false;
    this.draw = function () {};
    this.onFirstView = null;
    this.attach(box);
    if ("IntersectionObserver" in window) {
      new IntersectionObserver(function (entries) {
        self.visible = entries[0].isIntersecting;
        if (self.visible && !self.seen) {
          self.seen = true;
          if (self.onFirstView) self.onFirstView();
        }
        self.tick();
      }, { threshold: 0.35 }).observe(this.canvas);
    } else {
      this.visible = this.seen = true;
    }
    if ("ResizeObserver" in window) new ResizeObserver(function () { if (self.resize()) self.paint(); }).observe(this.canvas);
    document.addEventListener("visibilitychange", function () { self.tick(); });
  }

  Stage.prototype.attach = function (box) {
    if (this.canvas.parentNode !== box) box.appendChild(this.canvas);
  };

  Stage.prototype.resize = function () {
    var cw = this.canvas.clientWidth;
    if (!cw) return false;
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    if (cw === this.w && dpr === this.dpr) return false;
    this.w = cw;
    this.dpr = dpr;
    this.canvas.width = Math.round(cw * dpr);
    this.canvas.height = Math.round(this.h * dpr);
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return true;
  };

  Stage.prototype.paint = function () {
    if (!this.w && !this.resize()) return;
    this.ctx.clearRect(0, 0, this.w, this.h);
    this.draw(this.ctx, performance.now());
  };

  Stage.prototype.run = function (ms) {
    this.until = Math.max(this.until, performance.now() + ms);
    this.tick();
  };

  Stage.prototype.tick = function () {
    var self = this;
    var should = function () {
      return !reduceMotion && self.visible && !document.hidden && self.canvas.isConnected &&
        (self.forever || performance.now() < self.until);
    };
    if (self.running || !should()) { if (!self.running) self.paint(); return; }
    self.running = true;
    var loop = function () {
      self.paint();
      if (should()) requestAnimationFrame(loop);
      else { self.running = false; self.paint(); }
    };
    requestAnimationFrame(loop);
  };

  // ------------------------------------------------------------ race
  var raceS = null, raceD = null, raceT0 = null, raceTimer = 0;
  var RACE_MS = 3200;

  function race(box, d) {
    box.hidden = !d;
    if (!d) return;
    if (!raceS) {
      raceS = new Stage(box, 124, "viz-race", "The fuel car and the electric car each driving 100 km along a scale of rand spent: each stops at its cost per 100 km.");
      raceS.draw = drawRace;
      raceS.onFirstView = function () { raceT0 = performance.now(); raceS.run(RACE_MS + 200); };
    }
    var changed = raceD && (raceD.fuel100 !== d.fuel100 || raceD.ev100 !== d.ev100);
    raceD = d;
    raceS.attach(box);
    if (changed && raceS.seen) {
      // run it again once the typing stops
      clearTimeout(raceTimer);
      raceT0 = null;
      raceTimer = setTimeout(function () { raceT0 = performance.now(); raceS.run(RACE_MS + 200); }, 800);
    }
    raceS.paint();
  }

  // Both cars drive the same 100 km in the same time; the track is the money,
  // so each moves along it at the rate it spends and stops at its own cost.
  function drawRace(ctx, now) {
    var c = colours(), d = raceD, w = raceS.w;
    var p = reduceMotion || raceT0 === null ? (raceS.seen || reduceMotion ? 1 : 0) : ease((now - raceT0) / RACE_MS);
    var xs = 4, xe = w - 78, len = xe - xs - 36;
    var top = Math.max(d.fuel100, d.ev100, 1);
    var step = niceStep(top / 3);
    var max = top * 1.1;
    var X = function (r) { return xs + (r / max) * len; };
    var lanes = [
      { y: 40, c: c.fuel, label: d.fuelLabel.toUpperCase(), value: d.fuel100, electric: false },
      { y: 88, c: c.ev, label: "EV · YOUR MIX", value: d.ev100, electric: true }
    ];
    // the rand scale under both lanes
    ctx.font = font(500, 10, false);
    for (var r = 0; r <= max + 1e-6; r += step) {
      var tx = X(r) + 17;
      ctx.fillStyle = "rgba(120, 170, 255, 0.12)";
      ctx.fillRect(Math.round(tx), 20, 1, 84);
      ctx.fillStyle = rgba(c.muted, 0.8);
      ctx.textAlign = "center";
      ctx.fillText(fmt.rand(r), tx, 118);
    }
    lanes.forEach(function (ln) {
      var spent = ln.value * p, x = X(spent);
      ctx.font = font(600, 10, false);
      if ("letterSpacing" in ctx) ctx.letterSpacing = "1.2px";
      ctx.fillStyle = rgba(c.muted, 0.9);
      ctx.textAlign = "left";
      ctx.fillText(ln.label, xs, ln.y - 24);
      if ("letterSpacing" in ctx) ctx.letterSpacing = "0px";
      // the road, lit behind the car
      ctx.fillStyle = "rgba(120, 170, 255, 0.12)";
      ctx.fillRect(xs, ln.y, xe - xs, 2);
      var g = ctx.createLinearGradient(xs, 0, x + 36, 0);
      g.addColorStop(0, rgba(ln.c, 0.05));
      g.addColorStop(1, rgba(ln.c, 0.8));
      ctx.fillStyle = g;
      ctx.fillRect(xs, ln.y, x + 30 - xs, 2);
      // a puff of exhaust behind the fuel car while it moves
      if (!ln.electric && p > 0 && p < 1) {
        for (var k = 0; k < 4; k++) {
          var age = ((now / 400) + k / 4) % 1;
          ctx.beginPath();
          ctx.arc(x - 4 - age * 22, ln.y - 5 - age * 6, 2 + age * 4, 0, Math.PI * 2);
          ctx.fillStyle = "rgba(170, 185, 210, " + 0.25 * (1 - age) + ")";
          ctx.fill();
        }
      }
      car(ctx, x, ln.y, ln.c, p * 60, ln.electric);
      if (p >= 1) {
        ctx.font = font(600, 10, false);
        ctx.fillStyle = rgba(ln.c, 0.95);
        // beside the car, on whichever side has room before the meter
        var tag = "100 km ✓", tw = ctx.measureText(tag).width;
        var right = x + 40 + tw < xe;
        ctx.textAlign = right ? "left" : "right";
        ctx.fillText(tag, right ? x + 40 : x - 6, ln.y - 4);
      }
      // the meter: rand spent so far
      ctx.font = font(700, 19, true);
      ctx.textAlign = "right";
      ctx.fillStyle = rgba(ln.c, 1);
      ctx.shadowColor = rgba(ln.c, 0.7);
      ctx.shadowBlur = 10;
      ctx.fillText(fmt.rand(spent), w - 2, ln.y - 2);
      ctx.shadowBlur = 0;
    });
    // how far they've both got, then the saving
    ctx.font = font(600, 11, false);
    ctx.textAlign = "right";
    if (p >= 1) {
      var diff = d.fuel100 - d.ev100;
      ctx.fillStyle = rgba(diff >= 0 ? c.good : c.bad, 1);
      ctx.fillText(diff >= 0 ? "saves " + fmt.rand(diff) : "costs " + fmt.rand(-diff) + " more", w - 2, 118);
    } else {
      ctx.fillStyle = rgba(c.text, 0.85);
      ctx.fillText(Math.round(p * 100) + " km", w - 2, 118);
    }
  }

  // ------------------------------------------------------------ trip
  var tripS = null, tripD = null;
  var DRIVE_MS = 6500, STOP_MS = 1500, HOLD_MS = 2200;

  function trip(box, pts, tr, st) {
    if (!tripS) {
      tripS = new Stage(box, 214, "viz-trip", "Battery level along the trip, with the car driving it and each charging stop's energy, time and cost.");
      tripS.draw = drawTrip;
      tripS.forever = true;
    }
    tripS.attach(box);
    var keep = 1 - Math.max(0, Math.min(50, st.lossPct)) / 100;
    // the timeline: drive legs, then a pause at each stop while it charges
    var legs = [], t = 0, kmMs = DRIVE_MS / Math.max(1, tr.km);
    for (var i = 1; i < pts.length; i++) {
      var a = pts[i - 1], b = pts[i];
      if (b.stop) {
        var kwh = (b.pct - a.pct) / 100 * st.battery;
        legs.push({ stop: true, a: a, b: b, t0: t, t1: t + STOP_MS, kwh: kwh, cost: kwh / keep * st.n3Price, min: st.dcKw > 0 ? kwh / st.dcKw * 60 : 0 });
        t += STOP_MS;
      } else {
        var dur = Math.max(200, (b.km - a.km) * kmMs);
        legs.push({ stop: false, a: a, b: b, t0: t, t1: t + dur });
        t += dur;
      }
    }
    tripD = { pts: pts, tr: tr, st: st, legs: legs, total: t, t0: tripD ? tripD.t0 : performance.now() };
    tripS.paint();
    tripS.tick();
  }

  function drawTrip(ctx, now) {
    var c = colours(), d = tripD, w = tripS.w, h = tripS.h;
    if (!d || !d.pts.length) return;
    var m = { l: 40, r: 16, t: 26, b: 28 };
    var iw = w - m.l - m.r, ih = h - m.t - m.b;
    var x = function (km) { return m.l + km / Math.max(1, d.tr.km) * iw; };
    var y = function (p) { return m.t + (1 - Math.max(0, Math.min(100, p)) / 100) * ih; };
    var cycle = d.total + HOLD_MS;
    var t = reduceMotion ? d.total : (now - d.t0) % cycle;

    // grid, axis and the reserve band
    ctx.font = font(500, 10, false);
    ctx.textAlign = "right";
    [0, 50, 100].forEach(function (p) {
      ctx.fillStyle = "rgba(120, 170, 255, 0.14)";
      ctx.fillRect(m.l, Math.round(y(p)), iw, 1);
      ctx.fillStyle = rgba(c.muted, 0.85);
      ctx.fillText(p + "%", m.l - 6, y(p) + 4);
    });
    ctx.fillStyle = rgba(c.bad, 0.1);
    ctx.fillRect(m.l, y(d.st.reservePct), iw, y(0) - y(d.st.reservePct));
    ctx.fillStyle = rgba(c.muted, 0.85);
    ctx.textAlign = "left";
    ctx.fillText("Start", m.l, h - 8);
    ctx.textAlign = "right";
    ctx.fillText(fmt.num(d.tr.km) + " km", w - m.r, h - 8);

    // where the car is now
    var pos = d.pts[0], at = 0;
    for (var i = 0; i < d.legs.length; i++) {
      var lg = d.legs[i];
      if (t >= lg.t1) { pos = lg.b; at = i + 1; continue; }
      if (t >= lg.t0) {
        var f = (t - lg.t0) / (lg.t1 - lg.t0);
        if (lg.stop) f = ease(f);
        pos = { km: lg.a.km + (lg.b.km - lg.a.km) * f, pct: lg.a.pct + (lg.b.pct - lg.a.pct) * f };
        at = i + f;
      }
      break;
    }

    // the whole line faint, then the part driven so far bright with its area
    var path = function (upto) {
      ctx.beginPath();
      ctx.moveTo(x(d.pts[0].km), y(d.pts[0].pct));
      for (var j = 0; j < d.legs.length; j++) {
        if (j >= upto) break;
        var e = j + 1 <= upto ? d.legs[j].b : null;
        if (!e) {
          var fr = upto - j, L = d.legs[j];
          e = { km: L.a.km + (L.b.km - L.a.km) * (L.stop ? ease(fr) : fr), pct: L.a.pct + (L.b.pct - L.a.pct) * (L.stop ? ease(fr) : fr) };
        }
        ctx.lineTo(x(e.km), y(e.pct));
      }
    };
    path(d.legs.length);
    ctx.strokeStyle = rgba(c.ev, 0.22);
    ctx.lineWidth = 2;
    ctx.lineJoin = "round";
    ctx.stroke();
    path(at);
    ctx.lineTo(x(pos.km), y(0));
    ctx.lineTo(x(0), y(0));
    ctx.closePath();
    var g = ctx.createLinearGradient(0, m.t, 0, y(0));
    g.addColorStop(0, rgba(c.ev, 0.28));
    g.addColorStop(1, rgba(c.ev, 0.02));
    ctx.fillStyle = g;
    ctx.fill();
    path(at);
    ctx.strokeStyle = rgba(c.ev, 1);
    ctx.lineWidth = 2.5;
    ctx.shadowColor = rgba(c.ev, 0.9);
    ctx.shadowBlur = 8;
    ctx.stroke();
    ctx.shadowBlur = 0;

    // stops: a marker and label, and a callout with what that stop costs
    d.legs.forEach(function (lg) {
      if (!lg.stop) return;
      var sx = x(lg.b.km);
      ctx.strokeStyle = "rgba(160, 130, 255, 0.5)";
      ctx.setLineDash([3, 3]);
      ctx.beginPath(); ctx.moveTo(sx, m.t); ctx.lineTo(sx, y(0)); ctx.stroke();
      ctx.setLineDash([]);
      ctx.font = font(600, 10, false);
      ctx.fillStyle = "rgba(190, 170, 255, 0.95)";
      ctx.textAlign = sx > w - 60 ? "right" : "center";
      ctx.fillText("⚡ " + fmt.num(lg.b.km) + " km", sx, m.t - 10);
      var show = reduceMotion ? 1 : t < lg.t0 ? 0 : t < lg.t1 ? Math.min(1, (t - lg.t0) / 300) : Math.max(0, 1 - (t - lg.t1 - 900) / 500);
      if (show <= 0) return;
      var charging = !reduceMotion && t >= lg.t0 && t < lg.t1;
      if (charging) {
        // a glow pulsing round the car while it charges
        var pulse = (now / 600) % 1;
        ctx.beginPath();
        ctx.arc(sx, y(pos.pct), 6 + pulse * 12, 0, Math.PI * 2);
        ctx.strokeStyle = rgba(c.good, 0.8 * (1 - pulse));
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }
      var lines = ["+" + fmt.num(lg.kwh, 0) + " kWh · " + fmt.duration(lg.min), fmt.rand(lg.cost)];
      ctx.font = font(600, 11, false);
      var bw = Math.max(ctx.measureText(lines[0]).width, 40) + 16, bh = 36;
      var bx = sx + 10 + bw > w - 4 ? sx - 10 - bw : sx + 10;
      var by = y((lg.a.pct + lg.b.pct) / 2) - bh / 2;
      by = Math.max(m.t, Math.min(y(0) - bh, by));
      ctx.globalAlpha = show;
      ctx.beginPath();
      roundRect(ctx, bx, by, bw, bh, 6);
      ctx.fillStyle = "rgba(8, 14, 38, 0.9)";
      ctx.fill();
      ctx.strokeStyle = rgba(c.good, 0.7);
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.textAlign = "left";
      ctx.fillStyle = rgba(c.text, 0.95);
      ctx.fillText(lines[0], bx + 8, by + 15);
      ctx.font = font(700, 12, true);
      ctx.fillStyle = rgba(c.good, 1);
      ctx.fillText(lines[1], bx + 8, by + 30);
      ctx.globalAlpha = 1;
    });

    // the car on the line, with its battery level
    var cx = x(pos.km), cy = y(pos.pct);
    car(ctx, Math.min(cx - 17, w - m.r - 34), cy, c.ev, pos.km / 12, true);
    ctx.font = font(700, 11, true);
    ctx.textAlign = "center";
    ctx.fillStyle = rgba(c.text, 0.95);
    ctx.fillText(Math.round(pos.pct) + "%", Math.min(cx, w - m.r - 17), cy - 22);
  }

  // ------------------------------------------------------------ jar
  var jarS = null, jarD = null, jarFrom = 0, jarTo = 0, jarT0 = 0;
  var JAR_MS = 1600;

  function jar(box, d) {
    box.hidden = !d;
    if (!d) return;
    if (!jarS) {
      jarS = new Stage(box, 176, "viz-jar", "A jar the size of the EV's monthly instalment, filled with what switching saves each month.");
      jarS.draw = drawJar;
      jarS.onFirstView = function () { jarFrom = 0; jarT0 = performance.now(); jarS.run(JAR_MS + 1500); };
    }
    jarS.attach(box);
    var level = d.instalment > 0 ? Math.max(0, d.saving) / d.instalment : 0;
    if (jarD && Math.abs(level - jarTo) > 1e-6 && jarS.seen) {
      jarFrom = currentLevel(performance.now());
      jarT0 = performance.now();
      jarS.run(JAR_MS + 1500);
    }
    jarTo = level;
    jarD = d;
    jarS.paint();
  }

  function currentLevel(now) {
    if (reduceMotion) return jarTo;
    if (!jarS.seen) return 0;
    return jarFrom + (jarTo - jarFrom) * ease((now - jarT0) / JAR_MS);
  }

  function drawJar(ctx, now) {
    var c = colours(), d = jarD, w = jarS.w;
    var lvl = currentLevel(now), shown = Math.min(lvl, 1.04);
    var since = now - jarT0, filling = !reduceMotion && jarS.seen && since < JAR_MS;
    var calm = reduceMotion ? 0 : Math.max(0, 1 - since / (JAR_MS + 1200));
    var jw = Math.min(120, w * 0.32), jx = 14, top = 30, bot = 162, jh = bot - top;
    var surf = bot - jh * shown;

    // the stream pouring in while it fills
    if (filling && jarTo > 0) {
      for (var k = 0; k < 9; k++) {
        var f = ((now / 500) + k / 9) % 1;
        var dy = 4 + f * (surf - 8);
        ctx.beginPath();
        ctx.arc(jx + jw / 2 + Math.sin(k * 2.3) * 3, dy, 2.6, 0, Math.PI * 2);
        ctx.fillStyle = rgba(c.good, 0.8);
        ctx.fill();
      }
    }

    // the saving inside, its surface rippling as it settles
    ctx.save();
    ctx.beginPath();
    roundRect(ctx, jx, top, jw, jh, 14);
    ctx.clip();
    if (shown > 0) {
      ctx.beginPath();
      ctx.moveTo(jx, bot);
      for (var sx = 0; sx <= jw; sx += 4) {
        ctx.lineTo(jx + sx, surf + Math.sin(sx / 9 + now / 220) * 3 * calm);
      }
      ctx.lineTo(jx + jw, bot);
      ctx.closePath();
      var g = ctx.createLinearGradient(0, surf, 0, bot);
      g.addColorStop(0, rgba(c.good, 0.6));
      g.addColorStop(1, rgba(c.good, 0.18));
      ctx.fillStyle = g;
      ctx.shadowColor = rgba(c.good, 0.8);
      ctx.shadowBlur = 14;
      ctx.fill();
      ctx.shadowBlur = 0;
    }
    ctx.restore();

    // the jar: glass, rim and lid line at the instalment
    ctx.beginPath();
    roundRect(ctx, jx, top, jw, jh, 14);
    ctx.strokeStyle = rgba(c.ev, 0.85);
    ctx.lineWidth = 1.6;
    ctx.shadowColor = rgba(c.ev, 0.8);
    ctx.shadowBlur = 8;
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(jx - 5, top); ctx.lineTo(jx + jw + 5, top);
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.beginPath();
    ctx.moveTo(jx + 10, top + 12); ctx.lineTo(jx + 10, bot - 14);
    ctx.strokeStyle = "rgba(255, 255, 255, 0.12)";
    ctx.lineWidth = 3;
    ctx.stroke();

    // overflowing: drips down the outside
    if (lvl > 1) {
      for (var dk = 0; dk < 4; dk++) {
        var df = reduceMotion ? 0.5 : ((now / 900) + dk / 4) % 1;
        var side = dk % 2 ? jx + jw + 3 : jx - 3;
        ctx.beginPath();
        ctx.arc(side, top + 4 + df * (jh - 10), 2.4, 0, Math.PI * 2);
        ctx.fillStyle = rgba(c.good, 0.85 * (1 - df * 0.6));
        ctx.fill();
      }
    }

    // labels: the instalment at the rim, the saving at its level
    var lx = jx + jw + 22;
    var label = function (yy, head, value, col) {
      ctx.strokeStyle = rgba(col, 0.5);
      ctx.setLineDash([3, 3]);
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(jx + jw + 6, yy.line); ctx.lineTo(lx - 6, yy.text - 4); ctx.stroke();
      ctx.setLineDash([]);
      ctx.textAlign = "left";
      ctx.font = font(600, 10, false);
      if ("letterSpacing" in ctx) ctx.letterSpacing = "1.2px";
      ctx.fillStyle = rgba(c.muted, 0.9);
      ctx.fillText(head, lx, yy.text - 10);
      if ("letterSpacing" in ctx) ctx.letterSpacing = "0px";
      ctx.font = font(700, 15, true);
      ctx.fillStyle = rgba(col, 1);
      ctx.fillText(value, lx, yy.text + 8);
    };
    var savedY = Math.max(surf, top);
    var instText = top + 10, saveText = Math.max(savedY + 8, instText + 46);
    if (saveText > bot - 4) saveText = bot - 4;
    label({ line: top, text: instText }, "EV INSTALMENT", fmt.rand(d.instalment), c.ev);
    if (d.saving > 0) {
      label({ line: savedY, text: saveText }, lvl >= 1 ? "SAVING · COVERS IT ALL" : "SAVING · COVERS " + Math.round(Math.min(lvl, 1) * 100) + "%",
        fmt.rand(Math.max(0, d.saving) * (jarTo > 0 ? Math.min(1, lvl / jarTo) : 1)) + (lvl > 1 ? " (" + fmt.rand(d.saving - d.instalment) + " spare)" : ""), c.good);
    } else {
      label({ line: bot - 2, text: saveText }, "SAVING", "Nothing to put in", c.bad);
    }
  }

  // ------------------------------------------------------------ payback
  var payS = null, payD = null, payFrom = null, payT0 = 0, revealT0 = null;
  var REVEAL_MS = 2000, MORPH_MS = 700;

  function payback(box, o) {
    if (!payS) {
      payS = new Stage(box, 232, "viz-pay", "Total cost of each car year by year, with the point where the electric car pays back.");
      payS.draw = drawPay;
      payS.onFirstView = function () { revealT0 = performance.now(); payS.run(REVEAL_MS + 3500); };
    }
    payS.attach(box);
    var now = performance.now();
    if (payD && payD.fuel.length === o.fuel.length && payS.seen) {
      payFrom = shownSeries(now);
      payT0 = now;
      payS.run(MORPH_MS + 3500);
    } else {
      payFrom = null;
    }
    payD = o;
    payS.paint();
  }

  function shownSeries(now) {
    var o = payD;
    if (!payFrom || reduceMotion) return { fuel: o.fuel.slice(), ev: o.ev.slice(), be: o.breakEven };
    var f = ease((now - payT0) / MORPH_MS);
    var mixA = function (a, b) { return b.map(function (v, i) { return a[i] + (v - a[i]) * f; }); };
    var be = o.breakEven != null && payFrom.be != null ? payFrom.be + (o.breakEven - payFrom.be) * f : o.breakEven;
    return { fuel: mixA(payFrom.fuel, o.fuel), ev: mixA(payFrom.ev, o.ev), be: be };
  }

  function niceStep(raw) {
    if (!(raw > 0)) return 1;
    var p = Math.pow(10, Math.floor(Math.log10(raw)));
    var f = raw / p;
    return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10) * p;
  }

  function drawPay(ctx, now) {
    var c = colours(), o = payD, w = payS.w, h = payS.h;
    var sr = shownSeries(now);
    var m = { l: 58, r: 14, t: 16, b: 28 };
    var iw = w - m.l - m.r, ih = h - m.t - m.b;
    var all = o.ev.concat(o.fuel);
    var lo = Math.min.apply(null, all), hi = Math.max.apply(null, all);
    lo = Math.max(0, lo - (hi - lo) * 0.1);
    var step = niceStep((hi - lo) / 4);
    lo = Math.floor(lo / step) * step;
    hi = Math.ceil(hi / step) * step;
    var x = function (yr) { return m.l + yr / o.years * iw; };
    var y = function (v) { return m.t + (1 - (v - lo) / Math.max(1, hi - lo)) * ih; };
    var reveal = reduceMotion ? 1 : revealT0 === null ? (payS.seen ? 1 : 0) : ease((now - revealT0) / REVEAL_MS);
    var edge = m.l + reveal * iw;

    ctx.font = font(500, 10, false);
    for (var v = lo; v <= hi + 1; v += step) {
      ctx.fillStyle = "rgba(120, 170, 255, 0.14)";
      ctx.fillRect(m.l, Math.round(y(v)), iw, 1);
      ctx.fillStyle = rgba(c.muted, 0.85);
      ctx.textAlign = "right";
      ctx.fillText(fmt.short(v), m.l - 6, y(v) + 4);
    }
    var every = o.years > 8 ? 2 : 1;
    ctx.textAlign = "center";
    for (var yr = 0; yr <= o.years; yr += every) ctx.fillText(yr === 0 ? "Buy" : "Yr " + yr, x(yr), h - 8);

    // the lines, drawn across as they reveal
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, edge + 1, h);
    ctx.clip();
    [[sr.fuel, c.fuel], [sr.ev, c.ev]].forEach(function (ln) {
      ctx.beginPath();
      ln[0].forEach(function (val, i) { if (i) ctx.lineTo(x(i), y(val)); else ctx.moveTo(x(i), y(val)); });
      ctx.strokeStyle = rgba(ln[1], 1);
      ctx.lineWidth = 2.5;
      ctx.lineJoin = "round";
      ctx.shadowColor = rgba(ln[1], 0.85);
      ctx.shadowBlur = 8;
      ctx.stroke();
      ctx.shadowBlur = 0;
      ln[0].forEach(function (val, i) {
        ctx.beginPath();
        ctx.arc(x(i), y(val), 3, 0, Math.PI * 2);
        ctx.fillStyle = rgba(ln[1], 1);
        ctx.fill();
      });
    });
    ctx.restore();
    // the drawing tips
    if (reveal < 1) {
      [sr.fuel, sr.ev].forEach(function (arr, k) {
        var yrAt = reveal * o.years, i0 = Math.min(arr.length - 2, Math.floor(yrAt)), f = yrAt - i0;
        var val = arr[i0] + (arr[i0 + 1] - arr[i0]) * f;
        ctx.beginPath();
        ctx.arc(edge, y(val), 4.5, 0, Math.PI * 2);
        ctx.fillStyle = "#ffffff";
        ctx.shadowColor = rgba(k ? c.ev : c.fuel, 1);
        ctx.shadowBlur = 14;
        ctx.fill();
        ctx.shadowBlur = 0;
      });
    }

    // the break-even moment
    if (sr.be != null && sr.be > 0 && x(sr.be) <= edge) {
      var i = Math.min(sr.ev.length - 2, Math.floor(sr.be)), fr = sr.be - i;
      var bv = sr.ev[i] + (sr.ev[i + 1] - sr.ev[i]) * fr;
      var bx = x(sr.be), by = y(bv);
      ctx.strokeStyle = rgba(c.good, 0.6);
      ctx.setLineDash([4, 4]);
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(bx, by); ctx.lineTo(bx, y(lo)); ctx.stroke();
      ctx.setLineDash([]);
      var since = revealT0 === null ? 1e9 : now - revealT0 - REVEAL_MS * (sr.be / o.years);
      if (!reduceMotion && since < 3000) {
        for (var r = 0; r < 2; r++) {
          var pf = ((since / 900) + r / 2) % 1;
          ctx.beginPath();
          ctx.arc(bx, by, 6 + pf * 18, 0, Math.PI * 2);
          ctx.strokeStyle = rgba(c.good, 0.8 * (1 - pf));
          ctx.lineWidth = 1.5;
          ctx.stroke();
        }
      }
      ctx.beginPath();
      ctx.arc(bx, by, 6, 0, Math.PI * 2);
      ctx.fillStyle = rgba(c.good, 1);
      ctx.shadowColor = rgba(c.good, 1);
      ctx.shadowBlur = 16;
      ctx.fill();
      ctx.shadowBlur = 0;
      // callout
      var t1 = "Pays back in " + fmt.yearsText(sr.be), t2 = "Both cars " + fmt.short(bv) + " by then";
      ctx.font = font(500, 11, false);
      var w2 = ctx.measureText(t2).width;
      ctx.font = font(600, 11, false);
      var bw = Math.max(ctx.measureText(t1).width, w2, 60) + 16, bh = 36;
      var cx = bx + 12 + bw > w - 4 ? bx - 12 - bw : bx + 12;
      var cy = Math.max(m.t, by - bh - 10);
      ctx.beginPath();
      roundRect(ctx, cx, cy, bw, bh, 6);
      ctx.fillStyle = "rgba(8, 14, 38, 0.9)";
      ctx.fill();
      ctx.strokeStyle = rgba(c.good, 0.75);
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.textAlign = "left";
      ctx.fillStyle = rgba(c.good, 1);
      ctx.fillText(t1, cx + 8, cy + 15);
      ctx.font = font(500, 11, false);
      ctx.fillStyle = rgba(c.text, 0.9);
      ctx.fillText(t2, cx + 8, cy + 30);
    }
  }

  window.EVViz = {
    format: function (f) { fmt = f; },
    race: race,
    trip: trip,
    jar: jar,
    payback: payback
  };
})();
