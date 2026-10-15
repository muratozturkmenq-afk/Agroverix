import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.117.1/+esm";
const cfg = window.AGROVERIX_SUPABASE || {};
const label = document.querySelector("#fc-label"), icon = document.querySelector("#fc-ico");
const operation = document.querySelector("#fc-op"), cost = document.querySelector("#fc-cost"), delta = document.querySelector("#fc-delta");
const money = (value) => Number(value || 0).toLocaleString("tr-TR", { maximumFractionDigits: 2 });
function unitInfo(unit) {
  const key = String(unit || "").toLocaleLowerCase("tr-TR").replace(/\s/g, "");
  const map = {kg:{dimension:"mass",factor:1},g:{dimension:"mass",factor:0.001},ton:{dimension:"mass",factor:1000},l:{dimension:"volume",factor:1},lt:{dimension:"volume",factor:1},litre:{dimension:"volume",factor:1},ml:{dimension:"volume",factor:0.001},"m³":{dimension:"volume",factor:1000},m3:{dimension:"volume",factor:1000},m:{dimension:"length",factor:1},adet:{dimension:"count",factor:1},saat:{dimension:"time",factor:1}};
  return map[key] || null;
}
function costPerDecare(record) {
  const quantity = Number(record.quantity);
  const price = record.package_price === null || record.package_price === undefined || record.package_price === "" ? NaN : Number(record.package_price);
  const pack = String(record.package_size || "").trim().match(/^(\d+(?:[.,]\d+)?)\s*([\p{L}³0-9]+)$/u);
  const usedUnit = String(record.quantity_unit || "").replace(/\s*\/\s*da$/i, "").trim();
  if (!Number.isFinite(quantity) || quantity <= 0 || !Number.isFinite(price) || price < 0 || !pack) return null;
  const amount = Number(pack[1].replace(",", "."));
  const used = unitInfo(usedUnit), packaged = unitInfo(pack[2]);
  if (!Number.isFinite(amount) || amount <= 0 || !used || !packaged || used.dimension !== packaged.dimension) return null;
  return quantity * used.factor / (amount * packaged.factor) * price;
}
function showGuest() {
  label.textContent = "Agroverix çiftçi alanı"; icon.textContent = "A";
  operation.firstChild.textContent = "Kendi verilerini görüntüle";
  operation.querySelector("small").textContent = "Giriş yaptığında tarla ve üretim kayıtların burada görünür.";
  cost.textContent = "—"; delta.textContent = "Kişisel maliyet özeti";
}
async function showPersonalDashboard(client, user) {
  const [farmResult, recordResult] = await Promise.all([
    client.from("farmer_farms").select("id,name,crop,area_decare").eq("user_id", user.id),
    client.from("farmer_operations").select("farm_id,operation_type,operation_date,product,package_size,quantity,quantity_unit,package_price,created_at").eq("user_id", user.id).order("operation_date", {ascending:false}).order("created_at", {ascending:false})
  ]);
  const farms = farmResult.data, records = recordResult.data;
  if (farmResult.error || recordResult.error) { showGuest(); return; }
  if (!records?.length) {
    label.textContent = "Kişisel tarla alanın";
    operation.firstChild.textContent = "İlk üretim kaydını ekle";
    operation.querySelector("small").textContent = farms?.length ? `${farms.length} tarlan hazır · ilk işlemini kaydet` : "Önce tarlanı ekle, ardından işlemlerini kaydet.";
    cost.textContent = "—"; delta.textContent = "Hesaplama kayıtlarla başlayacak"; return;
  }
  const latest = records[0], farm = farms?.find((item) => item.id === latest.farm_id);
  const farmRecords = records.filter((item) => item.farm_id === latest.farm_id);
  const values = farmRecords.map(costPerDecare).filter((value) => value !== null);
  const latestCost = costPerDecare(latest);
  const types = {tillage:"Toprak hazırlığı",planting:"Ekim",fertilizing:"Gübreleme",irrigation:"Sulama",spraying:"İlaçlama",weeding:"Ot mücadelesi",harvest:"Hasat",other:"Diğer işlem"};
  label.textContent = (farm?.name || "Tarlan") + " · kişisel kayıt";
  icon.textContent = ({tillage:"S",planting:"E",fertilizing:"G",irrigation:"S",spraying:"İ",weeding:"O",harvest:"H"})[latest.operation_type] || "•";
  operation.firstChild.textContent = (types[latest.operation_type] || "Üretim işlemi") + " kaydedildi";
  operation.querySelector("small").textContent = `${latest.product || "Ürün belirtilmedi"} · ${new Date(latest.operation_date + "T12:00:00").toLocaleDateString("tr-TR")} · ${values.length}/${farmRecords.length} kayıt hesaplandı`;
  cost.textContent = values.length ? money(values.reduce((sum, value) => sum + value, 0)) : "—";
  delta.textContent = latestCost === null ? "Son işlem için ambalaj ve fiyat bilgisi gerekli" : `+${money(latestCost)} TL/da bu işlemle`;
}
if (!cfg.url || !cfg.publishableKey) showGuest();
else {
  const client = createClient(cfg.url,cfg.publishableKey,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
  const {data} = await client.auth.getSession();
  if (data.session) await showPersonalDashboard(client,data.session.user); else showGuest();
  client.auth.onAuthStateChange((_event,session) => { if (session) showPersonalDashboard(client,session.user); else showGuest(); });
}