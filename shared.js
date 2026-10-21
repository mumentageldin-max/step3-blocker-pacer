/* Step 3 Pacer — shared module: time helpers, session store, gist sync, sound, wake lock, theme, nav. */
window.Pacer = (() => {
  const KEYS = {
    sessions: "step3pacer.sessions.v1",
    theme: "step3pacer.theme.v1",
    sync: "step3pacer.sync.v1",
    parking: "step3pacer.parking.v1"
  };
  const GIST_FILE = "step3-pacer-sessions.json";

  /* ---------- time ---------- */
  function fmt(sec) {
    sec = Math.max(0, Math.round(sec));
    const m = Math.floor(sec / 60), s = sec % 60;
    return m + ":" + String(s).padStart(2, "0");
  }
  function fmtSigned(sec) { return (sec < 0 ? "−" : "+") + fmt(Math.abs(sec)); }
  function parseMS(str) {
    const m = String(str).trim().match(/^(\d{1,3})(?::([0-5]?\d))?$/);
    if (!m) return null;
    return (+m[1]) * 60 + (m[2] ? +m[2] : 0);
  }
  function todayKey(d) { // local calendar day, YYYY-MM-DD
    d = d ? new Date(d) : new Date();
    const p = n => String(n).padStart(2, "0");
    return d.getFullYear() + "-" + p(d.getMonth() + 1) + "-" + p(d.getDate());
  }
  function fmtDate(iso, withTime) {
    const d = new Date(iso);
    if (isNaN(d)) return "";
    const opts = withTime ? { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" } : { month: "short", day: "numeric" };
    return d.toLocaleString(undefined, opts);
  }
  function fmtDay(iso) {
    const d = new Date(iso);
    if (isNaN(d)) return "";
    return d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
  }
  function newId() { return Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 8); }
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])); }

  /* ---------- storage ---------- */
  function readJSON(key, fallback) {
    try { const raw = localStorage.getItem(key); return raw ? JSON.parse(raw) : fallback; } catch (e) { return fallback; }
  }
  function writeJSON(key, val) {
    try { localStorage.setItem(key, JSON.stringify(val)); return true; } catch (e) { return false; }
  }

  /* ---------- sessions ---------- */
  function loadSessions() {
    const arr = readJSON(KEYS.sessions, []);
    return Array.isArray(arr) ? arr.filter(s => s && s.id && s.type && s.date) : [];
  }
  function saveSessions(arr) { writeJSON(KEYS.sessions, arr); }
  function saveSession(s) {
    const arr = loadSessions();
    s.updatedAt = Date.now();
    const i = arr.findIndex(x => x.id === s.id);
    if (i >= 0) arr[i] = s; else arr.push(s);
    saveSessions(arr);
    return s;
  }
  function deleteSession(id) {
    const arr = loadSessions().filter(x => x.id !== id);
    saveSessions(arr);
  }
  function mergeSessions(a, b) {
    const map = new Map();
    [...a, ...b].forEach(s => {
      if (!s || !s.id) return;
      const cur = map.get(s.id);
      if (!cur || (s.updatedAt || 0) > (cur.updatedAt || 0)) map.set(s.id, s);
    });
    return Array.from(map.values()).sort((x, y) => new Date(x.date) - new Date(y.date));
  }

  /* ---------- theme ---------- */
  function getTheme() { const t = readJSON(KEYS.theme, "system"); return (t === "light" || t === "dark") ? t : "system"; }
  function setTheme(t) { writeJSON(KEYS.theme, t); applyTheme(); }
  function applyTheme() {
    const t = getTheme(), root = document.documentElement;
    if (t === "light" || t === "dark") root.setAttribute("data-theme", t); else root.removeAttribute("data-theme");
  }

  /* ---------- sound / haptics / wake lock ---------- */
  let actx = null, soundOn = true;
  function setSound(on) { soundOn = !!on; }
  function audioInit() {
    try {
      if (!actx) { const C = window.AudioContext || window.webkitAudioContext; if (C) actx = new C(); }
      if (actx && actx.state === "suspended") actx.resume();
    } catch (e) {}
  }
  function tone(f, dur, at, type, g) {
    if (!soundOn || !actx) return;
    try {
      const o = actx.createOscillator(), gn = actx.createGain();
      o.type = type || "triangle"; o.frequency.value = f;
      const t0 = actx.currentTime + (at || 0);
      gn.gain.setValueAtTime(0.0001, t0);
      gn.gain.exponentialRampToValueAtTime(g || 0.12, t0 + 0.012);
      gn.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      o.connect(gn).connect(actx.destination);
      o.start(t0); o.stop(t0 + dur + 0.03);
    } catch (e) {}
  }
  function sfx(kind) {
    audioInit();
    switch (kind) {
      case "start": tone(523, .09); break;
      case "ahead": tone(587, .1); tone(880, .16, .12); break;
      case "behind": tone(330, .14); tone(330, .14, .18); tone(247, .28, .36); break;
      case "flag": tone(440, .07); tone(440, .07, .12); break;
      case "fill": tone(880, .1); tone(880, .1, .15); tone(880, .1, .3); tone(1175, .35, .5); break;
      case "end": tone(523, .5); tone(392, .6, .3); break;
      case "tick": tone(660, .06); break;                                   // correct question done (30 s)
      case "move": tone(494, .12); tone(494, .12, .16); tone(392, .3, .34); break;   // Timer B rang: move or extend
      case "hardmove": tone(392, .15); tone(330, .15, .18); tone(262, .4, .36); break; // extension over: move
      case "stand": tone(523, .12); tone(659, .12, .14); tone(784, .3, .28); break;  // chunk over: stand up
      case "resume": tone(784, .1); tone(659, .1, .12); tone(523, .25, .24); break;  // stand over: sit down
      case "stop": tone(523, .4); tone(392, .4, .3); tone(330, .7, .6); break;       // 90:00 hard stop
    }
  }
  function vibrate(p) { try { if (navigator.vibrate) navigator.vibrate(p); } catch (e) {} }
  let wake = null;
  async function keepAwake() {
    try {
      if (navigator.wakeLock && !wake) {
        wake = await navigator.wakeLock.request("screen");
        wake.addEventListener("release", () => { wake = null; });
      }
    } catch (e) { wake = null; }
  }
  function releaseWake() { try { if (wake) wake.release(); } catch (e) {} wake = null; }

  /* ---------- nav ---------- */
  function renderNav(active) {
    const el = document.getElementById("pnav");
    if (!el) return;
    const items = [["block", "./", "Block"], ["review", "./review.html", "Review"], ["ccs", "./ccs.html", "CCS"], ["stats", "./stats.html", "Stats"]];
    el.className = "pnav";
    el.innerHTML = items.map(([k, href, label]) => '<a href="' + href + '"' + (k === active ? ' aria-current="page"' : "") + ">" + label + "</a>").join("");
  }

  /* ---------- gist sync (optional, per device token) ---------- */
  function getSync() { const s = readJSON(KEYS.sync, {}); return (s && typeof s === "object") ? s : {}; }
  function setSync(obj) { writeJSON(KEYS.sync, obj || {}); }
  async function gh(path, opts) {
    const cfg = getSync();
    const res = await fetch("https://api.github.com" + path, Object.assign({}, opts, {
      headers: Object.assign({
        "Authorization": "Bearer " + cfg.token,
        "Accept": "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28"
      }, (opts && opts.headers) || {})
    }));
    if (!res.ok) {
      let msg = res.status + " " + res.statusText;
      try { const j = await res.json(); if (j && j.message) msg += " — " + j.message; } catch (e) {}
      throw new Error(msg);
    }
    return res.status === 204 ? null : res.json();
  }
  let syncing = false;
  async function syncNow() {
    const cfg = getSync();
    if (!cfg.token) return { ok: false, skipped: true, msg: "No sync token on this device." };
    if (syncing) return { ok: false, skipped: true, msg: "Sync already running." };
    syncing = true;
    try {
      let gistId = cfg.gistId;
      if (!gistId) {
        const list = await gh("/gists?per_page=100");
        const found = (list || []).find(g => g.files && g.files[GIST_FILE]);
        if (found) gistId = found.id;
      }
      let remote = [];
      if (gistId) {
        const g = await gh("/gists/" + gistId);
        const f = g.files && g.files[GIST_FILE];
        if (f) {
          let content = f.content;
          if (f.truncated && f.raw_url) content = await (await fetch(f.raw_url)).text();
          try { const parsed = JSON.parse(content); remote = Array.isArray(parsed) ? parsed : (parsed.sessions || []); } catch (e) { remote = []; }
        }
      }
      const merged = mergeSessions(loadSessions(), remote);
      saveSessions(merged);
      const payload = JSON.stringify({ app: "step3-pacer", savedAt: new Date().toISOString(), sessions: merged });
      if (gistId) {
        await gh("/gists/" + gistId, { method: "PATCH", body: JSON.stringify({ files: { [GIST_FILE]: { content: payload } } }) });
      } else {
        const created = await gh("/gists", { method: "POST", body: JSON.stringify({ description: "Step 3 Pacer — sessions (private)", public: false, files: { [GIST_FILE]: { content: payload } } }) });
        gistId = created.id;
      }
      setSync(Object.assign({}, cfg, { gistId: gistId, lastSync: Date.now(), lastError: "" }));
      return { ok: true, msg: "Synced " + merged.length + " session" + (merged.length === 1 ? "" : "s") + ".", count: merged.length };
    } catch (e) {
      setSync(Object.assign({}, getSync(), { lastError: String(e.message || e) }));
      return { ok: false, msg: "Sync failed: " + (e.message || e) };
    } finally { syncing = false; }
  }
  function syncQuietly() { if (getSync().token) syncNow().catch(() => {}); }

  /* ---------- parking lot (shared across pages) ---------- */
  function loadParking() { const a = readJSON(KEYS.parking, []); return Array.isArray(a) ? a : []; }
  function saveParking(a) { writeJSON(KEYS.parking, a); }

  const standalone = () => { try { return window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone === true; } catch (e) { return false; } };

  return { KEYS, fmt, fmtSigned, parseMS, todayKey, fmtDate, fmtDay, newId, esc, readJSON, writeJSON,
    loadSessions, saveSessions, saveSession, deleteSession, mergeSessions,
    getTheme, setTheme, applyTheme, setSound, audioInit, sfx, vibrate, keepAwake, releaseWake,
    renderNav, getSync, setSync, syncNow, syncQuietly, loadParking, saveParking, standalone };
})();
