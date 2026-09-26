const RULESETS = ['adult', 'gambling', 'social', 'games'];

const YOUTUBE_DOMAINS = [
  'youtube.com', 'www.youtube.com', 'youtu.be',
  'm.youtube.com', 'music.youtube.com',
  'youtube-nocookie.com', 'youtubekids.com'
];

const GOOGLE_SEARCH_HOST_RE = /(^|\.)google\.[a-z.]{2,}$/i;
const BING_SEARCH_HOST_RE = /(^|\.)bing\.com$/i;

// Matched as whole words (\bass\b) so "ass" doesn't hit "class" and "anal"
// doesn't hit "canal". Plurals and -ing forms are listed explicitly.
const ADULT_SEARCH_KEYWORDS = [
  // English
  'porn','porno','porns','pornography','xxx','nude','nudes','naked','nudity','nsfw',
  'hentai','ecchi','lewd','erotic','erotica','onlyfans','fansly','camgirl','camgirls',
  'sexcam','xvideos','xvideo','xnxx','xhamster','pornhub','redtube','youporn','spankbang',
  'sex','sexy','sexting','sextape','sexvideo','cumshot','blowjob','handjob',
  'gangbang','threesome','deepthroat','creampie','bdsm','fetish','masturbate',
  'masturbation','masturbating','stripper','strippers','striptease','twerk','twerking',
  'ass','asses','tits','titties','boobs','boobies','anal','milf','milfs','pussy','cock',
  'horny','slut','sluts','thot','thots','hooker','escort','escorts','rule34','r34',
  'leaked','topless','bottomless','upskirt','nipple','nipples','orgasm','orgy',
  'softcore','playboy','brazzers','chaturbate','stripchat','fap','fapping',
  // Portuguese
  'sexo','nua','nuas','nuda','nudez','pelada','peladas','pelado','pelados','putaria',
  'safada','safadas','safado','safadinha','gostosa','gostosas','gostoso','rabuda',
  'rabudas','rabudo','peituda','peitudas','peitos','bunda','bundas','bundinha','buceta',
  'xota','xoxota','pornografia','siririca','punheta','trepando','trepar','transando',
  'transar','ninfeta','ninfetas','novinha','novinhas','putinha','putinhas','puta','putas',
  'boquete','mamada','foder','fodendo','fodida','gozar','gozando','gozada','tesao',
  'tesuda','tesudas','acompanhante','acompanhantes','piroca','nudinha','nudinhas',
  'seminua','seminuas'
];

// Also checked against the query with every non-letter stripped, which catches
// "p o r n" and "porn-hub". Only long terms: short ones would hit innocent
// word joins ("top ornaments" -> "topornaments" contains "porn").
const ADULT_COMPACT_TERMS = [
  'pornhub','xvideos','xhamster','onlyfans','blowjob','cumshot','creampie','gangbang',
  'deepthroat','sextape','putaria','punheta','siririca','buceta','xoxota','pornografia',
  'chaturbate','stripchat','spankbang','redtube','youporn','hentai'
];

const ADULT_SEARCH_RE = new RegExp('\\b(' + ADULT_SEARCH_KEYWORDS.join('|') + ')\\b');

const LEET = { '0': 'o', '1': 'i', '3': 'e', '4': 'a', '5': 's', '7': 't', '@': 'a', '$': 's' };

