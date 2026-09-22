/* ============================================================
   ANTISTAR-moviMIENTO — app logic
   hash router · HLS player · simulated chat · go-live modal
   ============================================================ */
"use strict";

/* ---------------- tiny helpers ---------------- */
const $  = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
}[c]));

const fmtCount = (n) => n >= 1000 ? (n / 1000).toFixed(1).replace(/\.0$/, "") + "k" : String(n);

const fmtDur = (s) => {
  s = Math.max(0, Number(s) || 0);
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60);
  return h > 0 ? `${h}h ${String(m).padStart(2, "0")}m` : `${m}m`;
};

const rand = (arr) => arr[Math.floor(Math.random() * arr.length)];
const uid = () => Math.random().toString(36).slice(2, 9);

/* ---------------- persistent user identity ---------------- */
const USER = {
  name: localStorage.getItem("antistar_handle") || "anónimo_" + uid(),
  get color() { return "var(--acid)"; },
};
localStorage.setItem("antistar_handle", USER.name);

/* ---------------- regions of the global dial ---------------- */
const WORLD_REGIONS = {
  LatAm:   { name: "LATINOAMÉRICA", ccs: ["AR","BO","CL","CR","CU","DO","EC","GT","HN","MX","PE","PR","UY","BR","CO","PA"] },
  Africa:  { name: "ÁFRICA", ccs: ["DZ","BF","CM","EG","KE","MA","MZ","NG","RW","TD","UG","ZA","ET","GH","MW","TZ"] },
  Asia:    { name: "ASIA", ccs: ["BD","KH","MM","NP","PH","SG","TH","UZ","VN","KR","ID","KZ","MY","PK"] },
  MENA:    { name: "MEDIO ORIENTE", ccs: ["IQ","KW","LB","PS","QA","SA","TR","YE","GE","JO"] },
  Europe:  { name: "EUROPA", ccs: ["BE","CZ","DK","FI","FR","GR","HR","NL","NO","PT","RO","SE","ES","HU","RU"] },
  NorthAm: { name: "NORTeamérica", ccs: ["CA","US"] },
  Oceania: { name: "OCEANÍA", ccs: ["AU","NZ","PG"] },
};

/* ---------------- state ---------------- */
const state = {
  theme: localStorage.getItem("antistar_theme") || "midnight",
  route: { page: "home", param: null },
  search: "",
  region: "ALL",
  regionRefs: [],
  liveIds: new Set(CHANNELS.filter(c => c.live).map(c => c.id)),
  viewers: new Map(CHANNELS.map(c => [c.id, c.viewers])),
};

/* ============================================================
   BOOT SEQUENCE
   ============================================================ */
function runBoot() {
  const boot = $("#boot"), bar = $("#bootBar"), log = $("#bootLog");
  let i = 0;
  const step = () => {
    if (i < BOOT_LINES.length) {
      log.innerHTML = "» " + BOOT_LINES[i].replace(/<b>(.*?)<\/b>/, "<b>$1</b>");
      bar.style.width = Math.round(((i + 1) / BOOT_LINES.length) * 100) + "%";
      i++;
      setTimeout(step, 190 + Math.random() * 240);
    } else {
      setTimeout(() => {
        boot.classList.add("off");
        $("#app").hidden = false;
        setTimeout(() => boot.remove(), 700);
      }, 340);
    }
  };
  step();
}

/* ============================================================
   TICKER
   ============================================================ */
function buildTicker() {
  const track = $("#tickerTrack");
  const html = TICKER_ITEMS
    .map(([tag, txt]) => `<span><b>[${tag}]</b>${esc(txt)}</span>`)
    .join("");
  track.innerHTML = html + html; /* duplicate for seamless loop */
}

/* ============================================================
   TOASTS
   ============================================================ */
function toast(title, body, tone = "rose") {
  const el = document.createElement("div");
  el.className = `toast ${tone === "acid" ? "acid" : ""}`;
  el.innerHTML = `<b>${esc(title)}</b>${esc(body)}`;
  $("#toastRoot").appendChild(el);
  setTimeout(() => { el.classList.add("out"); setTimeout(() => el.remove(), 350); }, 3400);
}

