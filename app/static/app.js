"use strict";

// LinkedIn Rebuild demo. Five steps, following Ziad's demo video:
// Choose -> Scan -> Recommend -> Generate -> Email. Every step reads the real files
// a /rebuild run writes in out/<slug>/, through app/server.py.

const $ = (sel, el = document) => el.querySelector(sel);
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const LABEL = { 1: "Headshot", 2: "Website link", 3: "Banner", 4: "About", 5: "Featured", 6: "Headline", 7: "Follow button" };
const FIELD = { 1: "headshot", 2: "website", 3: "banner", 4: "about", 5: "featured", 6: "headline" };
const TILE_ORDER = [3, 1, 6, 2, 7, 4, 5];
const ACTION = {
  1: "Swap in a headshot on a solid color",
  2: "Put a website link under the name",
  3: "Give the banner a message",
  4: "Turn the About into short bullets",
  5: "Pin a real post to Featured",
  6: "Make the headline say what you do",
  7: "Make Follow the main button",
};
const KEYWORDS = { 3: /banner/i, 6: /headline/i, 4: /\babout\b/i, 5: /featured|\bpin\b/i, 2: /website|link under|site there/i, 1: /photo|headshot|picture/i, 7: /follow|connect|button/i };
const SYMBOL = { pass: "✓", fix: "!", unknown: "?" };
const WORD = { pass: "Pass", fix: "Fix", unknown: "Not checked" };
const STEPS = [
  { n: 1, label: "Choose", title: "Choose a profile", sub: "Paste a LinkedIn URL" },
  { n: 2, label: "Scan", title: "Scan and analyze", sub: "7 checks, 90 days of posts" },
  { n: 3, label: "Recommend", title: "Recommend fixes", sub: "Backed by their own data" },
  { n: 4, label: "Generate", title: "Generate the fixes", sub: "Their profile, rebuilt" },
  { n: 5, label: "Email", title: "Email your prospect", sub: "You review. You send." },
];
const ICON = {
  3: '<rect x="3" y="6" width="18" height="12" rx="2"/><path d="M7 14l3-3 3 3 2-2 3 3"/>',
  1: '<circle cx="12" cy="9" r="3.5"/><path d="M5 20c1.5-4.5 12.5-4.5 14 0"/>',
  6: '<path d="M5 8h14M5 12h14M5 16h9"/>',
  2: '<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>',
  7: '<circle cx="10" cy="8" r="3.5"/><path d="M3 19c1-4 10-4 11 0M18 8v6M15 11h6"/>',
  4: '<path d="M9 7h11M9 12h11M9 17h11"/><circle cx="5" cy="7" r="1"/><circle cx="5" cy="12" r="1"/><circle cx="5" cy="17" r="1"/>',
  5: '<path d="M12 3.5l2.6 5.4 5.9.7-4.4 4 1.2 5.9L12 16.6l-5.3 2.9 1.2-5.9-4.4-4 5.9-.7z"/>',
};
const icon = (n) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">${ICON[n]}</svg>`;

const S = {
  step: 1, url: "", button: "", job: null, slug: null, data: null,
  foundShown: false, poll: null, scan: null, typing: null, mailView: "draft", founders: [],
};

// ── Data ────────────────────────────────────────────────────

// The shared app asks for a team key once; it rides along as a header and a cookie (for images)
const KEY_STORE = "lr-team-key";
const storedKey = () => { try { return localStorage.getItem(KEY_STORE) || ""; } catch { return ""; } };

function saveKey(key) {
  try { localStorage.setItem(KEY_STORE, key); } catch { /* the cookie still works */ }
  document.cookie = `appkey=${encodeURIComponent(key)}; path=/; max-age=31536000; SameSite=Lax${location.protocol === "https:" ? "; Secure" : ""}`;
}

let asking = null;
function askKey(note) {
  if (asking) return asking;
  asking = new Promise((resolve) => {
    const box = document.createElement("div");
    box.className = "keywrap";
    box.innerHTML = `<form class="glass keybox"><div class="mono">LINKEDIN REBUILD</div><h3>Team key</h3>
      <p>${esc(note || "Ask Ziad for it. You only enter it once on this browser.")}</p>
      <input type="password" autocomplete="current-password" placeholder="Paste the team key" required>
      <button class="btn primary" type="submit">Enter</button></form>`;
    document.body.append(box);
    box.querySelector("input").focus();
    box.querySelector("form").addEventListener("submit", (e) => {
      e.preventDefault();
      saveKey(box.querySelector("input").value.trim());
      box.remove();
      asking = null;
      resolve();
    });
  });
  return asking;
}

async function api(path, opts = {}) {
  const key = storedKey();
  const res = await fetch(path, { ...opts, headers: { ...(opts.headers || {}), ...(key ? { "X-App-Key": key } : {}) } });
  if (res.status === 401) {
    await askKey(key ? "That key didn't work. Try again." : "");
    return api(path, opts);
  }
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw Object.assign(new Error(body.error || `Request failed (${res.status})`), { status: res.status });
  return body;
}

async function startRun(fresh = false) {
  const url = ($("#url")?.value || S.url).trim();
  if (!url) return;
  S.url = url;
  stopPolling();
  Object.assign(S, { job: null, slug: null, data: null, foundShown: false });
  setStatus("Starting…", "busy");
  $("#found") && ($("#found").innerHTML = "");
  try {
    S.job = await api("/api/run", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ url, button: S.button, fresh }) });
    S.poll = setInterval(tick, 1500);
    tick();
  } catch (err) {
    setStatus(err.message, "err");
  }
}

