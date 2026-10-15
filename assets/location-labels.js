// Seçim kutuları kayıtları kodla saklar; ekranda yer adlarını göster.
export function locationLabels(record, admin, separator = " · ") {
  const province = String(record.province || "").trim();
  const district = String(record.district || "").trim();
  const provinceRow = (admin?.provinces || []).find((row) => String(row.id) === province || row.name === province);
  const districts = admin?.districts?.[provinceRow?.id] || [];
  const districtRow = districts.find((row) => String(row.id) === district || row.name === district);
  const readable = (value) => /^\d+$/.test(value) ? "" : value;
  return [record.village, districtRow?.name || readable(district), provinceRow?.name || readable(province)].filter(Boolean).join(separator);
}
