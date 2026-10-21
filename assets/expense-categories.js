export const expenseCategories={seed:'Tohum',fertilizer:'Gübre',chemical:'İlaç',fuel:'Mazot',maintenance:'Araç Bakımı/Tamir',electricity:'Elektrik',water:'Sulama',transport:'Nakliye',analysis:'Toprak Analizi',machinery:'Makine / Ekipman',labor:'İşçilik',other_service:'Diğer Gider',other:'Diğer Ürün'};
export const serviceCategories=new Set(['maintenance','electricity','water','transport','analysis','machinery','labor','other_service']);
export const categoryLabel=category=>expenseCategories[category]||'Diğer Ürün';
export const categoryKind=category=>serviceCategories.has(category)?'service':'stock';
export const normalizeSupplier=value=>String(value||'').trim().toLocaleLowerCase('tr-TR');
