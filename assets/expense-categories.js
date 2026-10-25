import {t,locale,areaDisplay,areaStored,perAreaDisplay,perAreaStored} from './regional-format.js?v=international-v1';
const I=window.AgroIntl;
const __avt=s=>I.t(s);
export const expenseCategories={seed:__avt("Tohum"),fertilizer:__avt("Gübre"),chemical:__avt("İlaç"),fuel:__avt("Mazot"),maintenance:__avt("Araç Bakımı/Tamir"),electricity:__avt("Elektrik"),water:__avt("Sulama"),transport:__avt("Nakliye"),analysis:__avt("Toprak Analizi"),machinery:__avt("Makine / Ekipman"),labor:__avt("İşçilik"),other_service:__avt("Diğer Gider"),other:__avt("Diğer Ürün")};
export const serviceCategories=new Set(['maintenance','electricity','water','transport','analysis','machinery','labor','other_service']);
export const categoryLabel=category=>expenseCategories[category]||__avt("Diğer Ürün");
export const categoryKind=category=>serviceCategories.has(category)?'service':'stock';
export const normalizeSupplier=value=>String(value||'').trim().toLocaleLowerCase('tr-TR');
