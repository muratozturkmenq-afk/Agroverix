import { parseNumberInput as decimal, bindNumberInput, setNumberInputValue } from './number-input.js?v=groups-v2';
import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.117.1/+esm";
import { farmFinance, seasonFor, appendMetric, appendSupportMetrics, fmt } from "./farm-finance.js?v=support-v1";
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
let editingFarm = null, operationRows = [];
['farm-entry-area','farm-rent','farm-actual-yield','farm-actual-price','farm-expected-support','farm-actual-support'].forEach(id=>bindNumberInput($('#'+id),{maximumFractionDigits:['farm-rent','farm-actual-price','farm-expected-support','farm-actual-support'].includes(id)?2:20}));
$("#farm-season-year").value = new Date().getFullYear();
function tenureChanged(){ const rented=$("#farm-tenure").value==='rented'; $("#farm-rent-field").hidden=!rented; $("#farm-rent").required=rented; $("#farm-rent").disabled=!rented; updateSeasonPreview(); }
function updateSeasonPreview(){
 const el=$("#farm-season-preview"); el.replaceChildren();
 const year=Number($("#farm-season-year").value), area=decimal($("#farm-entry-area").value);
 ['expected','actual'].forEach(kind=>{const value=decimal($('#farm-'+kind+'-support').value);$('#farm-'+kind+'-support-note').textContent=value!==null&&Number.isFinite(value)&&value>=0&&area>0?'Dekara destekleme: '+fmt(value/area)+' TL/da':'Bu tarlanın sezonluk toplam tutarını gir. Destek yoksa 0 yaz; belli değilse boş bırak.';});
 if(!editingFarm || !area || area<=0){$("#farm-season-note").textContent='Tarla kaydı ve masraflar eklendikçe hesaplama burada görünür.';return;}
 const c=farmFinance(editingFarm,operationRows,year,{area_decare:area,tenure:$("#farm-tenure").value,rent_total:decimal($("#farm-rent").value)||0,actual_yield:decimal($("#farm-actual-yield").value),actual_price:decimal($("#farm-actual-price").value),expected_support:decimal($("#farm-expected-support").value),actual_support:decimal($("#farm-actual-support").value)});
 appendMetric(el,'Toplam Maliyet',c.total,'TL');appendMetric(el,'Dekara Maliyet',c.perDecare,'TL/da');appendMetric(el,'Gerçek Kg Başına Maliyet',c.actual.costKg,'TL/kg');appendMetric(el,'Toplam Satış Geliri',c.actual.revenue,'TL');appendMetric(el,'Destek Hariç Toplam Kâr / Zarar',c.actual.profit,'TL');appendMetric(el,'Destek Hariç Kâr / Zarar Oranı',c.actual.percent,'%');
 appendSupportMetrics(el,c.actual);
 $("#farm-season-note").textContent=c.missing?'Hesaplanamayan eski masraf var. Tarla detayından kaydı düzenle.':'Destek dahil kâr/zarar = satış geliri + gerçekleşen destekleme − (masraflar + kira). Destek girilmediyse destekli sonuç boş kalır. Yüzde = kâr/zarar ÷ toplam maliyet × 100. Sıfır maliyette yüzde hesaplanmaz.';
}
function seasonFields(year){
 const s=editingFarm ? seasonFor(editingFarm,year) : null;
 $("#farm-tenure").value=s?.tenure||'';setNumberInputValue($('#farm-rent'),s?.rent_total);setNumberInputValue($('#farm-actual-yield'),s?.actual_yield);setNumberInputValue($('#farm-actual-price'),s?.actual_price);setNumberInputValue($('#farm-expected-support'),s?.expected_support);setNumberInputValue($('#farm-actual-support'),s?.actual_support);
 if(s){$("#farm-entry-crop").value=s.crop;setNumberInputValue($("#farm-entry-area"),s.area_decare);}
 tenureChanged();
}
$("#farm-tenure").addEventListener('change',tenureChanged);
$("#farm-season-year").addEventListener('change',()=>seasonFields(Number($("#farm-season-year").value)));
['farm-rent','farm-actual-yield','farm-actual-price','farm-entry-area','farm-expected-support','farm-actual-support'].forEach(id=>$('#'+id).addEventListener('input',updateSeasonPreview));

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
    const detailsLink=document.createElement('a');detailsLink.className='auth-back';detailsLink.textContent='Tarla Detayı';detailsLink.href='tarla-detay.html?farm='+encodeURIComponent(farm.id);
    actions.append(detailsLink,remove);
    card.append(details, actions);
    list.append(card);
  });
}
async function loadFarms() {
  await adminReady;
  const { data, error } = await client.from("farmer_farms").select("*,farmer_seasons(*)").eq("user_id", session.user.id).order("created_at", { ascending: false });
  if (error) { message("Tarla kayıtları yüklenemedi. Kurulum durumunu kontrol et.", true); return; }
  renderFarms(data || []);
  const requestedEdit = new URLSearchParams(location.search).get("edit");
  if (requestedEdit && !requestedEditOpened) {
    requestedEditOpened = true;
    const farm = (data || []).find(row => row.id === requestedEdit);
    if (farm) {
      const result=await client.from('farmer_operations').select('*').eq('farm_id',farm.id).eq('user_id',session.user.id);
      if(result.error){message('Masraflar yüklenemedi. Sayfayı yenile.',true);return;}
      operationRows=result.data||[];editFarm(farm);
    }
    else message("Düzenlenecek tarla bulunamadı veya hesabına ait değil.", true);
  }
}
function editFarm(farm) {
  editingFarm=farm;
  $("#farm-entry-id").value = farm.id;
  $("#farm-entry-name").value = farm.name || "";
  $("#farm-entry-crop").value = farm.crop || "";
  setNumberInputValue($("#farm-entry-area"),farm.area_decare);
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
  const year=Number(new URLSearchParams(location.search).get('year'))||farm.season_year;
  $("#farm-season-year").value=year;seasonFields(year);
  const section=['#season-start','#season-end'].includes(location.hash)?$(location.hash):form;
  section.scrollIntoView({ behavior: "smooth", block: "start" });
}
$("#farm-entry-cancel").addEventListener("click", () => {
  form.reset();
  editingFarm=null;$("#farm-season-year").value=new Date().getFullYear();tenureChanged();
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
  const area = decimal($("#farm-entry-area").value);
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
  const year=Number($("#farm-season-year").value),rent=decimal($("#farm-rent").value), actualYield=decimal($("#farm-actual-yield").value),actualPrice=decimal($("#farm-actual-price").value),expectedSupport=decimal($("#farm-expected-support").value),actualSupport=decimal($("#farm-actual-support").value);
  if(!Number.isInteger(year)||year<2000||year>2200){message('Geçerli sezon yılı gir.',true);return;}
  if(!['owned','rented'].includes($("#farm-tenure").value)){message('Mülk veya kiralık seç.',true);return;}
  if($("#farm-tenure").value==='rented'&&(rent===null||!Number.isFinite(rent)||rent<0)){message('Sezonluk toplam kira tutarını gir.',true);return;}
  if((actualYield===null)!==(actualPrice===null)||[actualYield,actualPrice].some(v=>v!==null&&(!Number.isFinite(v)||v<0))){message('Sezon sonunda gerçek verim ve satış fiyatını birlikte, sıfır veya daha büyük gir.',true);return;}
  if([expectedSupport,actualSupport].some(v=>v!==null&&(!Number.isFinite(v)||v<0))){message('Destekleme tutarlarını sıfır veya daha büyük gir; tutar belli değilse boş bırak.',true);return;}
  const prior=editingFarm?seasonFor(editingFarm,year):null;
  const season={season_year:year,crop:record.crop,area_decare:area,tenure:$("#farm-tenure").value,rent_total:$("#farm-tenure").value==='rented'?rent:0,expected_yield:prior?.expected_yield??null,expected_price:prior?.expected_price??null,actual_yield:actualYield,actual_price:actualPrice,expected_support:expectedSupport,actual_support:actualSupport};
  $("#farm-entry-submit").disabled = true;
  message("Tarla kaydı kaydediliyor…");
  const { error, data:savedId } = await client.rpc('save_farmer_farm_season',{p_farm:{...record,id:editingId||null},p_season:season});
  $("#farm-entry-submit").disabled = false;
  if (error) { message("Tarla kaydedilemedi. Kurulum durumunu kontrol edip tekrar dene.", true); return; }
  if (savedId) { window.location.assign("tarla-detay.html?farm=" + encodeURIComponent(savedId)+"&year="+year); return; }
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
