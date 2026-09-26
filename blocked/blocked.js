const i18n = (key) => chrome.i18n.getMessage(key);
document.querySelectorAll('[data-i18n]').forEach(el => {
  el.textContent = i18n(el.dataset.i18n);
});
// Every block uses the same template: a title for WHY it was blocked (site,
// search, search engine, page content), a sentence for WHAT it was, then the
// category and site. The search query itself is never shown back on screen.
const CATEGORY = {
  adult:    { label: 'catAdult',    siteMsg: 'msgAdult' },
  gambling: { label: 'catGambling', siteMsg: 'msgGambling' },
  social:   { label: 'catSocial',   siteMsg: 'msgSocial' },
  games:    { label: 'catGames',    siteMsg: 'msgGames' },
  youtube:  { label: 'youtube',     siteMsg: 'msgYoutube' },
  manage:   { label: 'protection',  siteMsg: 'msgManage' }
};
const REASON = {
  site:    { title: 'titleSite' },
  search:  { title: 'titleSearch',  msg: 'msgSearch' },
  engine:  { title: 'titleEngine',  msg: 'msgEngine' },
  content: { title: 'titleContent', msg: 'msgContent' },
  manage:  { title: 'titleManage',  msg: 'msgManage' }
};

const params = new URLSearchParams(location.search);
let domain   = params.get('domain') || '—';
const cat    = CATEGORY[params.get('cat')] ? params.get('cat') : 'adult';
const reason = REASON[params.get('reason')] ? params.get('reason') : 'site';

const title = i18n(REASON[reason].title);
document.getElementById('blockTitle').textContent  = title;
document.getElementById('blockReason').textContent = i18n(REASON[reason].msg || CATEGORY[cat].siteMsg);
document.getElementById('valCat').textContent      = i18n(CATEGORY[cat].label);
document.getElementById('valDomain').textContent   = domain;
document.title = title + ' — Abrigo';

// The PIN unlock only lifts blocks made by the page-content detector; the
// blocklists and search checks ignore it. Offering it elsewhere would just
// send people round in a loop, so it only shows where it works.
// The extensions page gate only exists when a PIN is set, so the button always
// applies there. "Uma pausa agora vale a pena" doesn't fit a settings page.
if (reason === 'manage') {
  document.getElementById('btnUnlock').classList.remove('hidden');
  document.querySelector('.encourage').classList.add('hidden');
  document.querySelector('[data-i18n="blockedMsg"]').classList.add('hidden');
}

if (reason === 'content') {
  chrome.runtime.sendMessage({ type: 'GET_SETTINGS' }).then(s => {
    if (s?.pinHash) document.getElementById('btnUnlock').classList.remove('hidden');
  });
}

// The big adult blocklist redirects here without a domain in the URL; the
// service worker remembers where this tab was trying to go.
if (!params.get('domain')) {
  chrome.runtime.sendMessage({ type: 'GET_BLOCKED_URL' }).then(url => {
    if (!url) return;
    try { domain = new URL(url).hostname.replace(/^www\./, ''); } catch { return; }
    document.getElementById('valDomain').textContent = domain;
  });
}

document.getElementById('btnBack').addEventListener('click', () => {
  if (history.length > 1) history.back();
  else window.close();
});

document.getElementById('btnUnlock').addEventListener('click', () => {
  document.getElementById('pinInput').value = '';
  document.getElementById('pinError').classList.add('hidden');
  document.getElementById('pinOverlay').classList.remove('hidden');
  setTimeout(() => document.getElementById('pinInput').focus(), 50);
});

document.getElementById('pinCancel').addEventListener('click', () => {
  document.getElementById('pinOverlay').classList.add('hidden');
});

document.getElementById('pinConfirm').addEventListener('click', async () => {
  const pin = document.getElementById('pinInput').value.trim();
  if (!pin) return;

  if (reason === 'manage') {
    const { ok } = await chrome.runtime.sendMessage({ type: 'UNLOCK_MANAGE', pin });
    if (ok) {
      const target = params.get('target') || 'chrome://extensions';
      const tab = await chrome.tabs.getCurrent();
      chrome.tabs.update(tab.id, { url: target });
    } else {
      document.getElementById('pinError').classList.remove('hidden');
      document.getElementById('pinInput').value = '';
      document.getElementById('pinInput').focus();
    }
    return;
  }

  const response = await chrome.runtime.sendMessage({ type: 'VERIFY_PIN', pin });

  if (response?.ok) {
    const settings = await chrome.runtime.sendMessage({ type: 'GET_SETTINGS' });
    settings.bypass = settings.bypass || {};
    settings.bypass[domain] = Date.now() + 3600000;
    await chrome.runtime.sendMessage({ type: 'SET_SETTINGS', settings });
    if (history.length > 1) history.back();
    else window.close();
  } else {
    document.getElementById('pinError').classList.remove('hidden');
    document.getElementById('pinInput').value = '';
    document.getElementById('pinInput').focus();
  }
});

document.getElementById('pinInput').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') document.getElementById('pinConfirm').click();
  if (e.key === 'Escape') document.getElementById('pinCancel').click();
});
