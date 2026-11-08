(() => {
  'use strict';
  if (document.getElementById('agri-support')) return;
  const phone = '905498218994';
  const asset = new URL('images/agri-assistant-v1.webp', document.currentScript.src).href;
  const root = document.createElement('div');
  root.id = 'agri-support';
  root.setAttribute('data-lenis-prevent', '');
  root.innerHTML = `
    <button class="agri-launcher" type="button" aria-label="Destek mesajı yaz" aria-expanded="false" aria-controls="agri-panel">
      <span class="agri-launcher-copy"><strong>Merhaba</strong><span>Nasıl yardımcı olabilirim?</span></span>
      <span class="agri-launcher-portrait"><img width="600" height="657" alt="" decoding="async"></span>
    </button>
    <section class="agri-panel" id="agri-panel" role="dialog" aria-labelledby="agri-title" aria-describedby="agri-role" hidden>
      <header class="agri-header">
        <span class="agri-avatar"><img width="600" height="657" alt="Tarla ve hesap asistanı" decoding="async"></span>
        <div><h2 id="agri-title">Merhaba</h2><p id="agri-role">Tarla ve hesap asistanın</p></div>
        <button class="agri-close" type="button" aria-label="Destek penceresini kapat">×</button>
      </header>
      <div class="agri-content">
        <p class="agri-greeting">Merhaba! Aklına takılanı yaz, AgroVerix ekibine iletelim.</p>
        <p class="agri-team">Mesajını AgroVerix destek ekibi yanıtlar.</p>
        <label for="agri-message">Nasıl yardımcı olabiliriz?</label>
        <textarea id="agri-message" rows="4" maxlength="1200" placeholder="Sorunu buraya yaz…" aria-describedby="agri-handoff"></textarea>
        <a class="agri-send" target="_blank" rel="noopener noreferrer" aria-disabled="true">WhatsApp’ta Devam Et <span aria-hidden="true">↗</span></a>
        <p class="agri-handoff" id="agri-handoff">WhatsApp açılır. Mesajını göndermek için orada <strong>Gönder</strong>’e bas.</p>
      </div>
    </section>`;
  root.querySelectorAll('img').forEach(img => { img.src = asset; });
  document.body.append(root);
  const launcher = root.querySelector('.agri-launcher');
  const panel = root.querySelector('.agri-panel');
  const close = root.querySelector('.agri-close');
  const message = root.querySelector('textarea');
  const send = root.querySelector('.agri-send');
  let returnFocus = launcher;

  function setOpen(open) {
    if (open) returnFocus = document.activeElement;
    panel.hidden = !open;
    launcher.setAttribute('aria-expanded', String(open));
    launcher.hidden = open;
    if (open) close.focus();
    else if (returnFocus && typeof returnFocus.focus === 'function') returnFocus.focus();
  }
  function updateLink() {
    const text = message.value.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '').trim();
    send.setAttribute('aria-disabled', String(!text));
    if (!text) { send.removeAttribute('href'); return; }
    const title = document.title.replace(/\s*[·|]\s*AgroVerix.*$/i, '').trim();
    const context = title && title !== 'AgroVerix' ? '\nSayfa: ' + title.slice(0, 120) : '';
    const payload = 'AgroVerix Destek' + context + '\n\n' + text;
    send.href = 'https://wa.me/' + phone + '?text=' + encodeURIComponent(payload);
  }
  launcher.addEventListener('click', () => setOpen(true));
  close.addEventListener('click', () => setOpen(false));
  root.addEventListener('keydown', event => {
    if (event.key === 'Escape' && !panel.hidden) {
      event.preventDefault();
      setOpen(false);
    }
  });
  message.addEventListener('input', updateLink);
  send.addEventListener('click', event => {
    updateLink();
    if (!send.hasAttribute('href')) {
      event.preventDefault();
      message.focus();
    }
  });
})();