/* ============================================================
   TIME HELPERS for stream "uptime"
   ============================================================ */
function uptimeOf(chan) {
  return chan.live ? Math.floor((Date.now() - chan.started) / 1000) : (chan.duration || 0);
}

/* ============================================================
   CHANNEL GRID (home)
   ============================================================ */
function channelCard(chan) {
  const live = state.liveIds.has(chan.id);
  const viewers = state.viewers.get(chan.id) || 0;
  return `
  <button class="chan-card" data-goto="/watch/${chan.slug}">
    <span class="thumb">
      <img src="${chan.thumb}" alt="" loading="lazy"
           onerror="this.replaceWith(Object.assign(document.createElement('div'),{style:'width:100%;height:100%;background:linear-gradient(135deg,var(--cell2),var(--pit))'}))">
      ${live
        ? `<span class="badge-live">EN VIVO</span>
           ${chan.stream?.kind === "radio" ? `<span class="badge-radio">RADIO</span>` : ""}
           ${chan.alt ? `<span class="badge-alt">ALT</span>` : ""}
           <span class="badge-viewers"><iconify-icon icon="ph:person-bold"></iconify-icon>${fmtCount(viewers)}</span>
           <span class="badge-dur" data-uptime="${chan.id}">${fmtDur(uptimeOf(chan))}</span>`
        : `<span class="badge-replay">REPLAY</span>
           <span class="badge-dur">${fmtDur(chan.duration || 0)}</span>`}
    </span>
    <span class="chan-meta">
      <span class="chan-title">${esc(chan.title)}</span>
      <span class="chan-tags">${chan.tags.map(t => `<span class="tag">#${esc(t)}</span>`).join("")}</span>
      <span class="chan-by">
        <span class="chan-avatar">${esc(chan.host[0].toUpperCase())}</span>
        <span class="chan-host">${esc(chan.host)}</span>
      </span>
    </span>
  </button>`;
}

function filteredChannels() {
  const q = state.search.trim().toLowerCase();
  if (!q) return CHANNELS;
  return CHANNELS.filter(c =>
    c.title.toLowerCase().includes(q) ||
    c.host.toLowerCase().includes(q) ||
    (c.country || "").toLowerCase().includes(q) ||
    (c.cc || "").toLowerCase().includes(q) ||
    c.tags.some(t => t.toLowerCase().includes(q))
  );
}

function regionChipsHtml(ccSet) {
  const chip = (id, label, n) => `
    <button class="rchip ${state.region === id ? "on" : ""}" data-region="${id}">
      ${label}<i>${n}</i>
    </button>`;
  const total = CHANNELS.filter(c => c.cc).length;
  return `
  <div class="region-bar">
    ${chip("ALL", "EL MUNDO ENTERO", total)}
    ${Object.entries(WORLD_REGIONS).map(([id, r]) =>
      chip(id, r.name, r.ccs.filter(cc => ccSet.has(cc)).length))
      .join("")}
  </div>`;
}

const dialChannels = (list) => list.filter(c => c.cc);

function renderHome() {
  const ccSet = new Set(CHANNELS.filter(c => c.cc).map(c => c.cc));
  const list = state.region === "ALL"
    ? filteredChannels()
    : (state.search.trim()
        ? filteredChannels().filter(c => c.cc && state.regionRefs.includes(c.cc))
        : CHANNELS.filter(c => c.cc && state.regionRefs.includes(c.cc)));
  const dialLive = dialChannels(list).filter(c => !c.alt && state.liveIds.has(c.id));
  const dialList = dialChannels(list).filter(c => !c.alt);
  const altList = list.filter(c => c.alt);
  const barrioLive = list.filter(c => !c.cc && state.liveIds.has(c.id));
  const liveCount = CHANNELS.filter(c => state.liveIds.has(c.id)).length;
  const totalViewers = [...state.viewers.values()].reduce((a, b) => a + b, 0);

  return `
  <section class="view-hero">
    <div>
      <div class="hero-kicker">// TRANSMISIÓN ABIERTA — NO PERMITS REQUIRED</div>
      <h1 class="hero-title">
        KILL THE <span class="hot">STAR</span>.<br>
        START THE <span class="cool">MOVIMIENTO</span>.
      </h1>
      <p class="hero-sub">
        ANTISTAR-moviMIENTO is a pirate livestreaming network. Every rooftop is a station,
        every viewer a repeater. The dial now carries <b>${CHANNELS.filter(c => c.cc).length} relayed signals
        from ${new Set(CHANNELS.filter(c => c.cc).map(c => c.cc)).size} countries</b> — barrios, exiles,
        campuses and kitchen tables. No algorithm decides what you watch — the barrio does.
      </p>
      <div class="hero-cta">
        <button class="btn btn-solid" data-goto="/watch/${(CHANNELS.find(c => state.liveIds.has(c.id)) || CHANNELS[0]).slug}">
          <iconify-icon icon="ph:play-bold"></iconify-icon> JOIN THE LIVE SIGNAL
        </button>
        <button class="btn btn-ghost" data-goto="/manifesto">READ THE MANIFESTO</button>
      </div>
    </div>
    <div class="hero-stats">
      <div class="statcard live"><b>${liveCount}</b><span>SEÑALES EN VIVO</span></div>
      <div class="statcard"><b>${fmtCount(totalViewers)}</b><span>ESPECTADORES CONECTADOS</span></div>
      <div class="statcard"><b>${CHANNELS.length}</b><span>ESTACIONES REGISTRADAS</span></div>
      <div class="statcard"><b>${new Set(CHANNELS.filter(c => c.cc).map(c => c.cc)).size}</b><span>PAÍSES AL AIRE</span></div>
    </div>
  </section>

  ${regionChipsHtml(ccSet)}

  <div class="sect-head">
    <h2>Live signals — the founders</h2><div class="rule"></div>
    <span class="count">${barrioLive.length} ON AIR</span>
  </div>
  <div class="grid-channels">
    ${barrioLive.map(channelCard).join("") || ""}
  </div>

  <div class="sect-head">
    <h2>MUNDO — the global dial</h2><div class="rule"></div>
    <span class="count">${dialLive.length} LIVE · ${ccSet.size} COUNTRIES</span>
  </div>
  <div class="grid-channels">
    ${dialList.map(channelCard).join("") ||
      `<div class="empty-note">— no relayed signal matches this filter —</div>`}
  </div>

  <div class="sect-head">
    <h2>ALT-WAVE — the undial</h2><div class="rule"></div>
    <span class="count">${altList.length} LIBRES · ${new Set(altList.map(c => c.cc)).size} COUNTRIES</span>
  </div>
  <div class="grid-channels">
    ${altList.map(channelCard).join("") ||
      `<div class="empty-note">— no free signal matches this filter —</div>`}
  </div>

  <div class="sect-head">
    <h2>Replay vault</h2><div class="rule"></div>
    <span class="count">${list.filter(c => !state.liveIds.has(c.id)).length} ARCHIVED</span>
  </div>
  <div class="grid-channels">
    ${list.filter(c => !state.liveIds.has(c.id)).map(channelCard).join("") ||
      `<div class="empty-note">— no transmissions match "${esc(state.search)}" —</div>`}
  </div>
  ${list.length === 0 ? `<div class="empty-note">— the spectrum is silent: nothing matches "${esc(state.search)}" —</div>` : ""}`;
}

/* ============================================================
   WATCH PAGE + HLS PLAYER
   ============================================================ */
let hls = null;
let activePlayerEl = null;

function destroyPlayer() {
  if (hls) { hls.destroy(); hls = null; }
  if (activePlayerEl) {
    activePlayerEl.pause?.();
    activePlayerEl.removeAttribute("src");
    activePlayerEl.load?.();
    activePlayerEl = null;
  }
  Chat.stop();
}

function attachStream(video, stream) {
  destroyPlayer();
  activePlayerEl = video;
  clearTimeout(attachStream._wd);
  const isLiveVod = stream && stream.liveVod;
  if (stream.kind === "radio") {
    /* continuous community radio — native decode, no hls.js wrapper */
    video.src = stream.url;
  } else if (stream.kind === "hls") {
    if (window.Hls && Hls.isSupported()) {
      hls = new Hls({ enableWorker: true });
      hls.on(Hls.Events.ERROR, (_ev, data) => {
        if (!data || !data.fatal) return;
        if (data.type === Hls.ErrorTypes.NETWORK_ERROR) {
          toast("SIGNAL LOST", "Relay not responding — retrying uplink…", "rose");
          hls.startLoad();
        } else if (data.type === Hls.ErrorTypes.MEDIA_ERROR) {
          hls.recoverMediaError();
        } else {
          toast("FEED DEAD", "This relay went dark. Try another signal.", "rose");
        }
      });
      hls.loadSource(stream.url);
      hls.attachMedia(video);
      /* stall watchdog: no decoded frames within 12s → advise another station */
      clearTimeout(attachStream._wd);
      attachStream._wd = setTimeout(() => {
        if (video.readyState < 2 && hls) {
          toast("SEÑAL DÉBIL", "This relay isn't delivering — try another station.", "rose");
        }
      }, 12000);
    } else if (video.canPlayType("application/vnd.apple.mpegurl")) {
      video.src = stream.url; /* Safari native HLS */
    } else {
      toast("NO CODEC", "This browser can't decode the stream.", "rose");
    }
  } else {
    video.src = stream.url;
  }
  /* archive VODs loop; live feeds ride the rolling window */
  video.loop = !!isLiveVod;
}

function renderWatch(slug) {
  const chan = CHANNELS.find(c => c.slug === slug) || CHANNELS[0];
  const live = state.liveIds.has(chan.id);
  const viewers = state.viewers.get(chan.id) || 0;
  const isRadio = chan.stream?.kind === "radio";
  const tuneHint = (chan.stream && chan.stream.liveVod)
    ? "ARCHIVE REPLAY — TAP TO PLAY"
    : isRadio ? "● LIVE RADIO — TAP TO LISTEN"
    : (live ? "● LIVE FEED — TAP TO TUNE IN" : "ARCHIVE REPLAY — TAP TO TUNE IN");

  return `
  <div class="watch">
    <div>
      <div class="playerwrap">
        <div class="crt-frame">
          <${isRadio ? "audio controls" : "video"} id="video" playsinline autoplay muted></${isRadio ? "audio" : "video"}>
          <div class="player-clickbar" id="clickbar"></div>
          <div class="player-overlay" id="overlay">
            <div class="bigplay"><iconify-icon icon="ph:play-fill"></iconify-icon></div>
            <p class="overlay-title">${esc(chan.title)}</p>
            <p class="overlay-sub">${tuneHint}</p>
          </div>
        </div>
      </div>

      <div class="watch-head">
        <h1 class="watch-title">${esc(chan.title)}</h1>
        <div class="watch-sub">
          ${live ? `<span class="pill-live">● EN VIVO</span>` : `<span class="pill-soft">REPLAY</span>`}
          <span class="pill-soft"><iconify-icon icon="ph:person-bold"></iconify-icon> <span data-viewers="${chan.id}">${fmtCount(viewers)}</span> watching</span>
          <span class="pill-soft">${esc(chan.host)}</span>
          ${chan.country ? `<span class="pill-soft pill-cc">${isRadio ? "📻" : "📺"} ${esc(chan.country.toUpperCase())}</span>` : ""}
          <span class="pill-soft" data-uptime="${chan.id}">${fmtDur(uptimeOf(chan))} on air</span>
        </div>
        <div class="chipbar">
          <button class="chip" id="chipShare"><iconify-icon icon="ph:link-bold"></iconify-icon> COPY SIGNAL LINK</button>
          <button class="chip" id="chipQuality"><iconify-icon icon="ph:sliders-bold"></iconify-icon> SIGNAL: <span class="n">AUTO</span></button>
          <button class="chip" id="chipMute"><iconify-icon icon="ph:speaker-high-bold"></iconify-icon> UNMUTE</button>
          <button class="chip" id="chipPiP"><iconify-icon icon="ph:picture-in-picture-bold"></iconify-icon> PIP</button>
          <button class="chip" id="chipFav"><iconify-icon icon="ph:heart-bold"></iconify-icon> AMPLIFY <span class="n" id="favCount">0</span></button>
        </div>
        <p class="broadcast-note">
          SIMULCAST VIA <b>${esc(chan.stream?.label || (live ? "MESH RELAY" : "ARCHIVE NODE"))}</b> — PEER RELAYS: ${4 + (chan.viewers % 9)} —
          ${chan.country ? `RELAYED FROM ${esc(chan.country.toUpperCase())} · ` : ""}NO TELEMETRY LEAVES THIS BOROUGH
        </p>
      </div>
    </div>

    <aside class="chat">
      <div class="chat-head">
        <iconify-icon icon="ph:chat-circle-dots-bold"></iconify-icon> TRANSMISSION CHAT
        <span class="dot"></span>
      </div>
      <div class="chat-scroll" id="chatScroll"></div>
      <form class="chat-form" id="chatForm">
        <input id="chatInput" type="text" maxlength="200" placeholder="transmit to the movimiento…" autocomplete="off">
        <button type="submit">SEND</button>
      </form>
    </aside>
  </div>
  ${renderUpNext(chan)}`;
}

function renderUpNext(chan) {
  const others = CHANNELS.filter(c => c.id !== chan.id).slice(0, 4);
  return `
  <div class="sect-head"><h2>Other signals</h2><div class="rule"></div></div>
  <div class="grid-channels">${others.map(channelCard).join("")}</div>`;
}

function bindWatchPage(slug) {
  const chan = CHANNELS.find(c => c.slug === slug) || CHANNELS[0];
  const video = $("#video");
  const overlay = $("#overlay");
  const live = state.liveIds.has(chan.id);
  const isRadio = chan.stream?.kind === "radio";

  const startPlayback = () => {
    attachStream(video, chan.stream);
    video.play().catch(() => {});
    overlay.hidden = true;
    toast("TUNED IN", chan.title, "acid");
  };

  /* chat tunes in with you — spins up on first watch interaction */
  const kickChat = () => { if (live || isRadio) Chat.start(chan); };
  overlay.addEventListener("click", kickChat, { once: true });
  $("#clickbar").addEventListener("click", kickChat, { once: true });

  overlay.addEventListener("click", startPlayback);
  $("#clickbar").addEventListener("click", () => {
    if (!video.src && !hls) startPlayback();
    else video.paused ? video.play().catch(() => {}) : video.pause();
  });

  /* unmute helper (browsers autoplay-block unmuted) */
  $("#chipMute").addEventListener("click", () => {
    video.muted = !video.muted;
    $("#chipMute").innerHTML = video.muted
      ? `<iconify-icon icon="ph:speaker-high-bold"></iconify-icon> UNMUTE`
      : `<iconify-icon icon="ph:speaker-slash-bold"></iconify-icon> MUTE`;
  });

  /* share */
  $("#chipShare").addEventListener("click", async () => {
    const url = location.href;
    try { await navigator.clipboard.writeText(url); toast("LINK COPIED", "Amplify the signal.", "acid"); }
    catch { toast("COPY FAILED", url, "rose"); }
  });

  /* amplify counter */
  let favs = 0;
  $("#chipFav").addEventListener("click", () => {
    favs++;
    $("#favCount").textContent = favs;
    if (favs === 1) toast("AMPLIFIED", "The channel feels your voltage.", "acid");
  });

  /* PiP */
  $("#chipPiP").addEventListener("click", async () => {
    try {
      document.pictureInPictureElement ? await document.exitPictureInPicture() : await video.requestPictureInPicture();
    } catch { toast("PIP", "Not supported here.", "rose"); }
  });

  /* quality cycling (only meaningful when hls.js is driving) */
  const levels = ["AUTO", "1080p", "720p", "480p"];
  let qi = 0;
  $("#chipQuality").addEventListener("click", () => {
    qi = (qi + 1) % levels.length;
    const label = levels[qi];
    $("#chipQuality .n").textContent = label;
    if (hls) {
      hls.currentLevel = qi === 0 ? -1 : Math.min(qi - 1, (hls.levels?.length || 1) - 1);
      toast("QUALITY", label, "acid");
    } else {
      toast("QUALITY", label + " (source-driven)", "acid");
    }
  });

  Chat.bindForm();
}

/* ============================================================
   CHAT SIMULATION
   ============================================================ */
const Chat = {
  timer: null,
  chan: null,
  count: 0,

  start(chan) {
    this.stop();
    this.chan = chan;
    this.count = 0;
    const box = $("#chatScroll");
    if (!box) return;
    box.innerHTML = "";
    this.sys(`sintonizando chat de ${chan.host}…`);
    this.timer = setInterval(() => this.tick(), 1400 + Math.random() * 1800);
    for (let i = 0; i < 6; i++) setTimeout(() => this.tick(), 300 * i + Math.random() * 500);
  },

  stop() {
    if (this.timer) { clearInterval(this.timer); this.timer = null; }
    this.chan = null;
  },

  add(who, txt, cls = "") {
    const box = $("#chatScroll");
    if (!box) return;
    const el = document.createElement("div");
    el.className = "msg " + cls;
    el.innerHTML = `<span class="who">${esc(who)}:</span> <span class="txt">${esc(txt)}</span>`;
    box.appendChild(el);
    while (box.children.length > 80) box.firstChild.remove();
    box.scrollTop = box.scrollHeight;
  },

  sys(txt) {
    const box = $("#chatScroll");
    if (!box) return;
    const el = document.createElement("div");
    el.className = "msg sys";
    el.textContent = txt;
    box.appendChild(el);
    box.scrollTop = box.scrollHeight;
  },

  tick() {
    if (!this.chan) return;
    const lang = this.chan.tags.includes("es") ? "es" : "en";
    const roll = Math.random();
    if (roll < 0.08) {
      this.add("MOD·" + rand(USER_NAMES), rand(CHAT_LINES.mod), "mod");
    } else if (roll < 0.2) {
      this.add(rand(USER_NAMES), rand(CHAT_LINES.hype), "mod");
    } else {
      this.add(rand(USER_NAMES), rand(roll < 0.6 ? CHAT_LINES[lang] : CHAT_LINES.en));
    }
    /* viewers drift */
    const cur = state.viewers.get(this.chan.id) || 0;
    const next = Math.max(10, cur + Math.floor((Math.random() - 0.45) * 24));
    state.viewers.set(this.chan.id, next);
    $$(`[data-viewers="${this.chan.id}"]`).forEach(el => el.textContent = fmtCount(next));
    $$(`[data-uptime="${this.chan.id}"]`).forEach(el => el.textContent = fmtDur(uptimeOf(this.chan)));
  },

  bindForm() {
    const form = $("#chatForm");
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      const input = $("#chatInput");
      const txt = input.value.trim();
      if (!txt) return;
      this.add(USER.name, txt, "me");
      input.value = "";
      setTimeout(() => {
        const lang = this.chan?.tags.includes("es") ? "es" : "en";
        this.add(rand(USER_NAMES), Math.random() < 0.3 ? rand(CHAT_LINES.hype) : rand(CHAT_LINES[lang]));
      }, 900 + Math.random() * 1600);
    });
  },
};

/* ============================================================
   GO-LIVE MODAL
   ============================================================ */
function openGoLive() {
  const root = $("#modalRoot");
  root.innerHTML = `
  <div class="modal-back" id="modalBack">
    <div class="modal" role="dialog" aria-modal="true" aria-label="Go live">
      <div class="modal-head">
        <iconify-icon icon="ph:broadcast-bold"></iconify-icon>
        <h3>START A TRANSMISSION</h3>
      </div>
      <div class="modal-body">
        <label>TITLE OF THE SIGNAL
          <input id="liveTitle" maxlength="90" placeholder="ej. ASAMBLEA RELÁMPAGO — plaza oeste" required>
        </label>
        <label>HOST / COLECTIVO
          <input id="liveHost" maxlength="40" value="${esc(USER.name)}">
        </label>
        <label>CATEGORY
          <select id="liveTag">
            <option value="asamblea">asamblea</option>
            <option value="taller">taller</option>
            <option value="music">music</option>
            <option value="cine">cine</option>
            <option value="comida">comida</option>
            <option value="mesh">mesh</option>
          </select>
        </label>
        <label>LANGUAGE
          <select id="liveLang">
            <option value="es">es — español</option>
            <option value="en">en — english</option>
          </select>
        </label>
        <label>SIGNAL LINK — .m3u8 / .mp4 <span class="opt">(optional)</span>
          <input id="liveStream" type="url" inputmode="url"
                 placeholder="https://mi-servidor.org/stream/master.m3u8"
                 value="${esc(localStorage.getItem("antistar_last_stream") || "")}">
        </label>
        <div class="modal-actions">
          <button class="btn btn-cancel" id="modalCancel">CANCEL</button>
          <button class="btn btn-solid" id="modalGo">
            <iconify-icon icon="ph:broadcast-bold"></iconify-icon> ON AIR
          </button>
        </div>
      </div>
    </div>
  </div>`;

  const close = () => { root.innerHTML = ""; };
  $("#modalBack").addEventListener("click", (e) => { if (e.target.id === "modalBack") close(); });
  document.addEventListener("keydown", function escClose(e) {
    if (e.key === "Escape") { close(); document.removeEventListener("keydown", escClose); }
  });
  $("#modalCancel").addEventListener("click", close);

  $("#modalGo").addEventListener("click", () => {
    const title = $("#liveTitle").value.trim() || "SIN TÍTULO — señal abierta";
    const host = $("#liveHost").value.trim() || USER.name;
    const tag = $("#liveTag").value;
    const lang = $("#liveLang").value;
    const streamInput = $("#liveStream").value.trim();

    /* validate a custom signal link if given */
    const hlsPool = GLOBAL_FEEDS.filter(f => f.kind === "hls");
    let stream = hlsPool[Math.floor(Math.random() * hlsPool.length)];
    if (streamInput) {
      let u;
      try { u = new URL(streamInput); } catch {
        toast("BAD LINK", "That signal link isn't a URL.", "rose");
        return;
      }
      if (u.protocol !== "https:" && location.protocol === "https:") {
        toast("INSECURE LINK", "Live pages can only pull https:// streams.", "rose");
        return;
      }
      stream = { id: "custom", label: "USER RELAY · " + u.hostname, url: streamInput, kind: u.pathname.endsWith(".mp4") ? "file" : "hls" };
      localStorage.setItem("antistar_last_stream", streamInput);
    }

    const slug = "user-" + title.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 32) + "-" + uid();
    const chan = {
      id: "ch-" + uid(),
      slug,
      title,
      host,
      tags: [tag, lang, "user"],
      live: true,
      viewers: 1,
      stream,
      thumb: `https://picsum.photos/seed/${slug}/640/360`,
      started: Date.now(),
      desc: "User transmission created from the browser.",
    };
    CHANNELS.unshift(chan);
    state.liveIds.add(chan.id);
    state.viewers.set(chan.id, 1);

    /* keep user stations alive across reloads */
    try {
      const mine = JSON.parse(localStorage.getItem("antistar_stations") || "[]");
      mine.unshift({
        id: chan.id, slug: chan.slug, title: chan.title, host: chan.host,
        tags: chan.tags, stream: chan.stream, started: chan.started, desc: chan.desc,
      });
      localStorage.setItem("antistar_stations", JSON.stringify(mine.slice(0, 20)));
    } catch {}

    close();
    toast("ON AIR", "Tu señal está viva. Que la escuchen.", "acid");
    location.hash = "#/watch/" + slug;
  });

  setTimeout(() => $("#liveTitle").focus(), 50);
}

