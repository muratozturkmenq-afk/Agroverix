import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.117.1/+esm";
import { costPerDecare } from "./operation-cost.js";
const cfg = window.AGROVERIX_SUPABASE || {};
const area = document.querySelector("#ciftci-ozet");
const message = document.querySelector("#home-dashboard-message");
const login = document.querySelector("#home-dashboard-login");
const grid = document.querySelector("#home-crop-grid");
const heroFarms = document.querySelector("#hero-farm-cards");
const money = (value) => Number(value || 0).toLocaleString("tr-TR", { maximumFractionDigits: 2 });
const text = (tag, className, value) => { const node = document.createElement(tag); if (className) node.className = className; node.textContent = value; return node; };
function farmCost(farm, records) {
  const rows = records.filter((row) => row.farm_id === farm.id);
  const values = rows.map(row => costPerDecare(row, farm.area_decare)).filter((value) => value !== null);
  return { rows, values, perDecare: values.length ? values.reduce((sum, value) => sum + value, 0) : null,
    total: values.length ? values.reduce((sum, value) => sum + value, 0) * Number(farm.area_decare || 0) : null };
}
function heroNotice(copy, href, action) {
  if (!heroFarms) return;
  const card = text('div', 'hero-farm-card', '');
  card.append(text('b', 'hero-farm-name', 'Tarla maliyet özetin'), text('p', 'hero-farm-note', copy));
  if (href) { const link = text('a', 'hero-farm-action', action); link.href = href; card.append(link); }
  heroFarms.replaceChildren(card);
}
function renderHeroFarms(farms, records) {
  if (!heroFarms) return;
  heroFarms.replaceChildren();
  if (!farms.length) { heroNotice('İlk tarlanı eklediğinde maliyet özetin burada görünecek.', 'tarla-bilgileri.html', 'Tarla ekle →'); return; }
  farms.forEach(farm => {
    const cost = farmCost(farm, records);
    const card = text('a', 'hero-farm-card', '');
    card.href = 'tarla-detay.html?farm=' + encodeURIComponent(farm.id);
    card.append(text('b', 'hero-farm-name', farm.name));
    const per = text('div', 'hero-farm-metric', '');
    per.append(text('span', '', 'Dekara Maliyet'), text('strong', '', cost.perDecare === null ? '— TL/da' : money(cost.perDecare) + ' TL/da'));
    const total = text('div', 'hero-farm-metric hero-farm-total', '');
    total.append(text('span', '', 'Toplam Maliyet'), text('strong', '', cost.total === null ? '— TL' : money(cost.total) + ' TL'));
    card.append(per);
    if (!cost.rows.length) card.append(text('small', 'hero-farm-note', 'Henüz işlem kaydı yok.'));
    else if (cost.values.length < cost.rows.length) card.append(text('small', 'hero-farm-note', (cost.rows.length - cost.values.length) + ' işlemde hesaplama bilgisi eksik.'));
    card.append(total);
    heroFarms.append(card);
  });
}
function cardCrop(crop, farms, records) {
  const known = farms.map((farm) => ({ farm, cost: farmCost(farm, records) }));
  const priced = known.filter((item) => item.cost.perDecare !== null);
  const knownArea = priced.reduce((sum, item) => sum + Number(item.farm.area_decare || 0), 0);
  const total = priced.reduce((sum, item) => sum + item.cost.total, 0);
  const average = knownArea ? total / knownArea : null;
  const button = text("button", "farmer-crop-card", "");
  button.type = "button"; button.setAttribute("aria-expanded", "false");
  const top = text("span", "farmer-crop-top", "");
  top.append(text("b", "farmer-crop-name", crop), text("span", "farmer-crop-arrow", "＋"));
  const metrics = text("span", "farmer-crop-metrics", "");
  const metricA = text("span", "farmer-crop-metric", "");
  metricA.append(text("small", "", "Hesaplanabilen maliyet"), text("b", "", average === null ? "—" : money(average) + " TL/da"));
  const metricB = text("span", "farmer-crop-metric", "");
  metricB.append(text("small", "", "Hesaplanabilen toplam"), text("b", "", total === null || !priced.length ? "—" : money(total) + " TL"));
  const metricC = text("span", "farmer-crop-metric", "");
  const areaTotal = farms.reduce((sum, farm) => sum + Number(farm.area_decare || 0), 0);
  metricC.append(text("small", "", "Toplam alan"), text("b", "", money(areaTotal) + " da"));
  metrics.append(metricA, metricB, metricC);
  const note = text("small", "farmer-crop-note", `${priced.length}/${farms.length} tarlada maliyet hesaplanabildi`);
  button.append(top, metrics, note);
  const list = document.createElement("div"); list.className = "farmer-crop-farms"; list.hidden = true;
  known.forEach(({ farm, cost }) => {
    const link = document.createElement("a"); link.className = "farmer-farm-card";
    link.href = "tarla-detay.html?farm=" + encodeURIComponent(farm.id);
    const info = text("span", "farmer-farm-info", "");
    info.append(text("b", "", farm.name), text("small", "", `${farm.crop || crop} · ${money(farm.area_decare)} da · ${cost.values.length}/${cost.rows.length} işlem hesaplandı`));
    const figures = text("span", "farmer-farm-cost", "");
    figures.append(text("b", "", cost.perDecare === null ? "—" : money(cost.perDecare) + " TL/da"), text("small", "", cost.total === null ? "Toplam maliyet —" : money(cost.total) + " TL toplam"));
    link.append(info, figures, text("span", "farmer-farm-arrow", "→"));
    list.append(link);
  });
  button.addEventListener("click", () => {
    const opening = list.hidden; list.hidden = !opening;
    button.setAttribute("aria-expanded", String(opening));
    button.querySelector(".farmer-crop-arrow").textContent = opening ? "−" : "＋";
  });
  const wrap = document.createElement("div"); wrap.className = "farmer-crop-wrap"; wrap.append(button, list);
  return wrap;
}
function showGuest() {
  heroNotice('Tarla başına dekara ve toplam maliyetini görmek için giriş yap.', 'ciftci-bilgi.html', 'Giriş yap →');
  area.hidden = false; login.hidden = false; grid.replaceChildren();
  message.textContent = "Bu özet yalnızca kendi hesabına giriş yaptığında görünür.";
}
async function showDashboard(client, user) {
  heroNotice('Tarlalarının maliyetleri yükleniyor…');
  area.hidden = false; login.hidden = true; grid.replaceChildren();
  message.textContent = "Tarlaların ve hesaplanabilen maliyetlerin yükleniyor…";
  const [farmResult, recordResult] = await Promise.all([
    client.from("farmer_farms").select("id,name,crop,area_decare").eq("user_id", user.id).order("created_at", {ascending:true}),
    client.from("farmer_operations").select("farm_id,operation_type,operation_date,product,package_size,quantity,quantity_unit,package_price,total_cost,cost_basis,created_at").eq("user_id", user.id).order("operation_date", {ascending:false}).order("created_at", {ascending:false})
  ]);
  if (farmResult.error || recordResult.error) { heroNotice('Tarla özeti yüklenemedi. Sayfayı yenileyerek tekrar dene.'); message.textContent = "Kişisel özet yüklenemedi. Üretim kayıtları sayfasından tekrar deneyebilirsin."; return; }
  const farms = farmResult.data || [], records = recordResult.data || [];
  renderHeroFarms(farms, records);
  if (!farms.length) {
    message.textContent = "Önce bir tarla ekle; ürün kartların ve maliyet özetlerin burada oluşacak.";
    const add = text("a", "farmer-dashboard-login", "Tarla ekle →"); add.href = "tarla-bilgileri.html"; grid.append(add); return;
  }
  const groups = new Map();
  farms.forEach((farm) => { const crop = String(farm.crop || "Ürün belirtilmedi").trim(); const key = crop.toLocaleLowerCase("tr-TR"); if (!groups.has(key)) groups.set(key, {name:crop,farms:[]}); groups.get(key).farms.push(farm); });
  [...groups.values()].sort((a,b)=>a.name.localeCompare(b.name,"tr")).forEach((group)=>grid.append(cardCrop(group.name,group.farms,records)));
  message.textContent = records.length ? "Ürün kartına dokunarak tarlalarını aç. Tarla adına dokununca tüm ayrıntıları gör." : "Tarlaların hazır. İlk üretim kaydını eklediğinde maliyetler burada hesaplanacak.";
}
if (!cfg.url || !cfg.publishableKey) showGuest();
else {
  const client = createClient(cfg.url,cfg.publishableKey,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
  const {data} = await client.auth.getSession();
  if (data.session) await showDashboard(client,data.session.user); else showGuest();
  client.auth.onAuthStateChange((_event,session)=>{if(session) showDashboard(client,session.user); else showGuest();});
}
