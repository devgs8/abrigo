// Adult content detector — catches adult pages that aren't in any blocklist.
// Injected at document_start so it's in place before the page renders, then
// scans once the DOM is parsed, again on load, and again after lazy content.
// Skips if: extension disabled, adult category off, already on blocked page, in bypass list.

// Whole-word terms (so "anal" doesn't hit "canal" and "ass" doesn't hit "class").
const ADULT_TERMS = [
  'porn','porno','pornography','xxx','nude','nudes','naked','nudity','nsfw','hentai',
  'ecchi','erotic','erotica','onlyfans','fansly','camgirl','camgirls','sexcam','sex cam',
  'live sex','sex video','sex videos','sex tape','sextape','free sex','hot sex','sex chat',
  'xvideos','xnxx','xhamster','pornhub','milf','milfs','anal','blowjob','handjob','cumshot',
  'creampie','gangbang','deepthroat','threesome','bdsm','fetish','pussy','tits','boobs',
  'big ass','big booty','big tits','big boobs','thick ass','fat ass','twerk','twerking',
  'striptease','stripper','topless','upskirt','masturbation','masturbating','orgasm',
  'hardcore sex','adult video','adult videos','adult content','adults only','18+ only',
  'hot girls','sexy girls','leaked nudes','escort','escorts','rule34','r34','lewd',
  'sexo','nua','nuas','nudez','pelada','peladas','pelado','putaria','safada','safadas',
  'safadinha','gostosa','gostosas','rabuda','peituda','buceta','xota','xoxota','punheta',
  'siririca','boquete','foder','fodendo','transando','novinha','novinhas','putinha',
  'ninfeta','acompanhantes','video porno','videos porno','filme porno','nudinhas',
  'seminua','vazados nudes','conteudo adulto','so para adultos'
];

// Unambiguous even inside other words -- used on the URL, where words run
// together ("bigtitsvideo", "xvideos-br").
const URL_SUBSTRINGS = [
  'porn','xxx','hentai','nsfw','xvideo','xnxx','xhamster','onlyfans','fapello','thothub',
  'camgirl','sexcam','stripchat','chaturbate','bigtits','big-tits','bigboobs','big-boobs',
  'bigass','big-ass','blowjob','cumshot','creampie','gangbang','deepthroat','sextape',
  'sex-video','sexvideo','videoporno','video-porno','putaria','nudes','nudez','pelad',
  'safadas','novinhas','rule34','erotic'
];

const ADULT_RE = new RegExp('(?:^|[^a-z0-9])(' + ADULT_TERMS.map(t => t.replace(/[+]/g, '\\+')).join('|') + ')(?=$|[^a-z0-9])', 'g');

