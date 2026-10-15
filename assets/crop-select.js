export function bindCropSelect(select, input) {
  const field = input.closest('.profile-field');
  function sync() {
    const other = select.value === 'Diğer';
    field.hidden = !other;
    input.disabled = !other;
    input.required = other;
    input.setCustomValidity(other && !input.value.trim() ? 'Yetiştirdiğin ürünün adını yaz.' : '');
  }
  select.addEventListener('change', sync);
  input.addEventListener('input', sync);
  select.form.addEventListener('reset', () => window.setTimeout(sync, 0));
  sync();
  return {
    value: () => select.value === 'Diğer' ? input.value.trim() : select.value,
    setValue(value) {
      const listed = Array.from(select.options).some(option => option.value === value && value !== 'Diğer');
      select.value = listed ? value : value ? 'Diğer' : '';
      input.value = listed ? '' : value === 'Diğer' ? '' : value || '';
      sync();
    }
  };
}
