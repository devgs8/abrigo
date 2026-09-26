const i18n = (key) => chrome.i18n.getMessage(key);

let settings = null;
let pinMode = null; // 'set' | 'verify-then-set' | 'verify-then-remove' | 'verify-then-disable-cat' | 'verify-then-set-youtube' | 'verify-then-randomize'
let pendingCat = null;
let pendingYoutubeValue = null;

const YT_LEVEL = { block: 2, restrict: 1, free: 0 };

// ── i18n ─────────────────────────────────────────────────────────────────────

document.getElementById('optTitle').textContent       = i18n('optTitle');
document.getElementById('pinTitle').textContent       = i18n('pinTitle');
document.getElementById('catTitle').textContent       = i18n('categories');
document.getElementById('ytTitle').textContent        = i18n('youtube');
document.getElementById('lblAdult').textContent       = i18n('catAdult');
document.getElementById('lblGambling').textContent    = i18n('catGambling');
document.getElementById('lblSocial').textContent      = i18n('catSocial');
document.getElementById('lblGames').textContent       = i18n('catGames');
document.getElementById('lblYtFree').textContent      = i18n('ytFree');
document.getElementById('lblYtRestrict').textContent  = i18n('ytRestrict');
document.getElementById('lblYtBlock').textContent     = i18n('ytBlock');
document.getElementById('btnSetPin').textContent      = i18n('pinSet');
document.getElementById('btnRemovePin').textContent   = i18n('pinRemove');
document.querySelectorAll('[data-i18n]').forEach(el => {
  el.textContent = i18n(el.dataset.i18n);
});

// ── About: real numbers, not placeholders ────────────────────────────────────

document.getElementById('statVersion').textContent = chrome.runtime.getManifest().version;
fetch('../rules/stats.json').then(r => r.json()).then(s => {
  document.getElementById('statDomains').textContent =
    new Intl.NumberFormat(navigator.language, { notation: 'compact', maximumFractionDigits: 0 }).format(s.adultDomains);
  document.getElementById('statDate').textContent =
    new Date(s.generated + 'T12:00:00').toLocaleDateString(navigator.language, { day: 'numeric', month: 'short', year: 'numeric' });
}).catch(() => {});

// ── Load ──────────────────────────────────────────────────────────────────────

async function load() {
  settings = await sendMsg({ type: 'GET_SETTINGS' });
  render();
}

function render() {
  const s = settings;

  // PIN
  const hasPIN = !!s.pinHash;
  const pinStatus = document.getElementById('pinStatus');
  pinStatus.textContent = i18n(hasPIN ? 'pinStatusOn' : 'pinStatusOff');
  pinStatus.classList.toggle('is-on', hasPIN);
  document.getElementById('btnSetPin').textContent = hasPIN ? i18n('pinChange') : i18n('pinSet');
  document.getElementById('btnRemovePin').classList.toggle('hidden', !hasPIN);

  // Categories
  document.getElementById('catAdult').checked    = s.categories.adult;
  document.getElementById('catGambling').checked = s.categories.gambling;
  document.getElementById('catSocial').checked   = s.categories.social;
  document.getElementById('catGames').checked    = s.categories.games;

  // YouTube
  const ytRadio = document.querySelector(`input[name="youtube"][value="${s.youtube}"]`);
  if (ytRadio) ytRadio.checked = true;
}

async function save() {
  await sendMsg({ type: 'SET_SETTINGS', settings });
  render();
}

// ── Categories ────────────────────────────────────────────────────────────────

['catAdult','catGambling','catSocial','catGames'].forEach(id => {
  document.getElementById(id).addEventListener('change', async (e) => {
    const cat = id.replace('cat','').toLowerCase();
    const wantEnable = e.target.checked;

    // Turning OFF any category protection requires the PIN, same as the master toggle.
    if (!wantEnable && settings.pinHash) {
      e.target.checked = true; // revert UI until PIN confirmed
      pinMode = 'verify-then-disable-cat';
      pendingCat = cat;
      openPinDialog(i18n('pinEnter'), false);
      return;
    }

    settings.categories[cat] = wantEnable;
    await save();
  });
});

// ── YouTube ───────────────────────────────────────────────────────────────────

document.querySelectorAll('input[name="youtube"]').forEach(r => {
  r.addEventListener('change', async (e) => {
    const wantValue = e.target.value;

    // Loosening YouTube restriction (block -> restrict/free, or restrict -> free)
    // requires the PIN, same as disabling adult/social protections.
    if (YT_LEVEL[wantValue] < YT_LEVEL[settings.youtube] && settings.pinHash) {
      render(); // revert UI (re-check the still-current radio) until PIN confirmed
      pinMode = 'verify-then-set-youtube';
      pendingYoutubeValue = wantValue;
      openPinDialog(i18n('pinEnter'), false);
      return;
    }

    settings.youtube = wantValue;
    await save();
  });
});

