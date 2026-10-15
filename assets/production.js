import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.117.1/+esm";

const $ = (selector) => document.querySelector(selector);
const cfg = window.AGROVERIX_SUPABASE || {};
const banner = $("#production-auth-banner");
const form = $("#production-form");
const status = $("#production-status");
let client = null;
let session = null;
let farms = [];
let records = [];
const icons = { tillage:"⌁", planting:"✳", fertilizing:"＋", irrigation:"⌖", spraying:"✧", weeding:"⌁", harvest:"↟", other:"•" };
const labels = { tillage:"Toprak hazırlığı / sürüm", planting:"Ekim / dikim", fertilizing:"Gübreleme", irrigation:"Sulama", spraying:"İlaçlama", weeding:"Yabancı ot mücadelesi", harvest:"Hasat", other:"Diğer işlem" };

function message(text, error = false) {
  status.textContent = text || "";
  status.classList.toggle("is-error", Boolean(error));
}
function activeFarm() {
  return farms.find((farm) => farm.id === $("#operation-farm").value) || null;
}
function selectedFilterFarm() {
  return $("#records-filter").value;
}
function localToday() {
  const now = new Date();
  return new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
}
function farmOptionLabel(farm) {
  return farm.name + " · " + farm.crop + " · " + Number(farm.area_decare).toLocaleString("tr-TR") + " da";
}
function renderFarmOptions() {
  const input = $("#operation-farm");
  const filter = $("#records-filter");
  input.replaceChildren(new Option(farms.length ? "Tarla seç" : "Önce tarla eklemelisin", ""));
  filter.replaceChildren(new Option("Tüm tarlalar", ""));
  farms.forEach((farm) => {
    input.add(new Option(farmOptionLabel(farm), farm.id));
    filter.add(new Option(farm.name + " · " + farm.crop, farm.id));
  });
  if (!farms.length) input.add(new Option("Tarla ekleme sayfasına git →", "__add_farm__"));
  input.disabled = farms.length === 0;
  filter.disabled = farms.length === 0;
  if (farms.length === 1) input.value = farms[0].id;
  if ($("#operation-date") && !$("#operation-date").value) $("#operation-date").value = localToday();
  updateCostPreview();
}
function formatMoney(value) {
  return Number(value || 0).toLocaleString("tr-TR", { maximumFractionDigits: 2 });
}
function updateSummary() {
  const farmId = selectedFilterFarm();
  const filtered = farmId ? records.filter((row) => row.farm_id === farmId) : records;
  const cost = filtered.reduce((sum, row) => sum + Number(row.total_cost || 0), 0);
  const farm = farms.find((row) => row.id === farmId);
  const area = farm ? Number(farm.area_decare) : farms.filter((row) => filtered.some((entry) => entry.farm_id === row.id)).reduce((sum, row) => sum + Number(row.area_decare || 0), 0);
  $("#summary-count").textContent = String(filtered.length);
  $("#summary-total").textContent = formatMoney(cost);
  $("#summary-area-label").textContent = farm ? "Seçili tarlada" : "Tarlalar ortalaması";
  $("#summary-per-decare").textContent = area ? formatMoney(cost / area) : "—";
  $("#production-empty").hidden = filtered.length > 0;
  renderRecords(filtered);
}
function renderRecords(rows) {
  const list = $("#production-record-list");
  list.replaceChildren();
  rows.forEach((record) => {
    const card = document.createElement("article");
    card.className = "production-record";
    const icon = document.createElement("span");
    icon.className = "production-record-icon";
    icon.setAttribute("aria-hidden", "true");
    icon.textContent = icons[record.operation_type] || "•";
    const content = document.createElement("div");
    content.className = "production-record-content";
    const title = document.createElement("b");
    title.textContent = labels[record.operation_type] || "Diğer işlem";
    const detail = document.createElement("small");
    const farm = farms.find((item) => item.id === record.farm_id);
    const quantity = record.quantity ? formatMoney(record.quantity) + " " + (record.quantity_unit || "") : "";
    const productAndBrand = [record.product, record.brand_name ? "Marka: " + record.brand_name : ""].filter(Boolean).join(" · ");
    detail.textContent = (farm ? farm.name + " · " : "") + new Date(record.operation_date + "T12:00:00").toLocaleDateString("tr-TR") + (productAndBrand ? " · " + productAndBrand : "") + (quantity ? " · Dekara kullanım: " + quantity : "");
    const cost = document.createElement("div");
    cost.className = "production-record-cost";
    const costValue = document.createElement("b");
    costValue.textContent = formatMoney(record.total_cost) + " TL";
    const costUnit = document.createElement("small");
    costUnit.textContent = farm?.area_decare ? formatMoney(Number(record.total_cost || 0) / Number(farm.area_decare)) + " TL/da" : "Maliyet";
    cost.append(costValue, costUnit);
    const actions = document.createElement("div");
    actions.className = "production-record-actions";
    const edit = document.createElement("button");
    edit.type = "button"; edit.textContent = "Düzenle";
    edit.addEventListener("click", () => editRecord(record));
    const remove = document.createElement("button");
    remove.type = "button"; remove.textContent = "Sil";
    remove.addEventListener("click", async () => {
      if (!window.confirm("Bu üretim kaydını silmek istiyor musun?")) return;
      const { error } = await client.from("farmer_operations").delete().eq("id", record.id).eq("user_id", session.user.id);
      if (error) { message("Kayıt silinemedi. Kurulum durumunu kontrol et.", true); return; }
      message("Üretim kaydı silindi.");
      await loadRecords();
    });
    actions.append(edit, remove);
    card.append(icon, content, cost, actions);
    content.append(title, detail);
    list.append(card);
  });
}
async function loadFarms() {
  const { data, error } = await client.from("farmer_farms").select("id,name,crop,area_decare").eq("user_id", session.user.id).order("created_at", { ascending: true });
  if (error) { message("Tarla listesi yüklenemedi. Supabase kurulumunu kontrol et.", true); return; }
  farms = data || [];
  renderFarmOptions();
  if (!farms.length) {
    message("Önce Aşama 02'de en az bir tarla eklemelisin.");
    updateSummary();
    return;
  }
  await loadRecords();
}
async function loadRecords() {
  const { data, error } = await client.from("farmer_operations").select("*").eq("user_id", session.user.id).order("operation_date", { ascending: false }).order("created_at", { ascending: false });
  if (error) { message("İşlem tablosu henüz kurulmamış. Yönetici Supabase kurulum dosyasını güncellemeli.", true); records = []; updateSummary(); return; }
  records = data || [];
  updateSummary();
}
function editRecord(record) {
  $("#operation-id").value = record.id;
  $("#operation-farm").value = record.farm_id;
  $("#operation-type").value = record.operation_type;
  $("#operation-date").value = record.operation_date;
  $("#operation-product").value = record.product || "";
  $("#operation-brand").value = record.brand_name || "";
  $("#operation-quantity").value = record.quantity ?? "";
  $("#operation-unit").value = record.quantity_unit || "";
  $("#operation-cost").value = record.total_cost || "";
  $("#operation-note").value = record.notes || "";
  $("#production-title").textContent = "İşlem kaydını düzenle";
  $("#operation-submit").innerHTML = "Değişiklikleri kaydet <span>→</span>";
  $("#operation-cancel").hidden = false;
  updateCostPreview();
  form.scrollIntoView({ behavior: "smooth", block: "start" });
}
function clearForm() {
  form.reset();
  $("#operation-id").value = "";
  $("#operation-date").value = localToday();
  $("#production-title").textContent = "Yeni işlem kaydı";
  $("#operation-submit").innerHTML = "İşlemi kaydet <span>→</span>";
  $("#operation-cancel").hidden = true;
  renderFarmOptions();
  message("");
}
function updateCostPreview() {
  const farm = activeFarm();
  const cost = Number($("#operation-cost").value || 0);
  const target = $("#operation-cost-preview");
  if (!farm) { target.textContent = "Tarlayı seçtiğinde dekara düşen maliyet burada hesaplanır."; return; }
  target.replaceChildren();
  const perDecare = document.createElement("strong");
  perDecare.textContent = formatMoney(cost / Number(farm.area_decare || 1)) + " TL/da";
  target.append("Bu işlem için dekara düşen maliyet: ", perDecare);
}
$("#operation-farm").addEventListener("change", () => { updateCostPreview(); updateSummary(); });
$("#operation-farm").addEventListener("change", () => { if ($("#operation-farm").value === "__add_farm__") location.href = "tarla-bilgileri.html"; });
$("#operation-cost").addEventListener("input", updateCostPreview);
$("#records-filter").addEventListener("change", updateSummary);
$("#operation-cancel").addEventListener("click", clearForm);
form.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!session) { message("Kaydetmek için önce telefon numaranla giriş yap. Form bilgileri bu sayfada saklanmadı.", true); return; }
  const farm = activeFarm();
  if (!farm) { message("İşlem kaydı için önce bir tarla seç veya ekle.", true); return; }
  if ($("#operation-quantity").value && !$("#operation-unit").value) { message("Dekara kullanılan miktar için ölçü birimini de seç.", true); return; }
  const record = {
    user_id: session.user.id,
    farm_id: farm.id,
    operation_type: $("#operation-type").value,
    operation_date: $("#operation-date").value,
    product: $("#operation-product").value.trim() || null,
    brand_name: $("#operation-brand").value.trim() || null,
    quantity: $("#operation-quantity").value ? Number($("#operation-quantity").value) : null,
    quantity_unit: $("#operation-unit").value || null,
    total_cost: Number($("#operation-cost").value || 0),
    notes: $("#operation-note").value.trim() || null,
    updated_at: new Date().toISOString()
  };
  if ($("#operation-id").value) record.id = $("#operation-id").value;
  $("#operation-submit").disabled = true;
  message("Üretim kaydı kaydediliyor…");
  const { error } = await client.from("farmer_operations").upsert(record, { onConflict: "id" });
  $("#operation-submit").disabled = false;
  if (error) { message("Kayıt kaydedilemedi. Supabase kurulumunu kontrol edip tekrar dene.", true); return; }
  message("Üretim kaydı hesabına özel kaydedildi.");
  clearForm();
  await loadRecords();
});
$("#operation-farm").addEventListener("change", updateCostPreview);
if (!cfg.url || !cfg.publishableKey) {
  message("Kayıt servisi henüz yapılandırılmadı.", true);
} else {
  client = createClient(cfg.url, cfg.publishableKey, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } });
  const { data } = await client.auth.getSession();
  session = data.session;
  banner.hidden = Boolean(session);
  if (session) await loadFarms();
  client.auth.onAuthStateChange(async (_event, newSession) => {
    session = newSession;
    banner.hidden = Boolean(session);
    if (session) await loadFarms();
    else {
      farms = []; records = []; renderFarmOptions(); updateSummary();
      message("Giriş yaparak kendi kayıtlarını görüntüleyebilirsin.");
    }
  });
}