function stopPolling() {
  if (S.poll) clearInterval(S.poll);
  S.poll = null;
}

async function tick() {
  try {
    if (S.job) S.job = await api(`/api/job/${S.job.id}`);
    if (S.job?.slug) {
      S.slug = S.job.slug;
      S.data = await api(`/api/founder/${S.slug}`);
    }
    if (S.job && ["done", "error"].includes(S.job.stage)) stopPolling();
    onData();
    S.misses = 0;
  } catch (err) {
    // The link to the laptop blips now and then: keep polling through it, and give up only
    // when the laptop has been unreachable for about a minute or the server says no for real
    const blip = !err.status || [502, 503, 504].includes(err.status);
    S.misses = (S.misses || 0) + 1;
    if (blip && S.misses < 40) return setStatus("Reconnecting to the laptop…", "busy");
    const text = blip ? "Can't reach the laptop that runs this. Check it's on and the app is running." : err.message;
    setStatus(text, "err");
    if (S.step > 1) toast(text);
    stopPolling();
  }
}

const ready = (n) => {
  const d = S.data;
  if (n === 1) return true;
  if (!d) return false;
  if (n === 2) return true;
  if (n === 3) return !!d.teardown;
  if (n === 4) return !!d.rebuild;
  return !!d.email;
};

function onData() {
  renderSteps();
  const stage = S.job?.stage;
  if (S.step === 1) {
    if (stage === "error") setStatus(S.job.error, "err");
    else if (stage === "pulling") setStatus("Pulling the profile and posts from LinkedIn. About a minute.", "busy");
    else if (stage === "rebuilding") setStatus("Profile found. Claude is scoring and rewriting it, a few minutes. The scan can start now.", "busy");
    else if (stage === "done") setStatus("Ready.", "ok");
    if (S.data && !S.foundShown) {
      S.foundShown = true;
      showFound();
      // A live run moves on by itself so the scan can start while Claude works; a saved one waits for the presenter
      if (stage !== "done") setTimeout(() => S.step === 1 && go(2), 1600);
    }
  }
  if (S.step === 2) updateWaiting();
  if (S.step === 4) renderFiles();
  if (S.step >= 2 && stage === "error") toast(S.job.error);
}

// ── Navigation ─────────────────────────────────────────────

function renderSteps() {
  $("#steps").innerHTML = STEPS.map((s) => {
    const cls = s.n === S.step ? "active" : ready(s.n) ? "ready" : "locked";
    const done = s.n < S.step && ready(s.n) ? " done" : "";
    return `<button class="pill ${cls}${done}" data-step="${s.n}"><span class="num">${s.n}</span>${s.label}</button>`;
  }).join("");
}

function go(n) {
  if (n < 1 || n > 5 || !ready(n)) return;
  cancelAnimationFrame(S.scan?.raf);
  clearTimeout(S.typing);
  S.step = n;
  renderSteps();
  window.scrollTo({ top: 0, behavior: "smooth" });
  [null, renderChoose, renderScan, renderRecommend, renderGenerate, renderEmail][n]();
}

function caption(n, actions = "") {
  const s = STEPS[n - 1];
  return `<div class="caption"><div><div class="kicker">Step 0${n} / 05</div><h1>${s.title}</h1><p>${s.sub}</p></div><div style="display:flex;gap:10px">${actions}</div></div>`;
}

function nextButton(n, label) {
  const ok = ready(n);
  return `<button class="btn primary" data-go="${n}" ${ok ? "" : "disabled"}>${ok || n === 2 ? label : "Waiting for Claude…"}</button>`;
}

document.addEventListener("click", (e) => {
  const step = e.target.closest("[data-step]");
  if (step) go(+step.dataset.step);
  const next = e.target.closest("[data-go]");
  if (next && !next.disabled) go(+next.dataset.go);
});

document.addEventListener("keydown", (e) => {
  if (e.target.matches("input, textarea")) return;
  if (e.key === "ArrowRight") go(S.step + 1);
  if (e.key === "ArrowLeft" && S.step > 1) go(S.step - 1);
  if (e.key.toLowerCase() === "r" && S.step === 2) renderScan();
});

// ── Step 1: choose ─────────────────────────────────────────

const logo = (h = 40) => `<svg width="${h * 1.44}" height="${h}" viewBox="0 0 46 32" aria-hidden="true"><circle cx="16" cy="16" r="13" fill="#DFDFDC"/><circle cx="30" cy="16" r="13" fill="#B5B5B1"/><path d="M23 4.5 C27.5 7.5 27.5 24.5 23 27.5 C18.5 24.5 18.5 7.5 23 4.5Z" fill="#F1F3F6" opacity="0.9"/></svg>`;

