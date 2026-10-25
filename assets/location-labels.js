import {t,locale,areaDisplay,areaStored,perAreaDisplay,perAreaStored} from './regional-format.js?v=international-v1';
const I=window.AgroIntl;
const __avt=s=>I.t(s);
// Seçim kutuları kayıtları kodla saklar; ekranda yer adlarını göster.
export function locationLabels(record, admin, separator = " · ") {
  if(record.country&&record.country!=='TR')return [record.village,record.district,record.province,window.AgroIntl.countryName(record.country)].filter(Boolean).join(separator);
  const province = String(record.province || "").trim();
  const district = String(record.district || "").trim();
  const provinceRow = (admin?.provinces || []).find((row) => String(row.id) === province || row.name === province);
  const districts = admin?.districts?.[provinceRow?.id] || [];
  const districtRow = districts.find((row) => String(row.id) === district || row.name === district);
  const readable = (value) => /^\d+$/.test(value) ? "" : value;
  return [record.village, districtRow?.name || readable(district), provinceRow?.name || readable(province)].filter(Boolean).join(separator);
}
