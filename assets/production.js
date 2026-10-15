import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.117.1/+esm";
import { costPerDecare } from "./operation-cost.js";

const $ = (selector) => document.querySelector(selector);
const cfg = window.AGROVERIX_SUPABASE || {};
const banner = $("#production-auth-banner");
const form = $("#production-form");
const status = $("#production-status");
let client = null;
let session = null;
let farms = [];
let records = [];
const icons = { tillage:"⌁", seed:"✳",planting:"✳", fertilizing:"＋", irrigation:"⌖", spraying:"✧", weeding:"⌁", harvest:"↟", other:"•" };
const labels = { tillage:"Toprak hazırlığı / sürüm", seed:"Tohum",planting:"Ekim / dikim", fertilizing:"Gübreleme", irrigation:"Sulama", spraying:"İlaçlama", weeding:"Yabancı ot mücadelesi", harvest:"Hasat", other:"Diğer işlem" };

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
  const selectedFarm = input.value;
  const selectedFilter = filter.value;
  input.replaceChildren(new Option(farms.length ? "Tarla seç" : "Önce tarla eklemelisin", ""));
  filter.replaceChildren(new Option("Tüm tarlalar", ""));
  farms.forEach((farm) => {
    input.add(new Option(farmOptionLabel(farm), farm.id));
    filter.add(new Option(farm.name + " · " + farm.crop, farm.id));
  });
  if (!farms.length) input.add(new Option("Tarla ekleme sayfasına git →", "__add_farm__"));
  input.disabled = farms.length === 0;
  filter.disabled = farms.length === 0;
  if (farms.some((farm) => farm.id === selectedFarm)) input.value = selectedFarm;
  else if (farms.length === 1) input.value = farms[0].id;
  if (farms.some((farm) => farm.id === selectedFilter)) filter.value = selectedFilter;
  if ($("#operation-date") && !$("#operation-date").value) $("#operation-date").value = localToday();
  updateCostPreview();
}
function formatMoney(value) {
  return Number(value || 0).toLocaleString("tr-TR", { maximumFractionDigits: 2 });
}
function calculateCostPerDecare(record) {
  const farm = farms.find(item => item.id === record.farm_id);
  return costPerDecare(record, farm?.area_decare);
}
function updateSummary() {
  const farmId = selectedFilterFarm();
  const filtered = farmId ? records.filter((row) => row.farm_id === farmId) : records;
  const farmIds = [...new Set(filtered.map((row) => row.farm_id))];
  let knownTotal = 0, knownArea = 0;
  farmIds.forEach((id) => {
    const farm = farms.find((item) => item.id === id);
    const farmRows = filtered.filter((row) => row.farm_id === id);
    const costs = farmRows.map(calculateCostPerDecare).filter((value) => value !== null);
    if (farm && costs.length) {
      knownTotal += costs.reduce((sum, value) => sum + value, 0) * Number(farm.area_decare || 0);
      knownArea += Number(farm.area_decare || 0);
    }
  });
  $("#summary-count").textContent = String(filtered.length);
  $("#summary-total").textContent = knownArea ? formatMoney(knownTotal / knownArea) : "—";
  $("#summary-per-decare").textContent = knownArea ? formatMoney(knownTotal) : "—";
  const note = $("#summary-cost-note");
  if (note) note.textContent = filtered.length ? `${filtered.filter((row) => calculateCostPerDecare(row) !== null).length}/${filtered.length} kayıt hesaplanabildi` : "Tarla maliyeti ve alanıyla hesaplanır";
  const totalNote = $("#summary-total-note");
  if (totalNote) totalNote.textContent = knownArea ? "Hesaplanabilen kayıtların toplamı" : "Tarla alanı ve maliyet bilgisi gerekli";
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
    const productAndBrand = [record.product, record.package_size ? "Ambalaj: " + record.package_size : "", record.brand_name ? "Marka: " + record.brand_name : ""].filter(Boolean).join(" · ");
    detail.textContent = (farm ? farm.name + " · " : "") + new Date(record.operation_date + "T12:00:00").toLocaleDateString("tr-TR") + (productAndBrand ? " · " + productAndBrand : "") + (quantity ? (record.cost_basis === "field_total" ? " · Tarlada kullanım: " : " · Dekara kullanım: ") + quantity : "");
    const cost = document.createElement("div");
    cost.className = "production-record-cost";
    const costValue = document.createElement("b");
    const perDecare = calculateCostPerDecare(record);
    costValue.textContent = perDecare !== null ? formatMoney(perDecare) + " TL/da" : "Maliyet bilgisi eksik";
    const costUnit = document.createElement("small");
    costUnit.textContent = perDecare !== null && farm ? formatMoney(perDecare * Number(farm.area_decare)) + " TL tarla toplamı" : "Tarla alanı veya maliyet bilgisi eksik";
    cost.append(costValue, costUnit);
    const actions = document.createElement("div");
    actions.className = "production-record-actions";
    const remove = document.createElement("button");
    remove.type = "button"; remove.textContent = "Sil";
    remove.addEventListener("click", async () => {
      if (!window.confirm("Bu üretim kaydını silmek istiyor musun?")) return;
      const { error } = await client.from("farmer_operations").delete().eq("id", record.id).eq("user_id", session.user.id);
      if (error) { message("Kayıt silinemedi. Kurulum durumunu kontrol et.", true); return; }
      message("Üretim kaydı silindi.");
      await loadRecords();
    });
    actions.append(remove);
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
  const requestedFarm = new URLSearchParams(location.search).get("farm");
  if (requestedFarm && farms.some((farm) => farm.id === requestedFarm)) {
    $("#operation-farm").value = requestedFarm;
    $("#records-filter").value = requestedFarm;
    updateCostPreview();
  }
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
  const farm = activeFarm();
  const legacy = record.cost_basis !== "field_total";
  const per = calculateCostPerDecare(record);
  $("#operation-quantity").value = legacy && record.quantity && farm ? Number((Number(record.quantity) * Number(farm.area_decare)).toFixed(3)) : record.quantity ?? "";
  $("#operation-unit").value = String(record.quantity_unit || "").replace(/\/da$/, "");
  $("#operation-total-cost").value = per !== null && farm ? Number((per * Number(farm.area_decare)).toFixed(2)) : "";
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
  const preview = $("#operation-cost-preview");
  const farm = activeFarm();
  const raw = $("#operation-total-cost").value.trim();
  const total = Number(raw.replace(',', '.'));
  if (!farm || !raw || !Number.isFinite(total) || total < 0 || Number(farm.area_decare) <= 0) {
    preview.textContent = "Dekara maliyeti görmek için tarla seç ve bu tarla için toplam maliyeti gir.";
    return;
  }
  preview.textContent = "Dekara maliyet: " + formatMoney(total / Number(farm.area_decare)) + " TL/da · " + farm.name + " (" + formatMoney(farm.area_decare) + " da) için toplam " + formatMoney(total) + " TL";
}$("#operation-farm").addEventListener("change", () => { updateCostPreview(); updateSummary(); });
$("#operation-farm").addEventListener("change", () => { if ($("#operation-farm").value === "__add_farm__") location.href = "tarla-bilgileri.html"; });
$("#records-filter").addEventListener("change", updateSummary);
$("#operation-cancel").addEventListener("click", clearForm);
form.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!session) { message("Kaydetmek için önce telefon numaranla giriş yap. Form bilgileri bu sayfada saklanmadı.", true); return; }
  if (!$("#operation-product").value.trim()) { message("Kullanılan Ürün Adı zorunludur.", true); return; }
  const farm = activeFarm();
  if (!farm) { message("İşlem kaydı için önce bir tarla seç veya ekle.", true); return; }
  const quantity = Number($("#operation-quantity").value.trim().replace(',', '.'));
  if (!Number.isFinite(quantity) || quantity <= 0) { message("Bu Tarla İçin Kullanılan Miktar sıfırdan büyük olmalıdır.", true); return; }
  if (!$("#operation-unit").value) { message("Bu Tarla İçin Kullanılan Miktar için birim seç.", true); return; }
  const rawCost = $("#operation-total-cost").value.trim();
  const totalCost = Number(rawCost.replace(",", "."));
  if (!rawCost || !Number.isFinite(totalCost) || totalCost < 0) { message("Bu Tarla İçin Maliyet tutarını sıfır veya daha büyük gir.", true); return; }
  const record = {
    user_id: session.user.id,
    farm_id: farm.id,
    operation_type: $("#operation-type").value,
    operation_date: $("#operation-date").value,
    product: $("#operation-product").value.trim(),
    cost_basis: "field_total",
    total_cost: totalCost,
    package_size: null,
    quantity,
    quantity_unit: $("#operation-unit").value || null,
    package_price: null,
    notes: $("#operation-note").value.trim() || null,
    updated_at: new Date().toISOString()
  };
  if ($("#operation-id").value) record.id = $("#operation-id").value;
  $("#operation-submit").disabled = true;
  message("Üretim kaydı kaydediliyor…");
  const { error } = await client.from("farmer_operations").upsert(record, { onConflict: "id" });
  if (error) { $("#operation-submit").disabled = false; message("Kayıt kaydedilemedi. Supabase kurulumunu kontrol edip tekrar dene.", true); return; }
  message("İşlem kaydedildi. Ana sayfadaki maliyet özetine yönlendiriliyorsun…");
  window.location.assign("index.html");
});
["operation-quantity", "operation-unit", "operation-total-cost"].forEach((id) => {
  $("#" + id).addEventListener("input", updateCostPreview);
  $("#" + id).addEventListener("change", updateCostPreview);
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
