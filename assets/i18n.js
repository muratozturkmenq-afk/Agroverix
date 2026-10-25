(function(){
'use strict';
const store={get(k){try{return localStorage.getItem(k);}catch{return null;}},set(k,v){try{localStorage.setItem(k,v);}catch{}}};
const requested=new URLSearchParams(location.search).get('lang'),lang=['tr','en'].includes(requested)?requested:(store.get('agroverix-language')||'tr');
if(requested)store.set('agroverix-language',lang);
const I=window.AgroIntl={lang:lang==='en'?'en':'tr',currency:store.get('agroverix-new-currency')||(lang==='en'?'EUR':'TRY'),accountId:null,country:'TR',dict:window.AGROVERIX_EN||{},locale:lang==='en'?'en-GB':'tr-TR'};
I.factor=()=>I.lang==='en'?10:1;
I.currencyLabel=code=>(code||I.currency)==='EUR'?'EUR':I.lang==='en'?'TRY':'TL';
I.unit=unit=>String(unit||'').replace(/\bTL\b/g,I.currencyLabel()).replace(I.lang==='en'?/\bda\b/g:/$^/g,'ha');
I.t=function(value){const raw=String(value??''),key=raw.trim().replace(/\s+/g,' '),translated=I.lang==='en'?(I.dict[key]??key):key;return raw.slice(0,raw.length-raw.trimStart().length)+I.unit(translated)+raw.slice(raw.trimEnd().length);};
I.num=(n,options={maximumFractionDigits:2})=>Number(n).toLocaleString(I.locale,options);
I.area=n=>n==null?n:Number(n)/I.factor();I.areaStored=n=>n==null?n:Number(n)*I.factor();
I.perArea=n=>n==null?n:Number(n)*I.factor();I.perAreaStored=n=>n==null?n:Number(n)/I.factor();
I.money=(n,code=I.currency)=>I.num(n,{minimumFractionDigits:2,maximumFractionDigits:2})+' '+I.currencyLabel(code);
I.countryName=code=>{try{return new Intl.DisplayNames([I.locale],{type:'region'}).of(code);}catch{return code;}};
I.countries='AD AE AF AG AI AL AM AO AQ AR AS AT AU AW AX AZ BA BB BD BE BF BG BH BI BJ BL BM BN BO BQ BR BS BT BV BW BY BZ CA CC CD CF CG CH CI CK CL CM CN CO CR CU CV CW CX CY CZ DE DJ DK DM DO DZ EC EE EG EH ER ES ET FI FJ FK FM FO FR GA GB GD GE GF GG GH GI GL GM GN GP GQ GR GS GT GU GW GY HK HM HN HR HT HU ID IE IL IM IN IO IQ IR IS IT JE JM JO JP KE KG KH KI KM KN KP KR KW KY KZ LA LB LC LI LK LR LS LT LU LV LY MA MC MD ME MF MG MH MK ML MM MN MO MP MQ MR MS MT MU MV MW MX MY MZ NA NC NE NF NG NI NL NO NP NR NU NZ OM PA PE PF PG PH PK PL PM PN PR PS PT PW PY QA RE RO RS RU RW SA SB SC SD SE SG SH SI SJ SK SL SM SN SO SR SS ST SV SX SY SZ TC TD TF TG TH TJ TK TL TM TN TO TR TT TV TW TZ UA UG UM US UY UZ VA VC VE VG VI VN VU WF WS YE YT ZA ZM ZW'.split(' ');
I.fillCountries=function(select,value){select.replaceChildren(new Option(I.t('Ülke seç'),'') );I.countries.map(code=>({code,name:I.countryName(code)})).sort((a,b)=>a.name.localeCompare(b.name,I.locale)).forEach(c=>select.add(new Option(c.name,c.code)));select.value=value||'';};
I.cropName=crop=>{const raw=String(crop||''),n=raw.trim().toLowerCase();return ({cotton:'pamuk',wheat:'buğday',maize:'mısır',corn:'mısır',olive:'zeytin',grape:'üzüm',sunflower:'ayçiçeği',barley:'arpa',rice:'çeltik',potato:'patates',tomato:'domates',apple:'elma',walnut:'ceviz',almond:'badem'})[n]||raw;};
const last=new WeakMap(),original=new WeakMap();
I.apply=function(root=document){
 document.documentElement.lang=I.lang;
 root.querySelectorAll('[data-i18n]').forEach(el=>{const key=el.getAttribute('data-i18n'),before=last.get(el);if(el.textContent.trim().replace(/\s+/g,' ')===key||el.textContent===before){if(!original.has(el))original.set(el,el.textContent);const text=I.t(original.get(el));el.textContent=text;last.set(el,text);}});
 for(const [attr,data]of [['placeholder','data-i18n-placeholder'],['title','data-i18n-title'],['aria-label','data-i18n-label'],['alt','data-i18n-alt']])root.querySelectorAll('['+data+']').forEach(el=>el.setAttribute(attr,I.t(el.getAttribute(data))));
 root.querySelectorAll('datalist option[data-crop-tr]').forEach(el=>el.value=I.lang==='en'?(I.dict[el.dataset.cropTr]||el.dataset.cropTr):el.dataset.cropTr);
 document.querySelectorAll('[data-account-currency]').forEach(el=>el.textContent=I.currencyLabel());
 document.querySelectorAll('[data-new-currency]').forEach(el=>{el.value=I.currency;el.disabled=!!I.accountId;});
};
I.dbError=function(error){const s=String(error?.message||'');if(I.lang!=='en')return s;
 if(/Yetersiz stok|insufficient stock/i.test(s))return 'Insufficient stock. Check the available quantity and expense records.';
 if(/birim|Ambalaj/.test(s))return 'Check the selected unit and package contents.';
 if(/ödeme|Ödeme|tahsilat|Tahsilat|borç|alacak/.test(s))return 'Check the payment amount and date. It cannot exceed the outstanding balance available on that date.';
 if(/currency|para birimi/i.test(s))return 'The record currency must match the account currency.';
 if(/hesab|owner|auth|Giriş/i.test(s))return 'Sign in again and check that this record belongs to your account.';
 return 'Could not save. Check your entries and connection, then try again.';
};
I.mount=function(){
 const target=document.querySelector('.nav-in,.profile-top');if(!target||document.querySelector('.regional-controls'))return;
 const wrap=document.createElement('div');wrap.className='regional-controls';wrap.setAttribute('aria-label',I.t('Dil ve para birimi'));
 const group=document.createElement('div');group.className='regional-language';group.setAttribute('role','group');group.setAttribute('aria-label',I.t('Dil'));
 ['tr','en'].forEach(code=>{const b=document.createElement('button');b.type='button';b.textContent=code.toUpperCase();b.lang=code;b.setAttribute('aria-pressed',String(code===I.lang));b.onclick=()=>{if(code===I.lang)return;if(document.querySelector('form[data-intl-dirty="true"]')&&!confirm(I.t('Kaydedilmemiş bilgiler var. Dil değiştirilsin mi?')))return;store.set('agroverix-language',code);const u=new URL(location.href);u.searchParams.set('lang',code);location.assign(u.href);};group.append(b);});wrap.append(group);
 if(I.accountId){const badge=document.createElement('span');badge.className='regional-currency';badge.setAttribute('data-account-currency','');badge.title=I.t('Hesabın para birimi');badge.textContent=I.currencyLabel();wrap.append(badge);}
 else{const select=document.createElement('select');select.setAttribute('data-new-currency','');select.setAttribute('aria-label',I.t('Yeni hesabın para birimi'));[['TRY','TL / TRY'],['EUR','EUR / €']].forEach(([value,text])=>select.add(new Option(text,value)));select.value=I.currency;select.onchange=()=>{if(document.querySelector('form[data-intl-dirty="true"]')&&!confirm(I.t('Kaydedilmemiş bilgiler var. Para birimi seçimi değiştirilsin mi?'))){select.value=I.currency;return;}store.set('agroverix-new-currency',select.value);location.reload();};wrap.append(select);}
 function place(){const menu=document.querySelector('.mobile-page-links');const narrow=matchMedia('(max-width:1800px)').matches;if(menu&&narrow)menu.append(wrap);else target.append(wrap);}
 place();window.addEventListener('resize',place);
};
I.setCurrency=function(code){if(!['TRY','EUR'].includes(code))return;I.currency=code;I.apply();};
document.addEventListener('input',e=>{if(e.isTrusted&&e.target.closest('form'))e.target.closest('form').dataset.intlDirty='true';});
document.addEventListener('DOMContentLoaded',()=>{I.apply();I.mount();});
document.documentElement.lang=I.lang;
})();