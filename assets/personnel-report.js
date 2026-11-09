export function personnelReportSheets(data,{year=''}={}){
 const owners=new Map((data.accounts||[]).map(a=>[a.user_id,a])),farms=new Map((data.farms||[]).map(f=>[f.id,f]));
 const prefix=row=>{const owner=owners.get(row.user_id)||{};return [owner.full_name||owner.email||row.user_id,...(data.administrator?[owner.member_code||'—']:[]),row.currency||owner.currency||'TRY'];};
 const heads=['Çiftçi',...(data.administrator?['Üye Kodu']:[]),'Para Birimi'];
 const expenses=(data.personnel_expenses||[]).filter(e=>(!year||Number(e.season_year)===Number(year))&&(!data.reportFarmId||(e.selected_farm_ids||[]).includes(data.reportFarmId)));
 const allowed=new Map(expenses.map(e=>[e.id,e]));
 const expenseSheet={name:'Personel Giderleri',headers:[...heads,'Personelin Adı Soyadı','Gider Tarihi','Sezon','Maaş (TL)','Sigorta (TL)','Diğer Personel Giderleri (TL)','Personel Kaydının Toplamı (TL)','Durum','Açıklama','Kayıt No'],rows:expenses.map(e=>[...prefix(e),e.person_name,e.expense_date,Number(e.season_year),Number(e.salary),Number(e.insurance),Number(e.other_cost),Number(e.total_cost),e.is_void?'İptal Edildi':'Etkin',e.notes||'',e.id])};
 const allocationSheet={name:'Personel Tarla Dağılımı',headers:[...heads,'Personelin Adı Soyadı','Gider Tarihi','Sezon','Tarla','Bitki','Kayıt Anındaki Alan (da)','Tarlaya Eklenen Personel Gideri (TL)','Personel Kayıt No'],rows:(data.personnel_allocations||[]).filter(a=>allowed.has(a.expense_id)&&(!data.reportFarmId||a.farm_id===data.reportFarmId)).map(a=>{const e=allowed.get(a.expense_id),f=farms.get(a.farm_id),s=(data.seasons||[]).find(s=>s.farm_id===a.farm_id&&Number(s.season_year)===Number(a.season_year));return [...prefix(a),e.person_name,e.expense_date,Number(a.season_year),f?.name||a.farm_id,s?.crop||'',Number(a.area_decare),Number(a.amount),a.expense_id];})};
 return [expenseSheet,allocationSheet];
}