async function renderChoose() {
  $("#app").innerHTML = `<section class="step">
    <div class="hero">${logo(44)}<h1>LinkedIn Rebuild</h1><p>Paste a founder's LinkedIn. Get a better profile and an email worth sending.</p></div>
    <div class="choose win">
      <div class="win-bar"><div class="dots"><i></i><i></i><i></i></div><span class="mono">LinkedIn Rebuild</span></div>
      <div class="inner">
        <div class="mono">NEW REBUILD</div>
        <h2>Whose profile are we rebuilding?</h2>
        <form class="url-row" id="form">
          <label class="url-field"><span class="in-badge">in</span><input id="url" type="url" placeholder="Paste a LinkedIn profile URL" value="${esc(S.url)}" autocomplete="off" spellcheck="false"></label>
          <button class="btn primary" type="submit">Scan profile →</button>
        </form>
        <div class="options">Their main button today
          <div class="seg" id="seg">${[["", "Not checked"], ["follow", "Follow"], ["connect", "Connect"]].map(([v, l]) => `<button type="button" data-v="${v}" class="${S.button === v ? "on" : ""}">${l}</button>`).join("")}</div>
        </div>
        <div id="status"></div>
        <div id="found"></div>
        <p class="fine">A new founder uses about $0.50 of the team's Apify credit, once. Saved founders open instantly.</p>
      </div>
    </div>
    <div class="recent"><div class="mono">SAVED FOUNDERS</div><div class="recent-list" id="recent"></div></div>
    ${caption(1, nextButton(2, "Start the scan →"))}
  </section>`;
  $("#form").addEventListener("submit", (e) => { e.preventDefault(); startRun(false); });
  $("#seg").addEventListener("click", (e) => {
    const b = e.target.closest("button");
    if (!b) return;
    S.button = b.dataset.v;
    $("#seg").querySelectorAll("button").forEach((x) => x.classList.toggle("on", x === b));
  });
  if (S.data) showFound();
  try {
    S.founders = await api("/api/founders");
    $("#recent").innerHTML = S.founders.map((f) => `<button class="recent-item" data-url="${esc(f.url)}">${f.headshot ? `<img src="${esc(f.headshot)}" alt="">` : '<span class="ph"></span>'}${esc(f.name)}${f.done ? "" : ' <span class="chip dim">not built</span>'}</button>`).join("") || '<span class="fine">None yet.</span>';
    $("#recent").addEventListener("click", (e) => {
      const b = e.target.closest("[data-url]");
      if (!b) return;
      $("#url").value = b.dataset.url;
      startRun(false);
    });
  } catch { /* the list is a convenience */ }
}

function setStatus(text, kind) {
  const el = $("#status");
  if (!el) return;
  el.innerHTML = text ? `<div class="status-line ${kind === "err" ? "err" : ""}">${kind === "busy" ? '<span class="spinner"></span>' : ""}${esc(text)}</div>` : "";
}

function showFound() {
  const p = S.data.profile;
  const el = $("#found");
  if (!el) return;
  el.innerHTML = `<div class="found">${p.headshot ? `<img src="${esc(p.headshot)}" alt="">` : '<span class="ph"></span>'}
    <div class="who"><b>${esc(p.name)}</b><div>${esc(p.headline)}</div><small>${esc(p.location || "")}${p.followers != null ? ` · ${p.followers.toLocaleString()} followers` : ""}</small></div>
    <span class="chip pass"><span class="dot"></span>Profile found</span></div>
    ${S.data.files["email.md"] ? '<button class="btn ghost" id="again" style="margin-top:10px;height:32px;font-size:12.5px">Run Claude again on the saved pull</button>' : ""}`;
  $("#again")?.addEventListener("click", () => startRun(true));
  renderSteps();
  const btn = $("[data-go='2']");
  if (btn) { btn.disabled = false; btn.textContent = "Start the scan →"; }
}

// ── The LinkedIn profile, drawn from the data ───────────────

function sides() {
  const d = S.data, p = d.profile, r = d.rebuild;
  const cap = (s) => (s ? s[0].toUpperCase() + s.slice(1).toLowerCase() : null);
  const before = {
    banner: { image: p.banner }, headshot: p.headshot, headline: p.headline, website: p.website,
    about_text: p.about, featured: p.featured, button: cap(r?.button_today), changed: new Set(),
  };
  if (!r) return { before, after: null };
  const keep = (k) => (r[k] === "keep" ? before[k] : r[k]);
  const after = { headshot: keep("headshot"), headline: keep("headline"), website: keep("website"), banner: keep("banner") || {},
    featured: r.featured === "keep" ? before.featured : r.featured, button: "Follow", changed: new Set() };
  if (r.about === "keep") after.about_text = before.about_text; else after.about_list = r.about;
  if (r.featured === null) after.slot = true;
  for (const k of ["headline", "website", "banner", "featured", "headshot"]) {
    if (r[k] !== "keep" && r[k] && JSON.stringify(r[k]) !== JSON.stringify(before[k])) after.changed.add(k);
  }
  if (r.about !== "keep") after.changed.add("about");
  if (before.button === "Connect") after.changed.add("button");
  return { before, after };
}

