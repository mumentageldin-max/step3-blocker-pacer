/* Step 3 Pacer — shared module: time helpers, session store, gist sync, sound, wake lock, theme, nav,
   device id, live sync of a run in progress, background helpers (catch-up, notifications, keep-alive, PiP). */
window.Pacer = (() => {
  const KEYS = {
    sessions: "step3pacer.sessions.v1",
    theme: "step3pacer.theme.v1",
    sync: "step3pacer.sync.v1",
    parking: "step3pacer.parking.v1",
    device: "step3pacer.device.v1",
    volume: "step3pacer.volume.v1",
    bg: "step3pacer.background.v1"
  };
  const GIST_FILE = "step3-pacer-sessions.json";
  const LIVE_FILE = "step3-pacer-live.json";

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
  function fmtClock(ms, withSec) { // wall-clock time of day, e.g. 10:14 or 10:14:03
    const d = new Date(ms);
    if (isNaN(d)) return "";
    return d.toLocaleTimeString(undefined, withSec ? { hour: "numeric", minute: "2-digit", second: "2-digit" } : { hour: "numeric", minute: "2-digit" });
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

  /* ---------- device ---------- */
  const UA = (typeof navigator !== "undefined" && navigator.userAgent) || "";
  const isIOS = /iPhone|iPad|iPod/.test(UA) || (/Macintosh/.test(UA) && typeof navigator !== "undefined" && navigator.maxTouchPoints > 1);
  const isAndroid = /Android/.test(UA);
  function defaultDeviceName() {
    if (/iPad/.test(UA) || (/Macintosh/.test(UA) && navigator.maxTouchPoints > 1)) return "iPad";
    if (/iPhone|iPod/.test(UA)) return "iPhone";
    if (isAndroid) return "Android";
    if (/Macintosh|Mac OS/.test(UA)) return "Mac";
    if (/Windows/.test(UA)) return "Windows PC";
    return "Device";
  }
  function device() {
    let d = readJSON(KEYS.device, null);
    if (!d || typeof d !== "object" || !d.id) { d = { id: newId(), name: defaultDeviceName() }; writeJSON(KEYS.device, d); }
    if (!d.name) d.name = defaultDeviceName();
    return d;
  }
  function setDeviceName(name) { const d = device(); d.name = String(name || "").trim() || defaultDeviceName(); writeJSON(KEYS.device, d); return d; }

  /* ---------- sound / haptics / wake lock ---------- */
  let actx = null, soundOn = true;
  const VOLUMES = { normal: 1, quiet: 0.5, whisper: 0.25 };
  function getVolume() { const v = readJSON(KEYS.volume, "normal"); return VOLUMES[v] ? v : "normal"; }
  function setVolume(v) { if (VOLUMES[v]) writeJSON(KEYS.volume, v); }
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
      const t0 = actx.currentTime + (at || 0), peak = Math.max(0.0005, (g || 0.12) * VOLUMES[getVolume()]);
      gn.gain.setValueAtTime(0.0001, t0);
      gn.gain.exponentialRampToValueAtTime(peak, t0 + 0.012);
      gn.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      o.connect(gn).connect(actx.destination);
      o.start(t0); o.stop(t0 + dur + 0.03);
    } catch (e) {}
  }
  const SFX = {
    start: () => { tone(523, .09); },
    ahead: () => { tone(587, .1); tone(880, .16, .12); },
    behind: () => { tone(330, .14); tone(330, .14, .18); tone(247, .28, .36); },
    flag: () => { tone(440, .07); tone(440, .07, .12); },
    fill: () => { tone(880, .1); tone(880, .1, .15); tone(880, .1, .3); tone(1175, .35, .5); },
    end: () => { tone(523, .5); tone(392, .6, .3); },
    tick: () => { tone(660, .06); },                                          // correct question done (30 s)
    move: () => { tone(494, .12); tone(494, .12, .16); tone(392, .3, .34); },   // Timer B rang: move or extend
    hardmove: () => { tone(392, .15); tone(330, .15, .18); tone(262, .4, .36); }, // extension over: move
    stand: () => { tone(523, .12); tone(659, .12, .14); tone(784, .3, .28); },  // chunk over: stand up
    resume: () => { tone(784, .1); tone(659, .1, .12); tone(523, .25, .24); },  // stand over: sit down
    stop: () => { tone(523, .4); tone(392, .4, .3); tone(330, .7, .6); },       // 90:00 hard stop
    /* the 1:52 question budget: a soft sine triplet, the only sine sound in the app */
    budget: () => { tone(523, .14, 0, "sine", .07); tone(659, .14, .16, "sine", .07); tone(523, .3, .32, "sine", .07); },
    /* CCS phases: soft sine pairs, rising for a new phase, falling for the close phase */
    phase: () => { tone(659, .12, 0, "sine", .08); tone(880, .22, .14, "sine", .08); },
    close: () => { tone(880, .12, 0, "sine", .08); tone(659, .12, .14, "sine", .08); tone(523, .3, .28, "sine", .08); },
    /* the Day page: a rising four-note arpeggio with a held top note, played twice — the only melody in the app, so a
       step's end is never mistaken for a block, review or case sound. dayPart = one pass for a part inside a step
       (case → feedback, chunk → stand); dayWarn = two soft notes one minute before the end. */
    day: () => { [0, 1.15].forEach(o => { [[523, 0], [659, .13], [784, .26], [1047, .39]].forEach(([f, at]) => { tone(f, .14, o + at, "triangle", .13); tone(f / 2, .14, o + at, "sine", .05); }); tone(1047, .55, o + .55, "triangle", .13); tone(523, .55, o + .55, "sine", .06); }); },
    dayPart: () => { [[523, 0], [659, .13], [784, .26]].forEach(([f, at]) => tone(f, .14, at, "triangle", .12)); tone(784, .4, .42, "triangle", .12); },
    dayWarn: () => { tone(784, .16, 0, "sine", .07); tone(659, .3, .2, "sine", .07); }
  };
  function sfx(kind) { audioInit(); const f = SFX[kind]; if (f) f(); }
  function sfxLater(kinds, gapMs) { // several chimes one after the other (catch-up after being hidden)
    (kinds || []).forEach((k, i) => setTimeout(() => api.sfx(k), i * (gapMs || 700)));
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
    const items = [["day", "./day.html", "Day"], ["block", "./", "Block"], ["review", "./review.html", "Review"], ["ccs", "./ccs.html", "CCS"], ["stats", "./stats.html", "Stats"]];
    el.className = "pnav";
    el.innerHTML = items.map(([k, href, label]) => '<a href="' + href + '"' + (k === active ? ' aria-current="page"' : "") + ">" + label + "</a>").join("");
  }

  /* ---------- notices (one-line banners at the top of the page) ---------- */
  function notice(text, kind, ms) {
    let box = document.getElementById("pnotices");
    if (!box) { box = document.createElement("div"); box.id = "pnotices"; box.className = "pnotices"; box.setAttribute("aria-live", "polite"); document.body.appendChild(box); }
    const n = document.createElement("div"); n.className = "pnotice " + (kind || "info");
    const t = document.createElement("span"); t.textContent = text; n.appendChild(t);
    const x = document.createElement("button"); x.type = "button"; x.textContent = "×"; x.setAttribute("aria-label", "Dismiss"); x.addEventListener("click", () => n.remove()); n.appendChild(x);
    box.appendChild(n);
    setTimeout(() => { if (n.parentNode) n.remove(); }, ms || 20000);
    return n;
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
  async function fileContent(g, name) {
    const f = g && g.files && g.files[name];
    if (!f) return null;
    let content = f.content;
    if (f.truncated && f.raw_url) content = await (await fetch(f.raw_url)).text();
    return content;
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
        const content = await fileContent(g, GIST_FILE);
        if (content != null) {
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
      setSync(Object.assign({}, getSync(), { gistId: gistId, lastSync: Date.now(), lastError: "" }));
      return { ok: true, msg: "Synced " + merged.length + " session" + (merged.length === 1 ? "" : "s") + ".", count: merged.length };
    } catch (e) {
      setSync(Object.assign({}, getSync(), { lastError: String(e.message || e) }));
      return { ok: false, msg: "Sync failed: " + (e.message || e) };
    } finally { syncing = false; }
  }
  function syncQuietly() { if (getSync().token) syncNow().catch(() => {}); }

  /* ---------- live sync: the run in progress, shared through a second file in the same gist ----------
     Slot per page type: { state, deviceId, deviceName, savedAt, done }. The remote slot wins when it is newer
     than the local run and came from another device; a finished run is pushed with done:true so that other
     devices stop reviving it. Nothing here ever blocks the UI: one pull on load / on becoming visible, one every
     60 s while a run is active, one push (debounced 2 s) after a state change. */
  const live = (() => {
    let B = null;                       // the page binding
    let doc = null, pushTimer = 0, lastPushedStr = "", lastPushAt = 0, lastTouch = 0, lastError = "", pulling = false, pushing = false, pollN = 0;
    const STALE = 6 * 3600 * 1000;
    function on() { return !!getSync().token; }
    function status(text, cls) {
      const el = B && B.statusEl;
      if (!el) return;
      if (text == null) {
        if (!on()) { text = "Live sync off — add the token in Stats"; cls = "off"; }
        else if (lastError) { text = "Live sync: " + lastError; cls = "bad"; }
        else text = "Live sync on" + (lastPushAt ? " · last push " + fmtClock(lastPushAt, true) : "");
      }
      el.textContent = text; el.className = "livestatus " + (cls || "");
    }
    async function ensureGist() {
      const cfg = getSync();
      if (!cfg.token) return null;
      if (cfg.gistId) return cfg.gistId;
      await syncNow();
      return getSync().gistId || null;
    }
    async function fetchDoc() {
      const id = await ensureGist();
      if (!id) return null;
      const g = await gh("/gists/" + id);
      const content = await fileContent(g, LIVE_FILE);
      let d = {};
      if (content) { try { d = JSON.parse(content) || {}; } catch (e) { d = {}; } }
      doc = (d && typeof d === "object") ? d : {};
      return doc;
    }
    function slotFor() {
      const st = B.get(), me = device();
      return { state: st, deviceId: me.id, deviceName: me.name, savedAt: Date.now(), done: !B.active(), type: B.type };
    }
    async function push() {
      if (!B || !on()) { status(); return; }
      if (pushing) { touch(); return; }
      const slot = slotFor(), str = JSON.stringify(slot.state) + "|" + slot.done;
      if (str === lastPushedStr) return;
      pushing = true;
      try {
        const d = (await fetchDoc()) || {};
        d[B.type] = slot;
        const id = getSync().gistId;
        await gh("/gists/" + id, { method: "PATCH", body: JSON.stringify({ files: { [LIVE_FILE]: { content: JSON.stringify(d) } } }) });
        doc = d; lastPushedStr = str; lastPushAt = Date.now(); lastError = "";
      } catch (e) { lastError = String(e.message || e); }
      finally { pushing = false; status(); }
    }
    function touch() { // state changed: schedule a push
      lastTouch = Date.now();
      if (!B || !on()) return;
      clearTimeout(pushTimer); pushTimer = setTimeout(push, 2000);
    }
    function consider(slot) { // adopt the remote run?
      if (!slot || !slot.state || slot.deviceId === device().id) return false;
      if (!slot.savedAt || Date.now() - slot.savedAt > STALE) return false;
      if (Date.now() - lastTouch < 4000) return false;                 // mid-interaction here: next pull
      const local = B.get(), localAt = (local && local.updatedAt) || 0;
      if (slot.savedAt <= localAt) return false;
      const localActive = B.active();
      const sameRun = localActive && B.idOf && B.idOf(local) && B.idOf(local) === B.idOf(slot.state);
      if (slot.done && !sameRun) return false;                            // a finished run elsewhere; nothing to pick up
      if (localActive && !sameRun && !(slot.state.updatedAt > localAt)) return false;
      return true;
    }
    async function pull(reason) {
      if (!B || !on() || pulling) { status(); return; }
      pulling = true;
      try {
        const d = await fetchDoc();
        lastError = "";
        const slot = d && d[B.type];
        if (consider(slot)) {
          lastPushedStr = JSON.stringify(slot.state) + "|" + slot.done;  // no echo push of what we just adopted
          B.apply(slot.state, slot);
          if (!slot.done) {
            const when = slot.state.startAt ? " at " + fmtClock(slot.state.startAt) : "";
            notice("Picked up the " + B.noun + " you started on your " + (slot.deviceName || "other device") + when + ".", "good");
          } else notice("The " + B.noun + " was finished on your " + (slot.deviceName || "other device") + ".", "info");
        }
      } catch (e) { lastError = String(e.message || e); }
      finally { pulling = false; status(); }
    }
    function bind(b) {
      B = b; B.noun = B.noun || B.type;
      status();
      document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") pull("visible"); });
      setInterval(() => {
        if (document.hidden || !on()) return;
        pollN++;
        if (B.active() || pollN % 2 === 0) pull("poll");
      }, 60000);
      setTimeout(() => pull("load"), 300);
    }
    function clear() { // the run finished and was saved: tell the other devices right away
      lastTouch = Date.now();
      if (!B || !on()) return;
      clearTimeout(pushTimer); push();
    }
    function peek() { return doc; }          // the last live document fetched (all slots), or null
    return { bind, touch, pull, clear, on, status, peek };
  })();

  /* ---------- background: catch-up on return, notifications while hidden, keep-alive audio, PiP ----------
     Pages give a list of time-based events for the current run ({el (sec), title, body, sfx, important, mark}).
     On becoming visible, the events that fell between the last time the page was seen and now are reported in
     a banner and chimed once each (mark() sets the page's own "already chimed" flag so tick() stays quiet). */
  function getBg() { const b = readJSON(KEYS.bg, {}); return (b && typeof b === "object") ? b : {}; }
  function setBg(patch) { writeJSON(KEYS.bg, Object.assign({}, getBg(), patch || {})); }
  const standalone = () => { try { return window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone === true; } catch (e) { return false; } };

  /* notifications */
  function notifSupported() { return typeof Notification !== "undefined" && "serviceWorker" in navigator; }
  function notifStatus() { // granted | denied | default | unsupported | home-screen
    if (!notifSupported()) return isIOS && !standalone() ? "home-screen" : "unsupported";
    try { return Notification.permission; } catch (e) { return "unsupported"; }
  }
  async function notifRequest() {
    if (!notifSupported()) return notifStatus();
    try { const r = await Notification.requestPermission(); return r; } catch (e) {
      try { return await new Promise(res => Notification.requestPermission(res)); } catch (e2) { return notifStatus(); }
    }
  }
  let notifTimers = [];
  async function swReg() { // the registration, or null after 1.5 s (no worker registered yet, e.g. a plain Safari tab)
    try {
      if (!("serviceWorker" in navigator)) return null;
      return await Promise.race([navigator.serviceWorker.ready, new Promise(res => setTimeout(() => res(null), 1500))]);
    } catch (e) { return null; }
  }
  async function showNotif(ev) {
    const opts = { body: ev.body || "", tag: ev.tag || ev.title, renotify: true, icon: "./icons/icon-192.png", badge: "./icons/icon-192.png",
      vibrate: ev.important ? [300, 120, 300, 120, 600] : [150, 80, 150], requireInteraction: !!ev.important, silent: false, data: { url: location.href } };
    try {
      const reg = await swReg();
      if (reg && reg.showNotification) { await reg.showNotification(ev.title, opts); return true; }
    } catch (e) {}
    try { new Notification(ev.title, opts); return true; } catch (e) { return false; }
  }
  function swPost(msg) { try { if (navigator.serviceWorker && navigator.serviceWorker.controller) navigator.serviceWorker.controller.postMessage(msg); } catch (e) {} }
  function notifArm(events) { // schedule the upcoming events while the page is hidden (page timers + service worker, best effort)
    notifDisarm();
    if (!getBg().notify || notifStatus() !== "granted") return;
    const now = Date.now(), list = (events || []).filter(e => e.at > now && e.at - now < 6 * 3600 * 1000);
    list.forEach(e => {
      const t = setTimeout(() => { showNotif(e); swPost({ type: "fired", tag: e.tag || e.title }); }, e.at - now);
      notifTimers.push(t);
    });
    swPost({ type: "schedule", url: location.href, events: list.map(e => ({ at: e.at, tag: e.tag || e.title, title: e.title, body: e.body || "", important: !!e.important })) });
  }
  async function notifDisarm() {
    notifTimers.forEach(clearTimeout); notifTimers = [];
    swPost({ type: "cancel" });
    try { const reg = await swReg(); if (reg && reg.getNotifications) (await reg.getNotifications()).forEach(n => { try { n.close(); } catch (e) {} }); } catch (e) {}
  }

  /* keep-alive audio (Android): a near-silent loop with Media Session metadata keeps the tab from being throttled */
  let kaAudio = null, kaWanted = false, kaLabel = "";
  function silentWav() { // 1 s, 8 kHz, 8-bit mono, ±1 LSB so it is not flagged as pure silence
    const rate = 8000, n = rate, header = 44, buf = new Uint8Array(header + n);
    const s = (o, str) => { for (let i = 0; i < str.length; i++) buf[o + i] = str.charCodeAt(i); };
    const u32 = (o, v) => { buf[o] = v & 255; buf[o + 1] = (v >> 8) & 255; buf[o + 2] = (v >> 16) & 255; buf[o + 3] = (v >> 24) & 255; };
    const u16 = (o, v) => { buf[o] = v & 255; buf[o + 1] = (v >> 8) & 255; };
    s(0, "RIFF"); u32(4, 36 + n); s(8, "WAVE"); s(12, "fmt "); u32(16, 16); u16(20, 1); u16(22, 1); u32(24, rate); u32(28, rate); u16(32, 1); u16(34, 8); s(36, "data"); u32(40, n);
    for (let i = 0; i < n; i++) buf[header + i] = 128 + ((i % 400) < 200 ? 1 : 0);
    let bin = ""; for (let i = 0; i < buf.length; i++) bin += String.fromCharCode(buf[i]);
    return "data:audio/wav;base64," + btoa(bin);
  }
  function keepAliveStart(label) {
    kaWanted = true; kaLabel = label || "running";
    if (!getBg().keepAlive) return false;
    try {
      if (!kaAudio) { kaAudio = new Audio(silentWav()); kaAudio.loop = true; kaAudio.volume = 0.01; kaAudio.setAttribute("playsinline", ""); }
      const p = kaAudio.play(); if (p && p.catch) p.catch(() => {});
      if ("mediaSession" in navigator) {
        try {
          navigator.mediaSession.metadata = new MediaMetadata({ title: "Step 3 Pacer", artist: kaLabel, album: "running in the background" });
          navigator.mediaSession.playbackState = "playing";
          ["play", "pause", "stop"].forEach(a => { try { navigator.mediaSession.setActionHandler(a, () => {}); } catch (e) {} });
        } catch (e) {}
      }
      return true;
    } catch (e) { return false; }
  }
  function keepAliveStop() {
    kaWanted = false;
    try { if (kaAudio) { kaAudio.pause(); } } catch (e) {}
    try { if ("mediaSession" in navigator) { navigator.mediaSession.playbackState = "none"; navigator.mediaSession.metadata = null; } } catch (e) {}
  }
  function keepAliveActive() { return !!(kaAudio && !kaAudio.paused); }
  // a run restored after a reload cannot start audio without a gesture: the first tap on the page starts it
  document.addEventListener("pointerdown", () => { if (kaWanted && !keepAliveActive()) keepAliveStart(kaLabel); }, { capture: true, passive: true });

  /* picture-in-picture floating timer: a canvas drawn once a second, streamed into a muted video */
  let pip = null;
  function pipSupported() {
    try {
      const v = document.createElement("video"), c = document.createElement("canvas");
      if (!c.captureStream) return false;
      if (document.pictureInPictureEnabled && v.requestPictureInPicture) return true;
      if (typeof v.webkitSetPresentationMode === "function" && typeof v.webkitSupportsPresentationMode === "function" && v.webkitSupportsPresentationMode("picture-in-picture")) return true;
    } catch (e) {}
    return false;
  }
  function pipActive() { return !!(pip && pip.on); }
  function pipDraw() {
    if (!pip) return;
    const d = pip.draw() || {}, c = pip.canvas, ctx = c.getContext("2d"), W = c.width, H = c.height;
    const dark = (document.documentElement.getAttribute("data-theme") === "dark") || (!document.documentElement.getAttribute("data-theme") && window.matchMedia("(prefers-color-scheme: dark)").matches);
    ctx.fillStyle = dark ? "#0E141B" : "#F3F5F8"; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = d.color || (dark ? "#E6ECF3" : "#13202C");
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.font = "700 " + Math.round(H * 0.46) + "px 'Martian Mono', Menlo, monospace";
    ctx.fillText(d.clock || "", W / 2, H * 0.42);
    ctx.font = "700 " + Math.round(H * 0.13) + "px 'Atkinson Hyperlegible', system-ui, sans-serif";
    ctx.fillStyle = d.color || (dark ? "#92A2B4" : "#5A6A7B");
    ctx.fillText(d.label || "", W / 2, H * 0.8);
  }
  async function pipStart(draw) {
    if (!pipSupported()) return false;
    try {
      if (!pip) {
        const canvas = document.createElement("canvas"); canvas.width = 480; canvas.height = 270;
        const video = document.createElement("video"); video.muted = true; video.playsInline = true; video.setAttribute("playsinline", ""); video.autoplay = true;
        video.style.cssText = "position:fixed;width:1px;height:1px;opacity:0;pointer-events:none;left:-10px;top:-10px";
        document.body.appendChild(video);
        pip = { canvas, video, draw, on: false, iv: 0 };
        video.srcObject = canvas.captureStream(2);
        video.addEventListener("leavepictureinpicture", () => { pip.on = false; });
        video.addEventListener("webkitpresentationmodechanged", () => { pip.on = video.webkitPresentationMode === "picture-in-picture"; });
      }
      pip.draw = draw; pipDraw();
      clearInterval(pip.iv); pip.iv = setInterval(pipDraw, 500);
      await pip.video.play();
      if (pip.video.requestPictureInPicture) await pip.video.requestPictureInPicture();
      else pip.video.webkitSetPresentationMode("picture-in-picture");
      pip.on = true;
      return true;
    } catch (e) { if (pip) pip.on = false; return false; }
  }
  async function pipStop() {
    if (!pip) return;
    try { if (document.pictureInPictureElement) await document.exitPictureInPicture(); else if (pip.video.webkitSetPresentationMode) pip.video.webkitSetPresentationMode("inline"); } catch (e) {}
    clearInterval(pip.iv); pip.on = false;
  }

  /* the binding each pacer page makes */
  const bg = (() => {
    let B = null, lastSeenAt = Date.now(), armed = false;
    function seen() { lastSeenAt = Date.now(); }
    function catchUp(why) {
      if (!B) return;
      const now = Date.now(), then = lastSeenAt; lastSeenAt = now;
      if (now - then < 2500 || !B.running()) return;
      const elThen = B.elapsedAt(then), elNow = B.elapsedAt(now);
      // events that fell in the gap and were not already chimed by a throttled tick while hidden (fired() says so)
      const missed = B.events().filter(e => e.el > elThen && e.el <= elNow && !(e.fired && e.fired()));
      if (!missed.length) return;
      missed.forEach(e => { try { if (e.mark) e.mark(); } catch (err) {} });
      sfxLater(missed.map(e => e.sfx).filter(Boolean), 700);
      const at = e => (B.epochOf ? " at " + fmtClock(B.epochOf(e.el)) : "");
      notice("While you were away (" + fmt((now - then) / 1000) + "): " + missed.map(e => e.title + at(e)).join(" · "), "warn", 30000);
      if (B.after) B.after(missed);
    }
    function hidden() {
      lastSeenAt = Date.now();
      if (!B || !B.running()) return;
      const nowEl = B.elapsedAt(Date.now());
      const list = B.events().filter(e => e.el > nowEl && B.epochOf).map(e => ({ at: B.epochOf(e.el), tag: B.type + ":" + (e.tag || e.title), title: e.title, body: e.body || (B.label ? B.label() : ""), important: !!e.important }));
      notifArm(list); armed = true;
    }
    function visible() { if (armed) { notifDisarm(); armed = false; } catchUp("visible"); }
    function bind(b) {
      B = b;
      setInterval(() => { if (!document.hidden) seen(); }, 1000);
      document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") visible(); else hidden(); });
      window.addEventListener("focus", () => { if (!document.hidden) catchUp("focus"); });
      window.addEventListener("pageshow", () => { if (!document.hidden) catchUp("pageshow"); });
    }
    function runStart(label) { keepAliveStart(label); }
    function runEnd() { keepAliveStop(); if (armed) { notifDisarm(); armed = false; } }
    return { bind, runStart, runEnd, catchUp };
  })();

  /* the shared "Background" settings block (notifications, keep-alive, chime volume) rendered into a page's settings */
  function renderBgSettings(container, opts) {
    if (!container) return;
    opts = opts || {};
    const cfg = getBg();
    container.innerHTML =
      '<div class="bgset">' +
      '<label class="check wide"><input type="checkbox" id="bgNotify"' + (cfg.notify ? " checked" : "") + '> Notify me when the app is hidden (checkpoints, warnings, timer ends)</label>' +
      '<div class="formrow"><button type="button" class="small" id="bgNotifBtn">Allow notifications</button><span class="note" id="bgNotifStatus"></span></div>' +
      (isIOS ? "" : '<label class="check wide"><input type="checkbox" id="bgKeep"' + (cfg.keepAlive ? " checked" : "") + '> Keep running in the background (Android): a silent audio track keeps the chimes on time</label>') +
      '<label>Chime volume<select id="bgVolume"><option value="normal">Normal · library</option><option value="quiet">Quiet</option><option value="whisper">Whisper</option></select></label>' +
      (opts.note ? '<p class="note">' + opts.note + "</p>" : "") +
      "</div>";
    const st = () => {
      const s = notifStatus(), el = container.querySelector("#bgNotifStatus"), btn = container.querySelector("#bgNotifBtn");
      el.textContent = s === "granted" ? "Notifications allowed on this device." : s === "denied" ? "Blocked in the browser settings for this site." : s === "home-screen" ? "On iPad / iPhone: open the pacer from the Home Screen icon, then allow." : s === "unsupported" ? "Not supported in this browser." : "Not asked yet.";
      el.className = "note " + (s === "granted" ? "ok" : s === "denied" ? "bad" : "");
      btn.hidden = s === "granted" || s === "unsupported" || s === "home-screen";
    };
    st();
    container.querySelector("#bgNotify").addEventListener("change", async e => {
      setBg({ notify: e.target.checked });
      if (e.target.checked && notifStatus() === "default") { await notifRequest(); st(); }
    });
    container.querySelector("#bgNotifBtn").addEventListener("click", async () => { await notifRequest(); st(); });
    const keep = container.querySelector("#bgKeep");
    if (keep) keep.addEventListener("change", e => { setBg({ keepAlive: e.target.checked }); if (!e.target.checked) keepAliveStop(); else if (kaWanted) keepAliveStart(kaLabel); });
    const vol = container.querySelector("#bgVolume"); vol.value = getVolume();
    vol.addEventListener("change", () => { setVolume(vol.value); audioInit(); sfx("budget"); });
  }

  /* ---------- parking lot (shared across pages) ---------- */
  function loadParking() { const a = readJSON(KEYS.parking, []); return Array.isArray(a) ? a : []; }
  function saveParking(a) { writeJSON(KEYS.parking, a); }

  /* ---------- breaks (shared across pages) ----------
     The day's rule: 20 minutes after a task (a block, a review, a CCS case with its feedback), 10 minutes after
     a 30-minute review chunk (that one lives in the Review page's stand timer). A task break starts by itself
     when the task ends, is shown as a band on every pacer page, chimes once when it is over (and notifies when
     the page is hidden), and ends by itself when the next block, review or case starts. */
  KEYS.breaks = "step3pacer.breaks.v1";
  KEYS.brk = "step3pacer.break.v1";
  const BREAK_DEFAULTS = { taskSec: 1200 };
  function getBreaks() { const b = readJSON(KEYS.breaks, {}); return Object.assign({}, BREAK_DEFAULTS, (b && typeof b === "object") ? b : {}); }
  function setBreaks(patch) { writeJSON(KEYS.breaks, Object.assign({}, getBreaks(), patch || {})); }
  function breakGet() {
    const b = readJSON(KEYS.brk, null);
    if (!b || typeof b !== "object" || !b.endAt) return null;
    if (Date.now() - b.endAt > 3 * 3600 * 1000) { writeJSON(KEYS.brk, null); return null; }   // an old break nobody closed
    return b;
  }
  function breakStart(sec, label, from) {
    sec = sec > 0 ? sec : getBreaks().taskSec;
    const now = Date.now();
    const b = { startAt: now, endAt: now + sec * 1000, sec: sec, label: label || "Break", from: from || "", chimed: false };
    writeJSON(KEYS.brk, b);
    breakRender();
    return b;
  }
  function breakStop() { if (breakGet()) { writeJSON(KEYS.brk, null); breakRender(); } }
  function breakExtend(sec) { const b = breakGet(); if (!b) return; b.endAt += sec * 1000; b.sec += sec; b.chimed = false; writeJSON(KEYS.brk, b); breakRender(); }
  function breakLeft(b, now) { b = b || breakGet(); if (!b) return 0; return (b.endAt - (now || Date.now())) / 1000; }
  let breakBox = null, breakIv = 0, breakArmed = false;
  function breakRender() {
    if (!breakBox) return;
    const b = breakGet();
    if (!b) { breakBox.hidden = true; breakBox.innerHTML = ""; return; }
    const left = breakLeft(b), over = left <= 0;
    if (over && !b.chimed) { b.chimed = true; writeJSON(KEYS.brk, b); sfx("resume"); vibrate([150, 80, 150, 80, 300]); }
    breakBox.hidden = false;
    breakBox.dataset.tone = over ? "over" : "on";
    breakBox.innerHTML =
      '<div class="brkrow"><span class="pill" data-kind="' + (over ? "crit" : "good") + '">' + (over ? "Break over" : "Break") + "</span>" +
      '<span class="brkclock">' + (over ? "+" + fmt(-left) : fmt(Math.ceil(left))) + "</span></div>" +
      '<p class="brktext">' + esc(over ? "Next step. Press Start on it and this line goes away." : (b.label || "Break") + " · back at " + fmtClock(b.endAt) + " · out of the chair, no screen.") + "</p>" +
      '<div class="brkbtns"><button type="button" class="small" data-brk="ext">+5:00</button><button type="button" class="small" data-brk="stop">' + (over ? "Dismiss" : "Skip the rest") + "</button></div>";
    breakBox.querySelector('[data-brk="ext"]').addEventListener("click", () => breakExtend(300));
    breakBox.querySelector('[data-brk="stop"]').addEventListener("click", breakStop);
  }
  function breakTick() { // once a second: refresh the clock in place without rebuilding the buttons
    if (!breakBox || breakBox.hidden) { if (breakGet()) breakRender(); return; }
    const b = breakGet();
    if (!b) { breakRender(); return; }
    const left = breakLeft(b), over = left <= 0;
    if (over && (!b.chimed || breakBox.dataset.tone !== "over")) { breakRender(); return; }
    const c = breakBox.querySelector(".brkclock"); if (c) c.textContent = over ? "+" + fmt(-left) : fmt(Math.ceil(left));
  }
  function renderBreak(container, opts) { // call once per page; the band lives in `container`
    if (!container) return;
    breakBox = container; breakBox.className = "brkband"; breakBox.hidden = true;
    breakRender();
    clearInterval(breakIv); breakIv = setInterval(breakTick, 1000);
    const running = (opts && opts.running) || (() => false);
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") { if (breakArmed) { notifDisarm(); breakArmed = false; } breakRender(); return; }
      const b = breakGet();                          // hidden during a break (and no run active): a notification at its end
      if (!b || b.chimed || running() || breakLeft(b) <= 0) return;
      notifArm([{ at: b.endAt, tag: "break", title: "Break over — next step", body: b.label || "", important: true }]); breakArmed = true;
    });
  }
  function renderBreakSettings(container) {
    if (!container) return;
    const cfg = getBreaks();
    container.innerHTML =
      '<div class="bgset">' +
      '<label>Break after a task — a block, a review, a CCS case with its feedback (mm:ss)<input type="text" id="brkTask" inputmode="numeric" value="' + fmt(cfg.taskSec) + '" style="font-family:var(--font-num);font-size:15px;padding:9px 10px;border-radius:8px;border:1px solid var(--line);background:var(--bg);color:var(--fg);max-width:140px"></label>' +
      '<p class="note">The break starts by itself when the task ends and shows on every pacer page; it ends when the next block, review or case starts. The 10-minute stand after a 30-minute review chunk is in the Review page settings.</p>' +
      '<div class="formrow"><button type="button" class="small" id="brkSave">Save break</button><span class="note" id="brkMsg"></span></div>' +
      "</div>";
    container.querySelector("#brkSave").addEventListener("click", () => {
      const v = parseMS(container.querySelector("#brkTask").value);
      if (v == null || v < 60 || v > 3600) { container.querySelector("#brkMsg").textContent = "1:00 to 60:00."; return; }
      setBreaks({ taskSec: v }); container.querySelector("#brkMsg").textContent = "Saved: " + fmt(v) + " after a task.";
    });
  }

  const api = { KEYS, fmt, fmtSigned, parseMS, todayKey, fmtDate, fmtDay, fmtClock, newId, esc, readJSON, writeJSON,
    loadSessions, saveSessions, saveSession, deleteSession, mergeSessions,
    getTheme, setTheme, applyTheme, setSound, getVolume, setVolume, audioInit, sfx, sfxLater, vibrate, keepAwake, releaseWake,
    renderNav, notice, getSync, setSync, syncNow, syncQuietly, loadParking, saveParking, standalone,
    device, setDeviceName, isIOS, isAndroid, live, bg, getBg, setBg, notifSupported, notifStatus, notifRequest, notifArm, notifDisarm,
    keepAliveStart, keepAliveStop, keepAliveActive, pipSupported, pipStart, pipStop, pipActive, renderBgSettings,
    getBreaks, setBreaks, breakGet, breakStart, breakStop, breakExtend, breakLeft, renderBreak, renderBreakSettings };
  return api;
})();
