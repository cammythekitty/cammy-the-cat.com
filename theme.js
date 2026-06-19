// Builds the theme toggle (button + dropdown) and injects it into the page,
// then wires up its behaviour. Include this once, near the end of <body>,
// on every page — no HTML markup needed. Pair it with theme-init.js in
// <head> (before stylesheets) to avoid a flash of the wrong theme.
(function () {
    var STORAGE_KEY = 'theme';
    var root = document.documentElement;

    var wrap = document.createElement('div');
    wrap.className = 'theme-toggle';
    wrap.innerHTML =
        '<button type="button" class="theme-toggle-btn" id="theme-toggle-btn">' +
        '<span class="theme-toggle-dot"></span>' +
        '<span id="theme-toggle-label">system</span>' +
        '<span class="theme-toggle-caret">\u25BE</span>' +
        '</button>' +
        '<div class="theme-menu" id="theme-menu">' +
        '<button type="button" class="theme-option" data-theme-choice="system"><span>system</span><span class="theme-option-check">\u2713</span></button>' +
        '<button type="button" class="theme-option" data-theme-choice="light"><span>light</span><span class="theme-option-check">\u2713</span></button>' +
        '<button type="button" class="theme-option" data-theme-choice="dark"><span>dark</span><span class="theme-option-check">\u2713</span></button>' +
        '</div>';
    document.body.appendChild(wrap);

    var btn = wrap.querySelector('#theme-toggle-btn');
    var menu = wrap.querySelector('#theme-menu');
    var label = wrap.querySelector('#theme-toggle-label');
    var options = wrap.querySelectorAll('.theme-option');

    function getStoredTheme() {
        var t;
        try { t = localStorage.getItem(STORAGE_KEY); } catch (e) { t = null; }
        return (t === 'light' || t === 'dark') ? t : 'system';
    }

    function reflectUI(choice) {
        label.textContent = choice;
        options.forEach(function (opt) {
            opt.classList.toggle('is-active', opt.dataset.themeChoice === choice);
        });
    }

    function applyTheme(choice) {
        if (choice === 'light' || choice === 'dark') {
            root.setAttribute('data-theme', choice);
        } else {
            root.removeAttribute('data-theme');
        }
        reflectUI(choice);
    }

    function setTheme(choice) {
        try {
            if (choice === 'system') localStorage.removeItem(STORAGE_KEY);
            else localStorage.setItem(STORAGE_KEY, choice);
        } catch (e) { /* localStorage unavailable, just apply for this session */ }
        applyTheme(choice);
    }

    function openMenu() {
        menu.classList.add('open');
        btn.classList.add('is-open');
    }
    function closeMenu() {
        menu.classList.remove('open');
        btn.classList.remove('is-open');
    }

    btn.addEventListener('click', function (e) {
        e.stopPropagation();
        menu.classList.contains('open') ? closeMenu() : openMenu();
    });

    options.forEach(function (opt) {
        opt.addEventListener('click', function () {
            setTheme(opt.dataset.themeChoice);
            closeMenu();
        });
    });

    document.addEventListener('click', function (e) {
        if (!menu.contains(e.target) && e.target !== btn) closeMenu();
    });
    document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape') closeMenu();
    });

    // If this document is an iframe (or another tab) and someone changes the
    // theme elsewhere on the same origin, localStorage updates instantly but
    // THIS document doesn't know unless it's told — it only read localStorage
    // once, at load time. The 'storage' event fires in every other same-origin
    // browsing context when that happens, so listen for it and re-sync live.
    window.addEventListener('storage', function (e) {
        if (e.key === STORAGE_KEY) {
            applyTheme(getStoredTheme());
        }
    });

    // Actually apply the stored choice (sets data-theme + syncs the dropdown).
    // theme-init.js (if present in <head>) already did this before paint to
    // avoid a flash — calling it again here is harmless and idempotent, and
    // it's what makes this script work correctly even on pages that don't
    // include theme-init.js (you'll just get a brief flash on those pages).
    applyTheme(getStoredTheme());
})();