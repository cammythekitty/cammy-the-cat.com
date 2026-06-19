/* =====================================================================
 * now-playing.js — Discord presence card, polling edition.
 *
 * Fetches from your own Lanyard-compatible REST API instead of the
 * official Lanyard websocket. Polls every 30s; updates immediately on
 * page focus.
 *
 * API shape expected (from lanyard.cammy-the-cat.com/<id>):
 *   { success, data: { presence: {...}, user: {...} } }
 *
 * WHICH USER?  Resolved in priority order from:
 *   1. path        /api/<id>
 *   2. query       ?u=<id>  (also ?id= / ?user=)
 *   3. hash        #<id>
 *   4. <script data-user="<id>">  or  <div id="now-playing" data-user="...">
 *   5. window.NOW_PLAYING_USER_ID
 *
 * API BASE URL: set window.NOW_PLAYING_API or defaults to
 *   https://lanyard.cammy-the-cat.com
 * ===================================================================== */
(function presence() {
  "use strict";

  const API_BASE = (typeof window.NOW_PLAYING_API === "string" && window.NOW_PLAYING_API.trim())
    || "https://lanyard.cammy-the-cat.com";
  const POLL_INTERVAL = 30_000;

  // ---- who are we showing? ------------------------------------------------
  function valid(id) { return typeof id === "string" && /^\d{5,25}$/.test(id); }
  function resolveUserId() {
    const path = location.pathname.match(/\/api\/(\d{5,25})(?:[\/?#]|$)/);
    if (path) return path[1];
    const qs = new URLSearchParams(location.search);
    const q = qs.get("u") || qs.get("id") || qs.get("user");
    if (valid(q)) return q;
    if (/^#\d{5,25}$/.test(location.hash)) return location.hash.slice(1);
    const script = document.currentScript || document.querySelector("script[data-user]");
    if (script && script.dataset && valid(script.dataset.user)) return script.dataset.user;
    const m = document.getElementById("now-playing");
    if (m && m.dataset && valid(m.dataset.user)) return m.dataset.user;
    if (valid(window.NOW_PLAYING_USER_ID)) return window.NOW_PLAYING_USER_ID;
    return null;
  }

  const DISCORD_USER_ID = resolveUserId();
  const mount = document.getElementById("now-playing");
  if (!mount || !DISCORD_USER_ID) return;

  // ---- theme ---------------------------------------------------------------
  if (!document.documentElement.getAttribute("data-flavor")) {
    const t = new URLSearchParams(location.search).get("theme");
    const themes = ["mocha", "macchiato", "frappe", "latte"];
    if (!document.documentElement.getAttribute("data-theme")) {
      document.documentElement.setAttribute("data-theme", themes.indexOf(t) >= 0 ? t : "mocha");
    }
  }

  // ---- build the card ------------------------------------------------------
  const card = document.createElement("div");
  card.id = "now-playing";
  card.className = "presence-card";
  card.hidden = true;
  card.innerHTML =
    '<div class="pc-head">' +
      '<span class="pc-avatar">' +
        '<img class="pc-av-img" alt="" referrerpolicy="no-referrer" crossorigin="anonymous">' +
        '<img class="pc-av-deco" alt="" hidden>' +
        '<span class="pc-status"></span>' +
      '</span>' +
      '<span class="pc-id">' +
        '<span class="pc-name-row">' +
          '<span class="pc-name"></span>' +
          '<span class="pc-tag" hidden></span>' +
        '</span>' +
        '<span class="pc-sub-row">' +
          '<span class="pc-user"></span>' +
          '<span class="pc-platforms"></span>' +
        '</span>' +
        '<span class="pc-meta" hidden></span>' +
        '<span class="pc-badges"></span>' +
      '</span>' +
      '<button class="pc-star" type="button" title="wishlist">★</button>' +
    '</div>' +
    '<div class="pc-sections"></div>' +
    '<div class="pc-wishlist" id="pc-wishlist"></div>';
  mount.replaceWith(card);

  const avImg      = card.querySelector(".pc-av-img");
  const avDeco     = card.querySelector(".pc-av-deco");
  const nameEl     = card.querySelector(".pc-name");
  const tagEl      = card.querySelector(".pc-tag");
  const userEl     = card.querySelector(".pc-user");
  const platformsEl = card.querySelector(".pc-platforms");
  const metaEl     = card.querySelector(".pc-meta");
  const badgesEl   = card.querySelector(".pc-badges");
  const sections   = card.querySelector(".pc-sections");
  const starBtn    = card.querySelector(".pc-star");
  const wishlistEl = card.querySelector(".pc-wishlist");

  // ---- wishlist ------------------------------------------------------------
  let wishlistItems = null;
  function renderWishlist() {
    if (!wishlistEl) return;
    if (wishlistItems && wishlistItems.length) {
      wishlistEl.innerHTML = '<div class="pc-wishlist-title">Wishlist</div>' +
        wishlistItems.map(function (w) {
          const inner =
            (w.icon ? '<img class="pc-wl-ic" src="' + esc(w.icon) + '" alt="">' : "") +
            '<span class="pc-wl-name">' + esc(w.name || "") + "</span>";
          return w.url
            ? '<a class="pc-wl-item" href="' + esc(w.url) + '" target="_blank" rel="noopener">' + inner + "</a>"
            : '<span class="pc-wl-item">' + inner + "</span>";
        }).join("");
    } else {
      wishlistEl.innerHTML = '<div class="pc-wishlist-title">Wishlist</div>' +
        '<p class="pc-wl-empty">coming soon ✨</p>';
    }
  }
  if (starBtn) {
    starBtn.addEventListener("click", function (e) {
      e.stopPropagation();
      const open = card.classList.toggle("show-wishlist");
      starBtn.classList.toggle("on", open);

      if (open) renderWishlist();
    });
  }

  let latest   = null;
  let ticker   = null;
  let pollTimer = null;

  // ---- helpers -------------------------------------------------------------
  function fmt(ms) {
    const total = Math.max(0, Math.floor(ms / 1000));
    const m = Math.floor(total / 60);
    const s = total % 60;
    return `${m}:${String(s).padStart(2, "0")}`;
  }
  function elapsedStr(start) {
    const s = Math.max(0, Math.floor((Date.now() - start) / 1000));
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    return h ? `${h}h ${m}m` : `${m}m`;
  }
  function clamp(n, lo, hi) { return Math.min(Math.max(n, lo), hi); }
  function esc(str) {
    return String(str == null ? "" : str)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }
  function intToHex(n) {
    return "#" + (Number(n) >>> 0).toString(16).padStart(6, "0").slice(-6);
  }

  // ---- CDN helpers (matching your API's output) ----------------------------
  function avatarUrl(u) {
    // Your API returns avatar_url already built — use it if present.
    if (u && u.avatar_url) return u.avatar_url;
    if (!u || !u.avatar) return "https://cdn.discordapp.com/embed/avatars/0.png";
    const ext = String(u.avatar).startsWith("a_") ? "gif" : "png";
    return `https://cdn.discordapp.com/avatars/${u.id}/${u.avatar}.${ext}?size=128`;
  }
  function emojiUrl(e) {
    if (!e || !e.id) return null;
    return `https://cdn.discordapp.com/emojis/${e.id}.${e.animated ? "gif" : "png"}?size=32`;
  }
  function assetUrl(appId, asset) {
    if (!asset) return null;
    if (String(asset).startsWith("mp:")) return "https://media.discordapp.net/" + asset.slice(3);
    return `https://cdn.discordapp.com/app-assets/${appId}/${asset}.png`;
  }
  function guildBadgeUrl(clan) {
    if (!clan || !clan.badge || !clan.guild_id) return null;
    return `https://cdn.discordapp.com/guild-tag-badges/${clan.guild_id}/${clan.badge}.png?size=24`;
  }

  // ---- platform icons ------------------------------------------------------
  const PLATFORM_ICONS = {
    desktop: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="4" width="20" height="13" rx="1.5"/><path d="M8 21h8M12 17v4"/></svg>',
    mobile:  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="7" y="2" width="10" height="20" rx="2.5"/><path d="M11 18h2"/></svg>',
    web:     '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c2.5 2.5 2.5 15 0 18M12 3c-2.5 2.5-2.5 15 0 18"/></svg>'
  };
  function platformIcons(platform) {
    // Your API: presence.platform = { desktop, mobile, web }
    if (!platform) return "";
    let html = "";
    if (platform.desktop) html += '<span class="pc-plat" title="Desktop">' + PLATFORM_ICONS.desktop + "</span>";
    if (platform.mobile)  html += '<span class="pc-plat" title="Mobile">'  + PLATFORM_ICONS.mobile  + "</span>";
    if (platform.web)     html += '<span class="pc-plat" title="Web">'     + PLATFORM_ICONS.web     + "</span>";
    return html;
  }

  // ---- badges --------------------------------------------------------------
  const BADGE_FLAGS = [
    [1 << 0,  "Discord Staff",                "5e74e9b61934fc1f67c65515d1f7e60d"],
    [1 << 1,  "Partnered Server Owner",       "3f9748e53446a137a052f3454e2de41e"],
    [1 << 2,  "HypeSquad Events",             "bf01d1073931f921909045f3a39fd264"],
    [1 << 3,  "Bug Hunter",                   "2717692c7dca7289b35297368a940dd0"],
    [1 << 6,  "HypeSquad Bravery",            "8a88d63823d8a71cd5e390baa45efa02"],
    [1 << 7,  "HypeSquad Brilliance",         "011940fd013da3f7fb926e4a1cd2e618"],
    [1 << 8,  "HypeSquad Balance",            "3aa41de486fa12454c3761e8e223442e"],
    [1 << 9,  "Early Supporter",              "7060786766c9c840eb3019e725d2b358"],
    [1 << 14, "Bug Hunter Gold",              "848f79194d4be5ff5f81505cbd0ce1e6"],
    [1 << 17, "Early Verified Bot Developer", "6df5892e0f35b051f8b61eace34f4967"],
    [1 << 18, "Moderator Programs Alumni",    "fee1624003e2fee35cb398e125dc479b"],
    [1 << 22, "Active Developer",             "6bdc42827a38498929a4920da12695d9"],
  ];
  function renderBadges(flags) {
    flags = Number(flags) || 0;
    let html = "";
    for (const [bit, name, hash] of BADGE_FLAGS) {
      if (flags & bit) {
        html += '<img class="pc-badge" src="https://cdn.discordapp.com/badge-icons/' + hash +
          '.png" alt="" title="' + esc(name) + '" onerror="this.remove()">';
      }
    }
    return html;
  }
  function rgbTriplet(n) {
    n = Number(n) >>> 0;
    return ((n >> 16) & 255) + ", " + ((n >> 8) & 255) + ", " + (n & 255);
  }

  // ---- album art → Catppuccin accent ---------------------------------------
  const ACCENT_VARS = [
    "rosewater","flamingo","pink","mauve","red","maroon","peach",
    "yellow","green","teal","sky","sapphire","blue","lavender",
  ];
  function hexToRgb(hex) {
    hex = hex.trim().replace("#", "");
    if (hex.length === 3) hex = hex.split("").map((c) => c + c).join("");
    const n = parseInt(hex, 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  function getThemePalette() {
    const cs = getComputedStyle(document.documentElement);
    return ACCENT_VARS.map((name) => {
      const v = cs.getPropertyValue("--" + name).trim();
      if (!v.startsWith("#")) return null;
      const [r, g, b] = hexToRgb(v);
      return { r, g, b };
    }).filter(Boolean);
  }
  function nearestAccent(r, g, b) {
    const pal = getThemePalette();
    let best = null, bestD = Infinity;
    for (const c of pal) {
      const rm = (r + c.r) / 2, dr = r - c.r, dg = g - c.g, db = b - c.b;
      const d = (2 + rm / 256) * dr * dr + 4 * dg * dg + (2 + (255 - rm) / 256) * db * db;
      if (d < bestD) { bestD = d; best = c; }
    }
    return best;
  }
  let lastArtUrl = null;
  function applyAccent(url) {
    if (!url || url === lastArtUrl) return;
    lastArtUrl = url;
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.referrerPolicy = "no-referrer";
    img.onload = () => {
      try {
        const c = document.createElement("canvas");
        c.width = c.height = 16;
        const ctx = c.getContext("2d", { willReadFrequently: true });
        ctx.drawImage(img, 0, 0, 16, 16);
        const { data } = ctx.getImageData(0, 0, 16, 16);
        let r = 0, g = 0, b = 0, count = 0;
        for (let i = 0; i < data.length; i += 4) {
          if (data[i + 3] < 125) continue;
          const lum = 0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2];
          if (lum < 24 || lum > 235) continue;
          r += data[i]; g += data[i + 1]; b += data[i + 2]; count++;
        }
        if (!count) { resetAccent(); return; }
        r = Math.round(r / count); g = Math.round(g / count); b = Math.round(b / count);
        const near = nearestAccent(r, g, b);
        const rgb = near ? `${near.r}, ${near.g}, ${near.b}` : `${r}, ${g}, ${b}`;
        card.style.setProperty("--np-accent", rgb);
        card.classList.add("has-accent");
        document.documentElement.style.setProperty("--accent-rgb", rgb);
      } catch (e) { resetAccent(); }
    };
    img.onerror = resetAccent;
    img.src = url;
  }
  function resetAccent() {
    lastArtUrl = null;
    card.classList.remove("has-accent");
    card.style.removeProperty("--np-accent");
    document.documentElement.style.removeProperty("--accent-rgb");
  }

  // ---- section row builders ------------------------------------------------
  function rowText(kind, title, sub, extra) {
    return (
      '<span class="pc-row-text">' +
        '<span class="pc-row-kind">'  + esc(kind)  + "</span>" +
        '<span class="pc-row-title">' + esc(title) + "</span>" +
        '<span class="pc-row-sub">'   + esc(sub)   + "</span>" +
        (extra || "") +
      "</span>"
    );
  }

  function customRow(cs) {
    // cs = presence.custom_status = { text, emoji: { id, name, animated, url } }
    const row = document.createElement("div");
    row.className = "pc-row pc-custom";
    const eu = cs.emoji && (cs.emoji.url || emojiUrl(cs.emoji));
    row.innerHTML =
      (eu ? '<img class="pc-emoji" src="' + esc(eu) + '" alt="">'
          : '<span class="pc-row-ic pc-dot"></span>') +
      '<span class="pc-custom-text">' + esc(cs.text || "") + "</span>";
    return row;
  }

  function spotifyRow(s) {
    // s = presence.spotify
    const row = document.createElement("a");
    row.className = "pc-row pc-spotify";
    row.target = "_blank";
    row.rel = "noopener";
    row.href = s.track_id ? "https://open.spotify.com/track/" + s.track_id : "https://open.spotify.com/";
    if (s.album) row.title = (s.song || "") + " — " + s.album;
    if (s.timestamps && s.timestamps.start) row.dataset.start = s.timestamps.start;
    if (s.timestamps && s.timestamps.end)   row.dataset.end   = s.timestamps.end;
    row.innerHTML =
      (s.album_art_url ? '<img class="pc-art" src="' + esc(s.album_art_url) + '" alt="">' : "") +
      rowText("Listening to Spotify", s.song || "", s.artist || "",
        '<span class="pc-progress">' +
          '<span class="pc-bar"><span class="pc-fill"></span></span>' +
          '<span class="pc-times"><span class="pc-cur">0:00</span><span class="pc-dur">0:00</span></span>' +
        "</span>");
    return row;
  }

  function activityRow(a) {
    // a = one entry from presence.activities (type 0)
    const isCode = /visual studio code|vscode/i.test(a.name || "");
    const row = document.createElement("div");
    row.className = "pc-row pc-row--stack " + (isCode ? "pc-dev" : "pc-game");
    if (a.timestamps && a.timestamps.start) row.dataset.elapsedStart = a.timestamps.start;

    const large = a.assets && a.assets.large_image && assetUrl(a.application_id, a.assets.large_image);
    const small = a.assets && a.assets.small_image && assetUrl(a.application_id, a.assets.small_image);
    const iconHtml = large
      ? '<span class="pc-ic-wrap">' +
          '<img class="pc-row-ic-img" src="' + esc(large) + '" alt="">' +
          (small ? '<img class="pc-ic-badge" src="' + esc(small) + '" alt="" title="' + esc((a.assets && a.assets.small_text) || "") + '" onerror="this.remove()">' : "") +
        "</span>"
      : '<span class="pc-row-ic pc-dot"></span>';

    let kind = isCode ? "Coding" : "Playing " + (a.name || "");
    if (a.party && a.party.size && a.party.size.length === 2 && a.party.size[1]) {
      kind += " · " + a.party.size[0] + " of " + a.party.size[1];
    }

    const main = document.createElement("div");
    main.className = "pc-row-link";
    main.innerHTML = iconHtml +
      rowText(kind, a.details || (isCode ? "" : a.name) || "",
              a.state || (a.assets && a.assets.large_text) || "",
              '<span class="pc-row-elapsed"></span>');
    row.appendChild(main);

    if (a.buttons && a.buttons.length) {
      const bwrap = document.createElement("div");
      bwrap.className = "pc-buttons";
      a.buttons.forEach(function (label) {
        const b = document.createElement("span");
        b.className = "pc-btn";
        b.textContent = typeof label === "string" ? label : (label && label.label) || "Open";
        bwrap.appendChild(b);
      });
      row.appendChild(bwrap);
    }
    return row;
  }

  function streamRow(a) {
    const hasUrl = !!a.url;
    const row = document.createElement(hasUrl ? "a" : "div");
    row.className = "pc-row pc-stream";
    if (hasUrl) { row.target = "_blank"; row.rel = "noopener"; row.href = a.url; }
    const platform = (a.url && /twitch/i.test(a.url)) ? "Twitch"
                   : (a.url && /youtube/i.test(a.url)) ? "YouTube" : "Live";
    row.innerHTML =
      '<span class="pc-row-ic pc-dot"></span>' +
      rowText("Streaming on " + platform, a.details || a.name || "", a.state || "");
    return row;
  }

  // ---- render --------------------------------------------------------------
  function render(data) {
    if (!data) return;
    latest = data;

    // Your API shape: data.user + data.presence
    const u = data.user || {};
    const p = data.presence || {};

    const status = p.status || "offline";
    card.dataset.status = status;

    avImg.src = avatarUrl(u);

    // avatar decoration — not in your current API but handle if added later
    const deco = u.avatar_decoration;
    if (deco && deco.asset) {
      avDeco.src = `https://cdn.discordapp.com/avatar-decoration-presets/${deco.asset}.png?size=160`;
      avDeco.hidden = false;
    } else {
      avDeco.hidden = true;
    }

    nameEl.textContent = u.display_name || u.global_name || u.username || "Discord User";
    userEl.textContent = u.username ? "@" + u.username : "";

    // clan tag
    const clan = u.clan;
    if (clan && clan.tag) {
      const badge = guildBadgeUrl(clan);
      tagEl.innerHTML = (badge ? '<img class="pc-tag-badge" src="' + badge + '" alt="" onerror="this.remove()">' : "") +
        '<span class="pc-tag-text">' + esc(clan.tag) + "</span>";
      tagEl.hidden = false;
    } else {
      tagEl.hidden = true;
    }

    platformsEl.innerHTML = platformIcons(p.platform);

    // badges from public_flags if available, else leave empty
    if (badgesEl) badgesEl.innerHTML = renderBadges(u.public_flags || 0);

    // location kv — not in your API, hide
    metaEl.hidden = true;

    // ---- sections -----------------------------------------------------------
    sections.innerHTML = "";

    if (p.custom_status && (p.custom_status.text || (p.custom_status.emoji && p.custom_status.emoji.name))) {
      sections.appendChild(customRow(p.custom_status));
    }

    if (p.listening_to_spotify && p.spotify) {
      sections.appendChild(spotifyRow(p.spotify));
      applyAccent(p.spotify.album_art_url);
    } else {
      resetAccent();
    }

    const acts = p.activities || [];
    acts.filter((a) => a.type === 0).forEach((a) => sections.appendChild(activityRow(a)));
    acts.filter((a) => a.type === 1).forEach((a) => sections.appendChild(streamRow(a)));

    card.classList.toggle("has-sections", sections.children.length > 0);
    updateTimes();
    if (sections.querySelector("[data-start], [data-elapsed-start]")) startTicker();
    else stopTicker();

    card.hidden = false;
  }

  // ---- time tickers --------------------------------------------------------
  function updateTimes() {
    const sp = sections.querySelector(".pc-spotify[data-start][data-end]");
    if (sp) {
      const start = +sp.dataset.start, end = +sp.dataset.end;
      if (end > start) {
        const elapsed = clamp(Date.now() - start, 0, end - start);
        const fill = sp.querySelector(".pc-fill");
        const cur  = sp.querySelector(".pc-cur");
        const dur  = sp.querySelector(".pc-dur");
        if (fill) fill.style.width = clamp((elapsed / (end - start)) * 100, 0, 100) + "%";
        if (cur)  cur.textContent  = fmt(elapsed);
        if (dur)  dur.textContent  = fmt(end - start);
      }
    }
    sections.querySelectorAll("[data-elapsed-start]").forEach((row) => {
      const lbl = row.querySelector(".pc-row-elapsed");
      if (lbl) lbl.textContent = elapsedStr(+row.dataset.elapsedStart);
    });
  }
  function startTicker() { if (!ticker) ticker = setInterval(updateTimes, 1000); }
  function stopTicker()  { if (ticker) { clearInterval(ticker); ticker = null; } }

  // ---- REST polling --------------------------------------------------------
  function poll() {
    fetch(`${API_BASE}/v1/users/${DISCORD_USER_ID}`)
      .then((r) => r.ok ? r.json() : null)
      .then((j) => { if (j && j.success && j.data) render(j.data); })
      .catch(() => {});
  }

  function startPolling() {
    poll();
    if (pollTimer) clearInterval(pollTimer);
    pollTimer = setInterval(poll, POLL_INTERVAL);
  }

  // Re-poll immediately when the tab becomes visible again
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) {
      poll();
      if (latest) updateTimes();
    }
  });

  startPolling();
})();