function profileHTML(side, marks = true) {
  const p = S.data.profile;
  const c = side.changed;
  const attr = (n) => (marks ? ` data-check="${n}"` : "");
  const pill = (k, text) => (c.has(k) ? `<span class="new-pill">${text}</span>` : "");
  const b = side.banner || {};
  let bstyle = b.text ? `background-color:${esc(b.background || "#1d2226")};color:${esc(b.color || "#fff")};` : "";
  if (b.image) bstyle += `background-image:url('${esc(b.image)}');`;
  const words = b.text ? `<div class="words">${c.has("banner") ? '<span class="new-pill" style="margin:0 0 8px">New banner</span>' : ""}<h2>${esc(b.text)}</h2>${b.subtext ? `<p>${esc(b.subtext)}</p>` : ""}</div>` : "";
  const logoImg = b.text && b.logo ? `<img class="logo" src="${esc(b.logo)}" alt="">` : "";
  const headline = c.has("headline") ? `<span class="li-hl">${esc(side.headline)}</span>${pill("headline", "New headline")}` : esc(side.headline);
  const site = side.website ? `<div class="li-site"${attr(2)}>${c.has("website") ? `<span class="li-hl">${esc(side.website)}</span>` : esc(side.website)}${pill("website", "Website added")}</div>`
    : `<div class="li-site empty"${attr(2)}>No website link under the name</div>`;
  const reach = [p.followers != null ? `${p.followers.toLocaleString()} followers` : "", p.connections != null ? (p.connections >= 500 ? "500+ connections" : `${p.connections} connections`) : ""].filter(Boolean).join(" · ");
  const button = side.button ? `<span class="li-btn primary">${side.button === "Follow" ? "+ Follow" : "Connect"}</span>${pill("button", "Follow button")}` : '<span class="li-btn unknown">Follow or Connect?</span>';
  let about;
  if (side.about_list) about = `<ul>${side.about_list.map((x) => `<li>${esc(x)}</li>`).join("")}</ul>`;
  else if (side.about_text) about = esc(side.about_text);
  else about = '<span class="li-empty">No About section</span>';
  let feat;
  if (side.featured) feat = `<div class="li-feat"><div class="img" style="${side.featured.image ? `background-image:url('${esc(side.featured.image)}')` : ""}"></div><div class="kind">Post</div><div class="title">${esc(side.featured.title)}</div></div>`;
  else if (side.slot) feat = '<div class="li-slot">Their best post, pinned here with an image</div>';
  else feat = '<span class="li-empty">Nothing featured</span>';
  const aside = [p.company ? `<div><i style="${p.logo ? `background-image:url('${esc(p.logo)}')` : ""}"></i>${esc(p.company)}</div>` : "", p.school ? `<div><i></i>${esc(p.school)}</div>` : ""].join("");
  return `<div class="li">
    <div class="li-card li-top">
      <div class="li-banner"${attr(3)} style="${bstyle}">${words}${logoImg}</div>
      <div class="li-body">
        <div class="li-avatar"${attr(1)} style="${side.headshot ? `background-image:url('${esc(side.headshot)}')` : ""}"></div>
        <div class="li-main">
          <div class="li-name">${esc(p.name)}</div>
          <div class="li-headline"${attr(6)}>${headline}</div>
          <div class="li-meta">${esc(p.location || "")} · <a>Contact info</a></div>
          ${site}
          <div class="li-reach">${esc(reach)}</div>
          <div class="li-buttons"${attr(7)}>${button}<span class="li-btn outline">Message</span><span class="li-btn plain">More</span></div>
        </div>
        <div class="li-aside">${aside}</div>
      </div>
    </div>
    <div class="li-card li-section"${attr(4)}><h3>About${pill("about", side.about_list ? "Now in bullets" : "Updated")}</h3><div class="li-about">${about}</div></div>
    <div class="li-card li-section"${attr(5)}><h3>Featured${pill("featured", "Pinned post")}</h3>${feat}</div>
  </div>`;
}

// ── Step 2: scan ───────────────────────────────────────────

function renderScan() {
  cancelAnimationFrame(S.scan?.raf);
  const d = S.data;
  const { before } = sides();
  $("#app").innerHTML = `<section class="step">
    <div class="scan-grid">
      <div class="win scan-win" id="scanwin">
        <div class="win-bar"><div class="dots"><i></i><i></i><i></i></div><div class="addr">linkedin.com/in/${esc(d.username)}</div></div>
        <div class="viewport" id="vp"><div class="doc" id="doc">${profileHTML(before)}<div class="scanline" id="sl"></div></div></div>
      </div>
      <div class="glass panel">
        <div class="panel-head">
          <div><div class="mono">teardown.md</div><h3 id="thead">Scoring 7 checks</h3></div>
          <div class="ring"><svg width="58" height="58" viewBox="0 0 58 58"><circle cx="29" cy="29" r="25" fill="none" stroke="rgba(255,255,255,0.1)" stroke-width="4"/><circle id="ringarc" cx="29" cy="29" r="25" fill="none" stroke="#4ade80" stroke-width="4" stroke-linecap="round" stroke-dasharray="157.1" stroke-dashoffset="157.1" style="transition:stroke-dashoffset .5s"/></svg><div class="val"><span id="ringval">0</span><small>/7</small></div></div>
        </div>
        <div class="tiles">${TILE_ORDER.map((n) => `<button class="tile" data-tile="${n}">${icon(n)}${LABEL[n]}</button>`).join("")}
          <div class="legend"><span><i style="background:var(--pass)"></i><b id="npass">0</b>&nbsp;pass</span><span><i style="background:var(--fix)"></i><b id="nfix">0</b>&nbsp;fix</span></div></div>
        <div class="fact" id="fact"><div class="waiting"><span class="spinner"></span>Reading the profile…</div></div>
        <div id="afterscan"></div>
      </div>
    </div>
    ${caption(2, `<button class="btn ghost" id="replay">Replay scan</button>${nextButton(3, "See the fixes →")}`)}
  </section>`;
  $("#replay").addEventListener("click", renderScan);
  document.querySelectorAll("[data-tile]").forEach((t) => t.addEventListener("click", () => focusCheck(+t.dataset.tile)));
  requestAnimationFrame(() => startScan());
}

