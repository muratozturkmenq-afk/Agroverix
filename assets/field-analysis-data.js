export async function loadFieldAnalysisData(client,farmId,userId){
 const records=async()=>{const rows=[];for(let start=0;;start+=500){const r=await client.from('farmer_operations').select('*').eq('farm_id',farmId).eq('user_id',userId).order('id').range(start,start+499);if(r.error)throw r.error;rows.push(...r.data);if(r.data.length<500)return rows;}};
 const [result,operations]=await Promise.all([client.from('farmer_farms').select('*,farmer_seasons(*)').eq('id',farmId).eq('user_id',userId).maybeSingle(),records()]);
 if(result.error||!result.data)throw result.error||new Error('Tarla bulunamadı.');return {farm:result.data,records:operations};
}
