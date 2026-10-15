export function costPerDecare(record, farmArea) {
  if (record.cost_basis === 'field_total') {
    const area = Number(farmArea);
    const total = record.total_cost == null || record.total_cost === '' ? NaN : Number(record.total_cost);
    return Number.isFinite(area) && area > 0 && Number.isFinite(total) && total >= 0 ? total / area : null;
  }
  // Earlier records store application per decare and the package price.
  const quantity = Number(record.quantity);
  const price = record.package_price == null || record.package_price === '' ? NaN : Number(record.package_price);
  const pack = String(record.package_size || '').trim().match(/^(\d+(?:[.,]\d+)?)\s*([\p{L}³0-9]+)$/u);
  if (!Number.isFinite(quantity) || quantity <= 0 || !Number.isFinite(price) || price < 0 || !pack) return null;
  const units = {kg:['mass',1],g:['mass',.001],ton:['mass',1000],l:['volume',1],lt:['volume',1],litre:['volume',1],ml:['volume',.001],'m³':['volume',1000],m3:['volume',1000],m:['length',1],adet:['count',1],saat:['time',1]};
  const key = value => String(value || '').toLocaleLowerCase('tr-TR').replace(/\s/g, '').replace(/\/da$/, '');
  const used = units[key(record.quantity_unit)], packaged = units[key(pack[2])];
  const amount = Number(pack[1].replace(',', '.'));
  return amount > 0 && used && packaged && used[0] === packaged[0] ? quantity * used[1] / (amount * packaged[1]) * price : null;
}