function result(n) {
  return S.data.teardown?.checks.find((c) => c.n === n);
}

function startScan() {
  const vp = $("#vp"), doc = $("#doc"), line = $("#sl");
  if (!vp) return;
  const base = doc.getBoundingClientRect().top;
  const regions = [...doc.querySelectorAll("[data-check]")].map((el) => {
    const r = el.getBoundingClientRect();
    return { el, n: +el.dataset.check, trigger: r.top - base + Math.min(r.height * 0.55, 70) };
  }).sort((a, b) => a.trigger - b.trigger);
  const height = doc.scrollHeight;
  const scan = (S.scan = { raf: 0, y: 0, last: performance.now(), shown: new Set(), passes: 0, fixes: 0 });
  const speed = Math.max(140, height / 11);  // a full pass takes about 11 seconds, plus a beat per verdict

  const frame = (t) => {
    const dt = Math.min(0.05, (t - scan.last) / 1000);
    scan.last = t;
    if (t < (scan.hold || 0)) { scan.raf = requestAnimationFrame(frame); return; }
    scan.y += speed * dt;
    line.style.top = `${scan.y}px`;
    vp.scrollTop = Math.max(0, Math.min(height - vp.clientHeight, scan.y - vp.clientHeight * 0.5));
    for (const r of regions) {
      if (scan.y < r.trigger || scan.shown.has(r.n)) continue;
      const res = result(r.n);
      if (res) { reveal(r.el, res); scan.shown.add(r.n); scan.hold = t + 420; }
      else if (!r.el.classList.contains("reading")) { r.el.classList.add("reading"); tile(r.n, "active"); }
    }
    if (scan.y >= height) {
      // Done once every check is shown, or after one full pass with the results in hand
      if (scan.shown.size >= regions.length || scan.hadResults) return finishScan();
      scan.hadResults = !!S.data.teardown;
      scan.y = 0;  // Claude hasn't finished scoring: keep reading until it has
      document.querySelectorAll(".tile.active").forEach((t) => t.classList.remove("active"));
    }
    scan.raf = requestAnimationFrame(frame);
  };
  updateWaiting();
  scan.raf = requestAnimationFrame(frame);
}

function tile(n, cls) {
  const t = document.querySelector(`[data-tile="${n}"]`);
  if (!t) return;
  t.classList.remove("active", "pass", "fix", "unknown");
  t.classList.add(cls);
  if (["pass", "fix", "unknown"].includes(cls) && !t.querySelector(".badge")) t.insertAdjacentHTML("beforeend", `<span class="badge">${SYMBOL[cls]}</span>`);
}

function reveal(el, res) {
  el.classList.remove("reading");
  el.classList.add(res.status);
  el.insertAdjacentHTML("beforeend", `<span class="tag ${res.status}">${SYMBOL[res.status]} ${LABEL[res.n]}</span>`);
  tile(res.n, res.status);
  const scan = S.scan;
  if (res.status === "pass") scan.passes++; else scan.fixes++;
  $("#ringval").textContent = scan.passes;
  $("#ringarc").style.strokeDashoffset = 157.1 * (1 - scan.passes / 7);
  $("#npass").textContent = scan.passes;
  $("#nfix").textContent = scan.fixes;
  $("#fact").innerHTML = `<b>${LABEL[res.n]} · ${WORD[res.status]}.</b> ${esc(res.fact)}`;
}

function updateWaiting() {
  if (S.step !== 2 || !$("#fact") || S.data?.teardown) return;
  const secs = S.job?.elapsed || 0;
  const time = `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, "0")}`;
  if (S.scan && S.scan.shown.size === 0 && S.scan.y > 0) {
    $("#fact").innerHTML = `<div class="waiting"><span class="spinner"></span>Claude is scoring the 7 checks against the rubric · ${time}</div>`;
  }
}

function finishScan() {
  const d = S.data, t = d.teardown, st = d.stats || {};
  $("#scanwin")?.classList.add("done");
  setTimeout(() => $("#vp")?.scrollTo({ top: 0, behavior: "smooth" }), 500);
  $("#thead").textContent = `${t.passes} of 7 pass`;
  const fit = t.fit ? `<span class="chip ${t.fit === "Yes" ? "pass" : "fix"}"><span class="dot"></span>${t.fit === "Yes" ? "Fit: founder or CEO" : "Fit: not a founder"}</span>` : "";
  const weekly = d.weekly || [];
  const max = Math.max(1, ...weekly);
  const days = st.days_since_last_post;
  const last = days == null ? "none" : days === 0 ? "today" : `${days}d ago`;
  const chart = st.posts_in_window
    ? `<div class="chart"><div class="mono">posts per week · last 90 days</div><div class="bars">${weekly.map((w, i) => `<i style="height:${Math.max(3, (w / max) * 100)}%;animation-delay:${i * 40}ms" title="${w} posts"></i>`).join("")}</div>
       <div class="kpis"><div class="kpi"><b>${st.posts_in_window}</b><span>posts</span></div><div class="kpi"><b>${last}</b><span>last post</span></div><div class="kpi"><b>${st.avg_reactions ?? "n/a"}</b><span>avg reactions</span></div></div></div>`
    : `<div class="chart"><div class="mono">posts · last 90 days</div><div class="kpis"><div class="kpi"><b>0</b><span>posts in 90 days</span></div><div class="kpi"><b>${last}</b><span>last post</span></div></div></div>`;
  $("#afterscan").innerHTML = `<div style="display:flex;gap:8px;flex-wrap:wrap">${fit}</div>${chart}`;
  $("#fact").innerHTML = `<b>${t.passes} of 7 pass.</b> ${esc(t.fit_note || "")}`;
  renderSteps();
  const btn = $("[data-go='3']");
  if (btn) { btn.disabled = false; btn.textContent = "See the fixes →"; }
}

