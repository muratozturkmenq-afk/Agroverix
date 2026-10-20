import { parseNumberInput, bindNumberInput, setNumberInputValue } from './number-input.js?v=groups-v2';
import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.117.1/+esm";
import { farmFinance, seasonFor, serviceTypes, operationLabels } from "./farm-finance.js?v=seasons-v1";
import { costPerDecare } from "./operation-cost.js";
import {loadInventory,compatibleUnits,converted,fmt,stockError} from './inventory-data.js?v=auto-cost-v1';
import {automaticOperationCost} from './operation-pricing.js?v=application-entry-v1';

const $ = (selector) => document.querySelector(selector);
const cfg = window.AGROVERIX_SUPABASE || {};
const banner = $("#production-auth-banner");
const form = $("#production-form");
const status = $("#production-status");
let client = null;
let session = null;
let farms = [];
let records = [];
let editingRecords = false;
let requestedEditOpened = false;
let inventoryItems=[],inventoryPurchases=[],inventoryReady=false,autoCostReady=false;
const allUnitOptions=[...$('#operation-unit').options].map(o=>({value:o.value,label:o.textContent}));
const legacyProductValue='__legacy_product__';
function editingRecord(){return records.find(r=>r.id===$('#operation-id').value);}
function selectedProduct(){return inventoryItems.find(i=>i.id===$('#operation-inventory-item').value);}
function addLegacyProductOption(select,record){
 if(record&&!record.inventory_item_id&&!serviceTypes.has(record.operation_type))select.add(new Option((record.product||'Eski ürün')+' · Önceki kayıt (alışverişe bağlı değil)',legacyProductValue));
}
function updateStockSelection(fill=false){
 const item=selectedProduct(),unit=$('#operation-unit'),previous=unit.value;
 unit.replaceChildren();
 if(item){compatibleUnits(item.base_unit).forEach(u=>unit.add(new Option(u,u)));unit.value=compatibleUnits(item.base_unit).includes(previous)?previous:item.base_unit;
  const old=records.find(r=>r.id===$('#operation-id').value),available=Number(item.stock_quantity)+(old?.inventory_item_id===item.id?Number(old.inventory_quantity||0):0);
  $('#operation-stock-hint').textContent=item.name+' · Kullanılabilir: '+fmt(available)+' '+item.base_unit+'. Torba / şişe içeriğini kg veya L cinsinden gir. Kaydettiğinde stok güncellenir.';
 }else{allUnitOptions.forEach(o=>unit.add(new Option(o.label,o.value)));unit.value=previous;$('#operation-stock-hint').textContent=$('#operation-inventory-item').value===legacyProductValue?'Bu eski kayıt alışverişe bağlı değil; mevcut maliyeti elle düzenleyebilirsin. Otomatik hesap için listeden satın aldığın ürünü seç.':!session?'Alışverişlerine kaydettiğin ürünler hesabına giriş yaptıktan sonra burada listelenir.':!inventoryReady?'Alışveriş ürünleri yüklenemedi. Sayfayı yenileyerek tekrar dene.':!inventoryPurchases.length?'Önce Alışveriş Ekle sayfasında aldığın ürünü, miktarını ve bedelini kaydet.':'Alışveriş yaptığın ürünü listeden seç; kullanılan miktarı girince maliyet otomatik dolacak.';}
 if(fill&&!item&&$('#operation-total-cost').readOnly)$('#operation-total-cost').value='';
 updateCostPreview();
}
async function loadStock(){
 const uid=session?.user.id;if(!uid)return;
 try{const [stock,capability]=await Promise.all([loadInventory(client,uid),client.rpc('agroverix_operation_costing_ready').catch(()=>({error:true}))]);if(session?.user.id!==uid)return;inventoryItems=stock.items;inventoryPurchases=stock.purchases;inventoryReady=true;autoCostReady=!capability.error&&capability.data===true;}
 catch{inventoryItems=[];inventoryPurchases=[];inventoryReady=false;autoCostReady=false;}
 const s=$('#operation-inventory-item'),previous=s.value,old=editingRecord();
 s.replaceChildren(new Option(!inventoryReady?'Alışveriş ürünleri yüklenemedi':inventoryPurchases.length?'Alışveriş yapılan ürünü seç':'Henüz alışveriş kaydı yok',''));
 const purchasedIds=new Set(inventoryPurchases.map(p=>p.item_id));
 inventoryItems.filter(i=>purchasedIds.has(i.id)||i.id===old?.inventory_item_id).forEach(i=>s.add(new Option(i.name+(i.brand?' · '+i.brand:'')+' · Kalan: '+fmt(i.stock_quantity)+' '+i.base_unit,i.id)));
 addLegacyProductOption(s,old);
 const linked=old?.inventory_item_id;
 if(linked&&![...s.options].some(o=>o.value===linked))s.add(new Option('Kayıtlı ürün (yüklenemedi)',linked));
 s.value=previous;s.disabled=!inventoryReady||$('#expense-category').value==='service';updateStockSelection();
}
$('#operation-inventory-item').addEventListener('change',()=>updateStockSelection(true));
bindNumberInput($('#operation-quantity'),{maximumFractionDigits:3});bindNumberInput($('#operation-total-cost'),{maximumFractionDigits:2});
function selectCategory(type=''){
 const service=$('#expense-category').value==='service';
 const select=$('#operation-type'); select.replaceChildren(new Option('İşlem seç',''));
 Object.entries(labels).filter(([key])=>serviceTypes.has(key)===service).forEach(([key,label])=>select.add(new Option(label,key)));
 if(type && [...select.options].some(o=>o.value===type))select.value=type;
 ['operation-product-field','operation-quantity-field'].forEach(id=>$('#'+id).hidden=service);
 $('#operation-inventory-item').disabled=service||!inventoryReady;
 $('#operation-inventory-item').required=!service;
 if(service){$('#operation-inventory-item').value='';if($('#operation-total-cost').readOnly)$('#operation-total-cost').value='';}
 updateStockSelection();
 ['operation-quantity','operation-unit'].forEach(id=>{$('#'+id).required=!service;$('#'+id).disabled=service;});
 $('#service-note').hidden=!service;
}
$('#expense-category').addEventListener('change',()=>selectCategory());
function renderSeasons(selected){
 const farm=activeFarm(),select=$('#operation-season');select.replaceChildren();
 (farm?.farmer_seasons||[]).slice().sort((a,b)=>b.season_year-a.season_year).forEach(s=>select.add(new Option(s.season_year+' · '+s.crop,s.season_year)));
 if(farm)select.value=String(selected||farm.season_year);
}
function recordArea(record){const f=farms.find(f=>f.id===record.farm_id);return seasonFor(f||{},record.season_year)?.area_decare||f?.area_decare;}
const requestedEdit = new URLSearchParams(location.search).get("edit");
const icons = { tillage:"⌁", seed:"✳",planting:"✳", fertilizing:"＋", irrigation:"⌖", spraying:"✧", weeding:"⌁", harvest:"↟", other:"•" };
const labels = operationLabels;
selectCategory();

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
  return farm.name + " · " + farm.crop + " · " + Number(seasonFor(farm,Number($("#operation-season").value))?.area_decare||farm.area_decare).toLocaleString("tr-TR") + " da";
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
  renderSeasons();
  updateCostPreview();
}
function formatMoney(value) {
  return Number(value || 0).toLocaleString("tr-TR", { maximumFractionDigits: 2 });
}
function calculateCostPerDecare(record) {
  const farm = farms.find(item => item.id === record.farm_id);
  return costPerDecare(record, recordArea(record));
}
function updateSummary() {
  const farmId = selectedFilterFarm();
  const year=Number($('#operation-season').value);
  const chosen=farms.filter(f=>(!farmId||f.id===farmId)&&(!year||seasonFor(f,year)));
  const filtered=records.filter(r=>(!farmId||r.farm_id===farmId)&&Number(r.season_year)===(year||Number(farms.find(f=>f.id===r.farm_id)?.season_year)));
  const totals=chosen.map(f=>farmFinance(f,filtered,year||f.season_year));
  const valid=totals.filter(c=>c.total!==null),knownTotal=valid.reduce((n,c)=>n+c.total,0),knownArea=valid.reduce((n,c)=>n+c.area,0);
  $('#summary-count').textContent=filtered.length;$('#summary-total').textContent=knownArea?formatMoney(knownTotal/knownArea):'—';$('#summary-per-decare').textContent=knownArea?formatMoney(knownTotal):'—';
  $('#summary-cost-note').textContent='Seçilen sezon · kira dahil';$('#summary-total-note').textContent=totals.some(c=>c.missing)?'Eski kayıtlarda hesaplama bilgisi eksik':'Kayıtlı masraflar + sezonluk kira';
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
    const productAndBrand = serviceTypes.has(record.operation_type) ? '' : [record.product, record.package_size ? "Ambalaj: " + record.package_size : ""].filter(Boolean).join(" · ");
    detail.textContent = (farm ? farm.name + " · " : "") + new Date(record.operation_date + "T12:00:00").toLocaleDateString("tr-TR") + (productAndBrand ? " · " + productAndBrand : "") + (quantity ? (record.cost_basis === "field_total" ? " · Tarlada kullanım: " : " · Dekara kullanım: ") + quantity : "");
    if(record.cost_source==='inventory_average')detail.textContent+=' · Maliyet alışverişten hesaplandı';
    const cost = document.createElement("div");
    cost.className = "production-record-cost";
    const costValue = document.createElement("b");
    const perDecare = calculateCostPerDecare(record);
    costValue.textContent = perDecare !== null ? formatMoney(perDecare) + " TL/da" : "Maliyet bilgisi eksik";
    const costUnit = document.createElement("small");
    costUnit.textContent = perDecare !== null && farm ? formatMoney(perDecare * Number(recordArea(record))) + " TL tarla toplamı" : "Tarla alanı veya maliyet bilgisi eksik";
    cost.append(costValue, costUnit);
    const actions = document.createElement("div");
    actions.className = "production-record-actions";
    const edit = document.createElement("button");
    edit.type = "button"; edit.textContent = "Bu Kaydı Düzenle"; edit.hidden = !editingRecords;
    edit.addEventListener("click", () => editRecord(record));
    const remove = document.createElement("button");
    remove.type = "button"; remove.textContent = "Sil";
    remove.addEventListener("click", async () => {
      if (!window.confirm("Bu üretim kaydını silmek istiyor musun?")) return;
      const { error } = await client.from("farmer_operations").delete().eq("id", record.id).eq("user_id", session.user.id);
      if (error) { message("Kayıt silinemedi. Kurulum durumunu kontrol et.", true); return; }
      message("Üretim kaydı silindi.");
      await loadRecords();
      await loadStock();
    });
    actions.append(edit, remove);
    card.append(icon, content, cost, actions);
    content.append(title, detail);
    list.append(card);
  });
}
async function loadFarms() {
  const { data, error } = await client.from("farmer_farms").select("*,farmer_seasons(*)").eq("user_id", session.user.id).order("created_at", { ascending: true });
  if (error) { message("Tarla listesi yüklenemedi. Supabase kurulumunu kontrol et.", true); return; }
  farms = data || [];
  renderFarmOptions();
  const requestedFarm = new URLSearchParams(location.search).get("farm");
  if (requestedFarm && farms.some((farm) => farm.id === requestedFarm)) {
    $("#operation-farm").value = requestedFarm;
    $("#records-filter").value = requestedFarm;
    renderSeasons(Number(new URLSearchParams(location.search).get('year')));
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
  await loadStock();
  $("#records-edit-toggle").disabled = !records.length;
  updateSummary();
  if (requestedEdit && !requestedEditOpened) {
    requestedEditOpened = true;
    const record = records.find(row => row.id === requestedEdit);
    if (record) editRecord(record);
    else message("Düzenlenecek kayıt bulunamadı veya hesabına ait değil.", true);
  }
}
function editRecord(record) {
  $("#operation-id").value = record.id;
  $("#operation-farm").value = record.farm_id;
  $("#records-filter").value = record.farm_id;
  renderSeasons(record.season_year);
  $('#expense-category').value=serviceTypes.has(record.operation_type)?'service':'input';selectCategory(record.operation_type);
  $("#operation-date").value = record.operation_date;
  const farm = activeFarm();
  const legacy = record.cost_basis !== "field_total";
  const per = calculateCostPerDecare(record);
  setNumberInputValue($("#operation-quantity"),legacy && record.quantity && farm ? Number((Number(record.quantity) * Number(seasonFor(farm,Number($("#operation-season").value))?.area_decare||farm.area_decare)).toFixed(3)) : record.quantity ?? "");
  const stockSelect=$('#operation-inventory-item');
  [...stockSelect.options].filter(o=>o.value===legacyProductValue).forEach(o=>o.remove());
  addLegacyProductOption(stockSelect,record);
  if(record.inventory_item_id&&![...stockSelect.options].some(o=>o.value===record.inventory_item_id))stockSelect.add(new Option('Kayıtlı stok bağlantısı',record.inventory_item_id));
  stockSelect.value=record.inventory_item_id||(serviceTypes.has(record.operation_type)?'':legacyProductValue);updateStockSelection();
  $("#operation-unit").value = String(record.quantity_unit || "").replace(/\/da$/, "");
  setNumberInputValue($("#operation-total-cost"),per !== null && farm ? Number((per * Number(seasonFor(farm,Number($("#operation-season").value))?.area_decare||farm.area_decare)).toFixed(2)) : "");
  $("#operation-note").value = record.notes || "";
  $("#production-title").textContent = "Uygulama Girişi";
  $("#operation-submit").innerHTML = "Değişiklikleri kaydet <span>→</span>";
  $("#operation-cancel").hidden = false;
  message(legacy ? "Bu eski kaydı güncellerken kullanılan miktarı ve maliyeti tarlanın tamamı için kontrol et." : "Mevcut kaydı düzenliyorsun. Kaydettiğinde bu kayıt güncellenecek.");
  updateCostPreview();
  updateSummary();
  form.scrollIntoView({ behavior: "smooth", block: "start" });
}
function clearForm() {
  form.reset();
  $("#operation-id").value = "";
  [...$('#operation-inventory-item').options].filter(o=>o.value===legacyProductValue).forEach(o=>o.remove());
  $("#operation-date").value = localToday();
  $("#production-title").textContent = "Uygulama Girişi";
  $("#operation-submit").innerHTML = "Uygulamayı Kaydet <span>→</span>";
  $("#operation-cancel").hidden = true;
  renderFarmOptions();
  selectCategory();
  updateSummary();
  message("");
}
function updateCostPreview() {
  const preview = $("#operation-cost-preview");
  const farm = activeFarm();
  const item=inventoryItems.find(i=>i.id===$('#operation-inventory-item').value),service=$('#expense-category').value==='service';
  const legacy=$('#operation-inventory-item').value===legacyProductValue;
  const automatic=Boolean(item&&!service&&autoCostReady),field=$('#operation-total-cost'),note=$('#operation-pricing-note');
  field.readOnly=!service&&!legacy;field.placeholder=field.readOnly?'Otomatik hesaplanır':'Örn. 1000';note.classList.remove('is-error');
  $('#operation-cost-label').textContent=service?'Bu Tarla İçin Makine / İşçilik Maliyeti (TL) *':'Bu Uygulamada Kullanılan Ürünün Maliyeti (TL)';
  if(automatic){
   if(!$('#operation-date').value||!$('#operation-quantity').value.trim()){
    field.value='';note.textContent='İşlem tarihi ve kullanılan toplam miktar girildiğinde maliyet otomatik hesaplanır.';preview.textContent='Uygulama maliyeti = kullanılan toplam miktar × birim alış fiyatı.';return;
   }
   const result=currentAutomaticCost();
   if(result.error){field.value='';note.textContent=result.error;note.classList.add('is-error');preview.textContent='Ürünü, işlem tarihini ve kullanılan toplam miktarı kontrol et.';return;}
   setNumberInputValue(field,result.total);
   note.textContent=fmt(result.quantity)+' '+item.base_unit+' × '+fmt(result.unitCost)+' TL/'+item.base_unit+' = '+formatMoney(result.total)+' TL · '+(result.stored?'Bu işlemde kayıtlı birim alış fiyatı.':'İşlem tarihine kadar olan alışverişlerin ağırlıklı ortalaması.');
  }else{
   if(!service&&!legacy)field.value='';
   note.textContent=service?'Bu tarlaya ait makine veya işçilik uygulamasının toplam tutarını gir.':item?'Otomatik hesap servisi yüklenemedi. Sayfayı yenileyerek tekrar dene.':legacy?'Önceki kaydın maliyetini elle düzenleyebilir veya alışveriş ürünü seçerek otomatik hesaplatabilirsin.':'Ürün, işlem tarihi ve kullanılan miktar girildiğinde maliyet otomatik hesaplanır.';
   if(item&&!autoCostReady)note.classList.add('is-error');
  }
  const raw = $("#operation-total-cost").value.trim();
  const total = parseNumberInput(raw);
  if (!farm || !raw || !Number.isFinite(total) || total < 0 || Number(seasonFor(farm,Number($("#operation-season").value))?.area_decare||farm.area_decare) <= 0) {
    preview.textContent = service||legacy?"Dekara maliyeti görmek için tarla seç ve uygulama tutarını gir.":"Uygulama maliyeti = kullanılan toplam miktar × birim alış fiyatı. Dekara maliyet için tarla seç.";
    return;
  }
  preview.textContent = "Dekara maliyet: " + formatMoney(total / Number(seasonFor(farm,Number($("#operation-season").value))?.area_decare||farm.area_decare)) + " TL/da · " + farm.name + " (" + formatMoney(farm.area_decare) + " da) için toplam " + formatMoney(total) + " TL";
}$("#operation-farm").addEventListener("change", () => { renderSeasons(); $("#records-filter").value=$("#operation-farm").value; updateCostPreview(); updateSummary(); });
function currentAutomaticCost(){return automaticOperationCost({itemId:$('#operation-inventory-item').value,quantity:parseNumberInput($('#operation-quantity').value),unit:$('#operation-unit').value,date:$('#operation-date').value,purchases:inventoryPurchases,oldRecord:records.find(r=>r.id===$('#operation-id').value)});}
$('#operation-date').addEventListener('change',updateCostPreview);
$('#operation-date').addEventListener('input',updateCostPreview);
$("#operation-season").addEventListener("change",()=>{updateCostPreview();updateSummary();});
$("#operation-farm").addEventListener("change", () => { if ($("#operation-farm").value === "__add_farm__") location.href = "tarla-bilgileri.html"; });
$("#records-filter").addEventListener("change", ()=>{if($("#records-filter").value){$("#operation-farm").value=$("#records-filter").value;renderSeasons();}updateSummary();updateCostPreview();});
$("#records-edit-toggle").addEventListener("click", () => {
  editingRecords = !editingRecords;
  $("#records-edit-toggle").setAttribute("aria-pressed", String(editingRecords));
  $("#records-edit-toggle").textContent = editingRecords ? "Düzenlemeyi Kapat" : "Kayıtları Düzenle";
  updateSummary();
});
$("#operation-cancel").addEventListener("click", clearForm);
form.addEventListener("submit", async (event) => {
  event.preventDefault();
  updateCostPreview();
  if (!session) { message("Kaydetmek için önce hesabına giriş yap. Form bilgileri bu sayfada saklanmadı.", true); return; }
  const service=$("#expense-category").value === "service";
  const product=selectedProduct(),previousRecord=editingRecord();
  const keepLegacyProduct=Boolean(previousRecord&&!previousRecord.inventory_item_id&&!serviceTypes.has(previousRecord.operation_type)&&$('#operation-inventory-item').value===legacyProductValue);
  if (!service && !product && !keepLegacyProduct) { message("Alışveriş yapılan ürünler listesinden kullanılan ürünü seç.", true); return; }
  if (!service && !inventoryReady) { message("Alışveriş ürünleri yüklenemedi. Kaydetmeden önce sayfayı yenile.", true); return; }
  if (!service && product && !autoCostReady) { message("Otomatik hesap servisi yüklenemedi. Sayfayı yenileyerek tekrar dene.", true); return; }
  const farm = activeFarm();
  if (!farm) { message("İşlem kaydı için önce bir tarla seç veya ekle.", true); return; }
  const quantity = service ? 1 : parseNumberInput($("#operation-quantity").value);
  if (!Number.isFinite(quantity) || quantity <= 0) { message("Bu Uygulamada Kullanılan Toplam Miktar sıfırdan büyük olmalıdır.", true); return; }
  if (!service && !$("#operation-unit").value) { message("Bu Uygulamada Kullanılan Toplam Miktar için birim seç.", true); return; }
  const rawCost = $("#operation-total-cost").value.trim();
  const autoSelected=Boolean(!service&&autoCostReady&&product);
  if(autoSelected&&currentAutomaticCost().error){message(currentAutomaticCost().error,true);return;}
  const totalCost = parseNumberInput(rawCost);
  if (!rawCost || !Number.isFinite(totalCost) || totalCost < 0) { message("Bu Uygulamada Kullanılan Ürünün Maliyeti tutarını sıfır veya daha büyük gir.", true); return; }
  const record = {
    user_id: session.user.id,
    farm_id: farm.id,
    season_year: Number($("#operation-season").value),
    operation_type: $("#operation-type").value,
    operation_date: $("#operation-date").value,
    product: service ? labels[$("#operation-type").value] : product ? [product.name,product.brand].filter(Boolean).join(' · ').slice(0,120) : previousRecord.product,
    cost_basis: "field_total",
    total_cost: totalCost,
    package_size: null,
    quantity: service ? null : quantity,
    quantity_unit: service ? null : $("#operation-unit").value || null,
    package_price: null,
    notes: $("#operation-note").value.trim() || null,
    updated_at: new Date().toISOString()
  };
  const editingId = $("#operation-id").value;
  const oldRecord=records.find(r=>r.id===editingId),stockId=service||keepLegacyProduct?null:$('#operation-inventory-item').value||null;
  if(!autoCostReady&&oldRecord?.cost_source==='inventory_average'){message('Bu kaydın otomatik maliyet servisi yüklenemedi. Kaydetmeden önce sayfayı yenile.',true);return;}
  if(!inventoryReady&&oldRecord?.inventory_item_id){message('Stok bağlantısı yüklenemedi. Stok güncellenmeden bu kayıt değiştirilemez; sayfayı yenile.',true);return;}
  if(stockId){
    const item=inventoryItems.find(i=>i.id===stockId),used=converted(quantity,$('#operation-unit').value),available=Number(item?.stock_quantity||0)+(oldRecord?.inventory_item_id===stockId?Number(oldRecord.inventory_quantity||0):0);
    if(!item||!Number.isFinite(used)||used<=0||used>available+0.0000001){message('Yetersiz stok. Kullanılabilir miktarı veya alışveriş kaydını kontrol et.',true);return;}
  }
  if(inventoryReady)record.inventory_item_id=stockId;
  if(autoCostReady)record.cost_source=autoSelected?'inventory_average':'manual';
  $("#operation-submit").disabled = true;
  message("Üretim kaydı kaydediliyor…");
  const { error } = editingId
    ? await client.from("farmer_operations").update(record).eq("id", editingId).eq("user_id", session.user.id).select("id").single()
    : await client.from("farmer_operations").insert(record);
  if (error) { $("#operation-submit").disabled = false; message(stockError(error), true); return; }
  message("Uygulama kaydedildi. Ana sayfadaki maliyet özetine yönlendiriliyorsun…");
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
  if (session) {await loadStock();await loadFarms();}
  client.auth.onAuthStateChange((event, newSession) => {
    if (!["SIGNED_IN","SIGNED_OUT"].includes(event)) return;
    session = newSession;
    banner.hidden = Boolean(session);
    if (session) setTimeout(async()=>{await loadStock();await loadFarms();},0);
    else {
      farms = []; records = [];inventoryItems=[];inventoryPurchases=[];inventoryReady=false;autoCostReady=false;$('#operation-inventory-item').replaceChildren(new Option('Giriş yaptığında alışverişlerin yüklenecek',''));$('#operation-inventory-item').disabled=true;updateStockSelection();renderFarmOptions(); updateSummary();
      message("Giriş yaparak kendi kayıtlarını görüntüleyebilirsin.");
    }
  });
}
window.addEventListener('focus',()=>{if(session)loadStock();});
