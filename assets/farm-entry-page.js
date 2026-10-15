import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.117.1/+esm";
import { locationLabels } from "./location-labels.js";

const $ = (selector) => document.querySelector(selector);
const form = $("#farm-entry-form");
const status = $("#farm-entry-status");
const banner = $("#farm-auth-banner");
const cfg = window.AGROVERIX_SUPABASE || {};
const ready = Boolean(cfg.url && cfg.publishableKey);
let client = null;
let session = null;
let admin = null;
let requestedEditOpened = false;

function message(text, error = false) {
  status.textContent = text;
  status.classList.toggle("is-error", error);
}
function resetSelect(select, label) {
  select.replaceChildren(new Option(label, "", true, true));
  select.disabled = true;
}
function fillSelect(select, prompt, items) {
  resetSelect(select, prompt);
  items.forEach((item) => select.add(new Option(item.name, item.id)));
  select.disabled = !items.length;
}
function bindLocations() {
  const province = $("#farm-entry-province");
  const district = $("#farm-entry-district");
  const village = $("#farm-entry-village");
  province.addEventListener("change", () => {
    fillSelect(district, "İlçe seçin", admin?.districts?.[province.value] || []);
    resetSelect(village, "Önce ilçe seçin");
  });
  district.addEventListener("change", () => {
    const rows = (admin?.settlements?.[district.value] || []).map((name) => ({ id: name, name }));
    fillSelect(village, rows.length ? "Köy / mahalle seçin" : "Köy / mahalle bulunamadı", rows);
  });
}
bindLocations();

const adminReady = fetch("assets/administrative-units.json?v=2")
  .then((response) => { if (!response.ok) throw new Error(); return response.json(); })
  .then((data) => {
    admin = data;
    fillSelect($("#farm-entry-province"), "İl seçin", data.provinces);
  })
  .catch(() => resetSelect($("#farm-entry-province"), "Yer listesi yüklenemedi"));