function focusCheck(n) {
  const el = document.querySelector(`#doc [data-check="${n}"]`);
  const res = result(n);
  if (!el || !res || !S.scan || S.scan.raf && !$("#scanwin").classList.contains("done")) return;
  const vp = $("#vp");
  const top = el.getBoundingClientRect().top - $("#doc").getBoundingClientRect().top;
  vp.scrollTo({ top: Math.max(0, top - 80), behavior: "smooth" });
  $("#fact").innerHTML = `<b>${LABEL[n]} · ${WORD[res.status]}.</b> ${esc(res.fact)}`;
  el.animate([{ filter: "brightness(1)" }, { filter: "brightness(0.9)" }, { filter: "brightness(1)" }], { duration: 700 });
}

// ── Step 3: recommend ──────────────────────────────────────

function plan() {
  const d = S.data, checks = d.teardown.checks;
  const fixes = checks.filter((c) => c.status !== "pass");
  const items = d.email?.items || [];
  const used = new Set(), cards = [];
  for (const text of items) {
    const c = fixes.find((f) => !used.has(f.n) && KEYWORDS[f.n].test(text));
    if (c) { used.add(c.n); cards.push({ check: c, text, inEmail: true }); }
  }
  for (const c of fixes) {
    if (used.has(c.n)) continue;
    const why = c.status === "unknown" ? "Not in the email: the button wasn't checked on the live page."
      : c.n === 2 && d.rebuild?.website === null ? "Not in the email: no website of theirs anywhere in the data."
      : c.n === 5 && d.rebuild?.featured === null ? "Not in the email: they have no post to pin yet."
      : "Not in the email.";
    cards.push({ check: c, text: c.fact, inEmail: false, why });
  }
  return { passes: checks.filter((c) => c.status === "pass"), cards };
}

function mini(n) {
  const { before, after } = sides();
  const p = S.data.profile;
  if (!after) return "";
  if (n === 6) return `<div class="mini"><b>${esc(p.name)}</b><div class="old">${esc(before.headline)}</div><div class="arrow">becomes</div><div class="new">${esc(after.headline)}</div></div>`;
  if (n === 3) {
    const b = after.banner || {};
    return `<div class="mini"><div class="bn" style="${before.banner.image ? `background-image:url('${esc(before.banner.image)}')` : ""}"></div><div class="arrow">becomes</div>
      <div class="bn" style="background-color:${esc(b.background || "#1d2226")};color:${esc(b.color || "#fff")};${b.image ? `background-image:url('${esc(b.image)}')` : ""}">${esc(b.text || "")}</div></div>`;
  }
  if (n === 4) {
    const old = (before.about_text || "No About section").slice(0, 110);
    return `<div class="mini"><div class="old">${esc(old)}${(before.about_text || "").length > 110 ? "…" : ""}</div><div class="arrow">becomes</div><ul>${(after.about_list || []).slice(0, 3).map((x) => `<li>${esc(x)}</li>`).join("")}</ul></div>`;
  }
  if (n === 2) return `<div class="mini"><div class="old">${esc(before.website || "No link under the name")}</div><div class="arrow">becomes</div><div class="new">${esc(after.website || "Nothing yet: no site of theirs found")}</div></div>`;
  if (n === 5) {
    const f = after.featured;
    return `<div class="mini"><div class="old">${before.featured ? esc(before.featured.title) : "Nothing featured"}</div><div class="arrow">becomes</div>${f ? `<div class="new">★ ${esc((f.title || "").slice(0, 90))}</div>` : '<div class="new">An empty slot for their next post</div>'}</div>`;
  }
  if (n === 1) return `<div class="mini"><div class="pillrow">${before.headshot ? `<img src="${esc(before.headshot)}" style="width:54px;height:54px;border-radius:50%;object-fit:cover">` : ""}<span>Same face, on a solid brand color, head and shoulders.</span></div></div>`;
  if (n === 7) return `<div class="mini"><div class="pillrow"><span class="li-btn ${before.button === "Connect" ? "plain" : "unknown"}" style="height:28px;font-size:12.5px;white-space:nowrap">${before.button === "Connect" ? "Connect" : "Not checked"}</span><span class="arrow">→</span><span class="li-btn primary" style="height:28px;font-size:12.5px;white-space:nowrap">+ Follow</span></div><div style="margin-top:10px;color:rgba(0,0,0,.55)">Settings, then main profile button.</div></div>`;
  return "";
}

