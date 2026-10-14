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

  /* ---------- hero live cards ---------- */
  (function heroCards() {
    var ops = [
      { i: "S", c: "#8B5E3C", t: "Derin sürüm kaydedildi", s: "08 Nisan · 1.450 TL/da", v: 1450 },
      { i: "E", c: "#3F7D3A", t: "Ekim kaydedildi", s: "Sertifikalı tohum · 1.900 TL/da", v: 1900 },
      { i: "G", c: "#C08A10", t: "Taban gübresi kaydedildi", s: "DAP 20 kg/da · 2.600 TL/da", v: 2600 },
      { i: "Su", c: "#2F3CCF", t: "Sulama kaydedildi", s: "Damla sulama · 2.100 TL/da", v: 2100 },
      { i: "İ", c: "#B4372A", t: "İlaçlama kaydedildi", s: "Beyaz sinek · Flonicamid · 950 TL/da", v: 950 },
      { i: "G", c: "#C08A10", t: "Üst gübre kaydedildi", s: "Üre 25 kg/da · 1.500 TL/da", v: 1500 },
      { i: "İ", c: "#B4372A", t: "İlaçlama kaydedildi", s: "Yeşil kurt · Emamektin benzoat · 1.100 TL/da", v: 1100 },
      { i: "H", c: "#12160E", t: "Hasat kaydedildi", s: "Makineli hasat · 1.200 TL/da", v: 1200 }
    ];
    var idx = 4, cum = 0;
    for (var k = 0; k <= idx; k++) cum += ops[k].v;
    var ico = $("#fc-ico"), op = $("#fc-op"), cost = $("#fc-cost"), delta = $("#fc-delta");
    function show(o, prev) {
      ico.textContent = o.i; ico.style.background = o.c; ico.style.color = o.c === "#12160E" ? "#F1F3EA" : (o.c === "#C08A10" ? "#1B1403" : "#fff");
      op.innerHTML = o.t + "<small>" + o.s + "</small>";
      countTo(cost, prev, cum / 500, 2, 0.9);
      delta.textContent = "+" + fmt(o.v / 500, 2) + " TL bu işlemle";
    }
    show(ops[idx], (cum - ops[idx].v) / 500);
    if (!reduce) setInterval(function () {
      var prev = cum / 500;
      idx = (idx + 1) % ops.length;
      if (idx === 0) { cum = 0; prev = 0; }
      cum += ops[idx].v;
      show(ops[idx], prev);
      if (hasG) G.fromTo(".fc-farmer .fc-row", { x: 14, opacity: 0 }, { x: 0, opacity: 1, duration: 0.5, ease: "power2.out" });
    }, 3000);

    var vals = [40, 52, 71, 90, 112, 131, 150, 158];
    var a = $("#fc-spark-a"), l = $("#fc-spark-l"), fv = $("#fc-firm-v");
    function draw() {
      var mx = Math.max.apply(null, vals) * 1.1, mn = Math.min.apply(null, vals) * 0.8;
      var d = vals.map(function (v, i) { return (i ? "L" : "M") + (i * 220 / (vals.length - 1)).toFixed(1) + " " + (44 - (v - mn) / (mx - mn) * 40).toFixed(1); }).join(" ");
      l.setAttribute("d", d); a.setAttribute("d", d + " L220 44 L0 44 Z");
    }
    draw();
    if (!reduce) setInterval(function () {
      var last = vals[vals.length - 1], nv = Math.round(last + 2 + Math.random() * 9);
      if (nv > 230) nv = 150;
      vals.push(nv); vals.shift(); draw(); countTo(fv, last, nv, 0, 0.8);
    }, 4200);
  })();

  /* ---------- ticker ---------- */
  (function ticker() {
    var data = [
      ["08:42", "Harran", "Pamuk · İlaçlama · Flonicamid · 20 da"], ["08:47", "Söke", "Pamuk · Sulama · damla · 35 da"],
      ["08:51", "Çorlu", "Ayçiçeği · Üst gübre · 60 da"], ["08:55", "Ceyhan", "Mısır · İlaçlama · koçan kurdu · 42 da"],
      ["09:02", "Nazilli", "Pamuk · Gözlem · yaprak biti · 18 da"], ["09:06", "Kızıltepe", "Pamuk · İlaçlama · Acetamiprid · 25 da"],
      ["09:11", "Uzunköprü", "Buğday · Ekim · sertifikalı tohum · 80 da"], ["09:15", "Akhisar", "Pamuk · Hasat · 462 kg/da · 30 da"],
      ["09:19", "Kozan", "Pamuk · İlaçlama · Emamektin benzoat · 22 da"], ["09:24", "Ceylanpınar", "Pamuk · Sulama · yağmurlama · 50 da"]
    ];
    var ins = [
      ["Öneri", "Harran", "Beyaz sinek yoğunluğu arttı, yaprak altlarını kontrol et"], ["Rapor", "Ege", "Flonicamid ilk uygulamada %31 pay aldı"],
      ["Öneri", "Çukurova", "Yeşil kurtta ikinci döl dönemi başlıyor"], ["Rapor", "Trakya", "Orobanşa dayanıklı çeşit payı %19"],
      ["Öneri", "Söke", "İlaç giderin bölge ortalamasının %12 altında"], ["Rapor", "GAP", "İlk ilaçlama geçen yıldan 9 gün erken"],
      ["Öneri", "Akhisar", "Hasat verimin bölge ortalamasının üstünde"]
    ];
    var h1 = data.map(function (d) { return '<span class="tk-item"><span class="tk-pill">Veri</span><span class="t">' + d[0] + "</span><b>" + d[1] + "</b>" + d[2] + "</span>"; }).join("");
    var h2 = ins.map(function (d) { return '<span class="tk-item"><span class="tk-pill">' + d[0] + "</span><b>" + d[1] + "</b>" + d[2] + "</span>"; }).join("");
    $("#tk-data .tk-track").innerHTML = h1 + h1;
    $("#tk-ins .tk-track").innerHTML = h2 + h2;
  })();

  /* ---------- story (pinned) ---------- */
  (function story() {
    var texts = [
      "Çiftçi tarlasını haritada çizer: konum, gerçek dekar, ürün ve tahmini verim. Firmaların hiçbir anketle ulaşamadığı ilk gerçek veri budur.",
      "Her işlem bir dokunuşla kaydedilir. İlaçlar Tarım Bakanlığı ruhsat listesinden seçilir; doz, tarih ve zararlı aynı anda kayda geçer.",
      "Her kayıttan sonra 1 kg ürünün çiftçiye maliyeti yeniden hesaplanır. Firma panelinde aynı veri bölge ortalamasına dönüşür.",
      "Hasatta gerçek verim girilir. Çiftçi sezon raporunu ve öneriyi alır; firma hangi uygulamanın verimle ilişkili olduğunu görür."
    ];
    // L1 dots
    var l1 = $("#l1-dots"), r = rng(3);
    for (var i = 0; i < 170; i++) {
      var a = r() * Math.PI * 2, rr = Math.sqrt(r());
      var x = 150 + Math.cos(a) * rr * 128 * (0.8 + 0.2 * Math.sin(a * 3)), y = 90 + Math.sin(a) * rr * 70;
      sv("circle", { cx: x.toFixed(1), cy: y.toFixed(1), r: 2.6, class: "dd" + (r() < 0.22 ? " hot" : "") }, l1);
    }
    sv("circle", { cx: 176, cy: 112, r: 5, class: "dd-ring" }, l1);
    sv("circle", { cx: 176, cy: 112, r: 4.5, class: "dd-new" }, l1);
    var tx = sv("text", { x: 186, y: 109, fill: "#F7D27A", "font-family": "Martian Mono, monospace", "font-size": 10 }, l1); tx.textContent = "Harran · +20 da";
    // L3 histogram
    var h = $("#l3-hist"), bins = [2, 4, 7, 9, 8, 5, 2, 1], labels = ["1.000", "1.200", "1.400", "1.600", "1.800", "2.000", "2.200", "2.400"];
    var bw = 32, x0 = 24, base = 160;
    bins.forEach(function (b, k) {
      var hh = b * 14;
      var rc = sv("rect", { x: x0 + k * (bw + 3), y: base - hh, width: bw, height: hh, rx: 3, class: k === 5 ? "me" : "" }, h);
      rc.style.transitionDelay = (k * 0.06) + "s";
      var t = sv("text", { x: x0 + k * (bw + 3) + bw / 2, y: base + 14, "text-anchor": "middle" }, h); t.textContent = labels[k];
    });
    var avgX = x0 + 3.8 * (bw + 3);
    sv("line", { x1: avgX, x2: avgX, y1: 14, y2: base }, h);
    var at = sv("text", { x: avgX + 4, y: 22 }, h); at.textContent = "ort. 1.760";
    var mt = sv("text", { x: x0 + 5 * (bw + 3) + bw / 2, y: base - 5 * 14 - 8, "text-anchor": "middle", fill: "#F7D27A" }, h); mt.textContent = "Parsel 7";
    // L4 scatter
    var s = $("#l4-sc"), r2 = rng(9);
    sv("line", { x1: 30, x2: 310, y1: 170, y2: 170, class: "ax" }, s); sv("line", { x1: 30, x2: 30, y1: 10, y2: 170, class: "ax" }, s);
    for (var k = 0; k < 70; k++) {
      var day = r2() * 40, yld = 560 - day * 3.4 + (r2() - .5) * 70;
      var cx = 30 + day / 40 * 280, cy = 170 - (yld - 360) / 220 * 160;
      var c = sv("circle", { cx: cx.toFixed(1), cy: clamp(cy, 12, 168).toFixed(1), r: 3.4, class: yld > 515 ? "top" : "" }, s);
      c.style.transitionDelay = (k * 0.01) + "s";
    }
    sv("line", { x1: 30, y1: 170 - (560 - 360) / 220 * 160, x2: 310, y2: 170 - (424 - 360) / 220 * 160, class: "reg" }, s);
    var t1 = sv("text", { x: 30, y: 186 }, s); t1.textContent = "1 Haz";
    var t2 = sv("text", { x: 310, y: 186, "text-anchor": "end" }, s); t2.textContent = "10 Tem · ilk ilaçlama";
    var t3 = sv("text", { x: 36, y: 20 }, s); t3.textContent = "verim kg/da";

    var cur = -1;
    function setStep(i) {
      if (i === cur) return;
      cur = i;
      $$(".ps").forEach(function (el, k) { el.classList.toggle("on", k === i); });
      $$(".ls").forEach(function (el, k) { el.classList.toggle("on", k === i); });
      $$(".sr").forEach(function (el, k) { el.classList.toggle("on", k === i); el.classList.toggle("done", k < i); });
      var d = $("#step-desc");
      if (hasG && !reduce) G.fromTo(d, { opacity: 0, y: 8 }, { opacity: 1, y: 0, duration: 0.45 });
      d.textContent = texts[i];
      if (i === 0) { countTo($("#l1-area"), 92400, 92420, 0, 1.6); countTo($("#l1-farm"), 1610, 1611, 0, 1.6); }
      if (i === 2) countTo($("#ps3-v"), 21.0, 23.2, 2, 1.4);
    }
    setStep(0);
    if (hasG) {
      ST.create({
        trigger: ".story", start: "top top", end: "+=320%", pin: ".story-pin", anticipatePin: 1,
        onUpdate: function (st) { setStep(Math.min(3, Math.floor(st.progress * 4))); }
      });
    } else {
      var n = 0; setInterval(function () { n = (n + 1) % 4; setStep(n); }, 4000);
    }
  })();

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

  /* ---------- Turkey map + dashboard ---------- */
  (function insight() {
    var R = {
      ege: { name: "Ege", crop: "Pamuk", farmers: 1240, area: 48300, ops: 9870, kg: 27.1,
        insight: "Ege'de beyaz sinek bildirimleri son 4 haftada <em>%38 arttı</em>. İlk uygulamada en çok Flonicamid seçildi; ikinci uygulamada çiftçilerin <em>%41'i etken madde değiştirdi</em>.",
        pestT: "En çok bildirilen zararlılar", pests: [["Beyaz sinek", 44], ["Pamuk yaprak biti", 21], ["Yeşil kurt", 17], ["Kırmızı örümcek", 11], ["Trips", 7]],
        aiT: "Beyaz sinekte tercih edilen etken maddeler", ai: [["Flonicamid", 31], ["Spiromesifen", 24], ["Acetamiprid", 19], ["Pyriproxyfen", 14], ["Diğer", 12]],
        trendT: "Beyaz sinek bildirimi · son 8 hafta", trend: [62, 78, 96, 110, 118, 129, 141, 152],
        prov: [["Aydın", 412, 52, 27.84, 37.85, "rd"], ["İzmir", 318, 37, 27.14, 38.42, "l"], ["Manisa", 296, 44, 27.43, 38.61, "ru"], ["Denizli", 214, 29, 29.09, 37.78, "r"]] },
      cukurova: { name: "Çukurova", crop: "Pamuk · Mısır", farmers: 980, area: 61200, ops: 8140, kg: 25.4,
        insight: "Çukurova'da yeşil kurt beyaz sineği geçerek <em>ilk sıraya çıktı</em>. Adana'da Emamektin benzoat uygulamalarının <em>%27'si 10 gün içinde tekrarlandı</em>.",
        pestT: "En çok bildirilen zararlılar", pests: [["Yeşil kurt", 36], ["Beyaz sinek", 27], ["Mısır koçan kurdu", 19], ["Kırmızı örümcek", 12], ["Trips", 6]],
        aiT: "Yeşil kurtta tercih edilen etken maddeler", ai: [["Emamektin benzoat", 38], ["Klorantraniliprol", 29], ["Indoksakarb", 17], ["Spinetoram", 10], ["Diğer", 6]],
        trendT: "Yeşil kurt bildirimi · son 8 hafta", trend: [88, 92, 101, 97, 110, 118, 115, 126],
        prov: [["Adana", 520, 41, 35.32, 37.0, "lu"], ["Hatay", 270, 35, 36.2, 36.4, "rd"], ["Osmaniye", 190, 27, 36.25, 37.07, "ru"]] },
      gap: { name: "GAP", crop: "Pamuk", farmers: 1610, area: 92400, ops: 11230, kg: 24.8,
        insight: "Harran Ovası'nda ilk beyaz sinek ilaçlaması geçen yıla göre <em>9 gün erken</em> başladı. Acetamiprid kullanımı Şanlıurfa'da Diyarbakır'ın <em>1,6 katı</em>.",
        pestT: "En çok bildirilen zararlılar", pests: [["Beyaz sinek", 39], ["Yeşil kurt", 24], ["Trips", 16], ["Yaprak biti", 13], ["Kırmızı örümcek", 8]],
        aiT: "Beyaz sinekte tercih edilen etken maddeler", ai: [["Acetamiprid", 33], ["Flonicamid", 27], ["Pyriproxyfen", 18], ["Spiromesifen", 12], ["Diğer", 10]],
        trendT: "Beyaz sinek bildirimi · son 8 hafta", trend: [40, 52, 71, 90, 112, 131, 150, 158],
        prov: [["Şanlıurfa", 884, 58, 38.79, 37.17, "ld"], ["Diyarbakır", 366, 39, 40.23, 37.91, "lu"], ["Mardin", 224, 33, 40.74, 37.31, "rd"], ["Batman", 136, 24, 41.13, 37.88, "ru"]] },
      trakya: { name: "Trakya", crop: "Ayçiçeği · Buğday", farmers: 2140, area: 118600, ops: 12950, kg: 21.9,
        insight: "Tekirdağ'da kayıtlı ayçiçeği tarlalarının <em>%19'u orobanşa dayanıklı çeşide</em> geçti. Geçen sezon bu oran <em>%11</em>'di.",
        pestT: "En çok bildirilen sorunlar", pests: [["Orobanş (canavar otu)", 34], ["Mildiyö", 22], ["Tel kurdu", 18], ["Yabani yulaf", 15], ["Süne", 11]],
        aiT: "Orobanşa karşı tercih edilen uygulamalar", ai: [["Imazamox", 52], ["Dayanıklı çeşit", 31], ["Ekim nöbeti", 11], ["Diğer", 6]],
        trendT: "Orobanş bildirimi · son 8 hafta", trend: [140, 131, 122, 104, 92, 80, 71, 60],
        prov: [["Tekirdağ", 1520, 31, 27.51, 40.98, "rd"], ["Edirne", 380, 26, 26.56, 41.68, "lu"], ["Kırklareli", 240, 18, 27.22, 41.73, "ru"]] }
    };
    var HUB = { name: "Firma merkezleri", lon: 29.05, lat: 41.04 };
    var OUT = [[26.33, 41.73], [26.6, 41.97], [27.3, 42.08], [27.9, 41.99], [28.1, 41.6], [28.6, 41.35], [29.1, 41.23], [29.9, 41.15], [30.7, 41.1], [31.4, 41.3], [32.2, 41.65], [32.9, 41.85], [33.7, 42.02], [34.7, 41.95], [35.15, 42.03], [35.5, 41.65], [36.1, 41.65], [36.5, 41.25], [37.3, 41.1], [38.2, 40.95], [39.0, 41.0], [39.8, 41.0], [40.6, 41.05], [41.4, 41.4], [41.55, 41.52], [42.5, 41.45], [42.85, 41.58], [43.45, 41.1], [43.6, 40.75], [43.7, 40.25], [44.2, 40.05], [44.78, 39.7], [44.35, 39.4], [44.05, 39.25], [44.2, 38.8], [44.3, 38.35], [44.25, 37.95], [44.6, 37.75], [44.8, 37.3], [44.25, 37.1], [43.4, 37.25], [42.75, 37.35], [42.3, 37.1], [41.4, 37.07], [40.6, 37.1], [40.0, 36.83], [39.2, 36.67], [38.4, 36.85], [37.7, 36.75], [37.0, 36.65], [36.65, 36.85], [36.6, 36.4], [36.2, 35.85], [35.85, 35.9], [35.95, 36.3], [36.2, 36.6], [35.55, 36.6], [34.9, 36.75], [34.1, 36.3], [33.6, 36.15], [32.8, 36.05], [32.0, 36.5], [31.2, 36.85], [30.6, 36.85], [30.45, 36.4], [30.0, 36.2], [29.3, 36.25], [28.6, 36.75], [28.0, 36.6], [27.4, 36.75], [27.6, 37.05], [27.2, 37.35], [27.0, 37.75], [26.4, 38.25], [26.75, 38.45], [26.75, 38.8], [26.85, 39.1], [26.65, 39.3], [26.1, 39.45], [26.2, 39.9], [26.18, 40.05], [26.5, 40.4], [26.8, 40.62], [26.6, 40.68], [26.05, 40.73], [26.25, 41.1], [26.4, 41.4], [26.55, 41.6]];
    var HOLES = [
      [[26.75, 40.45], [27.3, 40.6], [27.6, 40.95], [28.2, 41.05], [28.9, 41.0], [29.15, 40.85], [29.9, 40.75], [29.4, 40.65], [28.9, 40.4], [28.0, 40.35], [27.4, 40.38], [26.9, 40.25]],
      [[42.3, 38.8], [42.8, 38.95], [43.3, 38.8], [43.1, 38.4], [42.6, 38.35], [42.3, 38.55]],
      [[33.2, 38.95], [33.45, 38.95], [33.55, 38.65], [33.4, 38.55], [33.25, 38.7]]
    ];
    function inside(pt, poly) {
      var x = pt[0], y = pt[1], ins = false;
      for (var i = 0, j = poly.length - 1; i < poly.length; j = i++) {
        var xi = poly[i][0], yi = poly[i][1], xj = poly[j][0], yj = poly[j][1];
        if (((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi)) ins = !ins;
      }
      return ins;
    }
    var LON0 = 25.6, LON1 = 45.2, LAT0 = 35.6, LAT1 = 42.35, KY = 1.287;
    var cv = $("#trmap"), ctx = cv.getContext("2d"), tip = $("#map-tip");
    var W = 0, H = 0, dpr = 1, kx = 1, ky = 1, ox = 0, oy = 0, dots = [], sp = 6;
    var cur = "gap", tab = "pests", t0 = performance.now(), visible = true;
    var allProv = [];
    Object.keys(R).forEach(function (k) { R[k].prov.forEach(function (p) { allProv.push({ r: k, name: p[0], n: p[1], int: p[2], lon: p[3], lat: p[4] }); }); });
    function proj(lon, lat) { return [ox + (lon - LON0) * kx, oy + (LAT1 - lat) * ky]; }
    function layout() {
      var r = cv.getBoundingClientRect();
      W = Math.max(1, r.width); H = Math.max(1, r.height); dpr = Math.min(window.devicePixelRatio || 1, 2);
      cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
      kx = Math.min(W / (LON1 - LON0), H / ((LAT1 - LAT0) * KY)); ky = kx * KY;
      ox = (W - (LON1 - LON0) * kx) / 2; oy = (H - (LAT1 - LAT0) * ky) / 2;
      sp = Math.max(4.2, W / 118);
      dots = [];
      var rr = rng(2);
      for (var y = sp / 2; y < H; y += sp) for (var x = sp / 2; x < W; x += sp) {
        var lon = LON0 + (x - ox) / kx, lat = LAT1 - (y - oy) / ky;
        var p = [lon, lat];
        if (!inside(p, OUT)) continue;
        if (HOLES.some(function (h) { return inside(p, h); })) continue;
        dots.push({ x: x, y: y, lon: lon, lat: lat, ph: rr() * 6.28, base: 0, sel: 0 });
      }
      computeHeat();
    }
    function computeHeat() {
      dots.forEach(function (d) {
        var b = 0, s = 0;
        allProv.forEach(function (p) {
          var dl = (d.lon - p.lon) * 0.8, dt = d.lat - p.lat, g = Math.exp(-(dl * dl + dt * dt) / (2 * 0.42 * 0.42)) * p.int / 60;
          if (p.r === cur) s = Math.max(s, g); else b = Math.max(b, g * 0.35);
        });
        d.base = b; d.sel = s;
      });
    }
    function draw(now) {
      var t = (now - t0) / 1000;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, W, H);
      var rad = sp * 0.27;
      for (var i = 0; i < dots.length; i++) {
        var d = dots[i], h = Math.max(d.sel, d.base);
        if (h < 0.06) { ctx.fillStyle = "rgba(241,243,234,.2)"; ctx.beginPath(); ctx.arc(d.x, d.y, rad, 0, 6.283); ctx.fill(); continue; }
        var tw = reduce ? 1 : 0.78 + 0.22 * Math.sin(t * 2.2 + d.ph);
        var hh = Math.min(1, h);
        var r = Math.round(lerp(237, 226, sstep(.5, 1, hh))), g = Math.round(lerp(180, 88, sstep(.5, 1, hh))), b = Math.round(lerp(62, 63, hh));
        var a = d.sel > d.base ? (0.35 + 0.65 * hh) * tw : 0.18 + hh * 0.5;
        ctx.fillStyle = "rgba(" + r + "," + g + "," + b + "," + a.toFixed(3) + ")";
        ctx.beginPath(); ctx.arc(d.x, d.y, rad * (1 + hh * 0.7), 0, 6.283); ctx.fill();
      }
      var hub = proj(HUB.lon, HUB.lat);
      var provs = R[cur].prov;
      provs.forEach(function (p, i) {
        var pp = proj(p[3], p[4]);
        var mx = (pp[0] + hub[0]) / 2, my = (pp[1] + hub[1]) / 2 - Math.hypot(pp[0] - hub[0], pp[1] - hub[1]) * 0.35;
        ctx.strokeStyle = "rgba(241,243,234,.14)"; ctx.lineWidth = 1; ctx.setLineDash([3, 4]);
        ctx.beginPath(); ctx.moveTo(pp[0], pp[1]); ctx.quadraticCurveTo(mx, my, hub[0], hub[1]); ctx.stroke(); ctx.setLineDash([]);
        if (!reduce) for (var q = 0; q < 3; q++) {
          var u = ((t * 0.28 + q / 3 + i * 0.17) % 1);
          var bx = (1 - u) * (1 - u) * pp[0] + 2 * (1 - u) * u * mx + u * u * hub[0], by = (1 - u) * (1 - u) * pp[1] + 2 * (1 - u) * u * my + u * u * hub[1];
          ctx.fillStyle = "rgba(247,210,122," + (0.9 * Math.sin(u * Math.PI)).toFixed(2) + ")"; ctx.beginPath(); ctx.arc(bx, by, 2.6, 0, 6.283); ctx.fill();
          var v = ((t * 0.22 + q / 3 + i * 0.29 + 0.5) % 1), w = 1 - v;
          var cx = (1 - w) * (1 - w) * pp[0] + 2 * (1 - w) * w * mx + w * w * hub[0], cy = (1 - w) * (1 - w) * pp[1] + 2 * (1 - w) * w * my + w * w * hub[1];
          ctx.fillStyle = "rgba(124,137,255," + (0.9 * Math.sin(v * Math.PI)).toFixed(2) + ")"; ctx.beginPath(); ctx.arc(cx, cy, 2.2, 0, 6.283); ctx.fill();
        }
        var ph = reduce ? 0.5 : ((t * 0.5 + i * 0.23) % 1);
        ctx.strokeStyle = "rgba(237,180,62," + (1 - ph).toFixed(2) + ")"; ctx.lineWidth = 1.6;
        ctx.beginPath(); ctx.arc(pp[0], pp[1], 4 + ph * 22, 0, 6.283); ctx.stroke();
        ctx.fillStyle = "#F7D27A"; ctx.beginPath(); ctx.arc(pp[0], pp[1], 3.6, 0, 6.283); ctx.fill();
        var dir = p[5] || "ru", left = dir.charAt(0) === "l", down = dir.indexOf("d") > 0;
        ctx.font = "600 11px Instrument Sans, sans-serif"; ctx.fillStyle = "rgba(241,243,234,.95)"; ctx.textAlign = left ? "right" : "left";
        ctx.fillText(p[0], pp[0] + (left ? -9 : 9), pp[1] + (down ? 15 : (dir.length === 1 ? 4 : -7)));
      });
      ctx.fillStyle = "#7C89FF"; ctx.beginPath(); ctx.arc(hub[0], hub[1], 5, 0, 6.283); ctx.fill();
      ctx.strokeStyle = "rgba(124,137,255,.5)"; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(hub[0], hub[1], 10, 0, 6.283); ctx.stroke();
      ctx.font = "500 10px Martian Mono, monospace"; ctx.fillStyle = "rgba(195,201,255,.95)"; ctx.textAlign = "left";
      ctx.fillText("FİRMALAR", hub[0] + 14, hub[1] - 10);
      allProv.forEach(function (p) { if (p.r === cur) return; var pp = proj(p.lon, p.lat); ctx.fillStyle = "rgba(241,243,234,.5)"; ctx.beginPath(); ctx.arc(pp[0], pp[1], 2.4, 0, 6.283); ctx.fill(); });
    }
    function loop(now) { if (visible) draw(now); if (!reduce) requestAnimationFrame(loop); }
    layout(); requestAnimationFrame(loop);
    try { new ResizeObserver(function () { layout(); if (reduce) draw(performance.now()); }).observe(cv); } catch (e) { window.addEventListener("resize", layout); }
    try { new IntersectionObserver(function (es) { visible = es[0].isIntersecting; }).observe(cv); } catch (e) {}
    function nearest(ex, ey) {
      var best = null, bd = 22;
      allProv.forEach(function (p) { var pp = proj(p.lon, p.lat), d = Math.hypot(pp[0] - ex, pp[1] - ey); if (d < bd) { bd = d; best = p; } });
      return best;
    }
    cv.addEventListener("pointermove", function (e) {
      var r = cv.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top, p = nearest(x, y);
      if (p) {
        var pp = proj(p.lon, p.lat);
        tip.innerHTML = "<b>" + p.name + " · " + R[p.r].name + "</b><span>" + fmt(p.n) + " çiftçi · yoğunluk %" + p.int + "</span>";
        tip.style.left = (pp[0] + 14) + "px"; tip.style.top = (pp[1] + 14) + "px"; tip.style.opacity = 1; cv.style.cursor = "pointer";
      } else { tip.style.opacity = 0; cv.style.cursor = "crosshair"; }
    });
    cv.addEventListener("pointerleave", function () { tip.style.opacity = 0; });
    cv.addEventListener("click", function (e) { var r = cv.getBoundingClientRect(), p = nearest(e.clientX - r.left, e.clientY - r.top); if (p && p.r !== cur) select(p.r); });

    var chips = $("#chips");
    Object.keys(R).forEach(function (k) {
      var b = document.createElement("button"); b.type = "button"; b.className = "chip"; b.dataset.k = k;
      b.innerHTML = R[k].name + "<small>" + R[k].crop + "</small>";
      b.addEventListener("click", function () { select(k); });
      chips.appendChild(b);
    });
    $$(".dtab").forEach(function (b) { b.addEventListener("click", function () { tab = b.dataset.tab; $$(".dtab").forEach(function (x) { x.setAttribute("aria-selected", x === b ? "true" : "false"); }); panel(); }); });
    function bars(list, cls) {
      var mx = Math.max.apply(null, list.map(function (x) { return x[1]; }));
      return '<div class="bars ' + (cls || "") + '">' + list.map(function (x) { return '<div class="bar"><span class="bl" title="' + x[0] + '">' + x[0] + '</span><span class="bt"><i data-w="' + (x[1] / mx * 100).toFixed(1) + '"></i></span><span class="bv">%' + x[1] + "</span></div>"; }).join("") + "</div>";
    }
    function spark(vals) {
      var Wd = 520, Hd = 170, pl = 30, pr = 44, pt = 14, pb = 26, iw = Wd - pl - pr, ih = Hd - pt - pb;
      var mx = Math.max.apply(null, vals), st = mx > 120 ? 50 : 25, top = Math.ceil(mx * 1.08 / st) * st;
      function X(i) { return pl + i * iw / (vals.length - 1); }
      function Y(v) { return pt + ih - v / top * ih; }
      var s = '<svg viewBox="0 0 ' + Wd + " " + Hd + '">';
      for (var v = 0; v <= top; v += st) s += '<line class="sp-g" x1="' + pl + '" x2="' + (Wd - pr) + '" y1="' + Y(v) + '" y2="' + Y(v) + '"/><text class="sp-t" x="' + (pl - 6) + '" y="' + (Y(v) + 3.5) + '" text-anchor="end">' + v + "</text>";
      var d = vals.map(function (v, i) { return (i ? "L" : "M") + X(i).toFixed(1) + " " + Y(v).toFixed(1); }).join(" ");
      s += '<path class="sp-a" d="' + d + " L" + X(vals.length - 1) + " " + Y(0) + " L" + X(0) + " " + Y(0) + ' Z"/><path class="sp-l" d="' + d + '" pathLength="1" style="stroke-dasharray:1;stroke-dashoffset:1;transition:stroke-dashoffset 1.2s ease"/>';
      var li = vals.length - 1;
      s += '<circle class="sp-e" cx="' + X(li) + '" cy="' + Y(vals[li]) + '" r="5"/><text class="sp-v" x="' + (X(li) + 9) + '" y="' + (Y(vals[li]) + 4) + '">' + vals[li] + "</text>";
      s += '<text class="sp-t" x="' + X(0) + '" y="' + (Hd - 6) + '">8 hafta önce</text><text class="sp-t" x="' + X(li) + '" y="' + (Hd - 6) + '" text-anchor="end">Bu hafta</text>';
      return '<div class="spark">' + s + "</svg></div>";
    }
    function grow(root) {
      requestAnimationFrame(function () { requestAnimationFrame(function () {
        $$("i[data-w]", root).forEach(function (i) { i.style.width = i.dataset.w + "%"; });
        $$(".sp-l", root).forEach(function (p) { p.style.strokeDashoffset = 0; });
      }); });
    }
    function panel() {
      var r = R[cur], p = $("#dpanel"), h = "";
      if (tab === "pests") h = "<h4>" + r.pestT + "</h4>" + bars(r.pests) + '<p class="lede" style="font-size:12.5px">Son 30 günde sorunu kaydeden tarlaların payı</p>';
      if (tab === "ai") h = "<h4>" + r.aiT + "</h4>" + bars(r.ai, "g") + '<p class="lede" style="font-size:12.5px">Bu soruna karşı yapılan uygulamaların dağılımı</p>';
      if (tab === "trend") h = "<h4>" + r.trendT + "</h4>" + spark(r.trend);
      if (tab === "prov") h = "<h4>İl kırılımı</h4>" + bars(r.prov.map(function (x) { return [x[0] + " · " + fmt(x[1]) + " çiftçi", x[2]]; }), "g") + '<p class="lede" style="font-size:12.5px">Yoğunluk: ana sorunu bildiren tarlaların oranı</p>';
      p.innerHTML = h; grow(p);
    }
    var prev = { farmers: 0, area: 0, ops: 0, kg: 0 };
    function select(k) {
      cur = k;
      $$(".chip", chips).forEach(function (b) { b.setAttribute("aria-pressed", b.dataset.k === k ? "true" : "false"); });
      var r = R[k];
      var head = $("#ins-head");
      if (hasG && !reduce) G.fromTo(head, { opacity: 0, y: 10 }, { opacity: 1, y: 0, duration: 0.5 });
      head.innerHTML = r.insight;
      countTo($("#k-farmers"), prev.farmers, r.farmers, 0, 0.9); countTo($("#k-area"), prev.area, r.area, 0, 0.9);
      countTo($("#k-ops"), prev.ops, r.ops, 0, 0.9); countTo($("#k-kg"), prev.kg, r.kg, 1, 0.9);
      prev = { farmers: r.farmers, area: r.area, ops: r.ops, kg: r.kg };
      computeHeat(); panel();
    }
    var started = false;
    function start() { if (started) return; started = true; select(cur); }
    once($("#firma"), start, 0.15);
    setTimeout(function () { if (!started && window.scrollY > 0) start(); }, 6000);
  })();

  /* ---------- pest counters ---------- */
  $$(".pest b[data-count]").forEach(function (b) { once(b, function () { countTo(b, 0, +b.dataset.count, 0, 1.4, b.dataset.prefix || ""); }, 0.6); });

  /* ---------- survey vs field ---------- */
  (function survey() {
    var co = $("#sv-old"), cn = $("#sv-new"); if (!co || !cn) return;
    var xo = co.getContext("2d"), xn = cn.getContext("2d");
    var P = 0, L = null;
    function size(cv) { var r = cv.getBoundingClientRect(), d = Math.min(window.devicePixelRatio || 1, 2); cv.width = Math.round(r.width * d); cv.height = Math.round(r.height * d); return { w: r.width, h: r.height, d: d }; }
    var so, sn;
    function layouts() {
      so = size(co); sn = size(cn);
      var w = so.w, h = so.h, pad = 18, top = 16, ah = h - 112, aw = w - pad * 2;
      var A = [], B = [], C = [], D = [];
      for (var i = 0; i < 1000; i++) {
        var c = i % 50, r = Math.floor(i / 50);
        A.push([pad + (c + .5) * aw / 50, top + (r + .5) * ah / 20]);
        var cl = Math.floor(i / 100), wi = i % 100, ccx = cl % 5, ccy = Math.floor(cl / 5);
        var cw = aw / 5, ch = ah / 2, sp = Math.min(cw, ch) * 0.074;
        var cx = pad + (ccx + .5) * cw, cy = top + (ccy + .5) * ch;
        B.push([cx + ((wi % 10) - 4.5) * sp, cy + (Math.floor(wi / 10) - 4.5) * sp]);
        var sub = Math.floor(wi / 20), w20 = wi % 20, ang = -Math.PI / 2 + sub * 2 * Math.PI / 5, rr = Math.min(cw, ch) * 0.3, s2 = sp * 0.85;
        C.push([cx + Math.cos(ang) * rr + ((w20 % 5) - 2) * s2, cy + Math.sin(ang) * rr + (Math.floor(w20 / 5) - 1.5) * s2]);
        var hl = cl === 7 && sub === 2;
        D.push(hl ? [w / 2 + ((w20 % 5) - 2) * 26, top + ah / 2 + (Math.floor(w20 / 5) - 1.5) * 26] : C[i]);
      }
      L = [A, B, C, D];
    }
    function drawOld(p) {
      var w = so.w, h = so.h;
      xo.setTransform(so.d, 0, 0, so.d, 0, 0); xo.clearRect(0, 0, w, h);
      var seg = clamp(p * 3, 0, 2.9999), s0 = Math.floor(seg), t = ease(seg - s0);
      var hlA = sstep(2.0, 3.0, p * 3);
      for (var i = 0; i < 1000; i++) {
        var a = L[s0][i], b = L[s0 + 1][i];
        var x = lerp(a[0], b[0], t), y = lerp(a[1], b[1], t);
        var cl = Math.floor(i / 100), sub = Math.floor((i % 100) / 20), hl = cl === 7 && sub === 2;
        var alpha = hl ? 0.85 : lerp(0.7, 0.07, hlA);
        var r = hl ? lerp(2.3, 6.5, hlA) : 2.3;
        xo.fillStyle = hl && hlA > 0 ? "rgba(243,160,143," + alpha + ")" : "rgba(241,243,234," + alpha + ")";
        xo.beginPath(); xo.arc(x, y, r, 0, 6.283); xo.fill();
      }
      if (p * 3 > 1.05 && p * 3 < 2.3) {
        var names = ["İzmir", "Aydın", "Manisa", "Adana", "Hatay", "Konya", "Diyarbakır", "Şanlıurfa", "Tekirdağ", "Edirne"];
        var aw = w - 36, ah = h - 112, la = Math.min(1, (p * 3 - 1.05) * 4) * Math.min(1, (2.3 - p * 3) * 4);
        xo.font = "500 10px Martian Mono, monospace"; xo.fillStyle = "rgba(161,169,148," + la + ")"; xo.textAlign = "center";
        names.forEach(function (n, k) { xo.fillText(n, 18 + ((k % 5) + .5) * aw / 5, 16 + (Math.floor(k / 5) + 1) * ah / 2 - 4); });
      }
      var cap = $("#sv-old-cap"), sub2 = $("#sv-old-sub"), ph = p * 3;
      var txt = ph < 0.6 ? ["1.000 kişi, 8.000 €", "1 nokta = 1 katılımcı"] : ph < 1.6 ? ["10 il, il başına 100 kişi", "örneklem illere bölünür"] : ph < 2.5 ? ["İlçe başına ~20 kişi", "il başına 4–5 ilçe"] : ["Bu 20 kişi, 500.000 çiftçi gibi raporlanır", "Ceylanpınar · tek seferlik beyan"];
      if (cap.textContent !== txt[0]) { cap.textContent = txt[0]; sub2.textContent = txt[1]; }
    }
    var rn = rng(12);
    var NN = 1520, nd = [];
    function layoutNew() {
      var w = sn.w, h = sn.h, pad = 18, top = 16, ah = h - 112, aw = w - pad * 2;
      var cols = Math.ceil(Math.sqrt(NN * aw / ah)), rows = Math.ceil(NN / cols), cell = Math.min(aw / cols, ah / rows);
      var x0 = pad + (aw - cols * cell) / 2 + cell / 2, y0 = top + (ah - rows * cell) / 2 + cell / 2;
      nd = [];
      for (var i = 0; i < NN; i++) nd.push({ x: x0 + (i % cols) * cell, y: y0 + Math.floor(i / cols) * cell, r: Math.max(1.2, cell * 0.36), t: rn() * 0.85 });
    }
    function drawNew(p) {
      var w = sn.w, h = sn.h, shown = 0;
      xn.setTransform(sn.d, 0, 0, sn.d, 0, 0); xn.clearRect(0, 0, w, h);
      for (var i = 0; i < NN; i++) {
        var d = nd[i], l = clamp((p - d.t) / 0.12, 0, 1);
        if (l <= 0) continue;
        if (l > 0.5) shown++;
        var e = easeOut(l);
        xn.fillStyle = "rgba(237,180,62," + (0.25 + 0.75 * e).toFixed(2) + ")";
        xn.beginPath(); xn.arc(d.x, d.y - (1 - e) * 60, d.r, 0, 6.283); xn.fill();
      }
      $("#sv-new-cap").textContent = "Tekirdağ'da " + fmt(p >= 0.97 ? NN : shown) + " kayıtlı çiftçi";
      $("#sv-new-sub").textContent = p >= 0.97 ? "her işlem, her hafta" : "1 nokta = 1 kayıtlı tarla";
    }
    function all() { drawOld(P); drawNew(P); }
    function relayout() { layouts(); layoutNew(); all(); }
    relayout();
    try { new ResizeObserver(relayout).observe(co); } catch (e) { window.addEventListener("resize", relayout); }
    if (hasG && !reduce) {
      ST.create({ trigger: ".sv-grid", start: "top 75%", end: "bottom 20%", scrub: 0.6, onUpdate: function (st) { P = st.progress; all(); } });
    } else {
      once($(".sv-grid"), function () {
        if (reduce) { P = 1; all(); return; }
        var t0 = performance.now();
        (function tick(n) { P = clamp((n - t0) / 6000, 0, 1); all(); if (P < 1) requestAnimationFrame(tick); })(t0);
      });
    }
  })();

  /* ---------- services focus ---------- */
  $$(".svc").forEach(function (c) {
    c.addEventListener("pointermove", function (e) {
      var r = c.getBoundingClientRect(), x = (e.clientX - r.left) / r.width, y = (e.clientY - r.top) / r.height;
      c.style.setProperty("--mx", (x * 100) + "%"); c.style.setProperty("--my", (y * 100) + "%");
    });
  });

  /* ---------- reach illustrations ---------- */
  (function reach() {
    var aw = $("#awning");
    if (aw) {
      for (var i = 0; i < 16; i++) {
        sv("rect", { x: 40 + i * 20, y: 94, width: 20, height: 26, fill: i % 2 ? "#F1F3EA" : "#EDB43E" }, aw);
        sv("circle", { cx: 50 + i * 20, cy: 120, r: 10, fill: i % 2 ? "#F1F3EA" : "#EDB43E" }, aw);
      }
    }
    var qr = $("#store-qr"), r = rng(77);
    if (qr) {
      var N = 16, s = 2;
      for (var y = 0; y < N; y++) for (var x = 0; x < N; x++) {
        var f = (x < 5 && y < 5) || (x > 10 && y < 5) || (x < 5 && y > 10);
        if (!f && r() < 0.5) sv("rect", { x: x * s, y: y * s, width: s, height: s, fill: "#1B1403" }, qr);
      }
      [[0, 0], [22, 0], [0, 22]].forEach(function (p) {
        sv("rect", { x: p[0], y: p[1], width: 10, height: 10, fill: "#1B1403" }, qr);
        sv("rect", { x: p[0] + 2, y: p[1] + 2, width: 6, height: 6, fill: "#FFFDF5" }, qr);
        sv("rect", { x: p[0] + 3.5, y: p[1] + 3.5, width: 3, height: 3, fill: "#1B1403" }, qr);
      });
    }
    var lines = ["Pamuğunun 1 kilosu", "sana kaça mal", "oluyor? Tarlanı", "kaydet, ücretsiz", "tn.link/pamuk"];
    var spans = lines.map(function (_, i) { return $("#sms-" + (i + 1)); });
    function type() {
      spans.forEach(function (s) { s.textContent = ""; });
      if (reduce) { lines.forEach(function (l, i) { spans[i].textContent = l; }); return; }
      var li = 0, ci = 0;
      var iv = setInterval(function () {
        if (li >= lines.length) { clearInterval(iv); setTimeout(type, 4000); return; }
        ci++; spans[li].textContent = lines[li].slice(0, ci);
        if (ci >= lines[li].length) { li++; ci = 0; }
      }, 55);
    }
    once($(".reach-grid"), type, 0.3);
  })();

  /* ---------- KVKK packet ---------- */
  (function kvkk() {
    var pipe = $("#pipe"), pk = $("#packet"); if (!pipe || !pk) return;
    var nodes = $$(".pnode", pipe);
    var labels = ["Mehmet Y. · 0532 ··· · Parsel 7", "Çiftçi #A7F3 · Harran · 20 da", "Harran · pamuk · 38 tarla", "Rapor: Harran beyaz sinek ↑ %38"];
    var i = 0;
    pk.style.transition = reduce ? "none" : "left .9s cubic-bezier(.6,0,.2,1), background .3s";
    function stepTo(k) {
      var pr = pipe.getBoundingClientRect(), nr = nodes[k].querySelector(".pi").getBoundingClientRect();
      pk.style.left = (nr.left - pr.left + nr.width / 2) + "px";
      pk.textContent = labels[k];
      pk.style.background = k === 0 ? "#F3A08F" : k === 3 ? "#7C89FF" : "#EDB43E";
      pk.style.color = k === 3 ? "#fff" : "#1B1403";
      nodes.forEach(function (n, j) { n.classList.toggle("on", j === k); });
    }
    stepTo(0);
    window.addEventListener("resize", function () { stepTo(i); });
    var iv = null;
    once(pipe, function () { if (reduce) return; iv = setInterval(function () { i = (i + 1) % 4; stepTo(i); }, 1900); }, 0.3);
  })();

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

  function demo(fid, oid, msg) { var f = $("#" + fid); f.addEventListener("submit", function (e) { e.preventDefault(); $("#" + oid).textContent = msg(); }); }
  demo("form-f", "f-ok", function () {
    if (!coordinates) {
      $("#f-location-status").textContent = "Önce telefonunuzun konumunu alın.";
      $("#f-get-location").focus();
      return "Tarlayı kaydetmek için önce telefon konumunu alın.";
    }
    return "Konsept sayfa: bilgileriniz kaydedilmedi ve hiçbir yere gönderilmedi. Canlı kayıt sistemi henüz bağlı değil.";
  });
  demo("form-c", "c-ok", function () { return "Konsept sayfa: talep henüz bir yere gönderilmiyor. Canlıda " + $("#c-bolge").value + " için örnek Nabız raporu e-postayla iletilecek."; });

  /* ---------- reveals ---------- */
  if (hasG && !reduce) {
    var items = $$(".sec-head, .pest-grid, .svc-grid, .rc, .pnode, .rule, .cform, .sim-vis, .sim-panel, .map-wrap, .ins-panel, .sv, .cmp-table, .quote");
    G.set(items, { y: 46, opacity: 0 });
    ST.batch(items, { start: "top 88%", once: true, onEnter: function (b) { G.to(b, { y: 0, opacity: 1, duration: 1, ease: "power3.out", stagger: 0.09, overwrite: true }); } });
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { ST.refresh(); });
    window.addEventListener("load", function () { ST.refresh(); });
  }
})();
