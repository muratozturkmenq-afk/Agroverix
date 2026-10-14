import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.117.1/+esm";

(function () {
  const $ = (selector) => document.querySelector(selector);
  const authCard = $("#auth-card"), profileCard = $("#profile-card"), authForm = $("#auth-form");
  if (!authCard || !profileCard || !authForm) return;
  const cfg = window.AGROVERIX_SUPABASE || {};
  const ready = Boolean(cfg.url && cfg.publishableKey);
  const status = $("#auth-status"), setupNote = $("#auth-setup-note"), profileStatus = $("#profile-status");
  const authPhone = $("#auth-phone"), authPassword = $("#auth-password"), authConfirm = $("#auth-confirm");
  const otpForm = $("#auth-otp-form"), resetForm = $("#auth-new-password-form");
  const profileForm = $("#farmer-profile-form");
  let client = null, mode = "login", pendingAction = "", pendingPhone = "", currentSession = null, admin = null;

  function message(text, isError) {
    status.textContent = text || "";
    status.classList.toggle("is-error", Boolean(isError));
  }
  function digitsToPhone(raw) {
    let digits = raw.replace(/\\D/g, "");
    if (digits.startsWith("00")) digits = digits.slice(2);
    if (digits.startsWith("0")) digits = "90" + digits.slice(1);
    else if (digits.length === 10) digits = "90" + digits;
    return digits.startsWith("+") ? digits : "+" + digits;
  }
  function validTurkishPhone(phone) { return /^\\+905[0-9]{9}$/.test(phone); }
  function showAuth(step) {
    authCard.hidden = false;
    profileCard.hidden = true;
    $("#auth-form-area").hidden = step !== "credentials";
    otpForm.hidden = step !== "otp";
    resetForm.hidden = step !== "new-password";
    $("#auth-modes").hidden = step !== "credentials";
  }
  function setMode(next) {
    mode = next;
    document.querySelectorAll("[data-auth-mode]").forEach((button) => {
      const active = button.dataset.authMode === mode;
      button.classList.toggle("is-active", active);
      button.setAttribute("aria-selected", String(active));
    });
    $("#auth-title").textContent = mode === "signup" ? "Hesabını oluştur" : "Hesabına giriş yap";
    $("#auth-submit").innerHTML = (mode === "signup" ? "Üyeliği oluştur" : "Giriş yap") + " <span>→</span>";
    $("#auth-confirm-wrap").hidden = mode !== "signup";
    authConfirm.required = mode === "signup";
    $("#auth-forgot").hidden = mode === "signup";
    authPassword.autocomplete = mode === "signup" ? "new-password" : "current-password";
    message("");
  }
  async function showAccount(session) {
    currentSession = session;
    if (!session) { showAuth("credentials"); return; }
    authCard.hidden = true;
    profileCard.hidden = false;
    $("#profile-account-phone").textContent = "Hesap: " + (session.user.phone || "");
    await adminReady;\n    await loadProfile();
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

  async function loadProfile() {
    const { data, error } = await client.from("farmer_profiles").select("*").eq("user_id", currentSession.user.id).maybeSingle();
    if (error) { profileStatus.textContent = "Profil tablosu henüz kurulmamış. Yönetici kurulum adımlarını tamamlamalı."; profileStatus.classList.add("is-error"); return; }
    if (!data) { profileForm.reset(); profileStatus.textContent = ""; profileStatus.classList.remove("is-error"); return; }
    $("#p-name").value = data.full_name || "";
    $("#p-id").value = data.identity_number || "";
    $("#p-area").value = data.area_decare ?? "";
    $("#p-crop").value = data.crop || "";
    $("#p-latitude").value = data.latitude ?? "";
    $("#p-longitude").value = data.longitude ?? "";
    $("#p-consent").checked = Boolean(data.anonymous_insights_consent);
    if (data.province && admin) {
      province.value = data.province;
      province.dispatchEvent(new Event("change"));
      district.value = data.district || "";
      district.dispatchEvent(new Event("change"));
      village.value = data.village || "";
    }
  }

  document.querySelectorAll("[data-auth-mode]").forEach((button) => button.addEventListener("click", () => setMode(button.dataset.authMode)));
  $("#auth-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!ready) { message("Hesap servisi henüz bağlanmadı. Yönetici kurulum adımlarını tamamlamalı.", true); return; }
    const phone = digitsToPhone(authPhone.value);
    if (!validTurkishPhone(phone)) { message("Türkiye cep telefonu numarasını 05xx xxx xx xx biçiminde gir.", true); return; }
    if (authPassword.value.length < 8) { message("Şifren en az 8 karakter olmalı.", true); return; }
    message("İşleniyor…");
    const result = mode === "signup"
      ? (authPassword.value !== authConfirm.value
        ? { error: new Error("Şifreler birbiriyle eşleşmiyor.") }
        : await client.auth.signUp({ phone, password: authPassword.value }))
      : await client.auth.signInWithPassword({ phone, password: authPassword.value });
    if (result.error) { message(result.error.message === "Şifreler birbiriyle eşleşmiyor." ? result.error.message : "İşlem tamamlanamadı. Telefonunu ve şifreni kontrol edip tekrar dene.", true); return; }
    if (mode === "signup") {
      pendingPhone = phone; pendingAction = "signup";
      $("#auth-otp-intro").textContent = "Telefonuna gelen SMS’teki 6 haneli kodu girerek hesabını doğrula.";
      showAuth("otp"); message("Doğrulama kodu gönderildi.");
      if (result.data.session) await showAccount(result.data.session);
      return;
    }
    await showAccount(result.data.session);
  });

  otpForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const { data, error } = await client.auth.verifyOtp({ phone: pendingPhone, token: $("#auth-otp").value.trim(), type: "sms" });
    if (error) { message("Kod doğrulanamadı. Kodu kontrol edip yeniden dene.", true); return; }
    if (pendingAction === "recovery") { resetForm.hidden = false; otpForm.hidden = true; message("Telefon doğrulandı; yeni şifreni belirle."); return; }
    await showAccount(data.session);
  });

  $("#auth-forgot").addEventListener("click", async () => {
    if (!ready) { message("Hesap servisi henüz bağlanmadı.", true); return; }
    const phone = digitsToPhone(authPhone.value);
    if (!validTurkishPhone(phone)) { message("Önce kayıtlı Türkiye cep telefonu numaranı gir.", true); return; }
    const { error } = await client.auth.signInWithOtp({ phone, options: { shouldCreateUser: false } });
    if (error) { message("Şifre yenileme kodu gönderilemedi. Numaranı kontrol edip tekrar dene.", true); return; }
    pendingPhone = phone; pendingAction = "recovery";
    $("#auth-otp-intro").textContent = "Şifre yenilemek için telefonuna gelen 6 haneli kodu gir.";
    showAuth("otp"); message("Şifre yenileme kodu gönderildi.");
  });
  resetForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const password = $("#auth-new-password").value;
    if (password.length < 8 || password !== $("#auth-new-password-confirm").value) { message("Şifreler eşleşmeli ve en az 8 karakter olmalı.", true); return; }
    const { error } = await client.auth.updateUser({ password });
    if (error) { message("Şifre güncellenemedi. Yeniden giriş yapıp tekrar dene.", true); return; }
    pendingAction = ""; await showAccount(currentSession); message("Şifren güncellendi.");
  });

  profileForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!currentSession) { showAuth("credentials"); return; }
    const record = {
      user_id: currentSession.user.id,
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
    const { error } = await client.from("farmer_profiles").upsert(record, { onConflict: "user_id" });
    if (error) { message("Profil kaydedilemedi. Bilgileri kontrol edip tekrar dene.", true); return; }
    message("Profilin hesabına özel olarak kaydedildi.");
  });
  $("#auth-signout").addEventListener("click", async () => {
    await client.auth.signOut(); currentSession = null; profileForm.reset(); showAuth("credentials"); setMode("login");
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
    setupNote.hidden = false;
    message("Telefonla üyelik servisi henüz etkinleştirilmedi.", true);
    document.querySelectorAll("[data-auth-mode], #auth-submit, #auth-forgot").forEach((element) => { element.disabled = true; });
    return;
  }
  client = createClient(cfg.url, cfg.publishableKey, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } });
  client.auth.getSession().then(({ data }) => showAccount(data.session));
  client.auth.onAuthStateChange((_event, session) => {
    window.setTimeout(() => {
      if (pendingAction === "recovery" && session) { currentSession = session; showAuth("new-password"); return; }
      showAccount(session);
    }, 0);
  });
})();
