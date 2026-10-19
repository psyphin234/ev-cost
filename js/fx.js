/* Visual effects, decoration only (nothing here touches the sums):
   - the header animation (canvas.hero-fx): a four-cylinder petrol engine
     beside an electric motor, both in blue. The engine's pistons pump on a
     turning crankshaft, each cylinder flashing as it fires (order 1-3-4-2) and
     puffing exhaust; the motor is an EV traction motor in cutaway, its rotor
     spinning smoothly inside copper windings with blue arcs crackling round
     them, the inverter and its high-voltage cables on top. Busy against smooth: no
     figures;
   - the form's fieldsets and the "good to know" cards fading in as they
     scroll into view.
   Under prefers-reduced-motion the animation is drawn once and stands still,
   and the fade-ins are skipped. The circuit board behind the page is
   js/circuit.js. */
(function () {
  "use strict";

  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // ---------------------------------------------------------------- fade-ins
  function setUpReveal() {
    if (reduceMotion || !("IntersectionObserver" in window)) return;
    var targets = document.querySelectorAll(".inputs fieldset, .know-grid > *");
    document.documentElement.classList.add("fx-reveal");
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (!e.isIntersecting) return;
        e.target.classList.add("is-visible");
        io.unobserve(e.target);
      });
    }, { rootMargin: "0px 0px -6% 0px", threshold: 0.04 });
    targets.forEach(function (el) { io.observe(el); });
    // Fail-safe: nothing stays invisible if the observer misses it.
    setTimeout(function () {
      targets.forEach(function (el) { el.classList.add("is-visible"); });
    }, 4000);
  }

  // ------------------------------------------------------ engine vs motor
  // Scene units: the engine's crankshaft centre line is y = 0 and its block
  // runs x = 0..280; the motor is centred at (MX, MY). The scene spans about
  // x -30..620, y -200..90.
  // Both machines in the same blue (owner's request, 2026-10-19), with paler
  // blues for the bright parts: flames, sparks, copper windings and cables.
  var EV = [76, 201, 255], GLOW = [215, 245, 255], BRIGHT = [150, 225, 255];
  var CYL = [52, 110, 168, 226];            // cylinder centres
  var THROW = [0, Math.PI, Math.PI, 0];     // crank pins: 1 and 4 together, 2 and 3 opposite
  var FIRE = [0, 540, 180, 360];            // degrees of the 720° cycle each fires at: 1-3-4-2
  var R = 20, ROD = 66, BORE = 44;
  var MX = 470, MY = -70;
  var CRANK = 1.15, SPIN = 0.6;            // revolutions a second

  function rgba(c, a) {
    return "rgba(" + c[0] + ", " + c[1] + ", " + c[2] + ", " + a + ")";
  }

  // Piston crown height above the crank centre for crank angle a (0 = top).
  function pistonY(a) {
    var sx = R * Math.sin(a);
    return -(R * Math.cos(a) + Math.sqrt(ROD * ROD - sx * sx));
  }

  function setUpHero() {
    var canvas = document.querySelector(".hero-fx");
    if (!canvas || !canvas.getContext) return;
    var header = canvas.parentElement;
    var text = header.querySelector(".brand-text");
    var ctx = canvas.getContext("2d");

    var w = 0, h = 0, s = 1, ox = 0, oy = 0, fade = 1, labels = true;
    var mx = 0, my = 0, tx = 0, ty = 0;
    var puffs = [];

    function resize() {
      var rect = header.getBoundingClientRect();
      var dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = rect.width; h = rect.height;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      var textRight = text ? text.getBoundingClientRect().right - rect.left : w * 0.6;
      var contentRight = (w + Math.min(w, 1120)) / 2;
      var room = Math.min(w - 24, contentRight + 140) - textRight - 30;
      if (room > 300) {
        s = Math.min(room / 640, (h - 30) / 290);
        ox = textRight + 30 + (room - 620 * s) / 2 + 20 * s;
        oy = h / 2 + 50 * s;
        fade = 1; labels = true;
      } else {
        // Narrow screens: faint, behind the text, along the bottom right.
        s = Math.min((w * 0.95) / 660, (h * 0.6) / 300);
        ox = w - 630 * s;
        oy = h - 100 * s;
        fade = 0.18; labels = false;
      }
    }

    function glowStroke(c, a, width, blur) {
      ctx.strokeStyle = rgba(c, a);
      ctx.lineWidth = width / s;
      ctx.shadowColor = rgba(c, 0.9);
      ctx.shadowBlur = blur;
      ctx.stroke();
      ctx.shadowBlur = 0;
    }

    function roundRect(x, y, rw, rh, r) {
      ctx.moveTo(x + r, y);
      ctx.arcTo(x + rw, y, x + rw, y + rh, r);
      ctx.arcTo(x + rw, y + rh, x, y + rh, r);
      ctx.arcTo(x, y + rh, x, y, r);
      ctx.arcTo(x, y, x + rw, y, r);
      ctx.closePath();
    }

    function engine(time, dt) {
      var crank = time * CRANK * Math.PI * 2;
      var cycle = ((crank * 180) / Math.PI) % 720;

      // Block, head and sump.
      ctx.beginPath();
      roundRect(8, -128, 264, 22, 6);            // cylinder head
      roundRect(14, -106, 252, 84, 4);           // block
      ctx.moveTo(22, 18); ctx.lineTo(258, 18);   // sump
      ctx.lineTo(244, 46); ctx.lineTo(36, 46); ctx.closePath();
      ctx.fillStyle = rgba(EV, 0.05);
      ctx.fill();
      glowStroke(EV, 0.7, 1.4, 6);

      CYL.forEach(function (cx, i) {
        var a = crank + THROW[i];
        var top = pistonY(a);
        // Degrees since this cylinder fired: power 0-180, exhaust 180-360,
        // intake 360-540, compression 540-720.
        var since = (cycle - FIRE[i] + 720) % 720;
        var burn = since < 120 ? 1 - since / 120 : 0;
        var exhaust = since >= 180 && since < 360;

        // Cylinder walls and the combustion space above the piston.
        ctx.beginPath();
        ctx.moveTo(cx - BORE / 2, -106); ctx.lineTo(cx - BORE / 2, -30);
        ctx.moveTo(cx + BORE / 2, -106); ctx.lineTo(cx + BORE / 2, -30);
        glowStroke(EV, 0.45, 1, 3);
        if (burn > 0) {
          var g = ctx.createLinearGradient(0, -106, 0, top);
          g.addColorStop(0, rgba(GLOW, 0.95 * burn));
          g.addColorStop(1, rgba(EV, 0.55 * burn));
          ctx.fillStyle = g;
          ctx.shadowColor = rgba(EV, burn);
          ctx.shadowBlur = 24 * burn;
          ctx.fillRect(cx - BORE / 2 + 1, -105, BORE - 2, top + 105);
          ctx.shadowBlur = 0;
        }

        // Spark plug, sparking just as it fires; valves.
        ctx.beginPath();
        ctx.moveTo(cx, -128); ctx.lineTo(cx, -142);
        ctx.moveTo(cx - 5, -142); ctx.lineTo(cx + 5, -142);
        glowStroke(EV, 0.6, 1.2, 3);
        if (since < 18 || since > 714) {
          ctx.beginPath();
          ctx.arc(cx, -110, 5, 0, Math.PI * 2);
          ctx.fillStyle = "rgba(255, 255, 240, 0.95)";
          ctx.shadowColor = rgba(GLOW, 1);
          ctx.shadowBlur = 18;
          ctx.fill();
          ctx.shadowBlur = 0;
        }
        // Valves: exhaust on the left, intake on the right. Closed, each sits
        // in its seat in the cylinder roof; it opens down into the cylinder
        // through its stroke (exhaust 180-360, intake 360-540), so a gap shows
        // only while it's open.
        var exL = exhaust ? 8 * Math.sin(((since - 180) / 180) * Math.PI) : 0;
        var inL = since >= 360 && since < 540 ? 8 * Math.sin(((since - 360) / 180) * Math.PI) : 0;
        if (inL > 0) {
          // fresh mixture drawn in
          ctx.fillStyle = rgba(GLOW, 0.1 * (inL / 8));
          ctx.fillRect(cx - BORE / 2 + 1, -105, BORE - 2, top + 105);
        }
        ctx.beginPath();
        // ports through the head
        ctx.moveTo(cx - 6, -106); ctx.lineTo(cx - 10, -118); ctx.lineTo(cx - BORE / 2 - 4, -122);
        ctx.moveTo(cx - 18, -106); ctx.lineTo(cx - BORE / 2 - 4, -112);
        ctx.moveTo(cx + 6, -106); ctx.lineTo(cx + 10, -118); ctx.lineTo(cx + BORE / 2 + 4, -122);
        ctx.moveTo(cx + 18, -106); ctx.lineTo(cx + BORE / 2 + 4, -112);
        glowStroke(EV, 0.3, 0.8, 0);
        ctx.beginPath();
        ctx.moveTo(cx - 12, -128); ctx.lineTo(cx - 12, -106 + exL);
        ctx.moveTo(cx - 18, -106 + exL); ctx.lineTo(cx - 6, -106 + exL);
        ctx.moveTo(cx + 12, -128); ctx.lineTo(cx + 12, -106 + inL);
        ctx.moveTo(cx + 6, -106 + inL); ctx.lineTo(cx + 18, -106 + inL);
        glowStroke(EV, 0.85, 1.4, 4);

        // Piston, rod and crank throw.
        var px = R * Math.sin(a), py = -R * Math.cos(a);
        ctx.beginPath();
        roundRect(cx - BORE / 2 + 3, top, BORE - 6, 24, 3);
        ctx.fillStyle = rgba(EV, 0.14);
        ctx.fill();
        glowStroke(EV, 0.9, 1.4, 6);
        ctx.beginPath();
        ctx.moveTo(cx, top + 14); ctx.lineTo(cx + px, py);
        glowStroke(EV, 0.85, 2, 5);
        ctx.beginPath();
        ctx.moveTo(cx + 9, 0); ctx.arc(cx, 0, 9, 0, Math.PI * 2);
        ctx.moveTo(cx + px + 4, py); ctx.arc(cx + px, py, 4, 0, Math.PI * 2);
        // counterweight opposite the pin
        var opp = a + Math.PI / 2;
        ctx.moveTo(cx + Math.cos(opp - 0.9) * R, Math.sin(opp - 0.9) * R);
        ctx.arc(cx, 0, R, opp - 0.9, opp + 0.9);
        glowStroke(EV, 0.7, 1.2, 4);

        // Exhaust puffs out of the manifold on the exhaust stroke.
        if (exhaust && !reduceMotion && Math.random() < dt * 8) {
          puffs.push({ x: cx - 12, y: -132, vx: -6 - Math.random() * 10, vy: -26 - Math.random() * 18, age: 0, r: 3 + Math.random() * 3 });
        }
      });

      // Crankshaft along the bottom.
      ctx.beginPath();
      ctx.moveTo(22, 0); ctx.lineTo(258, 0);
      glowStroke(EV, 0.6, 2.4, 5);

      // Puffs drift and fade.
      for (var i = puffs.length - 1; i >= 0; i--) {
        var p = puffs[i];
        p.age += dt;
        if (p.age > 1.6) { puffs.splice(i, 1); continue; }
        p.x += p.vx * dt; p.y += p.vy * dt;
        var k = 1 - p.age / 1.6;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r + p.age * 10, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(170, 195, 230, " + 0.1 * k + ")";
        ctx.fill();
      }
    }

    // An EV traction motor in cutaway, seen three-quarter on (from the owner's
    // reference picture): a laminated stator drum with copper windings round
    // its front face, the rotor spinning inside, the shaft coming out towards
    // you, blue arcs crackling round the windings, and the inverter on top with
    // its high-voltage cables, current running along them.
    var K = 0.55;      // how narrow the end faces look
    function motor(time) {
      var rot = reduceMotion ? 0.6 : time * SPIN * Math.PI * 2;
      var field = rot + Math.PI / 4;
      var Rr = 78;
      var F = { x: MX + 45, y: MY + 6 }, B = { x: MX - 52, y: MY - 22 };   // front and back face centres
      var pt = function (c, r, a) { return [c.x + r * K * Math.cos(a), c.y + r * Math.sin(a)]; };
      var ellipse = function (c, r, a0, a1) { ctx.ellipse(c.x, c.y, r * K, r, 0, a0, a1); };

      // HV cables from the inverter, curving away behind the motor.
      var cables = function () {
        ctx.moveTo(B.x + 18, B.y - Rr - 22); ctx.bezierCurveTo(B.x - 30, B.y - Rr - 30, B.x - 60, B.y - 40, B.x - 70, B.y + 10);
        ctx.moveTo(B.x + 30, B.y - Rr - 18); ctx.bezierCurveTo(B.x - 14, B.y - Rr - 6, B.x - 44, B.y - 20, B.x - 52, B.y + 24);
      };
      ctx.beginPath(); cables();
      glowStroke(BRIGHT, 0.75, 4, 6);
      if (!reduceMotion) {
        ctx.setLineDash([4 / s, 10 / s]);
        ctx.lineDashOffset = time * 36 / s;
        ctx.beginPath(); cables();
        glowStroke(GLOW, 0.9, 1.4, 6);
        ctx.setLineDash([]);
      }

      // Stator drum: a faint body, the back rim (its outer half), the sides
      // and the laminations.
      var bt = pt(B, Rr, -Math.PI / 2), ft = pt(F, Rr, -Math.PI / 2);
      var bb = pt(B, Rr, Math.PI / 2), fb = pt(F, Rr, Math.PI / 2);
      ctx.beginPath();
      ellipse(B, Rr, Math.PI / 2, Math.PI * 1.5);
      ctx.lineTo(ft[0], ft[1]);
      ellipse(F, Rr, -Math.PI / 2, Math.PI / 2);
      ctx.closePath();
      ctx.fillStyle = rgba(EV, 0.05);
      ctx.fill();
      ctx.beginPath();
      ellipse(B, Rr, Math.PI / 2, Math.PI * 1.5);
      ctx.moveTo(bt[0], bt[1]); ctx.lineTo(ft[0], ft[1]);
      ctx.moveTo(bb[0], bb[1]); ctx.lineTo(fb[0], fb[1]);
      glowStroke(EV, 0.7, 1.4, 6);
      for (var l = 1; l < 9; l++) {
        var f = l / 9, c = { x: B.x + (F.x - B.x) * f, y: B.y + (F.y - B.y) * f };
        ctx.beginPath();
        ellipse(c, Rr, Math.PI / 2, Math.PI * 1.5);
        glowStroke(EV, l % 3 === 0 ? 0.45 : 0.2, l % 3 === 0 ? 1.2 : 0.8, l % 3 === 0 ? 3 : 0);
      }

      // Inverter box on top.
      var o = [B.x + 8, B.y - Rr - 6], u = [(F.x - B.x) * 0.8, (F.y - B.y) * 0.8], v = [16, -12], hh = [0, -26];
      var P = function (a, b, cc) { return [o[0] + u[0] * a + v[0] * b + hh[0] * cc, o[1] + u[1] * a + v[1] * b + hh[1] * cc]; };
      var face = function (pts) {
        ctx.moveTo(pts[0][0], pts[0][1]);
        pts.slice(1).forEach(function (q) { ctx.lineTo(q[0], q[1]); });
        ctx.closePath();
      };
      ctx.beginPath();
      face([P(0, 0, 0), P(1, 0, 0), P(1, 0, 1), P(0, 0, 1)]);
      face([P(1, 0, 0), P(1, 1, 0), P(1, 1, 1), P(1, 0, 1)]);
      face([P(0, 0, 1), P(1, 0, 1), P(1, 1, 1), P(0, 1, 1)]);
      ctx.fillStyle = rgba(EV, 0.06);
      ctx.fill();
      glowStroke(EV, 0.7, 1.2, 5);
      ctx.beginPath();
      for (var fin = 1; fin < 7; fin++) {
        var a0 = P(fin / 7, 0.15, 1), a1 = P(fin / 7, 0.85, 1);
        ctx.moveTo(a0[0], a0[1]); ctx.lineTo(a1[0], a1[1]);
      }
      glowStroke(EV, 0.3, 0.8, 0);
      // the cables' connectors
      [0.08, 0.2].forEach(function (a) {
        var c0 = P(a, 0, 0.25), c1 = P(a + 0.08, 0, 0.75);
        ctx.beginPath();
        ctx.rect(c0[0], c1[1], c1[0] - c0[0], c0[1] - c1[1]);
        ctx.fillStyle = rgba(BRIGHT, 0.5);
        ctx.fill();
        glowStroke(BRIGHT, 0.85, 1, 4);
      });

      // Front face: the rim, the copper windings (lighting up in turn as the
      // field turns) and the bore.
      ctx.beginPath();
      ellipse(F, Rr, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(6, 12, 32, 0.85)";
      ctx.fill();
      glowStroke(EV, 0.85, 1.6, 8);
      var N = 18;
      for (var k = 0; k < N; k++) {
        var ang = (k / N) * Math.PI * 2, half = (Math.PI / N) * 0.8;
        var on = Math.pow(Math.max(0, Math.cos(2 * (ang - field))), 4);
        var p1 = pt(F, Rr * 0.66, ang - half), p2 = pt(F, Rr * 0.66, ang + half);
        var q1 = pt(F, Rr * 0.94, ang - half * 1.1), q2 = pt(F, Rr * 0.94, ang + half * 1.1);
        var tip = pt(F, Rr * 1.0, ang);
        ctx.beginPath();
        ctx.moveTo(p1[0], p1[1]); ctx.lineTo(q1[0], q1[1]);
        ctx.quadraticCurveTo(tip[0], tip[1], q2[0], q2[1]);
        ctx.lineTo(p2[0], p2[1]);
        ctx.closePath();
        ctx.fillStyle = rgba(BRIGHT, 0.14 + 0.4 * on);
        ctx.shadowColor = rgba(BRIGHT, on);
        ctx.shadowBlur = 12 * on;
        ctx.fill();
        ctx.shadowBlur = 0;
        glowStroke(BRIGHT, 0.5 + 0.45 * on, 1, 2 + 5 * on);
      }
      ctx.beginPath();
      ellipse(F, Rr * 0.62, 0, Math.PI * 2);
      glowStroke(EV, 0.5, 1, 3);

      // Rotor, with bright swirls turning on it.
      ctx.beginPath();
      ellipse(F, Rr * 0.56, 0, Math.PI * 2);
      ctx.fillStyle = rgba(EV, 0.06);
      ctx.fill();
      glowStroke(EV, 0.75, 1.3, 5);
      for (var sw = 0; sw < 3; sw++) {
        var st = rot + (sw * Math.PI * 2) / 3;
        [0.48, 0.38].forEach(function (rr, j) {
          ctx.beginPath();
          for (var n = 0; n <= 10; n++) {
            var q = pt(F, Rr * rr, st + n * 0.13 + j * 0.3);
            if (n) ctx.lineTo(q[0], q[1]); else ctx.moveTo(q[0], q[1]);
          }
          glowStroke(BRIGHT, j ? 0.55 : 0.9, j ? 1 : 1.6, 8);
        });
      }
      ctx.beginPath();
      ellipse(F, Rr * 0.2, 0, Math.PI * 2);
      glowStroke(EV, 0.8, 1.3, 5);

      // Shaft coming out towards you.
      var sr = 11, e = { x: F.x + 62, y: F.y + 17 };
      var s1 = pt(F, sr, -Math.PI / 2), s2 = pt(F, sr, Math.PI / 2), e1 = pt(e, sr, -Math.PI / 2), e2 = pt(e, sr, Math.PI / 2);
      ctx.beginPath();
      ctx.moveTo(s1[0], s1[1]); ctx.lineTo(e1[0], e1[1]);
      ctx.moveTo(s2[0], s2[1]); ctx.lineTo(e2[0], e2[1]);
      ellipse(e, sr, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(6, 12, 32, 0.9)";
      ctx.fill();
      glowStroke(EV, 0.9, 1.4, 6);
      var key = pt(e, sr * 0.7, rot);
      ctx.beginPath();
      ctx.moveTo(e.x, e.y); ctx.lineTo(key[0], key[1]);
      glowStroke(EV, 0.9, 1.4, 4);

      // Electric arcs crackling round the windings.
      for (var i = 0; i < 3; i++) {
        var start = (reduceMotion ? 0.5 : time * 1.6) + (i * Math.PI * 2) / 3;
        var path = [];
        for (var m = 0; m <= 28; m++) {
          var jit = Math.sin(time * 23 + m * 1.9 + i * 4) * 0.035 + Math.sin(time * 37 + m * 3.1 + i) * 0.025;
          path.push(pt(F, Rr * (1.07 + jit * 1.6 + 0.06 * Math.sin(m * 0.4 + i)), start + m * 0.085));
        }
        var flick = reduceMotion ? 0.8 : 0.55 + 0.45 * Math.abs(Math.sin(time * 3 + i * 2));
        [[EV, 2.2, 12, 0.8 * flick], [[235, 250, 255], 0.9, 4, flick]].forEach(function (pass) {
          ctx.beginPath();
          path.forEach(function (q, n) { if (n) ctx.lineTo(q[0], q[1]); else ctx.moveTo(q[0], q[1]); });
          glowStroke(pass[0], pass[3], pass[1], pass[2]);
        });
      }
    }

    var last = 0;
    function frame(t) {
      var time = t / 1000;
      var dt = last ? Math.min((t - last) / 1000, 0.1) : 0;
      last = t;
      ctx.clearRect(0, 0, w, h);
      tx += (mx - tx) * 0.05; ty += (my - ty) * 0.05;

      ctx.save();
      ctx.translate(ox + tx * 10, oy + ty * 6);
      ctx.scale(s, s);
      ctx.globalAlpha = fade;

      // Light pooled under each machine, in its colour.
      [[140, -40, EV, 0.16], [MX, MY, EV, 0.2]].forEach(function (l) {
        var pool = ctx.createRadialGradient(l[0], l[1], 10, l[0], l[1], 220);
        pool.addColorStop(0, rgba(l[2], l[3]));
        pool.addColorStop(1, rgba(l[2], 0));
        ctx.fillStyle = pool;
        ctx.fillRect(l[0] - 230, l[1] - 230, 460, 460);
      });

      engine(time, dt);
      motor(time);

      if (labels) {
        ctx.font = "600 " + 10.5 / s + "px Inter, system-ui, sans-serif";
        if ("letterSpacing" in ctx) ctx.letterSpacing = 2 / s + "px";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillStyle = rgba(EV, 0.9);
        ctx.shadowColor = rgba(EV, 0.8); ctx.shadowBlur = 8;
        ctx.fillText("PETROL ENGINE", 140, 72);
        ctx.fillStyle = rgba(EV, 0.95);
        ctx.shadowColor = rgba(EV, 0.8);
        ctx.fillText("ELECTRIC MOTOR", MX, 72);
        ctx.shadowBlur = 0;
        ctx.font = "600 " + 13 / s + "px Sora, Inter, system-ui, sans-serif";
        ctx.fillStyle = "rgba(168, 183, 214, 0.7)";
        ctx.fillText("vs", 330, -60);
        if ("letterSpacing" in ctx) ctx.letterSpacing = "0px";
      }
      ctx.restore();
    }

    var running = false, visible = true, raf = 0;
    function loop(t) { frame(t); raf = requestAnimationFrame(loop); }
    function update() {
      var should = !reduceMotion && visible && !document.hidden;
      if (should && !running) { running = true; last = 0; raf = requestAnimationFrame(loop); }
      if (!should && running) { running = false; cancelAnimationFrame(raf); }
    }
    // A still frame: cylinder 1 just fired, the coils mid-turn.
    function still() { if (!running) { last = 0; frame(60); } }

    resize();
    still();
    if ("ResizeObserver" in window) new ResizeObserver(function () { resize(); still(); }).observe(header);
    else window.addEventListener("resize", function () { resize(); still(); });
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { resize(); still(); });
    if ("IntersectionObserver" in window) {
      new IntersectionObserver(function (entries) { visible = entries[0].isIntersecting; update(); }).observe(header);
    }
    document.addEventListener("visibilitychange", update);
    header.addEventListener("pointermove", function (e) {
      var rect = header.getBoundingClientRect();
      mx = (e.clientX - rect.left) / rect.width - 0.5;
      my = (e.clientY - rect.top) / rect.height - 0.5;
    });
    update();
  }

  function start() { setUpReveal(); setUpHero(); }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start);
  else start();
})();
