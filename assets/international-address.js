const I=window.AgroIntl;
export function addressForm(prefix,{province,district,village},initialCountry='TR'){
 const get=id=>document.getElementById(id),select=get(prefix+'-country'),region=get(prefix+'-region'),city=get(prefix+'-city'),locality=get(prefix+'-locality');
 I.fillCountries(select,initialCountry);
 function update(){const foreign=select.value!=='TR';[province,district,village].forEach(el=>{el.closest('.profile-field').hidden=foreign;el.disabled=foreign;el.required=!foreign&&prefix==='f';});document.querySelectorAll('[data-address="'+prefix+'"]').forEach(el=>el.hidden=!foreign);if(!foreign){province.disabled=false;district.disabled=!province.value;village.disabled=!district.value;}}
 select.addEventListener('change',update);update();
 return {select,update,load(record){select.value=record.country||'TR';if(select.value!=='TR'){region.value=record.province||'';city.value=record.district||'';locality.value=record.village||'';}update();},value(){return select.value==='TR'?{country:'TR',province:province.value||null,district:district.value||null,village:village.value||null}:{country:select.value,province:region.value.trim()||null,district:city.value.trim()||null,village:locality.value.trim()||null};}};
}