(() => {
  'use strict';

  const PROJECTS = [
    { name: 'AtlasAI', cat: 'AI', tags: ['Python', 'PySide6', 'GGUF'], url: 'https://github.com/mummypoop/AtlasAI',
      desc: 'Local AI assistant with a PySide6 GUI and a CLI fallback for GGUF models.' },
    { name: 'sophie-AI', cat: 'AI', tags: ['Python', 'GGUF', 'offline'], url: 'https://github.com/mummypoop/sophie-AI',
      desc: 'Sophie runs entirely on your machine: no internet, no external servers, no subscription.' },
    { name: 'aether-forge', cat: 'AI', tags: ['Rust', 'CPU', 'CUDA'], url: 'https://github.com/cammythekitty/aether-forge',
      desc: 'Rust-based project with CPU and CUDA build variants and an optional voice module.' },
    { name: 'AetherSchematic', cat: 'AI', tags: ['Kotlin', 'Android', 'YOLOv8'],
      desc: 'Android app running YOLOv8n on-device, drawing detections and keypoints over the camera view.' },
    { name: 'aether-api', cat: 'AI', tags: ['YOLOv8', 'Python', '3D'],
      desc: 'Experiments around YOLOv8 detection and an ESP32 3D model.' },
    { name: 'systemdtainer', cat: 'Systems', tags: ['homelab', 'web', 'systemd'], url: 'https://github.com/cammythekitty/systemdtainer',
      desc: 'Portainer for systemd: a central dashboard to start, stop and monitor units across homelab boxes, with no inbound ports.' },
    { name: 'server-dashboard-auth', cat: 'Systems', tags: ['Rust', 'crypto'],
      desc: 'Authentication service for a server dashboard, built in Rust with production-grade cryptography.' },
    { name: 'aetherOS', cat: 'Systems', tags: ['Linux', 'QEMU', 'build'],
      desc: 'Build system that compiles a Linux kernel to vmlinuz and boots it in QEMU.' },
    { name: 'SeraphByte', cat: 'Systems', tags: ['engine'], url: 'https://github.com/cammythekitty/SeraphByte',
      desc: 'Engine and website project.' },
    { name: 'webgpu-blackhole', cat: 'Graphics', tags: ['WebGPU', 'raytracing', 'physics'], url: 'https://github.com/cammythekitty/webgpu-blackhole',
      desc: 'Real-time Schwarzschild black hole raytracer with light bending, Doppler beaming, redshift and a turbulent accretion disk.' },
    { name: 'circuit-tester', cat: 'Graphics', tags: ['Rust', 'shaders'],
      desc: 'Rust circuit tester with GPU shaders.' },
    { name: 'vaelora', cat: 'Web', tags: ['HTML', 'CSS', 'JS'], url: 'https://github.com/cammythekitty/vaelora',
      desc: 'A separate, strictly professional project page.' },
    { name: 'shell_website', cat: 'Web', tags: ['frontend', 'backend'], url: 'https://github.com/cammythekitty/shell_website',
      desc: 'A website with a shell-style interface and a backend.' },
    { name: 'MulticoreModv2', cat: 'Games', tags: ['Geode', 'C++'], url: 'https://github.com/mummypoop/MulticoreModv2',
      desc: 'Geode mod that offloads safe work to background threads to ease single-core bottlenecks.' },
    { name: 'Discord-Bot', cat: 'Games', tags: ['Discord'], url: 'https://github.com/msmoscar/Discord-Bot',
      desc: 'A Discord bot.' },
  ];

  const $ = (s, r = document) => r.querySelector(s);

  /* ---- cards ---- */
  const grid = $('#grid');
  const arrow = '<span class="arrow" aria-hidden="true">↗</span>';
  PROJECTS.forEach(p => {
    const el = document.createElement(p.url ? 'a' : 'article');
    el.className = 'card reveal';
    el.dataset.cat = p.cat;
    if (p.url) { el.href = p.url; el.rel = 'noopener'; }
    el.innerHTML =
      `<h3><span>${p.name}</span>${p.url ? arrow : ''}</h3>
       <p>${p.desc}</p>
       <div class="tags">${p.tags.map(t => `<span class="tag">${t}</span>`).join('')}</div>`;
    el.addEventListener('pointermove', e => {
      const r = el.getBoundingClientRect();
      el.style.setProperty('--mx', `${e.clientX - r.left}px`);
      el.style.setProperty('--my', `${e.clientY - r.top}px`);
    });
    grid.appendChild(el);
  });

  /* ---- filters ---- */
  const cats = ['All', ...new Set(PROJECTS.map(p => p.cat))];
  const filters = $('#filters');
  const count = $('#count');
  const apply = cat => {
    let n = 0;
    grid.querySelectorAll('.card').forEach(c => {
      const show = cat === 'All' || c.dataset.cat === cat;
      c.classList.toggle('hidden', !show);
      if (show) n++;
    });
    count.textContent = `(${n})`;
    filters.querySelectorAll('.chip').forEach(b => b.setAttribute('aria-pressed', b.dataset.cat === cat));
  };
  cats.forEach(c => {
    const b = document.createElement('button');
    b.className = 'chip'; b.type = 'button'; b.textContent = c.toLowerCase(); b.dataset.cat = c;
    b.addEventListener('click', () => apply(c));
    filters.appendChild(b);
  });
  apply('All');
})();