function renderRecommend() {
  const { passes, cards } = plan();
  const total = cards.filter((c) => c.inEmail).length;
  let k = 0;
  $("#app").innerHTML = `<section class="step">
    <div class="strong">Already strong: ${passes.map((c) => `<span class="chip pass">✓ ${LABEL[c.n]}</span>`).join("") || '<span class="chip dim">nothing yet</span>'}</div>
    <div class="cards">${cards.map((c, i) => {
      const num = c.inEmail ? `<span class="mono">${String(++k).padStart(2, "0")} / ${String(total).padStart(2, "0")}</span>` : "";
      return `<div class="glass card${c.inEmail ? "" : " muted"}" style="animation-delay:${i * 90}ms">
        <div class="top"><span class="chip ${c.check.status === "unknown" ? "unknown" : "fix"}">${c.check.status === "unknown" ? "Check" : "Fix"}</span>${num}</div>
        <h3>${ACTION[c.check.n]}</h3>
        <div class="why">${esc(c.text)}</div>
        ${c.inEmail ? "" : `<div class="in-email">${esc(c.why)}</div>`}
        ${mini(c.check.n)}
      </div>`;
    }).join("")}</div>
    ${caption(3, nextButton(4, "Generate the fixes →"))}
  </section>`;
}

// ── Step 4: generate ───────────────────────────────────────

function renderGenerate() {
  const { before, after } = sides();
  $("#app").innerHTML = `<section class="step">
    <div class="gen-grid">
      <div class="win">
        <div class="win-bar"><div class="dots"><i></i><i></i><i></i></div><span class="mono">before and after · drag the handle to compare</span></div>
        <div class="ba-scroll"><div class="ba" id="ba">
          <div class="layer before-layer">${profileHTML(before, false)}</div>
          <div class="layer after-layer">${profileHTML(after, false)}</div>
          <span class="side-label l">Before</span><span class="side-label r">After</span>
          <div class="handle" id="handle"></div>
        </div></div>
      </div>
      <div class="glass panel" id="filespanel"></div>
    </div>
    ${caption(4, nextButton(5, "Write the email →"))}
  </section>`;
  const ba = $("#ba");
  const size = () => { ba.style.height = `${Math.max(...[...ba.querySelectorAll(".layer")].map((l) => l.offsetHeight))}px`; };
  size();
  setTimeout(size, 400);
  const set = (pct) => ba.style.setProperty("--cut", `${Math.max(0, Math.min(100, pct))}%`);
  let drag = false;
  const move = (e) => { const r = ba.getBoundingClientRect(); set(((e.clientX - r.left) / r.width) * 100); };
  ba.addEventListener("pointerdown", (e) => { drag = true; ba.setPointerCapture(e.pointerId); move(e); });
  ba.addEventListener("pointermove", (e) => drag && move(e));
  ba.addEventListener("pointerup", () => { drag = false; });
  // Sweep once so the change is obvious: all Before, all After, then the middle
  let start = 0;
  const sweep = (t) => {
    if (drag || S.step !== 4) return;
    start = start || t;
    const k = Math.min(1, (t - start) / 2200);
    set(100 * (1 - (1 - Math.cos(Math.PI * k)) / 2));
    if (k < 1) requestAnimationFrame(sweep);
  };
  set(100);
  setTimeout(() => requestAnimationFrame(sweep), 700);
  renderFiles();
}

function renderFiles() {
  const el = $("#filespanel");
  if (!el || !S.data) return;
  const d = S.data, f = d.files;
  const rows = [["teardown.md", "MD", "The 7 checks"], ["rebuild.json", "JSON", "The rewrite"], ["mockup.png", "PNG", "The attachment"], ["email.md", "MD", "The email"]];
  el.innerHTML = `<div><div class="mono">out/${esc(d.slug)}/</div><h3 style="font-size:20px;font-weight:600;letter-spacing:-.02em;margin-top:2px">What the run wrote</h3></div>
    <div class="files">${rows.map(([name, ext, what]) => `<div class="file"><span class="ic">${ext}</span><span class="nm">${name}<br><span style="font-family:var(--font);color:var(--ink-faint)">${what}</span></span>
      ${f[name] ? `<a href="/out/${esc(d.slug)}/${name}" target="_blank">open</a><span class="st" style="color:var(--pass)">✓</span>` : '<span class="spinner"></span>'}</div>`).join("")}</div>
    ${d.check ? `<div class="chip ${d.check.ok ? "pass" : "fix"}"><span class="dot"></span>check.py: ${esc(d.check.summary)}</div>` : ""}
    ${d.mockup ? `<a class="btn ghost" href="${esc(d.mockup)}" download="${esc(d.slug)}-mockup.png">Download mockup.png</a>` : ""}`;
}

// ── Step 5: email ──────────────────────────────────────────

