(() => {
  'use strict';

  const $ = (s, r = document) => r.querySelector(s);
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const root = document.documentElement;

  /* ---- theme ---- */
  const isLight = () =>
    root.dataset.theme ? root.dataset.theme === 'light' : matchMedia('(prefers-color-scheme: light)').matches;
  $('#theme-toggle').addEventListener('click', () => {
    const next = isLight() ? 'dark' : 'light';
    root.dataset.theme = next;
    try { localStorage.setItem('theme', next); } catch (e) {}
  });

  /* ---- typed hero ---- */
  const typed = $('#typed');
  const lines = ['cammy-the-cat', 'systems tinkerer', 'rust + local AI', 'cammy-the-cat'];
  if (!typed) {
    // not the landing page
  } else if (reduced) {
    typed.textContent = lines[0];
  } else {
    let li = 0, ci = 0, del = false;
    const tick = () => {
      const word = lines[li];
      typed.textContent = word.slice(0, ci);
      if (!del && ci === word.length) {
        if (li === lines.length - 1) return;       // settle on the final line
        del = true; return setTimeout(tick, 1400);
      }
      if (del && ci === 0) { del = false; li++; }
      ci += del ? -1 : 1;
      setTimeout(tick, del ? 35 : 75);
    };
    tick();
  }

  /* ---- active nav link ---- */
  document.querySelectorAll('nav a').forEach(a => {
    if (location.pathname.startsWith(a.getAttribute('href'))) a.setAttribute('aria-current', 'page');
  });

  /* ---- click-to-copy cards ---- */
  document.querySelectorAll('[data-copy]').forEach(btn => {
    const note = btn.querySelector('p');
    const original = note.textContent;
    btn.addEventListener('click', async () => {
      try { await navigator.clipboard.writeText(btn.dataset.copy); note.textContent = 'Copied!'; }
      catch (e) { note.textContent = btn.dataset.copy; }
      setTimeout(() => { note.textContent = original; }, 1800);
    });
  });

  /* ---- scroll reveal ---- */
  const io = new IntersectionObserver((entries) => {
    entries.forEach(e => {
      if (!e.isIntersecting) return;
      const siblings = [...e.target.parentElement.children];
      e.target.style.transitionDelay = reduced ? '0s' : `${(siblings.indexOf(e.target) % 6) * 60}ms`;
      e.target.classList.add('in');
      io.unobserve(e.target);
    });
  }, { threshold: 0.12 });
  document.querySelectorAll('.reveal').forEach(el => io.observe(el));

  $('#year').textContent = new Date().getFullYear();
})();
