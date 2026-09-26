const i18n = (key) => chrome.i18n.getMessage(key);

// Apply i18n strings to all [data-i18n] elements
document.querySelectorAll('[data-i18n]').forEach(el => {
  el.textContent = i18n(el.dataset.i18n);
});
document.querySelectorAll('[data-i18n-label]').forEach(el => {
  el.setAttribute('aria-label', i18n(el.dataset.i18nLabel));
});

// Real number of blocked adult domains, written by tools/build-adult-rules.mjs.
let blockedCount = null;
fetch('../rules/stats.json').then(r => r.json()).then(s => {
  blockedCount = s.adultDomains;
  if (settings) render();
}).catch(() => {});

const $ = (id) => document.getElementById(id);

let settings = null;
let pendingAction = null; // 'toggle' | 'settings'

const YT_LEVEL = { block: 2, restrict: 1, free: 0 };

// ── Load settings ────────────────────────────────────────────────────────────

async function load() {
  settings = await sendMsg({ type: 'GET_SETTINGS' });
  render();
}

function render() {
  const s = settings;

  $('toggleEnabled').checked = s.enabled;
  $('statusLabel').textContent = i18n(s.enabled ? 'on' : 'off');
  $('hero').classList.toggle('is-off', !s.enabled);
  $('heroSub').textContent = !s.enabled
    ? i18n('offSub')
    : blockedCount
      ? new Intl.NumberFormat(navigator.language, { notation: 'compact', maximumFractionDigits: 0 }).format(blockedCount) + ' ' + i18n('sitesBlocked')
      : i18n('onSub');
  $('lockBadge').classList.toggle('hidden', !s.pinHash);

  $('catAdult').checked    = s.categories.adult;
  $('catGambling').checked = s.categories.gambling;
  $('catSocial').checked   = s.categories.social;
  $('catGames').checked    = s.categories.games;

  document.querySelector(`input[name="youtube"][value="${s.youtube}"]`).checked = true;

  $('mainContent').style.opacity = s.enabled ? '1' : '0.45';
  $('mainContent').style.pointerEvents = s.enabled ? '' : 'none';
}

async function save() {
  await sendMsg({ type: 'SET_SETTINGS', settings });
}

// ── Toggle ───────────────────────────────────────────────────────────────────

$('toggleEnabled').addEventListener('change', async (e) => {
  const wantEnable = e.target.checked;

  if (!wantEnable && settings.pinHash) {
    e.target.checked = true; // revert UI until PIN confirmed
    pendingAction = () => {
      settings.enabled = false;
      save();
      render();
    };
    showPin(i18n('pinEnter'));
    return;
  }

  settings.enabled = wantEnable;
  await save();
  render();
});

// ── Categories ───────────────────────────────────────────────────────────────

['catAdult','catGambling','catSocial','catGames'].forEach(id => {
  $(id).addEventListener('change', async (e) => {
    const cat = id.replace('cat','').toLowerCase();
    const wantEnable = e.target.checked;

    // Turning OFF any category protection requires the PIN, same as the master toggle.
    if (!wantEnable && settings.pinHash) {
      e.target.checked = true; // revert UI until PIN confirmed
      pendingAction = () => {
        settings.categories[cat] = false;
        save();
        render();
      };
      showPin(i18n('pinEnter'));
      return;
    }

    settings.categories[cat] = wantEnable;
    await save();
  });
});

// ── YouTube ──────────────────────────────────────────────────────────────────

document.querySelectorAll('input[name="youtube"]').forEach(r => {
  r.addEventListener('change', async (e) => {
    const wantValue = e.target.value;

    // Loosening YouTube restriction (block -> restrict/free, or restrict -> free)
    // requires the PIN, same as disabling adult/social protections.
    if (YT_LEVEL[wantValue] < YT_LEVEL[settings.youtube] && settings.pinHash) {
      render(); // revert UI (re-check the still-current radio) until PIN confirmed
      pendingAction = () => {
        settings.youtube = wantValue;
        save();
        render();
      };
      showPin(i18n('pinEnter'));
      return;
    }

    settings.youtube = wantValue;
    await save();
  });
});

// ── Settings / PIN buttons ───────────────────────────────────────────────────

$('btnSettings').addEventListener('click', () => {
  chrome.runtime.openOptionsPage();
});

$('btnPin').addEventListener('click', () => {
  if (settings.pinHash) {
    // Verify existing PIN before showing options
    pendingAction = () => chrome.runtime.openOptionsPage();
    showPin(i18n('pinEnter'));
  } else {
    chrome.runtime.openOptionsPage();
  }
});

// ── PIN dialog ───────────────────────────────────────────────────────────────

function showPin(title) {
  $('pinDialogTitle').textContent = title;
  $('pinInput').value = '';
  $('pinError').classList.add('hidden');
  $('pinOverlay').classList.remove('hidden');
  setTimeout(() => $('pinInput').focus(), 50);
}

function hidePin() {
  $('pinOverlay').classList.add('hidden');
  pendingAction = null;
}

$('pinCancel').addEventListener('click', hidePin);

$('pinConfirm').addEventListener('click', async () => {
  const pin = $('pinInput').value.trim();
  if (!pin) return;

  const { ok } = await sendMsg({ type: 'VERIFY_PIN', pin });
  if (ok) {
    hidePin();
    if (pendingAction) pendingAction();
  } else {
    $('pinError').classList.remove('hidden');
    $('pinInput').value = '';
    $('pinInput').focus();
  }
});

$('pinInput').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') $('pinConfirm').click();
  if (e.key === 'Escape') hidePin();
});

// ── Helper ───────────────────────────────────────────────────────────────────

function sendMsg(msg) {
  return new Promise(resolve => chrome.runtime.sendMessage(msg, resolve));
}

load();
