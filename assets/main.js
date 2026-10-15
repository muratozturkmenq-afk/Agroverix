/* Tarla Nabzı v2 · interactions */
(function () {
  "use strict";
  var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var G = window.gsap, ST = window.ScrollTrigger;
  var hasG = !!(G && ST);
  if (hasG) G.registerPlugin(ST);

  function $(s, r) { return (r || document).querySelector(s); }
  function $$(s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); }
  function fmt(n, d) { d = d || 0; return Number(n).toLocaleString("tr-TR", { minimumFractionDigits: d, maximumFractionDigits: d }); }
  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function ease(t) { return t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; }
  function easeOut(t) { return 1 - Math.pow(1 - t, 3); }
  function sstep(a, b, x) { var t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); }
  function rng(seed) { return function () { seed |= 0; seed = seed + 0x6D2B79F5 | 0; var t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
  function once(el, cb, th) {
    if (!el) return;
    if (!("IntersectionObserver" in window)) { cb(); return; }
    var io = new IntersectionObserver(function (es) { if (es[0].isIntersecting) { io.disconnect(); cb(); } }, { threshold: th || 0.3 });
    io.observe(el);
  }
  function countTo(el, from, to, dec, dur, prefix, suffix) {
    if (!el) return;
    prefix = prefix || ""; suffix = suffix || "";
    if (reduce) { el.textContent = prefix + fmt(to, dec) + suffix; return; }
    var t0 = performance.now();
    (function tick(now) {
      var t = clamp((now - t0) / (dur * 1000), 0, 1);
      el.textContent = prefix + fmt(lerp(from, to, easeOut(t)), dec) + suffix;
      if (t < 1) requestAnimationFrame(tick);
    })(t0);
  }
  var svgNS = "http://www.w3.org/2000/svg";
  function sv(tag, attrs, parent) { var e = document.createElementNS(svgNS, tag); for (var k in attrs) e.setAttribute(k, attrs[k]); if (parent) parent.appendChild(e); return e; }

  /* ---------- smooth scroll ---------- */
  var lenis = null;
  if (window.Lenis && !reduce) {
    try {
      lenis = new window.Lenis({ lerp: 0.09, smoothWheel: true });
      if (hasG) { lenis.on("scroll", ST.update); G.ticker.add(function (t) { lenis.raf(t * 1000); }); G.ticker.lagSmoothing(0); }
      else { (function raf(t) { lenis.raf(t); requestAnimationFrame(raf); })(performance.now()); }
    } catch (e) { lenis = null; }
  }
  $$('a[href^="#"]').forEach(function (a) {
    a.addEventListener("click", function (e) {
      var id = a.getAttribute("href"); if (id.length < 2) return;
      var t = document.querySelector(id); if (!t) return;
      e.preventDefault();
      if (lenis) lenis.scrollTo(t, { offset: 0, duration: 1.4 }); else t.scrollIntoView({ behavior: reduce ? "auto" : "smooth" });
    });
  });

  /* ---------- nav + progress ---------- */
  var nav = $("#nav"), bar = $(".progress i");
  function onScroll() {
    var y = window.scrollY;
    nav.classList.toggle("solid", y > 40);
    var h = document.documentElement.scrollHeight - window.innerHeight;
    bar.style.transform = "scaleX(" + (h > 0 ? y / h : 0) + ")";
  }
  window.addEventListener("scroll", onScroll, { passive: true }); onScroll();

  /* ---------- loader + hero intro ---------- */
  function heroIn() {
    if (!hasG || reduce) return;
    G.from(".hero-title .w > span", { yPercent: 105, duration: 0.95, ease: "power4.out", stagger: 0.055 });
    G.from(".kicker, .hero-sub, .hero-cta", { y: 18, opacity: 0, duration: 0.8, ease: "power3.out", stagger: 0.1, delay: 0.25 });
    G.from(".fcard", { y: 18, opacity: 0, duration: 0.8, ease: "power3.out", stagger: 0.1, delay: 0.45 });
    G.to(".hero-photo", { scale: 1.065, ease: "none", scrollTrigger: { trigger: ".hero", start: "top top", end: "bottom top", scrub: true } });
    G.to(".hero-inner", { yPercent: -8, opacity: 0.48, ease: "none", scrollTrigger: { trigger: ".hero", start: "top top", end: "bottom top", scrub: true } });
    G.to(".fcard", { yPercent: -14, ease: "none", scrollTrigger: { trigger: ".hero", start: "top top", end: "bottom top", scrub: true } });
  }
  var loader = $("#loader");
  setTimeout(function () {
    loader.classList.add("done");
    heroIn();
    if (hasG) setTimeout(function () { ST.refresh(); }, 400);
  }, reduce ? 0 : 800);

  /* ---------- season simulator ---------- */
  (function season() {
    var OPS = [
      { day: 7, t: "Sürüm", ic: "S", cl: "i-till", col: "#8B5E3C", n: "Derin sürüm + diskaro", c: 1450, ev: "Derin sürüm yapıldı" },
      { day: 21, t: "Ekim", ic: "E", cl: "i-seed", col: "#3F7D3A", n: "Sertifikalı tohum, 2,5 kg/da", c: 1900, ev: "Ekim yapıldı" },
      { day: 32, t: "Gübre", ic: "G", cl: "i-fert", col: "#C08A10", n: "Taban gübresi DAP, 20 kg/da", c: 2600, ev: "Taban gübresi atıldı" },
      { day: 70, t: "Sulama", ic: "Su", cl: "i-water", col: "#2F3CCF", n: "Damla sulama, elektrik ve bakım", c: 2100, ev: "Damla sulama başladı" },
      { day: 88, t: "İlaç", ic: "İ", cl: "i-pest", col: "#B4372A", n: "Beyaz sinek · Flonicamid", c: 950, ev: "Beyaz sineğe ilaçlama yapıldı" },
      { day: 105, t: "Gübre", ic: "G", cl: "i-fert", col: "#C08A10", n: "Üst gübre Üre, 25 kg/da", c: 1500, ev: "Üst gübre atıldı" },
      { day: 120, t: "İlaç", ic: "İ", cl: "i-pest", col: "#B4372A", n: "Yeşil kurt · Emamektin benzoat", c: 1100, ev: "Yeşil kurda ilaçlama yapıldı" },
      { day: 177, t: "Hasat", ic: "H", cl: "i-harv", col: "#12160E", n: "Makineli hasat", c: 1200, ev: "Hasat yapıldı" }
    ];
    var PESTEV = [{ a: 76, b: 88, t: "Beyaz sinek görüldü" }, { a: 108, b: 120, t: "Yeşil kurt görüldü" }];
    var MAXD = 197, HARVEST = 177, REG_PEST = 1760;
    var S = { day: 0, exp: 500, act: 450, price: 32, area: 20 };
    var base = new Date(2026, 3, 1);

    /* build plant */
    var plant = $("#plant"), roots = $("#roots");
    var rowsBg = $("#rows-bg");
    for (var rx = -40; rx < 460; rx += 26) sv("path", { d: "M" + rx + " 300 L" + (210 + (rx - 210) * 0.35) + " 262" }, rowsBg);
    var rootEls = [
      "M210 302 C 208 330, 214 360, 210 410", "M210 310 C 196 330, 184 344, 170 366", "M210 312 C 226 332, 240 346, 254 372",
      "M210 330 C 196 350, 190 372, 182 398", "M211 334 C 226 356, 232 380, 238 404", "M210 360 C 220 376, 222 394, 226 420"
    ].map(function (d) { var p = sv("path", { d: d, class: "pl-root", pathLength: 1 }, roots); p.style.strokeDasharray = 1; p.style.strokeDashoffset = 1; return p; });
    var stem = sv("path", { class: "pl-stem", d: "M210 300 C 206 252, 214 204, 208 160 C 204 128, 212 104, 210 84", "stroke-width": 5, pathLength: 1 }, plant);
    stem.style.strokeDasharray = 1; stem.style.strokeDashoffset = 1;
    var LEAF = "M0 0 C -6 -4 -16 -6 -18 -16 C -12 -16 -10 -20 -9 -27 C -4 -23 -2 -25 0 -33 C 2 -25 4 -23 9 -27 C 10 -20 12 -16 18 -16 C 16 -6 6 -4 0 0 Z";
    var cot = sv("g", { opacity: 0 }, plant);
    sv("ellipse", { cx: 196, cy: 290, rx: 12, ry: 6, class: "pl-leaf", transform: "rotate(-20 196 290)" }, cot);
    sv("ellipse", { cx: 224, cy: 290, rx: 12, ry: 6, class: "pl-leaf", transform: "rotate(20 224 290)" }, cot);
    var nodes = [];
    for (var k = 0; k < 9; k++) {
      var y = 278 - k * 22.5, side = k % 2 ? 1 : -1, L = 38 - k * 2.6;
      var g = sv("g", { transform: "translate(" + (210 + Math.sin(k) * 2).toFixed(1) + " " + y + ")" }, plant);
      var br = sv("path", { d: "M0 0 Q " + (side * L * 0.5) + " -4 " + (side * L) + " -12", class: "pl-stem", "stroke-width": 2.6, pathLength: 1 }, g);
      br.style.strokeDasharray = 1; br.style.strokeDashoffset = 1;
      var lg = sv("g", { transform: "translate(" + (side * L) + " -12)" }, g);
      var li = sv("g", {}, lg);
      var leaf = sv("path", { d: LEAF, class: "pl-leaf" + (k % 3 === 0 ? " d" : ""), transform: "rotate(" + (side * (58 - k * 4)) + ")" }, li);
      sv("path", { d: "M0 0 L0 -30 M0 -8 L-12 -16 M0 -8 L12 -16", class: "pl-vein", transform: "rotate(" + (side * (58 - k * 4)) + ")" }, li);
      li.style.transformBox = "fill-box"; li.style.transformOrigin = "center";
      var fruit = null;
      if (k >= 2 && k <= 7) {
        var fx = -side * (L * 0.55), fy = -18;
        fruit = sv("g", { transform: "translate(" + fx + " " + fy + ")" }, g);
        sv("path", { d: "M0 18 Q " + (fx * -0.2) + " 8 0 0", class: "pl-stem", "stroke-width": 1.6, transform: "translate(0 0)" }, fruit);
        var fl = sv("g", { opacity: 0 }, fruit);
        for (var pt = 0; pt < 5; pt++) sv("ellipse", { cx: 0, cy: -6, rx: 4.2, ry: 7, class: "pl-petal", transform: "rotate(" + (pt * 72) + ")" }, fl);
        sv("circle", { cx: 0, cy: 0, r: 3, class: "pl-fc" }, fl);
        var bo = sv("g", { opacity: 0 }, fruit);
        sv("path", { d: "M-9 4 L-12 -6 L-4 -2 Z M9 4 L12 -6 L4 -2 Z", class: "pl-bract" }, bo);
        sv("ellipse", { cx: 0, cy: -6, rx: 7.5, ry: 10, class: "pl-boll" }, bo);
        var op = sv("g", { opacity: 0 }, fruit);
        sv("path", { d: "M-10 6 L-14 -4 L-4 0 Z M10 6 L14 -4 L4 0 Z M0 8 L-3 -2 L3 -2 Z", class: "pl-bract dry" }, op);
        [[-6, -6, 7], [6, -6, 7], [0, -13, 7.5], [-3, -2, 6], [4, -1, 6]].forEach(function (c) { sv("circle", { cx: c[0], cy: c[1], r: c[2], class: "pl-cot" }, op); });
        fruit = { fl: fl, bo: bo, op: op, k: k };
      }
      nodes.push({ k: k, br: br, li: li, leaf: leaf, fruit: fruit, y: y });
    }
    // whiteflies
    var wf = $("#pests-wf");
    [[170, 150], [250, 130], [236, 186], [182, 206], [262, 220], [196, 120], [226, 160]].forEach(function (p, i) {
      var gg = sv("g", { transform: "translate(" + p[0] + " " + p[1] + ")" }, wf);
      var gi = sv("g", { class: "wf-g" }, gg); gi.style.animationDelay = (-i * 0.3) + "s";
      sv("path", { d: "M0 0 C -6 -5 -10 1 -7 6 Z M0 0 C 6 -5 10 1 7 6 Z", class: "wf" }, gi);
      sv("ellipse", { cx: 0, cy: 2, rx: 1.4, ry: 3.4, fill: "#E9D67A" }, gi);
    });
    // caterpillar on node 4 fruit area
    var cat = $("#pests-cat");
    for (var ci = 0; ci < 6; ci++) sv("circle", { cx: 232 + ci * 5.5, cy: 196 - ci * 1.6, r: 3.4 - Math.abs(ci - 2.5) * 0.25, class: "cat-seg" }, cat);
    sv("circle", { cx: 266, cy: 186, r: 3, fill: "#5A3E22" }, cat);
    // mist
    var mist = $("#mist"), mr = rng(4);
    for (var mi = 0; mi < 40; mi++) {
      var c = sv("circle", { cx: (120 + mr() * 180).toFixed(1), cy: (40 + mr() * 30).toFixed(1), r: (1 + mr() * 1.8).toFixed(1), class: "mist" }, mist);
      c.style.animation = "fall " + (1 + mr() * 0.8).toFixed(2) + "s linear " + (-mr() * 2).toFixed(2) + "s infinite";
    }
    // granules
    var gran = $("#gran"), gr = rng(8);
    for (var gi2 = 0; gi2 < 46; gi2++) sv("circle", { cx: (20 + gr() * 380).toFixed(1), cy: (296 + gr() * 8).toFixed(1), r: (1 + gr()).toFixed(1), class: "gran" }, gran);

    /* timeline markers */
    var marks = $("#tl-marks");
    OPS.forEach(function (o) { var m = document.createElement("span"); m.className = "tl-mark"; m.style.left = (o.day / MAXD * 100) + "%"; m.style.background = o.col; m.title = o.t; marks.appendChild(m); o.mark = m; });
    /* log rows */
    var log = $("#sim-log");
    OPS.forEach(function (o) {
      var d = new Date(base); d.setDate(d.getDate() + o.day);
      var row = document.createElement("div"); row.className = "lg";
      row.innerHTML = '<span class="dt">' + d.toLocaleDateString("tr-TR", { day: "2-digit", month: "short" }) + '</span><i class="' + o.cl + '">' + o.ic + "</i><span><b>" + o.t + "</b> <small>" + o.n + '</small></span><span class="c">' + fmt(o.c) + " TL/da</span>";
      log.appendChild(row); o.row = row;
    });

    var sky0 = [[156, 199, 232], [242, 228, 196]], sky1 = [[118, 180, 232], [246, 226, 178]], sky2 = [[176, 190, 196], [242, 210, 160]];
    function mix3(a, b, t) { return "rgb(" + a.map(function (v, i) { return Math.round(lerp(v, b[i], t)); }).join(",") + ")"; }
    function vis(el, on, val) { el.setAttribute("opacity", on ? (val == null ? 1 : val) : 0); }

    var lastEvent = "", evTimer = 0, lastLogScroll = -1;
    function render() {
      var d = S.day;
      var date = new Date(base); date.setDate(date.getDate() + Math.round(d));
      $("#sim-date-b").textContent = date.toLocaleDateString("tr-TR", { day: "numeric", month: "long" });
      $("#sim-date-s").textContent = "Sezonun " + (Math.round(d) + 1) + ". günü";
      var stage = d < 7 ? "Ekim öncesi" : d < 21 ? "Toprak hazırlığı" : d < 28 ? "Ekim · çimlenme" : d < 60 ? "Çıkış ve fide" : d < 90 ? "Taraklanma" : d < 120 ? "Çiçeklenme" : d < 160 ? "Koza oluşumu" : d < HARVEST ? "Koza açımı" : "Hasat";
      $("#sim-stage").textContent = stage;

      /* sky + sun */
      var ts = d / MAXD;
      var top = ts < 0.5 ? mix3(sky0[0], sky1[0], ts * 2) : mix3(sky1[0], sky2[0], (ts - 0.5) * 2);
      var bot = ts < 0.5 ? mix3(sky0[1], sky1[1], ts * 2) : mix3(sky1[1], sky2[1], (ts - 0.5) * 2);
      $("#sky-top").setAttribute("stop-color", top); $("#sky-bot").setAttribute("stop-color", bot);
      var sun = $("#sim-sun"); sun.setAttribute("cx", (60 + ts * 300).toFixed(1)); sun.setAttribute("cy", (110 - Math.sin(Math.PI * ts) * 60).toFixed(1));
      $("#clouds").setAttribute("transform", "translate(" + (-ts * 120).toFixed(1) + " 0)");

      /* plant */
      var hf = sstep(24, 150, d);
      stem.style.strokeDashoffset = 1 - hf;
      rootEls.forEach(function (p, i) { p.style.strokeDashoffset = 1 - sstep(24 + i * 6, 120 + i * 8, d); });
      vis(cot, d >= 26 && d < 75, d < 32 ? sstep(26, 32, d) : 1 - sstep(62, 75, d));
      nodes.forEach(function (n) {
        var th = (n.k + 1) / 9.6;
        var g = clamp((hf - th) * 9.6 * 1.4, 0, 1);
        n.br.style.strokeDashoffset = 1 - g;
        var sc = g * (1.28 - n.k * 0.055);
        n.li.setAttribute("transform", "scale(" + sc.toFixed(3) + ")");
        var old = d >= 165;
        n.leaf.style.fill = old ? (d >= HARVEST ? "#9C7A3E" : "#A8A14A") : "";
        n.li.setAttribute("opacity", d >= HARVEST + 6 ? 0.35 : 1);
        if (n.fruit) {
          var f = n.fruit, k = f.k - 2;
          var fa = 92 + k * 4, fb = 118 + k * 4, ba = 112 + k * 4, oa = 160 + (5 - k) * 2;
          var flo = d >= fa && d < fb ? Math.min(sstep(fa, fa + 4, d), 1 - sstep(fb - 4, fb, d)) : 0;
          f.fl.setAttribute("opacity", flo.toFixed(2)); f.fl.setAttribute("transform", "scale(" + (0.5 + flo * 0.5).toFixed(2) + ")");
          var bol = d >= ba && d < oa ? sstep(ba, ba + 6, d) : 0;
          f.bo.setAttribute("opacity", bol.toFixed(2)); f.bo.setAttribute("transform", "scale(" + (0.45 + 0.55 * sstep(ba, ba + 40, d)).toFixed(2) + ")");
          var opn = d >= oa ? sstep(oa, oa + 5, d) : 0;
          f.op.setAttribute("opacity", opn.toFixed(2)); f.op.setAttribute("transform", "scale(" + (0.6 + 0.4 * opn).toFixed(2) + ")");
          vis(f.fl.parentNode, g > 0.6);
        }
      });
      /* effects */
      vis($("#furrows"), d >= 5 && d < 16);
      vis($("#drip"), d >= 66 && d < 80);
      vis($("#gran"), (d >= 30 && d < 38) || (d >= 103 && d < 110));
      vis($("#pests-wf"), d >= 76 && d < 90, d < 80 ? sstep(76, 80, d) : 1 - sstep(87, 90, d));
      vis($("#pests-cat"), d >= 108 && d < 122, d < 111 ? sstep(108, 111, d) : 1 - sstep(119, 122, d));
      vis($("#mist"), (d >= 86 && d < 92) || (d >= 118 && d < 124));
      vis($("#stamp"), d >= HARVEST);

      /* event pill */
      var ev = "", warn = false;
      OPS.forEach(function (o) { if (d >= o.day && d < o.day + 5) ev = o.ev; });
      PESTEV.forEach(function (p) { if (d >= p.a && d < p.a + 6) { ev = p.t; warn = true; } });
      var pill = $("#sim-event");
      if (ev !== lastEvent) { lastEvent = ev; if (ev) { pill.textContent = ev; } pill.classList.toggle("on", !!ev); pill.classList.toggle("warn", warn); }

      /* costs */
      var cum = 0, n = 0, lastDone = -1;
      OPS.forEach(function (o, i) {
        var done = d >= o.day;
        if (done) { cum += o.c; n++; lastDone = i; }
        o.row.classList.toggle("done", done);
        o.mark.classList.toggle("done", done);
      });
      OPS.forEach(function (o, i) { o.row.classList.toggle("now", i === lastDone && d - o.day < 10); });
      if (lastDone !== lastLogScroll && lastDone >= 0) {
        lastLogScroll = lastDone;
        var row = OPS[lastDone].row;
        var target = row.offsetTop - log.clientHeight / 2 + row.offsetHeight / 2;
        log.scrollTo ? log.scrollTo({ top: Math.max(0, target), behavior: reduce ? "auto" : "smooth" }) : (log.scrollTop = target);
      }
      $("#k-cum").innerHTML = fmt(cum) + "<small>TL/da</small>";
      $("#k-cum-s").textContent = n + " işlem · tarla " + fmt(cum * S.area) + " TL";
      var e = cum / S.exp;
      $("#k-exp").innerHTML = fmt(e, 2) + "<small>TL/kg</small>";
      $("#k-exp-s").textContent = fmt(S.exp) + " kg/da tahminle";
      var harvested = d >= HARVEST;
      $("#harvest").classList.toggle("locked", !harvested);
      var a = cum / S.act;
      if (harvested) {
        var diff = (a - e) / e * 100;
        $("#k-act").innerHTML = fmt(a, 2) + "<small>TL/kg</small>";
        $("#k-act-s").textContent = fmt(S.act) + " kg/da · " + (diff >= 0 ? "+%" : "−%") + fmt(Math.abs(diff), 1);
        var pda = S.price * S.act - cum, ptot = pda * S.area;
        var pd = $("#p-da"), pt = $("#p-tot");
        pd.textContent = (pda < 0 ? "−" : "+") + fmt(Math.abs(pda)) + " TL"; pd.className = pda < 0 ? "neg" : "pos";
        pt.textContent = (ptot < 0 ? "−" : "+") + fmt(Math.abs(ptot)) + " TL"; pt.className = ptot < 0 ? "neg" : "pos";
      } else {
        $("#k-act").innerHTML = "—<small>TL/kg</small>"; $("#k-act-s").textContent = "hasatta açılır";
        $("#p-da").textContent = "hasatta"; $("#p-da").className = ""; $("#p-tot").textContent = "hasatta"; $("#p-tot").className = "";
      }
      $("#out-act").textContent = fmt(S.act) + " kg/da";

      /* notes */
      var notes = [];
      var pest = OPS.filter(function (o) { return o.t === "İlaç" && d >= o.day; }).reduce(function (s, o) { return s + o.c; }, 0);
      if (d < 60) notes.push("Harran'da bu dönem kayıtlı 38 pamuk tarlasının %71'i taban gübresini Mayıs'ın ilk haftasında attı.");
      else if (d < 88) notes.push("Bölgende beyaz sinek bildirimleri artıyor. Yaprak altlarını kontrol et; ilk uygulamada en çok Flonicamid ve Acetamiprid tercih ediliyor.");
      if (pest > 0) { var pdv = (pest - REG_PEST) / REG_PEST * 100; notes.push("İlaçlama giderin şimdilik dekar başına " + fmt(pest) + " TL. Bölgede sezon ortalaması " + fmt(REG_PEST) + " TL."); if (d >= 120) notes.push(pdv >= 0 ? "Sezon ilaç giderin ortalamanın %" + fmt(pdv) + " üstünde." : "Sezon ilaç giderin ortalamanın %" + fmt(-pdv) + " altında."); }
      if (harvested) notes.push("Hasat " + fmt(S.act) + " kg/da geldi; kilo maliyetin " + fmt(e, 2) + " TL'den " + fmt(a, 2) + " TL'ye " + (a >= e ? "çıktı." : "indi."));
      if (cum > 0) notes.push(fmt(S.price, S.price % 1 ? 1 : 0) + " TL/kg satış fiyatıyla şu ana kadarki giderin için başabaş verim " + fmt(Math.ceil(cum / S.price)) + " kg/da.");
      $("#ai-notes").innerHTML = notes.slice(-3).map(function (t) { return "<li>" + t + "</li>"; }).join("");

      /* timeline */
      $("#tl-fill").style.width = (d / MAXD * 100) + "%";
      $("#tl-knob").style.left = (d / MAXD * 100) + "%";
      $("#tl").value = Math.round(d);

      chart(d, cum, harvested);
    }

    function chart(d, cumNow, harvested) {
      var W = 600, Hc = 210, pl = 40, pr = 16, pt = 14, pb = 26, iw = W - pl - pr, ih = Hc - pt - pb;
      var totalAll = OPS.reduce(function (s, o) { return s + o.c; }, 0);
      var maxV = Math.max(totalAll / S.exp, totalAll / S.act, S.price) * 1.12;
      var step = maxV > 40 ? 10 : 5, top = Math.ceil(maxV / step) * step;
      function X(day) { return pl + day / MAXD * iw; }
      function Y(v) { return pt + ih - v / top * ih; }
      var s = '<svg viewBox="0 0 ' + W + " " + Hc + '">';
      for (var v = 0; v <= top; v += step) s += '<line class="scg" x1="' + pl + '" x2="' + (W - pr) + '" y1="' + Y(v) + '" y2="' + Y(v) + '"/><text class="sct" x="' + (pl - 6) + '" y="' + (Y(v) + 3) + '" text-anchor="end">' + v + "</text>";
      var full = "M" + X(0) + " " + Y(0), prog = full, c = 0, cp = 0;
      OPS.forEach(function (o) { full += " L" + X(o.day) + " " + Y(c / S.exp); c += o.c; full += " L" + X(o.day) + " " + Y(c / S.exp); });
      full += " L" + X(MAXD) + " " + Y(c / S.exp);
      OPS.forEach(function (o) { if (d >= o.day) { prog += " L" + X(o.day) + " " + Y(cp / S.exp); cp += o.c; prog += " L" + X(o.day) + " " + Y(cp / S.exp); } });
      prog += " L" + X(d) + " " + Y(cp / S.exp);
      s += '<path class="scf" d="' + full + '"/>';
      s += '<path class="sca" d="' + prog + " L" + X(d) + " " + Y(0) + ' Z"/><path class="scl" d="' + prog + '"/>';
      s += '<line class="scp" x1="' + pl + '" x2="' + (W - pr) + '" y1="' + Y(S.price) + '" y2="' + Y(S.price) + '"/><text class="scpt" x="' + (pl + 6) + '" y="' + (Y(S.price) - 6) + '">Satış fiyatı ' + fmt(S.price, S.price % 1 ? 1 : 0) + " TL/kg</text>";
      s += '<circle class="scn" cx="' + X(d) + '" cy="' + Y(cp / S.exp) + '" r="5"/>';
      if (harvested) { var av = cumNow / S.act; s += '<circle class="sch" cx="' + X(HARVEST) + '" cy="' + Y(av) + '" r="6"/><text class="scht" x="' + (X(HARVEST) - 10) + '" y="' + (Y(av) - 10) + '" text-anchor="end">Gerçek ' + fmt(av, 2) + "</text>"; }
      ["Nis", "May", "Haz", "Tem", "Ağu", "Eyl", "Eki"].forEach(function (m, i) { s += '<text class="sct" x="' + X(i * 30.5) + '" y="' + (Hc - 6) + '" text-anchor="' + (i === 0 ? "start" : "middle") + '">' + m + "</text>"; });
      $("#sim-chart").innerHTML = s + "</svg>";
    }

    /* play */
    var playing = false, raf = 0, last = 0;
    var playBtn = $("#play"), ico = $("#play-ico");
    function setIcon() { ico.innerHTML = playing ? '<rect x="3" y="2" width="3.5" height="12" fill="currentColor"/><rect x="9.5" y="2" width="3.5" height="12" fill="currentColor"/>' : '<path d="M3 1.5 L14 8 L3 14.5 Z" fill="currentColor"/>'; playBtn.setAttribute("aria-label", playing ? "Duraklat" : "Sezonu oynat"); }
    function frame(t) {
      if (!playing) return;
      var dt = Math.min(0.05, (t - (last || t)) / 1000); last = t;
      S.day = Math.min(MAXD, S.day + dt * 16);
      render();
      if (S.day >= MAXD) { playing = false; setIcon(); return; }
      raf = requestAnimationFrame(frame);
    }
    function play() { if (S.day >= MAXD) S.day = 0; playing = true; last = 0; setIcon(); raf = requestAnimationFrame(frame); }
    function pause() { playing = false; setIcon(); cancelAnimationFrame(raf); }
    playBtn.addEventListener("click", function () { playing ? pause() : play(); });
    $("#tl").addEventListener("input", function (e) { pause(); S.day = +e.target.value; render(); });
    function num(id, min, fb) { var v = parseFloat(String($(id).value).replace(",", ".")); return isFinite(v) && v >= min ? v : fb; }
    $("#in-area").addEventListener("input", function () { S.area = num("#in-area", 1, S.area); render(); });
    $("#in-exp").addEventListener("input", function () { S.exp = num("#in-exp", 50, S.exp); render(); });
    $("#in-price").addEventListener("input", function () { S.price = num("#in-price", 1, S.price); render(); });
    $("#in-act").addEventListener("input", function () { S.act = num("#in-act", 1, S.act); if (S.day < HARVEST) { pause(); S.day = HARVEST + 4; } render(); });
    render();
    once($(".sim"), function () { if (reduce) { S.day = MAXD; render(); } else setTimeout(play, 300); }, 0.35);
  })();

  /* ---------- pest counters ---------- */
  $$(".pest b[data-count]").forEach(function (b) { once(b, function () { countTo(b, 0, +b.dataset.count, 0, 1.4, b.dataset.prefix || ""); }, 0.6); });

  /* ---------- CTA wheat field ---------- */
  (function wheat() {
    var cv = $("#wheat"); if (!cv) return;
    var ctx = cv.getContext("2d"), W = 0, H = 0, d = 1, stalks = [], mxp = -999, vis = false;
    function build() {
      var r = cv.getBoundingClientRect(); W = r.width; H = r.height; d = Math.min(window.devicePixelRatio || 1, 2);
      cv.width = Math.round(W * d); cv.height = Math.round(H * d);
      var rr = rng(31); stalks = [];
      var n = Math.round(W / 6);
      for (var i = 0; i < n; i++) stalks.push({ x: rr() * W, h: 110 + rr() * 170, ph: rr() * 6.28, lean: (rr() - .5) * 18, depth: rr() });
      stalks.sort(function (a, b) { return a.depth - b.depth; });
    }
    function draw(t) {
      ctx.setTransform(d, 0, 0, d, 0, 0); ctx.clearRect(0, 0, W, H);
      for (var i = 0; i < stalks.length; i++) {
        var s = stalks[i];
        var push = mxp > -900 ? clamp(1 - Math.abs(s.x - mxp) / 120, 0, 1) * (s.x > mxp ? 22 : -22) : 0;
        var sway = Math.sin(t * 1.1 + s.ph + s.x * 0.01) * 8 + s.lean + push;
        var tx = s.x + sway, ty = H - s.h;
        var a = 0.35 + s.depth * 0.65;
        ctx.strokeStyle = "rgba(" + Math.round(lerp(120, 214, s.depth)) + "," + Math.round(lerp(96, 168, s.depth)) + ",40," + a + ")";
        ctx.lineWidth = 1 + s.depth * 1.2;
        ctx.beginPath(); ctx.moveTo(s.x, H); ctx.quadraticCurveTo(s.x + sway * 0.2, H - s.h * 0.5, tx, ty); ctx.stroke();
        var ang = Math.atan2(ty - (H - s.h * 0.5), tx - (s.x + sway * 0.2));
        ctx.fillStyle = "rgba(" + Math.round(lerp(150, 240, s.depth)) + "," + Math.round(lerp(118, 190, s.depth)) + ",60," + a + ")";
        for (var k = 0; k < 7; k++) {
          var hx = tx + Math.cos(ang) * k * 4.2, hy = ty + Math.sin(ang) * k * 4.2;
          ctx.beginPath(); ctx.ellipse(hx - 2, hy, 2.2, 4, ang + 0.5, 0, 6.283); ctx.fill();
          ctx.beginPath(); ctx.ellipse(hx + 2, hy, 2.2, 4, ang - 0.5, 0, 6.283); ctx.fill();
        }
      }
    }
    build();
    window.addEventListener("resize", build);
    var sec = $(".cta");
    sec.addEventListener("pointermove", function (e) { var r = cv.getBoundingClientRect(); mxp = e.clientX - r.left; });
    sec.addEventListener("pointerleave", function () { mxp = -999; });
    try { new IntersectionObserver(function (es) { vis = es[0].isIntersecting; }).observe(sec); } catch (e) { vis = true; }
    if (reduce) { draw(0); return; }
    (function loop(n) { if (vis) draw(n / 1000); requestAnimationFrame(loop); })(0);
  })();

  /* ---------- forms ---------- */
  (function farmerLocationForm() {
    var province = $("#f-il"), district = $("#f-ilce"), village = $("#f-koy");
    var geoButton = $("#f-get-location"), geoStatus = $("#f-location-status");
    var addressStatus = $("#f-address-status"), coordinates = null;
    var admin = null;
    if (!province || !district || !village) return;

    function resetSelect(el, prompt) {
      el.replaceChildren();
      var option = document.createElement("option");
      option.value = ""; option.textContent = prompt; option.disabled = true; option.selected = true;
      el.appendChild(option); el.disabled = true;
    }
    function fillSelect(el, prompt, rows) {
      resetSelect(el, prompt);
      rows.forEach(function (row) {
        var option = document.createElement("option");
        option.value = row.id; option.textContent = row.name; el.appendChild(option);
      });
      el.disabled = rows.length === 0;
    }

    fetch("assets/administrative-units.json?v=2").then(function (response) {
      if (!response.ok) throw new Error("address data unavailable");
      return response.json();
    }).then(function (data) {
      admin = data;
      fillSelect(province, "İl seçin", admin.provinces);
      addressStatus.textContent = "";
    }).catch(function () {
      addressStatus.textContent = "Yer listesi yüklenemedi. Sayfayı yenileyip tekrar deneyin.";
    });

    province.addEventListener("change", function () {
      var rows = (admin && admin.districts[province.value]) || [];
      fillSelect(district, "İlçe seçin", rows);
      resetSelect(village, "Önce ilçe seçin");
    });
    district.addEventListener("change", function () {
      var rows = (admin && admin.settlements[district.value] || []).map(function (name) {
        return { id: name, name: name };
      });
      fillSelect(village, "Köy / mahalle seçin", rows);
      if (!rows.length) village.options[0].textContent = "Bu ilçede kayıt bulunamadı";
    });

    geoButton.addEventListener("click", function () {
      if (!window.isSecureContext) {
        geoStatus.textContent = "Telefon konumu yalnızca güvenli (HTTPS) bağlantıda kullanılabilir.";
        return;
      }
      if (!navigator.geolocation) {
        geoStatus.textContent = "Bu tarayıcı telefon konumunu desteklemiyor.";
        return;
      }
      geoButton.disabled = true;
      geoStatus.textContent = "Konum izni bekleniyor…";
      navigator.geolocation.getCurrentPosition(function (position) {
        coordinates = { latitude: position.coords.latitude, longitude: position.coords.longitude };
        geoStatus.textContent = "Tarla konumu eklendi (yaklaşık " + Math.round(position.coords.accuracy) + " m doğruluk).";
        geoButton.disabled = false;
      }, function (error) {
        var messages = {
          1: "Konum izni verilmedi. Tarayıcı ayarlarından izin verip yeniden deneyin.",
          2: "Telefon konumu alınamadı. GPS'i açıp açık alanda yeniden deneyin.",
          3: "Konum isteği zaman aşımına uğradı. Yeniden deneyin."
        };
        geoStatus.textContent = messages[error.code] || "Telefon konumu alınamadı.";
        geoButton.disabled = false;
      }, { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 });
    });
  })();

  function demo(fid, oid, msg) { var f = $("#" + fid); if (!f) return; f.addEventListener("submit", function (e) { e.preventDefault(); $("#" + oid).textContent = msg(); }); }
  demo("form-f", "f-ok", function () {
    if (!coordinates) {
      $("#f-location-status").textContent = "Önce telefonunuzun konumunu alın.";
      $("#f-get-location").focus();
      return "Üyelik profilini oluşturmak için önce tarlanızın konumunu ekleyin.";
    }
    return "Konsept üyelik formu: profiliniz oluşturulmadı; bilgileriniz kaydedilmedi veya gönderilmedi. Üyelik ve giriş sistemi henüz bağlı değil.";
  });

  /* ---------- reveals ---------- */
  if (hasG && !reduce) {
    var items = $$(".sec-head, .pest-grid, .svc-grid, .rc, .pnode, .rule, .cform, .sim-vis, .sim-panel, .map-wrap, .ins-panel, .sv, .cmp-table, .quote");
    G.set(items, { y: 46, opacity: 0 });
    ST.batch(items, { start: "top 88%", once: true, onEnter: function (b) { G.to(b, { y: 0, opacity: 1, duration: 1, ease: "power3.out", stagger: 0.09, overwrite: true }); } });
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { ST.refresh(); });
    window.addEventListener("load", function () { ST.refresh(); });
  }
})();
