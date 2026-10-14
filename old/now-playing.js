(function () {
  const mount = document.getElementById("now-playing");
  if (!mount) return;
  
  const USER_ID = mount.dataset.user || "1110542429838397471";
  const API_URL = `https://lanyard.cammy-the-cat.com/v1/users/${USER_ID}`;

  // Inject minimalist markup
  mount.innerHTML = `
    <div class="np-minimal-card">
      <img id="np-avatar" src="" alt="Avatar" />
      <div class="np-text">
        <div id="np-name" class="np-name">booting...</div>
        <div id="np-status" class="np-status">establishing uplink</div>
      </div>
      <div id="np-indicator" class="np-dot"></div>
    </div>
  `;

  const els = {
    avatar: document.getElementById("np-avatar"),
    name: document.getElementById("np-name"),
    status: document.getElementById("np-status"),
    dot: document.getElementById("np-indicator")
  };

  async function pollLanyard() {
    try {
      const res = await fetch(API_URL);
      const { data } = await res.json();
      
      if (!data) return;
      const u = data.user || {};
      const p = data.presence || {};

      // Set Avatar (using your API's pre-built URL if available)
      els.avatar.src = u.avatar_url || `https://cdn.discordapp.com/avatars/${u.id}/${u.avatar}.png`;
      els.name.textContent = u.display_name || u.username;

      // Determine top activity or fallback to status
      let currentAction = p.status || "offline";
      if (p.activities && p.activities.length > 0) {
        const act = p.activities[0];
        currentAction = act.type === 2 && p.spotify ? `Listening to ${p.spotify.song}` : act.name;
      }
      els.status.textContent = currentAction;
      
      // Update status dot color
      els.dot.dataset.status = p.status || "offline";

    } catch (err) {
      console.error("Lanyard telemetry failed:", err);
    }
  }

  // Poll immediately, then every 15s
  pollLanyard();
  setInterval(pollLanyard, 15000);
})();