function normalize(text) {
  return (text || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
}

// Distinct terms found in text -- a page repeating one word shouldn't count as
// many signals the way several different explicit words do.
function adultHits(text) {
  const found = new Set();
  for (const m of normalize(text).matchAll(ADULT_RE)) found.add(m[1]);
  return [...found];
}

function countMatches(text) {
  return (normalize(text).match(ADULT_RE) || []).length;
}

// Sites where the word-based detector would misfire: code hosts and stores
// show text ABOUT adult content (blocklists, this extension's own source and
// store page), and account/work tools must never lock someone out. The
// blocklists still apply here -- only the detector stands down.
const TRUSTED_HOSTS = [
  'github.com', 'githubusercontent.com', 'gitlab.com', 'bitbucket.org',
  'stackoverflow.com', 'stackexchange.com', 'developer.chrome.com', 'developer.mozilla.org',
  'chromewebstore.google.com', 'chrome.google.com', 'microsoftedge.microsoft.com',
  'accounts.google.com', 'myaccount.google.com', 'mail.google.com', 'docs.google.com',
  'drive.google.com', 'classroom.google.com', 'login.microsoftonline.com',
  'outlook.live.com', 'outlook.office.com', 'office.com', 'claude.ai'
];

function isTrustedHost(hostname) {
  return TRUSTED_HOSTS.some(d => hostname === d || hostname.endsWith('.' + d));
}

let blocked = false;

async function scanPage() {
  if (isTrustedHost(location.hostname)) return;
  if (blocked) return;
  const BLOCKED_PAGE = chrome.runtime.getURL('/blocked/blocked.html');
  if (location.href.startsWith(BLOCKED_PAGE)) return;

  let settings;
  try {
    settings = await chrome.runtime.sendMessage({ type: 'GET_SETTINGS' });
  } catch { return; }

  if (!settings || !settings.enabled || !settings.categories.adult) return;

  const host = location.hostname.replace(/^www\./, '');

  // Skip if bypassed (1-hour unlock from blocked page)
  const bypassExpiry = settings.bypass?.[host];
  if (bypassExpiry && bypassExpiry > Date.now()) return;

  // --- Score-based detection. Threshold: 30 points. ---
  let score = 0;
  const signals = [];

  // 1. URL (host + path + query)
  const urlLower = normalize(decodeURIComponentSafe(location.href));
  const urlHit = URL_SUBSTRINGS.find(kw => urlLower.includes(kw));
  if (urlHit) { score += 20; signals.push('url:' + urlHit); }

  // 2. Page title
  const titleHits = adultHits(document.title);
  score += titleHits.length * 15;
  titleHits.forEach(h => signals.push('title:' + h));

  // 3. Meta description + keywords + Open Graph
  const meta = (sel) => document.querySelector(sel)?.content || '';
  const metaHits = adultHits([
    meta('meta[name="description"]'), meta('meta[name="keywords"]'),
    meta('meta[property="og:description"]'), meta('meta[property="og:title"]')
  ].join(' | '));
  score += metaHits.length * 10;
  metaHits.forEach(h => signals.push('meta:' + h));

  // meta rating: "adult" or "RTA-5042-1996-1400-1577-RTA" (RTA label used by adult sites)
  const metaRating = meta('meta[name="rating"]').toLowerCase();
  if (metaRating === 'adult' || metaRating.startsWith('rta') || metaRating === 'mature') {
    score += 50;
    signals.push('meta-rating:' + metaRating);
  }
  if (meta('meta[property="og:type"]').toLowerCase() === 'adult') { score += 40; signals.push('og:adult'); }

  // 4. Age-gate / age verification elements
  const ageGate = document.querySelector([
    '[id*="age-gate"]','[class*="age-gate"]','[id*="agegate"]','[class*="agegate"]',
    '[id*="age-verif"]','[class*="age-verif"]','[id*="ageverif"]','[class*="ageverif"]',
    '[id*="age-check"]','[class*="age-check"]','[id*="enter-age"]','[class*="enter-age"]',
    '[id*="adult-check"]','[class*="adult-check"]','[id*="disclaimer-18"]','[class*="over18"]'
  ].join(','));
  if (ageGate) { score += 40; signals.push('age-gate'); }

  // 5. Links -- tube sites are wall-to-wall links to other videos
  let adultLinks = 0;
  for (const a of Array.from(document.querySelectorAll('a[href]')).slice(0, 400)) {
    const href = normalize(a.getAttribute('href'));
    if (adultHits(a.textContent + ' ' + (a.title || '')).length || URL_SUBSTRINGS.some(kw => href.includes(kw))) {
      adultLinks++;
    }
  }
  if (adultLinks >= 4) {
    score += Math.min(adultLinks * 3, 40);
    signals.push('adult-links:' + adultLinks);
  }

  // 6. Image alt/title text -- thumbnails on tube sites describe the video
  let adultImgs = 0;
  for (const img of Array.from(document.images).slice(0, 300)) {
    if (adultHits(img.alt + ' ' + img.title).length) adultImgs++;
  }
  if (adultImgs >= 3) {
    score += Math.min(adultImgs * 4, 40);
    signals.push('adult-images:' + adultImgs);
  }

  // 7. Visible text -- how often explicit words appear in the page body
  const bodyText = (document.body?.innerText || '').slice(0, 40000);
  const bodyCount = countMatches(bodyText);
  if (bodyCount >= 6) {
    score += Math.min(bodyCount * 2, 40);
    signals.push('body-words:' + bodyCount);
  }

  if (score >= 30) {
    blocked = true;
    chrome.runtime.sendMessage({
      type: 'CONTENT_DETECTED',
      host,
      score,
      signals
    });
    location.replace(
      chrome.runtime.getURL('/blocked/blocked.html') +
      '?cat=adult&reason=content&domain=' + encodeURIComponent(host) +
      '&score=' + score
    );
  }
}

function decodeURIComponentSafe(s) {
  try { return decodeURIComponent(s); } catch { return s; }
}

// Scan as soon as the DOM is parsed, again when everything has loaded, and once
// more a little later for pages that fill themselves in with JavaScript.
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', scanPage, { once: true });
} else {
  scanPage();
}
window.addEventListener('load', () => {
  scanPage();
  setTimeout(scanPage, 2500);
}, { once: true });