function renderEmail() {
  const d = S.data, m = d.email;
  if (m.none) {
    $("#app").innerHTML = `<section class="step"><div class="glass panel"><h3>${esc(m.none)}</h3><p class="fine">Nothing to pitch: every check passed.</p></div>${caption(5)}</section>`;
    return;
  }
  const notes = [];
  if (d.teardown?.fit === "No") notes.push(["fix", `Not a founder or CEO. ${d.teardown.fit_note}`]);
  if (!d.rebuild?.button_today) notes.push(["unknown", "The main button wasn't checked, so it isn't in the email. Look at their live profile."]);
  for (const n of d.check?.notes || []) notes.push([n.startsWith("FAIL") ? "fix" : "dim", n.replace(/^(WARN|FAIL)\s+/, "")]);
  $("#app").innerHTML = `<section class="step">
    <div class="mail-grid">
      <div>
        <div style="display:flex;justify-content:flex-end;margin-bottom:10px"><div class="toggle" id="view"><button data-v="draft" class="${S.mailView === "draft" ? "on" : ""}">Draft</button><button data-v="inbox" class="${S.mailView === "inbox" ? "on" : ""}">In their inbox</button></div></div>
        <div id="mailview"></div>
      </div>
      <div class="glass notes"><h4>Before you send</h4>
        ${notes.length ? notes.map(([k, t]) => `<div class="item"><span class="chip ${k}" style="flex:none">${k === "fix" ? "!" : k === "unknown" ? "?" : "i"}</span><span>${esc(t)}</span></div>`).join("") : '<div class="item"><span class="chip pass">✓</span><span>Nothing to confirm. check.py is clean.</span></div>'}
        ${d.report ? `<details><summary>Notes from the run</summary><pre>${esc(d.report)}</pre></details>` : ""}
      </div>
    </div>
    ${caption(5)}
  </section>`;
  $("#view").addEventListener("click", (e) => {
    const b = e.target.closest("button");
    if (!b) return;
    S.mailView = b.dataset.v;
    $("#view").querySelectorAll("button").forEach((x) => x.classList.toggle("on", x === b));
    showMail(false);
  });
  showMail(true);
}

function showMail(animate) {
  const d = S.data, m = d.email, p = d.profile;
  clearTimeout(S.typing);
  const el = $("#mailview");
  if (S.mailView === "inbox") {
    el.innerHTML = `<div class="inbox"><div class="hd"><h2>${esc(m.subject)}</h2><div class="from"><i>ZH</i><div><b>Ziad Hassan</b><small>to ${esc(p.first_name || p.name)}</small></div></div></div>
      <div class="bd">${esc(m.body)}${d.mockup ? `<img src="${esc(d.mockup)}" alt="Their profile before and after">` : ""}</div></div>`;
    return;
  }
  el.innerHTML = `<div class="win compose">
    <div class="win-bar"><div class="dots"><i></i><i></i><i></i></div><span class="mono">New message</span></div>
    <div class="rows"><div class="row"><span>To</span>${esc(p.name)}</div><div class="row"><span>Subject</span><b id="subj"></b></div></div>
    <div class="body" id="mbody"></div>
    <div class="attach hidden" id="att">${d.mockup ? `<img src="${esc(d.mockup)}" alt="">` : ""}<div class="meta">mockup.png<small>Their profile today next to the rebuilt one</small></div></div>
    <div class="foot"><button class="btn primary" id="copy">Copy email</button>${d.mockup ? `<a class="btn ghost" href="${esc(d.mockup)}" download="${esc(d.slug)}-mockup.png">Download mockup</a>` : ""}<span class="note">Nothing sends from here. Paste it into your own inbox.</span></div>
  </div>`;
  $("#copy").addEventListener("click", copyEmail);
  if (!animate) {
    $("#subj").textContent = m.subject;
    $("#mbody").textContent = m.body;
    $("#att").classList.remove("hidden");
    return;
  }
  // Type it out, like the video. A click anywhere on the draft finishes it.
  const subj = $("#subj"), body = $("#mbody");
  let i = 0, j = 0, done = false;
  const finish = () => { done = true; subj.textContent = m.subject; body.textContent = m.body; $("#att").classList.remove("hidden"); };
  el.addEventListener("click", (e) => { if (!e.target.closest("button, a")) finish(); }, { once: true });
  const step = () => {
    if (done || S.step !== 5) return;
    if (i < m.subject.length) { i += 2; subj.innerHTML = `${esc(m.subject.slice(0, i))}<span class="caret"></span>`; }
    else if (j < m.body.length) { j += 6; subj.textContent = m.subject; body.innerHTML = `${esc(m.body.slice(0, j))}<span class="caret"></span>`; }
    else return finish();
    S.typing = setTimeout(step, 16);
  };
  step();
}

async function copyEmail() {
  const m = S.data.email;
  const text = `Subject: ${m.subject}\n\n${m.body}`;
  try { await navigator.clipboard.writeText(text); }
  catch {
    const ta = Object.assign(document.createElement("textarea"), { value: text });
    document.body.append(ta); ta.select(); document.execCommand("copy"); ta.remove();
  }
  toast("Email copied. Attach mockup.png and send it from your inbox.");
}

function toast(text) {
  const t = Object.assign(document.createElement("div"), { className: "toast", textContent: text });
  document.body.append(t);
  setTimeout(() => t.remove(), 3200);
}

// A link like /#/jeffrey-bussgang/2 opens a saved founder at that step (handy mid-demo)
async function boot() {
  if (storedKey()) saveKey(storedKey());  // refresh the cookie the images need
  renderSteps();
  const m = location.hash.match(/^#\/([\w-]+)(?:\/(\d))?/);
  if (m) {
    try {
      S.slug = m[1];
      S.data = await api(`/api/founder/${m[1]}`);
      S.url = S.data.url;
      S.foundShown = true;
      return go(+(m[2] || 2));
    } catch (err) { toast(err.message); }
  }
  renderChoose();
}
boot();