/* ============================================================
   MANIFESTO PAGE
   ============================================================ */
function renderManifesto() {
  return `
  <div class="manifesto">
    <div class="hero-kicker">// DOCUMENTO FUNDACIONAL — vØ.7</div>
    <h1>NO ESTRELLAS.<br>SOLO <em>ANTENAS.</em></h1>

    <article>
      <h3>1 · El espectro es de quien lo camina</h3>
      <p>
        The airwaves were never property. Every fence around a frequency is a fence
        around a <b>voice</b>. We cut the fence, we climb the roof, we broadcast.
      </p>
    </article>

    <article>
      <h3>2 · No algorithm decides</h3>
      <p>
        There is no feed to optimize, no engagement to farm, no stars to worship.
        Discovery happens the old way: <b>someone you trust passes you the link</b>.
      </p>
    </article>

    <article>
      <h3>3 · Amplify, don't monetize</h3>
      <p>
        Nothing here is for sale. Not your attention, not your data, not the signal.
        The only currency is <b>amplification</b> — relay what moves you.
      </p>
    </article>

    <article>
      <h3>4 · Every rooftop a station</h3>
      <p>
        You don't need permission, capital, or a studio. A phone, a battery bank,
        and something to say. <b>Go live.</b>
      </p>
    </article>

    <div class="slogan-wall">
      ${SLOGANS.map(s => `<span>${esc(s)}</span>`).join("")}
    </div>
  </div>`;
}

