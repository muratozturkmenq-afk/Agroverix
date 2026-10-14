/* Tarla Nabzı · hero 3D farmland
   Voronoi parcels shaded per fragment (crop colour, crop rows, field roads),
   registered parcels pulse gold, data rises from them, insight descends back. */
(function () {
  "use strict";
  var canvas = document.getElementById("field3d");
  if (!canvas || !window.THREE) return;
  var THREE = window.THREE;
  var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  var renderer;
  try { renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true, alpha: true, powerPreference: "high-performance" }); }
  catch (e) { return; }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
  renderer.setClearColor(0x000000, 0);

  var scene = new THREE.Scene();
  var FOG = new THREE.Color(0xEDB98A);
  scene.fog = new THREE.Fog(FOG, 70, 190);
  var camera = new THREE.PerspectiveCamera(40, 1, 0.1, 600);

  function rng(seed) { return function () { seed |= 0; seed = seed + 0x6D2B79F5 | 0; var t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
  var rand = rng(20261011);

  /* ---------- terrain height ---------- */
  function H(x, z) {
    var d = Math.sqrt(x * x + z * z);
    return 1.8 * Math.sin(x * 0.035) * Math.cos(z * 0.03) + 1.3 * Math.sin(x * 0.012 + z * 0.018 + 1.3) + 0.5 * Math.sin(x * 0.07 + z * 0.05) + Math.max(0, d - 100) * 0.16;
  }

  /* ---------- parcel seeds texture ---------- */
  var N = 44, CELL = 7.5, HALF = N * CELL / 2;
  var data = new Uint8Array(N * N * 4);
  var regs = [];
  for (var j = 0; j < N; j++) for (var i = 0; i < N; i++) {
    var jx = 0.12 + rand() * 0.76, jz = 0.12 + rand() * 0.76;
    var crop = Math.floor(rand() * 5);
    var ar = Math.floor(rand() * 49);
    var sx = (i + jx) * CELL - HALF, sz = (j + jz) * CELL - HALF;
    var dist = Math.sqrt(sx * sx + (sz - 10) * (sz - 10));
    var reg = (rand() < 0.15 && dist < 95) ? 1 : 0;
    var k = (j * N + i) * 4;
    data[k] = Math.round(jx * 255); data[k + 1] = Math.round(jz * 255); data[k + 2] = reg * 255; data[k + 3] = crop * 50 + ar;
    if (reg) regs.push({ x: sx, z: sz, y: H(sx, sz), ph: ar / 50 });
  }
  var tex = new THREE.DataTexture(data, N, N, THREE.RGBAFormat);
  tex.magFilter = THREE.NearestFilter; tex.minFilter = THREE.NearestFilter; tex.generateMipmaps = false; tex.needsUpdate = true;

  /* ---------- terrain mesh ---------- */
  var SIZE = 330, SEG = 220;
  var geo = new THREE.PlaneGeometry(SIZE, SIZE, SEG, SEG);
  geo.rotateX(-Math.PI / 2);
  var pos = geo.attributes.position;
  for (var v = 0; v < pos.count; v++) pos.setY(v, H(pos.getX(v), pos.getZ(v)));
  geo.computeVertexNormals();

  var uniforms = {
    uTex: { value: tex }, uN: { value: N }, uCell: { value: CELL }, uHalf: { value: HALF }, uTime: { value: 0 },
    uSun: { value: new THREE.Vector3(-0.65, 0.5, 0.35).normalize() },
    uFog: { value: new THREE.Vector3(FOG.r, FOG.g, FOG.b) }, uFogNear: { value: 60 }, uFogFar: { value: 185 },
    uGold: { value: new THREE.Vector3(0.96, 0.72, 0.26) },
    uP0: { value: new THREE.Vector3(0.36, 0.48, 0.19) },
    uP1: { value: new THREE.Vector3(0.78, 0.63, 0.31) },
    uP2: { value: new THREE.Vector3(0.47, 0.30, 0.19) },
    uP3: { value: new THREE.Vector3(0.56, 0.53, 0.20) },
    uP4: { value: new THREE.Vector3(0.48, 0.62, 0.25) }
  };
  var mat = new THREE.ShaderMaterial({
    uniforms: uniforms,
    vertexShader: [
      "varying vec3 vPos; varying vec3 vN; varying float vDepth;",
      "void main(){",
      "  vec4 wp = modelMatrix * vec4(position, 1.0);",
      "  vPos = wp.xyz; vN = normalize(mat3(modelMatrix) * normal);",
      "  vec4 mv = viewMatrix * wp; vDepth = -mv.z;",
      "  gl_Position = projectionMatrix * mv;",
      "}"
    ].join("\n"),
    fragmentShader: [
      "uniform sampler2D uTex; uniform float uN; uniform float uCell; uniform float uHalf; uniform float uTime;",
      "uniform vec3 uSun; uniform vec3 uFog; uniform float uFogNear; uniform float uFogFar; uniform vec3 uGold;",
      "uniform vec3 uP0; uniform vec3 uP1; uniform vec3 uP2; uniform vec3 uP3; uniform vec3 uP4;",
      "varying vec3 vPos; varying vec3 vN; varying float vDepth;",
      "vec4 cellAt(vec2 c){ vec2 uv = (clamp(c, 0.0, uN - 1.0) + 0.5) / uN; return texture2D(uTex, uv); }",
      "float h21(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }",
      "void main(){",
      "  vec2 p = (vPos.xz + uHalf) / uCell;",
      "  vec2 ip = floor(p);",
      "  float d1 = 1e9; vec2 bc = ip; vec2 bs = ip;",
      "  for (int j = -1; j <= 1; j++) for (int i = -1; i <= 1; i++) {",
      "    vec2 c = ip + vec2(float(i), float(j));",
      "    vec2 s = c + cellAt(c).rg;",
      "    float d = distance(p, s);",
      "    if (d < d1) { d1 = d; bc = c; bs = s; }",
      "  }",
      "  float ed = 1e9;",
      "  for (int j = -2; j <= 2; j++) for (int i = -2; i <= 2; i++) {",
      "    vec2 c = bc + vec2(float(i), float(j));",
      "    vec2 s = c + cellAt(c).rg;",
      "    vec2 dd = s - bs;",
      "    if (dot(dd, dd) > 0.0001) ed = min(ed, dot(0.5 * (bs + s) - p, normalize(dd)));",
      "  }",
      "  vec4 t = cellAt(bc);",
      "  float a = floor(t.a * 255.0 + 0.5);",
      "  float crop = floor(a / 50.0 + 0.001);",
      "  float ar = mod(a, 50.0) / 50.0;",
      "  float reg = step(0.5, t.b);",
      "  vec3 col = uP0;",
      "  if (crop > 0.5) col = uP1; if (crop > 1.5) col = uP2; if (crop > 2.5) col = uP3; if (crop > 3.5) col = uP4;",
      "  float ang = ar * 3.14159 + 0.2;",
      "  vec2 dir = vec2(cos(ang), sin(ang));",
      "  float rows = sin(dot(vPos.xz, dir) * 3.4);",
      "  float fw = fwidth(dot(vPos.xz, dir) * 3.4);",
      "  float rowMask = smoothstep(-fw, fw, rows);",
      "  float rowAmt = mix(0.16, 0.02, smoothstep(30.0, 110.0, vDepth));",
      "  col *= 1.0 - rowAmt + rowAmt * 1.4 * rowMask;",
      "  col *= 0.9 + 0.12 * h21(bc);",
      "  float road = 1.0 - smoothstep(0.025, 0.07, ed);",
      "  col = mix(col, vec3(0.55, 0.45, 0.30), road * 0.9);",
      "  vec3 n = normalize(vN);",
      "  float diff = max(dot(n, normalize(uSun)), 0.0);",
      "  vec3 lit = col * (0.5 + 0.75 * diff) * vec3(1.08, 0.97, 0.86);",
      "  if (reg > 0.5) {",
      "    float rim = 1.0 - smoothstep(0.035, 0.11, ed);",
      "    lit = mix(lit, uGold * 1.1, rim * 0.95);",
      "    float ph = fract(uTime * 0.32 + ar);",
      "    float ring = abs(d1 - ph * 0.85);",
      "    float rr = (1.0 - smoothstep(0.0, 0.045, ring)) * (1.0 - ph);",
      "    lit = mix(lit, vec3(1.0, 0.86, 0.5), rr * 0.9);",
      "    lit += uGold * 0.10;",
      "    lit = mix(lit, vec3(1.0, 0.96, 0.82), 1.0 - smoothstep(0.035, 0.07, d1));",
      "  }",
      "  float f = smoothstep(uFogNear, uFogFar, vDepth);",
      "  gl_FragColor = vec4(mix(lit, uFog, f), 1.0);",
      "}"
    ].join("\n"),
    extensions: { derivatives: true }
  });
  var terrain = new THREE.Mesh(geo, mat);
  scene.add(terrain);

  /* ---------- lights for simple meshes ---------- */
  scene.add(new THREE.HemisphereLight(0xFFE3B8, 0x3A2E1C, 0.85));
  var sun = new THREE.DirectionalLight(0xFFD29A, 0.9);
  sun.position.set(-60, 50, 30);
  scene.add(sun);

  /* ---------- trees (instanced) ---------- */
  var treeGeo = new THREE.ConeGeometry(0.9, 3.2, 7);
  treeGeo.translate(0, 1.6, 0);
  var treeMat = new THREE.MeshLambertMaterial({ color: 0x3C5426 });
  var TREES = 260;
  var trees = new THREE.InstancedMesh(treeGeo, treeMat, TREES);
  var m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3(), tp = new THREE.Vector3();
  var tr = rng(7);
  for (var t = 0; t < TREES; t++) {
    var row = tr() < 0.55;
    var tx, tz;
    if (row) { var line = Math.floor(tr() * 6); tz = -120 + line * 40 + (tr() - .5) * 2; tx = -150 + tr() * 300; }
    else { tx = (tr() - .5) * 300; tz = (tr() - .5) * 300; }
    if (Math.abs(tx) < 18 && Math.abs(tz - 20) < 18) { tx += 40; }
    var s = 0.7 + tr() * 0.9;
    tp.set(tx, H(tx, tz) - 0.2, tz); sc.set(s, s * (0.8 + tr() * 0.6), s);
    m4.compose(tp, q, sc); trees.setMatrixAt(t, m4);
  }
  scene.add(trees);

  /* ---------- data beams from registered parcels ---------- */
  var beamPos = [], beamCol = [];
  regs.forEach(function (r) {
    beamPos.push(r.x, r.y + 0.3, r.z, r.x, r.y + 16 + r.ph * 10, r.z);
    beamCol.push(0.95, 0.70, 0.25, 0, 0, 0);
  });
  var beamGeo = new THREE.BufferGeometry();
  beamGeo.setAttribute("position", new THREE.Float32BufferAttribute(beamPos, 3));
  beamGeo.setAttribute("color", new THREE.Float32BufferAttribute(beamCol, 3));
  var beams = new THREE.LineSegments(beamGeo, new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
  scene.add(beams);

  /* ---------- particles: data up (gold), insight down (blue) ---------- */
  var UP = 320, DOWN = 160, PN = UP + DOWN;
  var pPos = new Float32Array(PN * 3), pCol = new Float32Array(PN * 3), pA = new Float32Array(PN), pS = new Float32Array(PN);
  var P = [];
  var gold = [1.0, 0.78, 0.32], blue = [0.55, 0.6, 1.0];
  function respawn(p, first) {
    if (!regs.length) return;
    var r = regs[Math.floor(Math.random() * regs.length)];
    if (p.up) {
      p.x = r.x + (Math.random() - .5) * 1.2; p.z = r.z + (Math.random() - .5) * 1.2; p.y = r.y + 0.4 + (first ? Math.random() * 30 : 0);
      p.vy = 0.05 + Math.random() * 0.07; p.top = 30 + Math.random() * 18;
    } else {
      p.tx = r.x; p.tz = r.z; p.ty = r.y + 0.6;
      p.x = r.x + (Math.random() - .5) * 40; p.z = r.z + (Math.random() - .5) * 40; p.y = 42 + Math.random() * 8;
      if (first) { var f = Math.random(); p.x += (p.tx - p.x) * f; p.z += (p.tz - p.z) * f; p.y += (p.ty - p.y) * f; }
      p.sp = 0.006 + Math.random() * 0.006;
    }
  }
  for (var pi = 0; pi < PN; pi++) {
    var up = pi < UP, c = up ? gold : blue;
    var p = { up: up, i: pi };
    respawn(p, true); P.push(p);
    pCol[pi * 3] = c[0]; pCol[pi * 3 + 1] = c[1]; pCol[pi * 3 + 2] = c[2];
    pS[pi] = up ? 1.6 + Math.random() * 1.6 : 2.2 + Math.random() * 1.4;
  }
  var pGeo = new THREE.BufferGeometry();
  pGeo.setAttribute("position", new THREE.BufferAttribute(pPos, 3));
  pGeo.setAttribute("aColor", new THREE.BufferAttribute(pCol, 3));
  pGeo.setAttribute("aAlpha", new THREE.BufferAttribute(pA, 1));
  pGeo.setAttribute("aSize", new THREE.BufferAttribute(pS, 1));
  var pMat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: { uScale: { value: 300 } },
    vertexShader: "attribute vec3 aColor; attribute float aAlpha; attribute float aSize; uniform float uScale; varying vec3 vC; varying float vA; void main(){ vC = aColor; vA = aAlpha; vec4 mv = modelViewMatrix * vec4(position,1.0); gl_PointSize = aSize * uScale / -mv.z; gl_Position = projectionMatrix * mv; }",
    fragmentShader: "varying vec3 vC; varying float vA; void main(){ float d = length(gl_PointCoord - 0.5); float a = smoothstep(0.5, 0.0, d); gl_FragColor = vec4(vC * (0.6 + a), a * vA); }"
  });
  var points = new THREE.Points(pGeo, pMat);
  scene.add(points);

  /* ---------- drone with scan beam ---------- */
  var drone = new THREE.Group();
  var dMat = new THREE.MeshLambertMaterial({ color: 0x1C2016 });
  drone.add(new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.35, 1.4), dMat));
  var armG = new THREE.BoxGeometry(3.4, 0.12, 0.18);
  var a1 = new THREE.Mesh(armG, dMat); a1.rotation.y = Math.PI / 4; drone.add(a1);
  var a2 = new THREE.Mesh(armG, dMat); a2.rotation.y = -Math.PI / 4; drone.add(a2);
  var rotors = [];
  var rotG = new THREE.CylinderGeometry(0.75, 0.75, 0.04, 16);
  var rotM = new THREE.MeshBasicMaterial({ color: 0xF7E6C0, transparent: true, opacity: 0.35 });
  [[1.2, 1.2], [-1.2, 1.2], [1.2, -1.2], [-1.2, -1.2]].forEach(function (o) { var r = new THREE.Mesh(rotG, rotM); r.position.set(o[0], 0.22, o[1]); drone.add(r); rotors.push(r); });
  var led = new THREE.Mesh(new THREE.SphereGeometry(0.16, 8, 8), new THREE.MeshBasicMaterial({ color: 0xFFC94A }));
  led.position.set(0, -0.2, 0.7); drone.add(led);
  var coneG = new THREE.ConeGeometry(4.2, 11, 32, 1, true);
  coneG.translate(0, -5.5, 0);
  var cone = new THREE.Mesh(coneG, new THREE.MeshBasicMaterial({ color: 0xFFD27A, transparent: true, opacity: 0.1, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
  drone.add(cone);
  scene.add(drone);
  var scanRing = new THREE.Mesh(new THREE.RingGeometry(3.6, 4.2, 48), new THREE.MeshBasicMaterial({ color: 0xFFD27A, transparent: true, opacity: 0.55, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
  scanRing.rotation.x = -Math.PI / 2;
  scene.add(scanRing);

  /* ---------- sizing / interaction ---------- */
  var W = 1, Hh = 1, visible = true, mx = 0, my = 0, smx = 0, smy = 0;
  function resize() {
    var r = canvas.getBoundingClientRect();
    W = Math.max(1, r.width); Hh = Math.max(1, r.height);
    renderer.setSize(W, Hh, false);
    camera.aspect = W / Hh;
    camera.fov = W < 700 ? 52 : 40;
    camera.updateProjectionMatrix();
    pMat.uniforms.uScale.value = Hh * 0.55;
  }
  resize();
  window.addEventListener("resize", resize);
  window.addEventListener("pointermove", function (e) { mx = e.clientX / window.innerWidth - 0.5; my = e.clientY / window.innerHeight - 0.5; }, { passive: true });
  try { new IntersectionObserver(function (es) { visible = es[0].isIntersecting; if (visible) loop(); }).observe(canvas); } catch (e) {}

  var clock = new THREE.Clock(), raf = 0, elapsed = 0;
  var target = new THREE.Vector3();

  function update(dt) {
    elapsed += dt;
    uniforms.uTime.value = elapsed;
    var k = dt * 60;
    for (var i = 0; i < PN; i++) {
      var p = P[i];
      if (p.up) {
        p.y += p.vy * k; p.x += Math.sin(elapsed * 0.8 + i) * 0.006 * k;
        var life = (p.y - 0) / p.top;
        pA[i] = Math.max(0, Math.min(1, (1 - life) * 1.4)) * 0.95;
        if (p.y > p.top) respawn(p, false);
      } else {
        p.x += (p.tx - p.x) * p.sp * k; p.y += (p.ty - p.y) * p.sp * k; p.z += (p.tz - p.z) * p.sp * k;
        var dd = Math.abs(p.y - p.ty);
        pA[i] = Math.min(1, dd / 6) * 0.95;
        if (dd < 0.6) respawn(p, false);
      }
      pPos[i * 3] = p.x; pPos[i * 3 + 1] = p.y; pPos[i * 3 + 2] = p.z;
    }
    pGeo.attributes.position.needsUpdate = true;
    pGeo.attributes.aAlpha.needsUpdate = true;

    var dx = 34 * Math.sin(elapsed * 0.11), dz = 12 + 22 * Math.sin(elapsed * 0.17 + 1.2);
    var gy = H(dx, dz);
    drone.position.set(dx, gy + 11 + Math.sin(elapsed * 1.3) * 0.4, dz);
    drone.rotation.y = Math.atan2(34 * 0.11 * Math.cos(elapsed * 0.11), 22 * 0.17 * Math.cos(elapsed * 0.17 + 1.2));
    drone.rotation.z = Math.sin(elapsed * 0.9) * 0.05;
    rotors.forEach(function (r, ri) { r.rotation.y += (ri % 2 ? 0.9 : -0.9) * k; });
    scanRing.position.set(dx, gy + 0.25, dz);
    var sp = 1 + 0.12 * Math.sin(elapsed * 4);
    scanRing.scale.set(sp, sp, sp);

    smx += (mx - smx) * 0.04; smy += (my - smy) * 0.04;
    var heroH = canvas.parentElement.offsetHeight || Hh;
    var sp2 = Math.min(1, Math.max(0, window.scrollY / heroH));
    var ang = elapsed * 0.025 + smx * 0.35;
    var rad = 86 - sp2 * 26;
    var camY = 34 - sp2 * 16 - smy * 6;
    camera.position.set(Math.sin(ang) * rad, camY, Math.cos(ang) * rad + 10);
    target.set(Math.sin(ang) * 6, 2 - sp2 * 2, 4 - sp2 * 20);
    camera.lookAt(target);
  }

  function loop() {
    if (raf) return;
    raf = requestAnimationFrame(function step() {
      raf = 0;
      if (!visible) return;
      var dt = Math.min(clock.getDelta(), 0.05);
      update(dt);
      renderer.render(scene, camera);
      raf = requestAnimationFrame(step);
    });
  }

  if (reduce) { update(2); update(0.016); renderer.render(scene, camera); }
  else { clock.getDelta(); loop(); }
  window.__field3d = { regs: regs.length };
})();