// Search engines and video sites swap results in via the History API without a
// page load, so the initial scan above would only ever see the first query.
// Re-scan whenever the URL changes, after giving the new results time to render.
let lastUrl = location.href;
let rescanTimer = null;

function onUrlMaybeChanged() {
  if (location.href === lastUrl) return;
  lastUrl = location.href;
  clearTimeout(rescanTimer);
  rescanTimer = setTimeout(scanPage, 600);
}

for (const method of ['pushState', 'replaceState']) {
  const original = history[method];
  history[method] = function (...args) {
    const result = original.apply(this, args);
    onUrlMaybeChanged();
    return result;
  };
}

window.addEventListener('popstate', onUrlMaybeChanged);

// Coalesced to one check per frame — this fires on every DOM mutation, and
// search/feed pages mutate constantly.
let urlCheckScheduled = false;
new MutationObserver(() => {
  if (urlCheckScheduled) return;
  urlCheckScheduled = true;
  requestAnimationFrame(() => {
    urlCheckScheduled = false;
    onUrlMaybeChanged();
  });
}).observe(document, { subtree: true, childList: true });

// ── Lock the search engines' own SafeSearch switch ──────────────────────────
// Bing renders a Strict/Moderate/Off switch right on the results page, so the
// enforced setting is one click away from being turned off. The background
// listener puts it back on the next navigation, but hiding the control stops
// the round trip (and the moment of unfiltered results) entirely.

const SAFESEARCH_OPT_OUT_RE = /adlt=(off|moderate|demote)/i;
const IS_BING = /(^|\.)bing\.com$/i.test(location.hostname);

// Only the link itself is neutralised — never an ancestor. Hiding a parent
// container on a search page can blank out the whole results area, since the
// nearest div is often a top-level wrapper.
function lockSafeSearchControls() {
  if (!IS_BING) return;

  for (const a of document.querySelectorAll('a[href*="adlt="]')) {
    if (!SAFESEARCH_OPT_OUT_RE.test(a.getAttribute('href') || '')) continue;
    a.removeAttribute('href');
    a.style.setProperty('pointer-events', 'none', 'important');
    a.style.setProperty('opacity', '0.4', 'important');
  }
}

// Coalesce to one pass per frame: search pages mutate the DOM continuously, and
// re-scanning every mutation made the page crawl.
let lockScheduled = false;
function scheduleLock() {
  if (lockScheduled) return;
  lockScheduled = true;
  requestAnimationFrame(() => {
    lockScheduled = false;
    lockSafeSearchControls();
  });
}

if (IS_BING) {
  document.addEventListener('click', (event) => {
    const a = event.target?.closest?.('a[href]');
    if (a && SAFESEARCH_OPT_OUT_RE.test(a.getAttribute('href') || '')) {
      event.preventDefault();
      event.stopPropagation();
    }
  }, true);

  lockSafeSearchControls();
  new MutationObserver(scheduleLock).observe(document, { subtree: true, childList: true });
}