// Lowercase and strip accents (tesão -> tesao).
function normalizeQuery(text) {
  return text.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

// Undo leetspeak (p0rn -> porn). Tested alongside the plain form, not instead
// of it, because some terms carry digits of their own (r34).
function unLeet(text) {
  return text.replace(/[013457@$]/g, c => LEET[c]);
}

function containsAdultKeyword(text) {
  const norm = normalizeQuery(text);
  const leet = unLeet(norm);
  if (ADULT_SEARCH_RE.test(norm) || ADULT_SEARCH_RE.test(leet)) return true;
  const compact = leet.replace(/[^a-z]/g, '');
  return ADULT_COMPACT_TERMS.some(t => compact.includes(t));
}

const BLOCKED_PAGE = chrome.runtime.getURL('blocked/blocked.html');

// ── Defaults ────────────────────────────────────────────────────────────────

const DEFAULT_SETTINGS = {
  enabled:    true,
  categories: { adult: true, gambling: true, social: true, games: false },
  youtube:    'block', // 'free' | 'restrict' | 'block'
  pinHash:    null
};

// ── Init ────────────────────────────────────────────────────────────────────

chrome.runtime.onInstalled.addListener(async () => {
  const stored = await chrome.storage.local.get('settings');
  if (!stored.settings) {
    await chrome.storage.local.set({ settings: DEFAULT_SETTINGS });
  } else {
    let changed = false;
    if (!stored.settings.categories?.social) {
      // Force-enable social blocking on upgrade — adult content was leaking
      // through Twitter/X, which is only reachable when this category is on.
      stored.settings.categories.social = true;
      changed = true;
    }
    if (stored.settings.youtube !== 'block') {
      stored.settings.youtube = 'block';
      changed = true;
    }
    if (changed) await chrome.storage.local.set({ settings: stored.settings });
  }
  await scheduleSyncRules();
});

// Tabs opened as the browser starts (session restore, links from other apps)
// begin loading before the static rulesets are ready, so a blocked site in
// one of them would get through. Once the rules are in place, reload every
// tab that already loaded a web page so the rules get to see it.
chrome.runtime.onStartup.addListener(async () => {
  await scheduleSyncRules();
  const tabs = await chrome.tabs.query({});
  for (const tab of tabs) {
    if (!tab.discarded && /^https?:/.test(tab.url || tab.pendingUrl || '')) {
      chrome.tabs.reload(tab.id).catch(() => {});
    }
  }
});

// ── Sync DNR rulesets with saved categories ──────────────────────────────────
// Serialized: writing settings here can itself trigger storage.onChanged,
// which would otherwise run concurrently with an in-flight sync and race on
// the same declarativeNetRequest rule IDs ("Rule with id ... does not have
// a unique ID"). Queuing keeps runs sequential so each sees the other's result.

let syncChain = Promise.resolve();
function scheduleSyncRules() {
  syncChain = syncChain.then(() => syncRules()).catch(err => console.error('syncRules failed:', err));
  return syncChain;
}

async function syncRules() {
  const { settings } = await chrome.storage.local.get('settings');
  if (!settings) return;

  const s = settings;

  // Rulesets for categories
  const enableIds  = [];
  const disableIds = [];

  for (const cat of RULESETS) {
    const shouldEnable = s.enabled && (s.categories[cat] ?? false);
    shouldEnable ? enableIds.push(cat) : disableIds.push(cat);
  }

  await chrome.declarativeNetRequest.updateEnabledRulesets({
    enableRulesetIds:  enableIds,
    disableRulesetIds: disableIds
  });

  // Dynamic rules for YouTube block mode
  await syncYoutubeRules(s);
}

async function syncYoutubeRules(settings) {
  // Remove existing YouTube dynamic rules
  const existing = await chrome.declarativeNetRequest.getDynamicRules();
  const ytRuleIds = existing.filter(r => r.id >= 9000).map(r => r.id);

  const addRules = [];

  if (settings.enabled && settings.youtube === 'block') {
    let id = 9000;
    for (const domain of YOUTUBE_DOMAINS) {
      addRules.push({
        id: id++,
        priority: 100,
        action: { type: 'redirect', redirect: { url: BLOCKED_PAGE + '?cat=youtube&reason=site&domain=' + domain } },
        condition: { urlFilter: `||${domain}`, resourceTypes: ['main_frame'] }
      });
    }
  }

  await chrome.declarativeNetRequest.updateDynamicRules({
    removeRuleIds: ytRuleIds,
    addRules
  });
}

// ── Listen for settings changes ──────────────────────────────────────────────

chrome.storage.onChanged.addListener((changes) => {
  if (changes.settings) scheduleSyncRules();
});

// ── YouTube Restricted Mode via webNavigation ────────────────────────────────

chrome.webNavigation.onBeforeNavigate.addListener(async (details) => {
  if (details.frameId !== 0) return;

  const { settings } = await chrome.storage.local.get('settings');
  if (!settings?.enabled) return;
  if (settings.youtube !== 'restrict') return;

  const url = new URL(details.url);
  const isYt = YOUTUBE_DOMAINS.some(d => url.hostname === d || url.hostname.endsWith('.' + d));
  if (!isYt) return;

  // Force Restricted Mode by setting the 'restrict' parameter
  if (!url.searchParams.has('restrict') || url.searchParams.get('restrict') !== 'SafeSearch') {
    url.searchParams.set('restrict', 'SafeSearch');
    chrome.tabs.update(details.tabId, { url: url.toString() });
  }
});

// ── Search engine SafeSearch enforcement ────────────────────────────────────
// Covers the Web tab and the Images/Videos verticals: Google keeps those on
// /search (?udm=), Bing moves them to /images/search and /videos/search.
// Every engine gets the keyword check; engines with a URL switch for strict
// filtering also get that forced. An engine missing from this list would be a
// way around both, so the smaller ones are here too.

const SEARCH_ENGINES = [
  {
    hostRe:     GOOGLE_SEARCH_HOST_RE,
    paths:      ['/search', '/images'],
    queryParam: 'q',
    safeParam:  'safe',
    safeValue:  'active'
  },
  {
    // Bing's own "Moderate" default still surfaces suggestive results for
    // queries like "big ass", so force Strict rather than trusting it.
    hostRe:     BING_SEARCH_HOST_RE,
    paths:      ['/search', '/images/search', '/videos/search', '/news/search'],
    queryParam: 'q',
    safeParam:  'adlt',
    safeValue:  'strict'
  },
  {
    hostRe:     /(^|\.)duckduckgo\.com$/i,
    paths:      ['/', '/html', '/html/', '/lite', '/lite/'],
    queryParam: 'q',
    safeParam:  'kp',
    safeValue:  '1'
  },
  {
    hostRe:     /(^|\.)search\.yahoo\.com$/i,
    paths:      ['/search', '/search/images', '/search/video'],
    queryParam: 'p',
    safeParam:  'vm',
    safeValue:  'r'
  },
  {
    hostRe:     /^search\.brave\.com$/i,
    paths:      ['/search', '/images', '/videos', '/news'],
    queryParam: 'q',
    safeParam:  'safesearch',
    safeValue:  'strict'
  },
  {
    hostRe:     /(^|\.)startpage\.com$/i,
    paths:      ['/do/search', '/sp/search', '/do/dsearch'],
    queryParam: 'query',
    safeParam:  'qadf',
    safeValue:  'heavy'
  },
  {
    // No URL switch for strict mode -- keyword check only.
    hostRe:     /(^|\.)ecosia\.org$/i,
    paths:      ['/search', '/images', '/videos', '/news'],
    queryParam: 'q'
  },
  {
    hostRe:     /(^|\.)qwant\.com$/i,
    paths:      ['/'],
    queryParam: 'q'
  }
];

// Yandex has no SafeSearch that can be forced from the URL, and its image
// search is the usual way around filters -- its search pages are blocked outright.
const YANDEX_HOST_RE = /(^|\.)(yandex\.[a-z.]+|ya\.ru)$/i;
const YANDEX_SEARCH_PATH_RE = /^\/(search|images|video)/;

async function enforceSearchSafety(details) {
  if (details.frameId !== 0) return;

  const { settings } = await chrome.storage.local.get('settings');
  if (!settings?.enabled) return;
  if (!settings.categories?.adult) return;

  let url;
  try { url = new URL(details.url); } catch { return; }

  if (YANDEX_HOST_RE.test(url.hostname) && YANDEX_SEARCH_PATH_RE.test(url.pathname)) {
    chrome.tabs.update(details.tabId, {
      url: BLOCKED_PAGE + '?cat=adult&reason=engine&domain=' + encodeURIComponent(url.hostname)
    });
    return;
  }

  const engine = SEARCH_ENGINES.find(e => e.hostRe.test(url.hostname));
  if (!engine) return;
  if (!engine.paths.includes(url.pathname)) return;

  const query = url.searchParams.get(engine.queryParam) || '';
  if (containsAdultKeyword(query)) {
    chrome.tabs.update(details.tabId, {
      url: BLOCKED_PAGE + '?cat=adult&reason=search&domain=' + encodeURIComponent(url.hostname.replace(/^www\./, ''))
    });
    return;
  }

  if (!engine.safeParam || !query) return;
  if (url.searchParams.get(engine.safeParam) !== engine.safeValue) {
    url.searchParams.set(engine.safeParam, engine.safeValue);
    chrome.tabs.update(details.tabId, { url: url.toString() });
  }
}

// onBeforeNavigate alone misses searches typed into the search box of an
// already-open results page: Google and Bing run those through the History API
// instead of a real navigation, so only onHistoryStateUpdated sees them.
chrome.webNavigation.onBeforeNavigate.addListener(enforceSearchSafety);
chrome.webNavigation.onHistoryStateUpdated.addListener(enforceSearchSafety);
chrome.webNavigation.onCommitted.addListener(enforceSearchSafety);

// ── Remember where each tab was going ───────────────────────────────────────
// The static adult rules redirect with a fixed extensionPath, so the blocked
// page can't see which site was blocked. onBeforeNavigate fires with the
// original URL before the redirect, so the page can ask for it here.

chrome.webNavigation.onBeforeNavigate.addListener((details) => {
  if (details.frameId !== 0 || !/^https?:/.test(details.url)) return;
  chrome.storage.session.set({ ['nav_' + details.tabId]: details.url });
});

chrome.tabs.onRemoved.addListener((tabId) => {
  chrome.storage.session.remove('nav_' + tabId);
});

// ── PIN gate on the browser's extension management pages ────────────────────
// With a PIN set, opening the extensions page (where Abrigo could be
// switched off or removed) or the "reset settings" page (which disables every
// extension) sends the tab to a PIN screen instead. The right PIN opens them
// for a few minutes. Extensions can't touch chrome:// pages, but they can see
// a tab navigate to one and send it elsewhere, which is what this does.

const MANAGE_PAGE_RE = /^(chrome|edge|brave|opera|vivaldi):\/\/(extensions|settings\/(extensions|reset|resetProfileSettings))(\/|\?|#|$)/i;
const MANAGE_UNLOCK_MS = 10 * 60 * 1000;

async function gateManagePage(tabId, url) {
  if (!url || !MANAGE_PAGE_RE.test(url)) return;

  const { settings } = await chrome.storage.local.get('settings');
  if (!settings?.pinHash) return;

  const { manageUnlockUntil } = await chrome.storage.session.get('manageUnlockUntil');
  if (manageUnlockUntil && manageUnlockUntil > Date.now()) return;

  chrome.tabs.update(tabId, {
    url: BLOCKED_PAGE + '?cat=manage&reason=manage&domain=' + encodeURIComponent(url.replace(/[?#].*$/, '')) +
         '&target=' + encodeURIComponent(url)
  });
}

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  gateManagePage(tabId, changeInfo.url || (changeInfo.status === 'loading' ? tab.url : null));
});
chrome.tabs.onCreated.addListener((tab) => gateManagePage(tab.id, tab.pendingUrl || tab.url));

// ── Message handler (from popup / options / blocked page) ────────────────────

chrome.runtime.onMessage.addListener((msg, sender, reply) => {
  // Checked here, not in the page, so a page can't grant itself access.
  if (msg.type === 'UNLOCK_MANAGE') {
    (async () => {
      const { settings } = await chrome.storage.local.get('settings');
      const ok = !!settings?.pinHash && settings.pinHash === await hashPin(msg.pin);
      if (ok) await chrome.storage.session.set({ manageUnlockUntil: Date.now() + MANAGE_UNLOCK_MS });
      reply({ ok });
    })();
    return true;
  }

  if (msg.type === 'GET_BLOCKED_URL') {
    const key = 'nav_' + sender.tab?.id;
    chrome.storage.session.get(key).then(r => reply(r[key] || null));
    return true;
  }

  if (msg.type === 'GET_SETTINGS') {
    chrome.storage.local.get('settings').then(({ settings }) => reply(settings));
    return true;
  }

  if (msg.type === 'SET_SETTINGS') {
    chrome.storage.local.set({ settings: msg.settings }).then(() => reply({ ok: true }));
    return true;
  }

  if (msg.type === 'VERIFY_PIN') {
    (async () => {
      const { settings } = await chrome.storage.local.get('settings');
      const ok = settings?.pinHash === await hashPin(msg.pin);
      reply({ ok });
    })();
    return true;
  }

  // Generates a random PIN, hashes it, and locks the core categories + YouTube
  // with it — entirely inside this service worker so the plaintext never
  // crosses the messaging boundary to a page (options/popup), and is never
  // returned to the caller.
  if (msg.type === 'SET_RANDOM_PIN') {
    (async () => {
      const { settings } = await chrome.storage.local.get('settings');
      const s = settings || { ...DEFAULT_SETTINGS, pinHash: null };
      s.pinHash = await hashPin(generateRandomPin());
      s.categories = { ...s.categories, adult: true, gambling: true, social: true };
      s.youtube = 'block';
      await chrome.storage.local.set({ settings: s });
      reply({ ok: true });
    })();
    return true;
  }

  // Content script detected adult content on a page not in static list
  if (msg.type === 'CONTENT_DETECTED') {
    chrome.storage.local.get('detected').then(({ detected }) => {
      const list = detected || [];
      const entry = { host: msg.host, score: msg.score, ts: Date.now() };
      const exists = list.findIndex(e => e.host === msg.host);
      if (exists >= 0) list[exists] = entry; else list.unshift(entry);
      chrome.storage.local.set({ detected: list.slice(0, 100) });
    });
    reply({ ok: true });
    return true;
  }

});

// ── PIN hash (SHA-256 via SubtleCrypto) ──────────────────────────────────────

async function hashPin(pin) {
  const data = new TextEncoder().encode(pin + '_shieldblock');
  const digest = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(digest)).map(b => b.toString(16).padStart(2, '0')).join('');
}

function generateRandomPin(length = 8) {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, b => b % 10).join('');
}
