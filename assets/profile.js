import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.117.1/+esm";

(function () {
  const $ = (selector) => document.querySelector(selector);
  const authCard = $("#auth-card"), profileCard = $("#profile-card");
  const authForm = $("#auth-form"), profileForm = $("#farmer-profile-form"), farmForm = $("#farm-form");
  if (!authCard || !profileCard || !authForm || !profileForm || !farmForm) return;

  const cfg = window.AGROVERIX_SUPABASE || {};
  const ready = Boolean(cfg.url && cfg.publishableKey);
  const authStatus = $("#auth-status"), profileStatus = $("#profile-status"), farmStatus = $("#farm-status");
  const authPhone = $("#auth-phone"), authPassword = $("#auth-password");
  const credentials = $("#signup-credentials");
  const signupPhone = $("#signup-phone"), signupPassword = $("#signup-password"), signupConfirm = $("#signup-password-confirm");
  const farmProvince = $("#farm-province"), farmDistrict = $("#farm-district"), farmVillage = $("#farm-village");
  const profileProvince = $("#p-province"), profileDistrict = $("#p-district"), profileVillage = $("#p-village");
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
  const requestedStep = new URLSearchParams(window.location.search).get("next");
  const returnPath = ["tarla-bilgileri.html", "uretim-kayitlari.html"].includes(requestedStep) ? requestedStep : "";
  function redirectToStep() {
    if (!returnPath) return false;
    window.location.replace(returnPath);
    return true;
  }
  function setMode(next) {
    mode = next;
    if (next === "signup") $("#profile-edit-details").open = true;
    authCard.hidden = next !== "login";
    profileCard.hidden = next !== "signup";
    $("#farms-section").hidden = true;
    $("#profile-overview").hidden = true;
    credentials.disabled = next !== "signup";
    credentials.hidden = next !== "signup";
    document.querySelectorAll("[data-auth-mode]").forEach((button) => {
      const active = button.dataset.authMode === next;
      button.classList.toggle("is-active", active);
      button.setAttribute("aria-selected", String(active));
    });
    $("#auth-modes").hidden = currentSession !== null;
    $("#auth-back").hidden = next !== "signup";
    $("#auth-signout").hidden = currentSession === null;
    $("#profile-title").textContent = next === "signup" ? "Çiftçi profilini oluştur" : "Çiftçi profilin";
    $("#profile-account-phone").textContent = currentSession ? "Hesap: " + (currentSession.user.phone || "") : "Kişisel bilgilerini gir, tarlalarını hesabını açtıktan sonra ekle.";
    $("#profile-submit").innerHTML = next === "signup" ? "Hesabı oluştur ve profilini kaydet <span>→</span>" : "Profili güvenli şekilde kaydet <span>→</span>";
    setStatus(authStatus, "");
    if (next === "signup") setStatus(profileStatus, !ready ? "Formu doldurabilirsin. Kaydetmek için yönetici Supabase bağlantısını tamamlamalı." : "");
  }
  async function showAccount(session) {
    currentSession = session;
    if (!session) { setMode("login"); return; }
    $("#profile-edit-details").open = false;
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
    $("#farms-section").hidden = false;
    $("#profile-overview").hidden = false;
    await adminReady;
    await loadProfile();
    await loadFarms();
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

  function bindAddressSelectors(province, district, village) {
    province.addEventListener("change", () => {
      fillSelect(district, "İlçe seçin", (admin && admin.districts[province.value]) || []);
      resetSelect(village, "Önce ilçe seçin");
    });
    district.addEventListener("change", () => {
      const rows = ((admin && admin.settlements[district.value]) || []).map((name) => ({ id: name, name }));
      fillSelect(village, rows.length ? "Köy / mahalle seçin" : "Köy / mahalle bulunamadı", rows);
    });
  }
  bindAddressSelectors(profileProvince, profileDistrict, profileVillage);
  bindAddressSelectors(farmProvince, farmDistrict, farmVillage);

  const adminReady = fetch("assets/administrative-units.json?v=2").then((response) => {
    if (!response.ok) throw new Error("Yer listesi yüklenemedi.");
    return response.json();
  }).then((data) => { admin = data; fillSelect(profileProvince, "İl seçin", data.provinces); fillSelect(farmProvince, "İl seçin", data.provinces); })
    .catch(() => { resetSelect(profileProvince, "Yer listesi yüklenemedi"); resetSelect(farmProvince, "Yer listesi yüklenemedi"); });

  function profileRecord(userId) {
    return {
      user_id: userId,
      full_name: $("#p-name").value.trim(),
      identity_number: $("#p-id").value.trim(),
      province: profileProvince.value,
      district: profileDistrict.value,
      village: profileVillage.value,
      kvkk_notice_acknowledged: $("#p-kvkk").checked,
      kvkk_notice_acknowledged_at: $("#p-kvkk").checked ? new Date().toISOString() : null,
      updated_at: new Date().toISOString()
    };
  }
  async function saveProfile(record) {
    const { error } = await client.from("farmer_profiles").upsert(record, { onConflict: "user_id" });
    if (error) { setStatus(profileStatus, "Profil kaydedilemedi. Kurulumun tamamlandığını kontrol edip tekrar dene.", true); return false; }
    setStatus(profileStatus, "Profilin hesabına özel olarak kaydedildi.");
    return true;
  }
  async function loadProfile() {
    const { data, error } = await client.from("farmer_profiles").select("*").eq("user_id", currentSession.user.id).maybeSingle();
    if (error) { setStatus(profileStatus, "Profil tablosu henüz kurulmamış. Yönetici kurulum adımlarını tamamlamalı.", true); return; }
    if (!data) { $("#p-name").value = ""; $("#p-id").value = ""; $("#p-kvkk").checked = false; return; }
    $("#p-name").value = data.full_name || "";
    $("#p-id").value = data.identity_number || "";
    $("#p-kvkk").checked = Boolean(data.kvkk_notice_acknowledged);
    if (data.province && admin) {
      profileProvince.value = data.province; profileProvince.dispatchEvent(new Event("change"));
      profileDistrict.value = data.district || ""; profileDistrict.dispatchEvent(new Event("change"));
      profileVillage.value = data.village || "";
    }
  }
  function farmRecord() {
    const record = {
      user_id: currentSession.user.id,
      name: $("#farm-name").value.trim(),
      crop: $("#farm-crop").value,
      area_decare: Number($("#farm-area").value),
      province: farmProvince.value,
      district: farmDistrict.value,
      village: farmVillage.value,
      latitude: $("#farm-latitude").value ? Number($("#farm-latitude").value) : null,
      longitude: $("#farm-longitude").value ? Number($("#farm-longitude").value) : null,
      updated_at: new Date().toISOString()
    };
    if ($("#farm-id").value) record.id = $("#farm-id").value;
    return record;
  }
  function syncFarmOverview(farms) {
    $("#overview-farm-count").textContent = String(farms.length);
    $("#overview-area").textContent = farms.reduce((total, farm) => total + Number(farm.area_decare || 0), 0).toLocaleString("tr-TR", { maximumFractionDigits: 1 });
    $("#overview-crop-count").textContent = String(new Set(farms.map((farm) => farm.crop).filter(Boolean)).size);
  }
  async function loadFarms() {
    const list = $("#farm-list");
    list.replaceChildren();
    const { data, error } = await client.from("farmer_farms").select("*").eq("user_id", currentSession.user.id).order("created_at");
    if (error) { list.textContent = "Tarla tablosu henüz kurulmamış. Yönetici kurulum adımlarını tamamlamalı."; syncFarmOverview([]); return; }
    syncFarmOverview(data || []);
    if (!data || !data.length) {
      const empty = document.createElement("div"); empty.className = "farm-empty";
      const icon = document.createElement("span"); icon.className = "farm-empty-icon"; icon.setAttribute("aria-hidden", "true"); icon.textContent = "⌖";
      const title = document.createElement("b"); title.textContent = "İlk tarlanı kaydet";
      const copy = document.createElement("p"); copy.textContent = "Tarla adı, ürün, dekar alanı ve konum bilgilerini ekleyerek kişisel kayıt alanını oluşturmaya başla.";
      const add = document.createElement("button"); add.type = "button"; add.className = "profile-submit farm-empty-action"; add.textContent = "＋ İlk tarlamı ekle";
      add.addEventListener("click", () => $("#farm-new").click());
      empty.append(icon, title, copy, add); list.replaceChildren(empty); return;
    }
    data.forEach((farm) => {
      const item = document.createElement("article"); item.className = "farm-item";
      const details = document.createElement("div"); details.className = "farm-item-details";
      const title = document.createElement("b"); title.textContent = farm.name;
      const summary = document.createElement("small"); summary.textContent = [farm.crop, farm.area_decare + " da", farm.village, farm.district, farm.province].join(" · ");
      details.append(title, summary);
      const actions = document.createElement("div"); actions.className = "farm-item-actions";
      const edit = document.createElement("button"); edit.type = "button"; edit.className = "auth-back"; edit.textContent = "Düzenle";
      edit.addEventListener("click", () => editFarm(farm));
      const remove = document.createElement("button"); remove.type = "button"; remove.className = "auth-back"; remove.textContent = "Sil";
      remove.addEventListener("click", async () => {
        if (!window.confirm("Bu tarla kaydını silmek istiyor musun?")) return;
        const { error: deleteError } = await client.from("farmer_farms").delete().eq("id", farm.id).eq("user_id", currentSession.user.id);
        if (deleteError) setStatus(farmStatus, "Tarla silinemedi. Tekrar dene.", true);
        else { setStatus(farmStatus, "Tarla silindi."); await loadFarms(); }
      });
      actions.append(edit, remove); item.append(details, actions); list.appendChild(item);
    });
  }
  async function editFarm(farm) {
    farmForm.hidden = false;
    $("#farm-id").value = farm.id;
    $("#farm-name").value = farm.name || "";
    $("#farm-crop").value = farm.crop || "";
    $("#farm-area").value = farm.area_decare ?? "";
    $("#farm-latitude").value = farm.latitude ?? "";
    $("#farm-longitude").value = farm.longitude ?? "";
    farmProvince.value = farm.province || ""; farmProvince.dispatchEvent(new Event("change"));
    farmDistrict.value = farm.district || ""; farmDistrict.dispatchEvent(new Event("change"));
    farmVillage.value = farm.village || "";
    setStatus(farmStatus, "");
    farmForm.scrollIntoView({ behavior: "smooth", block: "start" });
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
    if (redirectToStep()) return;
    await showAccount(data.session);
  });

  profileForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!ready) { setStatus(profileStatus, "Hesap servisi henüz bağlanmadı. Yönetici kurulum adımlarını tamamlamalı.", true); return; }
    if (currentSession) {
      const record = profileRecord(currentSession.user.id);
      if (!record.full_name || !/^[0-9]{11}$/.test(record.identity_number) || !record.province || !record.district || !record.village || !record.kvkk_notice_acknowledged) {
        setStatus(profileStatus, "Profilini kaydetmek için ad-soyad, 11 haneli kimlik no, il/ilçe/köy ve KVKK bilgilendirme kutusunu tamamla. Bunlar üyelik oluşturmak için gerekli değil.", true);
        return;
      }
      setStatus(profileStatus, "Profil kaydediliyor…");
      await saveProfile(record);
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
    if (!session) { setStatus(profileStatus, "Hesap açılmadı: Supabase telefon onayı kapalı olmalı. Yönetici Authentication ayarlarını kontrol et.", true); return; }
    currentSession = session;
    record.user_id = session.user.id;
    const hasCompleteProfile = Boolean(record.full_name && /^[0-9]{11}$/.test(record.identity_number) && record.province && record.district && record.village && record.kvkk_notice_acknowledged);
    await showAccount(session);
    if (hasCompleteProfile) {
      if (await saveProfile(record)) await loadProfile();
    } else {
      setStatus(profileStatus, "Hesabın oluşturuldu. Ad-soyad, kimlik ve adres bilgilerini profilinden daha sonra tamamlayabilirsin.");
    }
    if (redirectToStep()) return;
  });

  $("#overview-add-farm").addEventListener("click", () => { $("#farm-new").click(); $("#farm-form").scrollIntoView({ behavior: "smooth", block: "start" }); });
  $("#farm-new").addEventListener("click", () => {
    farmForm.reset(); $("#farm-id").value = ""; resetSelect(farmDistrict, "Önce il seçin"); resetSelect(farmVillage, "Önce ilçe seçin");
    farmForm.hidden = false; setStatus(farmStatus, ""); $("#farm-name").focus();
  });
  $("#farm-cancel").addEventListener("click", () => { farmForm.reset(); farmForm.hidden = true; });
  farmForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!currentSession) return;
    setStatus(farmStatus, "Tarla kaydediliyor…");
    const { error } = await client.from("farmer_farms").upsert(farmRecord(), { onConflict: "id" });
    if (error) { setStatus(farmStatus, "Tarla kaydedilemedi. Yönetici kurulum adımlarını tamamlamalı.", true); return; }
    setStatus(farmStatus, "Tarla kaydedildi.");
    farmForm.reset(); farmForm.hidden = true; $("#farm-id").value = "";
    await loadFarms();
  });

  $("#auth-signout").addEventListener("click", async () => {
    if (client) await client.auth.signOut();
    currentSession = null; profileForm.reset(); farmForm.reset(); setMode("login");
  });
  $("#farm-get-location").addEventListener("click", () => {
    const locationStatus = $("#farm-location-status");
    if (!window.isSecureContext) { locationStatus.textContent = "Konum izni için HTTPS bağlantısı gerekli."; return; }
    if (!navigator.geolocation) { locationStatus.textContent = "Bu tarayıcı konum almayı desteklemiyor."; return; }
    const button = $("#farm-get-location"); button.disabled = true; locationStatus.textContent = "Konum izni bekleniyor…";
    navigator.geolocation.getCurrentPosition((position) => {
      $("#farm-latitude").value = position.coords.latitude; $("#farm-longitude").value = position.coords.longitude;
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
  client.auth.getSession().then(({ data }) => { if (data.session && redirectToStep()) return; showAccount(data.session); });
  client.auth.onAuthStateChange((_event, session) => {
    if (registrationPending) return;
    window.setTimeout(() => showAccount(session), 0);
  });
})();