function renderFarms(rows) {
  const list = $("#farm-entry-list");
  list.replaceChildren();
  $("#farm-list-heading").hidden = rows.length === 0;
  rows.forEach((farm) => {
    const card = document.createElement("article");
    card.className = "farm-entry-card";
    const details = document.createElement("div");
    const title = document.createElement("b");
    title.textContent = farm.name;
    const sub = document.createElement("small");
    sub.textContent = [farm.crop, Number(farm.area_decare).toLocaleString("tr-TR") + " da", locationLabels(farm, admin)].filter(Boolean).join(" · ");
    details.append(title, sub);
    const actions = document.createElement("div");
    const remove = document.createElement("button");
    remove.type = "button"; remove.textContent = "Sil";
    remove.addEventListener("click", async () => {
      if (!window.confirm(farm.name + " kaydını silmek istiyor musun?")) return;
      const { error } = await client.from("farmer_farms").delete().eq("id", farm.id).eq("user_id", session.user.id);
      if (error) { message("Tarla silinemedi. Daha sonra tekrar dene.", true); return; }
      message("Tarla kaydı silindi.");
      await loadFarms();
    });
    actions.append(remove);
    card.append(details, actions);
    list.append(card);
  });
}
async function loadFarms() {
  await adminReady;
  const { data, error } = await client.from("farmer_farms").select("*").eq("user_id", session.user.id).order("created_at", { ascending: false });
  if (error) { message("Tarla kayıtları yüklenemedi. Kurulum durumunu kontrol et.", true); return; }
  renderFarms(data || []);
  const requestedEdit = new URLSearchParams(location.search).get("edit");
  if (requestedEdit && !requestedEditOpened) {
    requestedEditOpened = true;
    const farm = (data || []).find(row => row.id === requestedEdit);
    if (farm) editFarm(farm);
    else message("Düzenlenecek tarla bulunamadı veya hesabına ait değil.", true);
  }
}
function editFarm(farm) {
  $("#farm-entry-id").value = farm.id;
  $("#farm-entry-name").value = farm.name || "";
  $("#farm-entry-crop").value = farm.crop || "";
  $("#farm-entry-area").value = farm.area_decare || "";
  const province = $("#farm-entry-province");
  const district = $("#farm-entry-district");
  const village = $("#farm-entry-village");
  province.value = farm.province || "";
  province.dispatchEvent(new Event("change"));
  district.value = farm.district || "";
  district.dispatchEvent(new Event("change"));
  village.value = farm.village || "";
  $("#farm-entry-latitude").value = farm.latitude || "";
  $("#farm-entry-longitude").value = farm.longitude || "";
  $("#farm-entry-location-status").textContent = farm.latitude ? "Tarla konumu kayıtlı. Yenilemek için konumu tekrar ekle." : "Konum, yalnızca bu tarla kaydına eklenir.";
  $("#farm-page-title").textContent = "Tarla kaydını düzenle";
  $("#farm-entry-submit").innerHTML = "Değişiklikleri kaydet <span>→</span>";
  $("#farm-entry-cancel").hidden = false;
  form.scrollIntoView({ behavior: "smooth", block: "start" });
}
$("#farm-entry-cancel").addEventListener("click", () => {
  form.reset();
  $("#farm-entry-id").value = "";
  resetSelect($("#farm-entry-district"), "Önce il seçin");
  resetSelect($("#farm-entry-village"), "Önce ilçe seçin");
  $("#farm-page-title").textContent = "Yeni tarla kaydı";
  $("#farm-entry-submit").innerHTML = "Tarlayı kaydet <span>→</span>";
  $("#farm-entry-cancel").hidden = true;
  message("");
});
$("#farm-entry-get-location").addEventListener("click", () => {
  const note = $("#farm-entry-location-status");
  const button = $("#farm-entry-get-location");
  if (!window.isSecureContext || !navigator.geolocation) { note.textContent = "Konum almak için HTTPS ve uyumlu bir tarayıcı gerekli."; return; }
  button.disabled = true; note.textContent = "Konum izni bekleniyor…";
  navigator.geolocation.getCurrentPosition((position) => {
    $("#farm-entry-latitude").value = position.coords.latitude;
    $("#farm-entry-longitude").value = position.coords.longitude;
    note.textContent = "Tarla konumu eklendi. Koordinatlar ekranda gösterilmez.";
    button.disabled = false;
  }, (error) => {
    note.textContent = error.code === 1 ? "Konum izni verilmedi. Tarayıcı ayarlarından izin verip tekrar dene." : "Konum alınamadı. GPS'i açıp tekrar dene.";
    button.disabled = false;
  }, { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 });
});
form.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!session) {
    message("Kaydetmek için önce hesabına giriş yap. Formdaki bilgiler bu sayfada kaydedilmedi.", true);
    return;
  }
  if (!$("#farm-entry-village").value) { message("İl, ilçe ve köy/mahalle seçimini tamamla.", true); return; }
  const area = Number($("#farm-entry-area").value.trim().replace(',', '.'));
  if (!Number.isFinite(area) || area <= 0 || area > 1000000) { message("Tarla alanını sıfırdan büyük, en fazla 1.000.000 dekar olacak şekilde yaz.", true); return; }
  const record = {
    user_id: session.user.id,
    name: $("#farm-entry-name").value.trim(),
    crop: $("#farm-entry-crop").value.trim(),
    area_decare: area,
    province: $("#farm-entry-province").value,
    district: $("#farm-entry-district").value,
    village: $("#farm-entry-village").value,
    latitude: $("#farm-entry-latitude").value ? Number($("#farm-entry-latitude").value) : null,
    longitude: $("#farm-entry-longitude").value ? Number($("#farm-entry-longitude").value) : null,
    updated_at: new Date().toISOString()
  };
  const editingId = $("#farm-entry-id").value;
  $("#farm-entry-submit").disabled = true;
  message("Tarla kaydı kaydediliyor…");
  const { error } = editingId
    ? await client.from("farmer_farms").update(record).eq("id", editingId).eq("user_id", session.user.id).select("id").single()
    : await client.from("farmer_farms").insert(record);
  $("#farm-entry-submit").disabled = false;
  if (error) { message("Tarla kaydedilemedi. Kurulum durumunu kontrol edip tekrar dene.", true); return; }
  if (editingId) { window.location.assign("tarla-detay.html?farm=" + encodeURIComponent(editingId)); return; }
  message("Tarla kaydın hesabına özel kaydedildi.");
  form.reset();
  $("#farm-entry-id").value = "";
  resetSelect($("#farm-entry-district"), "Önce il seçin");
  resetSelect($("#farm-entry-village"), "Önce ilçe seçin");
  $("#farm-entry-page-title")?.scrollIntoView?.({ behavior: "smooth", block: "start" });
  $("#farm-page-title").textContent = "Yeni tarla kaydı";
  $("#farm-entry-submit").innerHTML = "Tarlayı kaydet <span>→</span>";
  $("#farm-entry-cancel").hidden = true;
  await loadFarms();
});
if (!ready) {
  message("Kayıt servisi henüz hazır değil.", true);
} else {
  client = createClient(cfg.url, cfg.publishableKey, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } });
  const { data } = await client.auth.getSession();
  session = data.session;
  client.auth.onAuthStateChange((_event, newSession) => {
    session = newSession;
    banner.hidden = Boolean(session);
    if (session) loadFarms();
    else renderFarms([]);
  });
  banner.hidden = Boolean(session);
  if (session) await loadFarms();
}