/* ============================================================
   ROUTER
   ============================================================ */
function parseHash() {
  const h = location.hash.replace(/^#/, "") || "/";
  const parts = h.split("/").filter(Boolean);
  if (parts[0] === "watch") return { page: "watch", param: parts[1] || CHANNELS[0].slug };
  if (parts[0] === "manifesto") return { page: "manifesto", param: null };
  return { page: "home", param: null };
}

function render() {
  state.route = parseHash();
  const view = $("#view");
  destroyPlayer();

  if (state.route.page === "watch") {
    view.innerHTML = renderWatch(state.route.param);
    bindWatchPage(state.route.param);
  } else if (state.route.page === "manifesto") {
    view.innerHTML = renderManifesto();
  } else {
    if (state.route.page !== "home") state.region = "ALL";
    view.innerHTML = renderHome();
  }

  $$("[data-route]").forEach(a => {
    a.classList.toggle("active", a.dataset.route === state.route.page);
  });
  window.scrollTo({ top: 0 });
}

function navigate(path) {
  if (location.hash === "#" + path) render();
  else location.hash = path;
}

/* ============================================================
   GLOBAL EVENTS
   ============================================================ */
function bindGlobal() {
  document.addEventListener("click", (e) => {
    const rchip = e.target.closest("[data-region]");
    if (rchip) {
      const id = rchip.getAttribute("data-region");
      state.region = id;
      state.regionRefs = id === "ALL" ? [] : WORLD_REGIONS[id].ccs;
      if (state.route.page !== "home") navigate("/");
      render();
      return;
    }
    const goto = e.target.closest("[data-goto]");
    if (goto) { e.preventDefault(); navigate(goto.getAttribute("data-goto")); }
  });

  $("#searchInput").addEventListener("input", (e) => {
    state.search = e.target.value;
    if (state.route.page !== "home") navigate("/");
    render();
  });

  $("#goLiveBtn").addEventListener("click", openGoLive);

  $("#themeBtn").addEventListener("click", () => {
    state.theme = state.theme === "tubes" ? "midnight" : "tubes";
    document.documentElement.dataset.theme = state.theme;
    localStorage.setItem("antistar_theme", state.theme);
    toast("PHOSPHOR", state.theme === "tubes" ? "Tube mode engaged." : "Midnight restored.", "acid");
  });

  window.addEventListener("hashchange", render);
}

/* ============================================================
   USER STATIONS — persisted GO LIVE channels
   ============================================================ */
function loadUserStations() {
  let mine = [];
  try { mine = JSON.parse(localStorage.getItem("antistar_stations") || "[]"); } catch {}
  for (const s of mine) {
    if (!s || !s.slug || !s.stream || !s.stream.url) continue;
    if (CHANNELS.some(c => c.id === s.id)) continue;
    CHANNELS.unshift({
      ...s,
      live: true,
      viewers: 1,
      thumb: `https://picsum.photos/seed/${s.slug}/640/360`,
    });
    state.liveIds.add(s.id);
    state.viewers.set(s.id, 1);
  }
}

/* ============================================================
   INIT
   ============================================================ */
document.documentElement.dataset.theme = state.theme;
buildTicker();
bindGlobal();
runBoot();
loadUserStations();
render();
