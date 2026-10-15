import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.117.1/+esm";
import { costPerDecare } from "./operation-cost.js";
import { locationLabels } from "./location-labels.js";
let admin = null;
const cfg=window.AGROVERIX_SUPABASE||{}, q=new URLSearchParams(location.search), farmId=q.get("farm");
const $=(id)=>document.getElementById(id), money=(v)=>Number(v||0).toLocaleString("tr-TR",{maximumFractionDigits:2});
function fail(message){$("farm-title").textContent="Tarla açılamadı";$("farm-status").textContent=message;}
function render(farm,records){
  $("farm-title").textContent=farm.name;$("farm-crop").textContent=farm.crop||"—";$("farm-area").textContent=money(farm.area_decare);
  $("farm-location").textContent=locationLabels(farm,admin)||"Konum bilgisi eklenmemiş";
  const costs=records.map(row => costPerDecare(row, farm.area_decare)).filter(v=>v!==null),per=costs.reduce((sum,v)=>sum+v,0),total=per*Number(farm.area_decare||0);
  $("farm-per-decare").textContent=costs.length?money(per):"—";$("farm-total").textContent=costs.length?money(total):"—";
  $("farm-cost-note").textContent=records.length?`${costs.length}/${records.length} kayıt hesaplanabildi. Yeni kayıtlarda dekara maliyet, tarla toplam maliyetinin tarla alanına bölünmesiyle hesaplanır.`:"Henüz üretim kaydı yok.";
  $("farm-empty").hidden=records.length>0;
  $("add-operation").href="uretim-kayitlari.html?farm="+encodeURIComponent(farm.id);
  const list=$("farm-records");list.replaceChildren();
  const labels={tillage:"Toprak hazırlığı / sürüm",seed:"Tohum",planting:"Ekim / dikim",fertilizing:"Gübreleme",irrigation:"Sulama",spraying:"İlaçlama",weeding:"Yabancı ot mücadelesi",harvest:"Hasat",other:"Diğer işlem"};
  records.forEach((row)=>{const card=document.createElement("article");card.className="farm-detail-record";const content=document.createElement("div"),title=document.createElement("b"),detail=document.createElement("small"),cost=document.createElement("div"),val=document.createElement("b"),hint=document.createElement("small");title.textContent=labels[row.operation_type]||"Üretim işlemi";const quantity=row.quantity?money(row.quantity)+" "+(row.quantity_unit||""):"";detail.textContent=[new Date(row.operation_date+"T12:00:00").toLocaleDateString("tr-TR"),row.product,row.package_size?"Ambalaj "+row.package_size:"",quantity?(row.cost_basis === "field_total" ? "Tarlada kullanım: " : "Dekara ")+quantity:""].filter(Boolean).join(" · ");const perRecord=costPerDecare(row, farm.area_decare);val.textContent=perRecord===null?"Hesaplanamadı":money(perRecord)+" TL/da";hint.textContent=perRecord===null?"Ambalaj / fiyat bilgisi eksik":money(perRecord*Number(farm.area_decare||0))+" TL tarla toplamı";content.append(title,detail);cost.className="farm-detail-record-cost";cost.append(val,hint);card.append(content,cost);list.append(card);});
}
if(!farmId){fail("Tarla bağlantısı geçersiz. Ürün özetine dönüp bir tarla seç.");}
else if(!cfg.url||!cfg.publishableKey){fail("Kayıt servisi yüklenemedi.");}
else{
 const client=createClient(cfg.url,cfg.publishableKey,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
 const {data}=await client.auth.getSession();
 if(!data.session){$("farm-title").textContent="Tarla ayrıntılarını görmek için giriş yap";$("farm-status").innerHTML='Bu sayfa yalnızca tarla sahibine açıktır. <a href="ciftci-bilgi.html?next='+encodeURIComponent(location.pathname+location.search)+'">Giriş yap</a>.';}
 else{
  const [farmResult,recordsResult,locations]=await Promise.all([
   client.from("farmer_farms").select("id,user_id,name,province,district,village,crop,area_decare").eq("id",farmId).eq("user_id",data.session.user.id).maybeSingle(),
   client.from("farmer_operations").select("farm_id,operation_type,operation_date,product,package_size,quantity,quantity_unit,package_price,total_cost,cost_basis,created_at").eq("farm_id",farmId).eq("user_id",data.session.user.id).order("operation_date",{ascending:false}).order("created_at",{ascending:false}),
   fetch("assets/administrative-units.json?v=2").then(response=>response.ok?response.json():null).catch(()=>null)
  ]);
  admin=locations;
  if(farmResult.error||recordsResult.error||!farmResult.data)fail("Bu tarla bulunamadı veya hesabına ait değil.");
  else render(farmResult.data,recordsResult.data||[]);
 }
}
