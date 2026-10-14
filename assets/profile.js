import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.117.1/+esm";

(function () {
  const $ = (selector) => document.querySelector(selector);
  const authCard = $("#auth-card"), profileCard = $("#profile-card");
  const authForm = $("#auth-form"), profileForm = $("#farmer-profile-form");
  if (!authCard || !profileCard || !authForm || !profileForm) return;

  const cfg = window.AGROVERIX_SUPABASE || {};
  const ready = Boolean(cfg.url && cfg.publishableKey);
  const authStatus = $("#auth-status"), profileStatus = $("#profile-status");
  const authPhone = $("#auth-phone"), authPassword = $("#auth-password");
  const credentials = $("#signup-credentials");
  const signupPhone = $("#signup-phone"), signupPassword = $("#signup-password"), signupConfirm = $("#signup-password-confirm");
  let client = null, currentSession = null, mode = "login", registrationPending = false, admin = null;

  function setStatus(target, text, isError = false) {
    target.textContent = text || "";
    target.classList.toggle("is-error", Boolean(isError));
  }
  function digitsToPhone(raw) {
    let digits = raw.replace(/\D/g, "");
    if (digits.startsWith("00")) digits = digits.slice(2);
    if (digits.startsWith("0")) digits = "90" + digits.slice(1);
    else if (digits.length === 10) digits = "90" + digits;
    return "+" + digits;
  }
  function validPhone(phone) { return /^\+905[0-9]{9}$/.test(phone); }
  function setMode(next) {
    mode = next;
    authCard.hidden = next !== "login";
    profileCard.hidden = next !== "signup";
    credentials.disabled = next !== "signup";
    credentials.hidden = next !== "signup";
    $("#auth-title").textContent = "Hesabına giriş yap";
    $("#auth-submit").innerHTML = "Giriş yap <span>→</span>";
    document.querySelectorAll("[data-auth-mode]").forEach((button) => {
      const active = button.dataset.authMode === next;
      button.classList.toggle("is-active", active);
      button.setAttribute("aria-selected", String(active));
    });
    $("#auth-modes").hidden = currentSession !== null;
    $("#auth-back").hidden = next !== "signup";
    $("#auth-signout").hidden = currentSession === null;
    $("#profile-title").textContent = next === "signup" ? "Çiftçi profilini oluştur" : "Çiftçi profilin";
    $("#profile-account-phone").textContent = currentSession ? "Hesap: " + (currentSession.user.phone || "") : "Kayıt bilgilerini doldur, en son kendi şifreni belirle.";
    $("#profile-submit").innerHTML = next === "signup" ? "Hesabı oluştur ve profilini kaydet <span>→</span>" : "Profili güvenli şekilde kaydet <span>→</span>";
    setStatus(authStatus, "");
    if (next === "signup") setStatus(profileStatus, !ready ? "Formu doldurabilirsin. Hesabı kaydetmek için yönetici Supabase bağlantısını tamamlamalı." : "");
  }
  async function showAccount(session) {
    currentSession = session;
    if (!session) { setMode("login"); return; }
    authCard.hidden = true;
    profileCard.hidden = false;
    credentials.hidden = true;
    credentials.disabled = true;
    $("#auth-modes").hidden = true;
    $("#auth-signout").hidden = false;
    $("#auth-back").hidden = true;
    $("#profile-title").textContent = "Çiftçi profilin";
    $("#profile-account-phone").textContent = "Hesap: " + (session.user.phone || "");
    $("#profile-submit").innerHTML = "Profili güvenli şekilde kaydet <span>→</span>";
    await adminReady;
    await loadProfile();
  }

  function resetSelect(el, prompt) {
    el.replaceChildren();
    const option = document.createElement("option");
    option.value = ""; option.textContent = prompt; option.disabled = true; option.selected = true;
    el.appendChild(option); el.disabled = true;
  }
  function fillSelect(el, prompt, rows) {
    resetSelect(el, prompt);
    rows.forEach((row) => { const option = document.createElement("option"); option.value = row.id; option.textContent = row.name; el.appendChild(option); });
    el.disabled = rows.length === 0;
  }
  const province = $("#p-province"), district = $("#p-district"), village = $("#p-village");
  const adminReady = fetch("assets/administrative-units.json?v=2").then((response) => {
    if (!response.ok) throw new Error("Yer listesi yüklenemedi.");
    return response.json();
  }).then((data) => { admin = data; fillSelect(province, "İl seçin", data.provinces); })
    .catch(() => { resetSelect(province, "Yer listesi yüklenemedi"); });
  province.addEventListener("change", () => {
    fillSelect(district, "İlçe seçin", (admin && admin.districts[province.value]) || []);
    resetSelect(village, "Önce ilçe seçin");
  });
  district.addEventListener("change", () => {
    const rows = ((admin && admin.settlements[district.value]) || []).map((name) => ({ id: name, name }));
    fillSelect(village, rows.length ? "Köy / mahalle seçin" : "Köy / mahalle bulunamadı", rows);
  });

  function profileRecord(userId) {
    return {
      user_id: userId,
      full_name: $("#p-name").value.trim(),
      identity_number: $("#p-id").value.trim(),
      province: province.value,
      district: district.value,
      village: village.value,
      latitude: $("#p-latitude").value ? Number($("#p-latitude").value) : null,
      longitude: $("#p-longitude").value ? Number($("#p-longitude").value) : null,
      crop: $("#p-crop").value || null,
      area_decare: $("#p-area").value ? Number($("#p-area").value) : null,
      anonymous_insights_consent: $("#p-consent").checked,
      consent_updated_at: $("#p-consent").checked ? new Date().toISOString() : null,
      updated_at: new Date().toISOString()
    };
  }
  async function saveProfile(record) {
    const { error } = await client.from("farmer_profiles").upsert(record, { onConflict: "user_id" });
    if (error) {
      setStatus(profileStatus, "Profil kaydedilemedi. Kurulumun tamamlandığını ve bilgileri kontrol edip tekrar dene.", true);
      return false;
    }
    setStatus(profileStatus, "Profilin hesabına özel olarak kaydedildi.");
    return true;
  }
  async function loadProfile() {
    const { data, error } = await client.from("farmer_profiles").select("*").eq("user_id", currentSession.user.id).maybeSingle();
    if (error) { setStatus(profileStatus, "Profil tablosu henüz kurulmamış. Yönetici kurulum adımlarını tamamlamalı.", true); return; }
    if (!data) { profileForm.reset(); setStatus(profileStatus, ""); return; }
    $("#p-name").value = data.full_name || "";
    $("#p-id").value = data.identity_number || "";
    $("#p-area").value = data.area_decare ?? "";
    $("#p-crop").value = data.crop || "";
    $("#p-latitude").value = data.latitude ?? "";
    $("#p-longitude").value = data.longitude ?? "";
    $("#p-consent").checked = Boolean(data.anonymous_insights_consent);
    if (data.province && admin) {
      province.value = data.province; province.dispatchEvent(new Event("change"));
      district.value = data.district || ""; district.dispatchEvent(new Event("change"));
      village.value = data.village || "";
    }
  }

  document.querySelectorAll("[data-auth-mode]").forEach((button) => button.addEventListener("click", () => {
    if (button.dataset.authMode === "signup") {
      profileForm.reset();
      setMode("signup");
    } else setMode("login");
  }));
  $("#auth-back").addEventListener("click", () => setMode("login"));

  authForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!ready) { setStatus(authStatus, "Hesap servisi henüz bağlanmadı. Yönetici kurulum adımlarını tamamlamalı.", true); return; }
    const phone = digitsToPhone(authPhone.value);
    if (!validPhone(phone)) { setStatus(authStatus, "Türkiye cep telefonu numarasını 05xx xxx xx xx biçiminde gir.", true); return; }
    if (authPassword.value.length < 8) { setStatus(authStatus, "Şifren en az 8 karakter olmalı.", true); return; }
    setStatus(authStatus, "Giriş yapılıyor…");
    const { data, error } = await client.auth.signInWithPassword({ phone, password: authPassword.value });
    if (error || !data.session) { setStatus(authStatus, "Giriş yapılamadı. Telefon numaranı ve şifreni kontrol et.", true); return; }
    await showAccount(data.session);
  });

  profileForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!ready) { setStatus(profileStatus, "Hesap servisi henüz bağlanmadı. Yönetici kurulum adımlarını tamamlamalı.", true); return; }
    if (currentSession) {
      setStatus(profileStatus, "Profil kaydediliyor…");
      await saveProfile(profileRecord(currentSession.user.id));
      return;
    }
    if (mode !== "signup") { setMode("login"); return; }
    const phone = digitsToPhone(signupPhone.value);
    if (!validPhone(phone)) { setStatus(profileStatus, "Türkiye cep telefonu numarasını 05xx xxx xx xx biçiminde gir.", true); return; }
    if (signupPassword.value.length < 8) { setStatus(profileStatus, "Şifren en az 8 karakter olmalı.", true); return; }
    if (signupPassword.value !== signupConfirm.value) { setStatus(profileStatus, "Şifreler birbiriyle eşleşmiyor.", true); return; }

    const record = profileRecord(null);
    registrationPending = true;
    setStatus(profileStatus, "Hesap oluşturuluyor…");
    const { data, error } = await client.auth.signUp({ phone, password: signupPassword.value });
    registrationPending = false;
    if (error) { setStatus(profileStatus, "Hesap oluşturulamadı. Telefon numaranı kontrol et veya zaten kayıtlıysa giriş yap.", true); return; }
    const session = data.session || (await client.auth.getSession()).data.session;
    if (!session) {
      setStatus(profileStatus, "Hesap açılmadı: Supabase telefon onayı kapalı olmalı. Yönetici Authentication ayarlarını kontrol et.", true);
      return;
    }
    currentSession = session;
    record.user_id = session.user.id;
    await showAccount(session);
    if (await saveProfile(record)) {
      profileForm.reset();
      await loadProfile();
    }
  });

  $("#auth-signout").addEventListener("click", async () => {
    if (client) await client.auth.signOut();
    currentSession = null; profileForm.reset(); setMode("login");
  });
  $("#p-get-location").addEventListener("click", () => {
    const locationStatus = $("#p-location-status");
    if (!window.isSecureContext) { locationStatus.textContent = "Konum izni için HTTPS bağlantısı gerekli."; return; }
    if (!navigator.geolocation) { locationStatus.textContent = "Bu tarayıcı konum almayı desteklemiyor."; return; }
    const button = $("#p-get-location"); button.disabled = true; locationStatus.textContent = "Konum izni bekleniyor…";
    navigator.geolocation.getCurrentPosition((position) => {
      $("#p-latitude").value = position.coords.latitude; $("#p-longitude").value = position.coords.longitude;
      locationStatus.textContent = "Tarla konumu eklendi. Koordinatlar ekranda gösterilmez."; button.disabled = false;
    }, (error) => {
      locationStatus.textContent = error.code === 1 ? "Konum izni verilmedi. Tarayıcı ayarlarından izin verip tekrar dene." : "Konum alınamadı. GPS'i açıp tekrar dene.";
      button.disabled = false;
    }, { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 });
  });

  if (!ready) {
    $("#auth-setup-note").hidden = false;
    setStatus(authStatus, "Telefonla üyelik servisi henüz yapılandırılmadı.", true);
    return;
  }
  client = createClient(cfg.url, cfg.publishableKey, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } });
  client.auth.getSession().then(({ data }) => showAccount(data.session));
  client.auth.onAuthStateChange((_event, session) => {
    if (registrationPending) return;
    window.setTimeout(() => showAccount(session), 0);
  });
})();
