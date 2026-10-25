import {t,locale,areaDisplay,areaStored,perAreaDisplay,perAreaStored} from './regional-format.js?v=international-v1';
const I=window.AgroIntl;
const __avt=s=>I.t(s);
/* Tarla Nabzı v2 · interactions */
(function () {
  "use strict";
  var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var G = window.gsap, ST = window.ScrollTrigger;
  var hasG = !!(G && ST);
  if (hasG) G.registerPlugin(ST);

  function $(s, r) { return (r || document).querySelector(s); }
  function $$(s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); }
  function fmt(n, d) { d = d || 0; return Number(n).toLocaleString(I.locale, { minimumFractionDigits: d, maximumFractionDigits: d }); }
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
      fillSelect(province, __avt("İl seçin"), admin.provinces);
      addressStatus.textContent = "";
    }).catch(function () {
      addressStatus.textContent = "Yer listesi yüklenemedi. Sayfayı yenileyip tekrar deneyin.";
    });

    province.addEventListener("change", function () {
      var rows = (admin && admin.districts[province.value]) || [];
      fillSelect(district, __avt("İlçe seçin"), rows);
      resetSelect(village, __avt("Önce ilçe seçin"));
    });
    district.addEventListener("change", function () {
      var rows = (admin && admin.settlements[district.value] || []).map(function (name) {
        return { id: name, name: name };
      });
      fillSelect(village, __avt("Köy / mahalle seçin"), rows);
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
      geoStatus.textContent = __avt("Konum izni bekleniyor…");
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