// ── PIN ───────────────────────────────────────────────────────────────────────

document.getElementById('btnSetPin').addEventListener('click', () => {
  if (settings.pinHash) {
    pinMode = 'verify-then-set';
    openPinDialog(i18n('pinEnter'), false);
  } else {
    pinMode = 'set';
    openPinDialog(i18n('pinSet'), true);
  }
});

document.getElementById('btnRemovePin').addEventListener('click', () => {
  pinMode = 'verify-then-remove';
  openPinDialog(i18n('pinEnter'), false);
});

// Locks Adult/Gambling/Social + YouTube (Blocked) behind a random PIN that is
// generated and hashed entirely inside the background service worker — the
// plaintext is never sent to this page, never shown, never logged.
document.getElementById('btnRandomPin').addEventListener('click', () => {
  if (settings.pinHash) {
    pinMode = 'verify-then-randomize';
    openPinDialog(i18n('pinEnter'), false);
  } else {
    confirmAndRandomizePin();
  }
});

async function confirmAndRandomizePin() {
  const sure = confirm(i18n('randomPinConfirm'));
  if (!sure) return;

  await sendMsg({ type: 'SET_RANDOM_PIN' });
  settings = await sendMsg({ type: 'GET_SETTINGS' });
  render();
  showToast(i18n('randomPinDone'));
}

function openPinDialog(title, showConfirm) {
  document.getElementById('pinDialogTitle').textContent = title;
  document.getElementById('pinInput').value = '';
  document.getElementById('pinConfirmInput').value = '';
  document.getElementById('pinDialogError').classList.add('hidden');
  document.getElementById('pinConfirmInput').classList.toggle('hidden', !showConfirm);
  document.getElementById('pinOverlay').classList.remove('hidden');
  setTimeout(() => document.getElementById('pinInput').focus(), 50);
}

function closePinDialog() {
  document.getElementById('pinOverlay').classList.add('hidden');
  pinMode = null;
}

document.getElementById('pinCancel').addEventListener('click', closePinDialog);

document.getElementById('pinOk').addEventListener('click', async () => {
  const pin = document.getElementById('pinInput').value.trim();
  const confirmPin = document.getElementById('pinConfirmInput').value.trim();
  const errEl = document.getElementById('pinDialogError');

  if (!pin || pin.length < 4) {
    errEl.textContent = i18n('pinTooShort');
    errEl.classList.remove('hidden');
    return;
  }

  if (pinMode === 'set') {
    if (pin !== confirmPin) {
      errEl.textContent = i18n('pinMismatch');
      errEl.classList.remove('hidden');
      return;
    }
    settings.pinHash = await hashPin(pin);
    await save();
    closePinDialog();
    showToast(i18n('pinSaved'));
    return;
  }

  // Verify current PIN first
  const { ok } = await sendMsg({ type: 'VERIFY_PIN', pin });
  if (!ok) {
    errEl.textContent = i18n('pinWrong');
    errEl.classList.remove('hidden');
    document.getElementById('pinInput').value = '';
    document.getElementById('pinInput').focus();
    return;
  }

  if (pinMode === 'verify-then-remove') {
    settings.pinHash = null;
    await save();
    closePinDialog();
    showToast(i18n('pinRemoved'));
    return;
  }

  if (pinMode === 'verify-then-disable-cat') {
    settings.categories[pendingCat] = false;
    pendingCat = null;
    await save();
    closePinDialog();
    return;
  }

  if (pinMode === 'verify-then-set-youtube') {
    settings.youtube = pendingYoutubeValue;
    pendingYoutubeValue = null;
    await save();
    closePinDialog();
    return;
  }

  if (pinMode === 'verify-then-randomize') {
    closePinDialog();
    await confirmAndRandomizePin();
    return;
  }

  if (pinMode === 'verify-then-set') {
    pinMode = 'set';
    openPinDialog(i18n('pinSet'), true);
  }
});

document.getElementById('pinInput').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') document.getElementById('pinOk').click();
  if (e.key === 'Escape') closePinDialog();
});

// ── Helpers ───────────────────────────────────────────────────────────────────

async function hashPin(pin) {
  const data = new TextEncoder().encode(pin + '_shieldblock');
  const digest = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(digest)).map(b => b.toString(16).padStart(2, '0')).join('');
}

function showToast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.remove('hidden');
  setTimeout(() => t.classList.add('hidden'), 2500);
}

function sendMsg(msg) {
  return new Promise(resolve => chrome.runtime.sendMessage(msg, resolve));
}

load();
