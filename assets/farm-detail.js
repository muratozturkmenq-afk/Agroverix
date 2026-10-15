import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.117.1/+esm";
const cfg=window.AGROVERIX_SUPABASE||{}, q=new URLSearchParams(location.search), farmId=q.get("farm");
const $=(id)=>document.getElementById(id), money=(v)=>Number(v||0).toLocaleString("tr-TR",{maximumFractionDigits:2});
function unitInfo(unit){const key=String(unit||"").toLocaleLowerCase("tr-TR").replace(/\s/g,"");const map={kg:{d:"mass",f:1},g:{d:"mass",f:.001},ton:{d:"mass",f:1000},l:{d:"volume",f:1},lt:{d:"volume",f:1},litre:{d:"volume",f:1},ml:{d:"volume",f:.001},"m³":{d:"volume",f:1000},m3:{d:"volume",f:1000},m:{d:"length",f:1},adet:{d:"count",f:1},saat:{d:"time",f:1}};return map[key]||null;}
function costPerDecare(record){const quantity=Number(record.quantity),price=record.package_price===null||record.package_price===undefined||record.package_price===""?NaN:Number(record.package_price),pack=String(record.package_size||"").trim().match(/^(\d+(?:[.,]\d+)?)\s*([\p{L}³0-9]+)$/u),usedUnit=String(record.quantity_unit||"").replace(/\s*\/\s*da$/i,"").trim();if(!Number.isFinite(quantity)||quantity<=0||!Number.isFinite(price)||price<0||!pack)return null;const amount=Number(pack[1].replace(",", ".")),used=unitInfo(usedUnit),packaged=unitInfo(pack[2]);if(!Number.isFinite(amount)||amount<=0||!used||!packaged||used.d!==packaged.d)return null;return quantity*used.f/(amount*packaged.f)*price;}
function fail(message){$("farm-title").textContent="Tarla açılamadı";$("farm-status").textContent=message;}
function render(farm,records){
  $("farm-title").textContent=farm.name;$("farm-crop").textContent=farm.crop||"—";$("farm-area").textContent=money(farm.area_decare);
  $("farm-location").textContent=[farm.village,farm.district,farm.province].filter(Boolean).join(" · ")||"Konum bilgisi eklenmemiş";
  const costs=records.map(costPerDecare).filter(v=>v!==null),per=costs.reduce((sum,v)=>sum+v,0),total=per*Number(farm.area_decare||0);
  $("farm-per-decare").textContent=costs.length?money(per):"—";$("farm-total").textContent=costs.length?money(total):"—";
  $("farm-cost-note").textContent=records.length?`${costs.length}/${records.length} kayıt hesaplanabildi. Hesaplama: (dekara kullanılan miktar ÷ ambalaj miktarı) × paket fiyatı.`:"Henüz üretim kaydı yok.";
  $("farm-empty").hidden=records.length>0;
  $("add-operation").href="uretim-kayitlari.html?farm="+encodeURIComponent(farm.id);
  const list=$("farm-records");list.replaceChildren();
  const labels={tillage:"Toprak hazırlığı / sürüm",seed:"Tohum",planting:"Ekim / dikim",fertilizing:"Gübreleme",irrigation:"Sulama",spraying:"İlaçlama",weeding:"Yabancı ot mücadelesi",harvest:"Hasat",other:"Diğer işlem"};
  records.forEach((row)=>{const card=document.createElement("article");card.className="farm-detail-record";const content=document.createElement("div"),title=document.createElement("b"),detail=document.createElement("small"),cost=document.createElement("div"),val=document.createElement("b"),hint=document.createElement("small");title.textContent=labels[row.operation_type]||"Üretim işlemi";const quantity=row.quantity?money(row.quantity)+" "+(row.quantity_unit||""):"";detail.textContent=[new Date(row.operation_date+"T12:00:00").toLocaleDateString("tr-TR"),row.product,row.package_size?"Ambalaj "+row.package_size:"",quantity?"Dekara "+quantity:""].filter(Boolean).join(" · ");const perRecord=costPerDecare(row);val.textContent=perRecord===null?"Hesaplanamadı":money(perRecord)+" TL/da";hint.textContent=perRecord===null?"Ambalaj / fiyat bilgisi eksik":money(perRecord*Number(farm.area_decare||0))+" TL tarla toplamı";content.append(title,detail);cost.className="farm-detail-record-cost";cost.append(val,hint);card.append(content,cost);list.append(card);});
}
if(!farmId){fail("Tarla bağlantısı geçersiz. Ürün özetine dönüp bir tarla seç.");}
else if(!cfg.url||!cfg.publishableKey){fail("Kayıt servisi yüklenemedi.");}
else{
 const client=createClient(cfg.url,cfg.publishableKey,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
 const {data}=await client.auth.getSession();
 if(!data.session){$("farm-title").textContent="Tarla ayrıntılarını görmek için giriş yap";$("farm-status").innerHTML='Bu sayfa yalnızca tarla sahibine açıktır. <a href="ciftci-bilgi.html?next='+encodeURIComponent(location.pathname+location.search)+'">Giriş yap</a>.';}
 else{
  const [farmResult,recordsResult]=await Promise.all([
   client.from("farmer_farms").select("id,user_id,name,province,district,village,crop,area_decare").eq("id",farmId).eq("user_id",data.session.user.id).maybeSingle(),
   client.from("farmer_operations").select("farm_id,operation_type,operation_date,product,package_size,quantity,quantity_unit,package_price,created_at").eq("farm_id",farmId).eq("user_id",data.session.user.id).order("operation_date",{ascending:false}).order("created_at",{ascending:false})
  ]);
  if(farmResult.error||recordsResult.error||!farmResult.data)fail("Bu tarla bulunamadı veya hesabına ait değil.");
  else render(farmResult.data,recordsResult.data||[]);
 }
}