/* ==========================================================================
   Pavan Shiraguppi — Portfolio interactions (no dependencies)
   The page is complete without this file; everything here is enhancement.
   ========================================================================== */
(function () {
    'use strict';

    var doc = document.documentElement;
    var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    var finePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
    var $ = function (s, c) { return (c || document).querySelector(s); };
    var $$ = function (s, c) { return Array.prototype.slice.call((c || document).querySelectorAll(s)); };
    window.__siteReady = true;

    /* ---------- Year ---------- */
    var yearEl = $('#year');
    if (yearEl) yearEl.textContent = new Date().getFullYear();

    /* ---------- Toast + copy ---------- */
    var toastEl = $('#toast'), toastText = $('#toast-text'), toastTimer;
    function toast(msg) {
        if (!toastEl) return;
        toastText.textContent = msg;
        toastEl.classList.add('is-on');
        clearTimeout(toastTimer);
        toastTimer = setTimeout(function () { toastEl.classList.remove('is-on'); }, 2200);
    }
    function copyEmail(email) {
        var ok = function () { toast('Email address copied'); };
        var fallback = function () { window.location.href = 'mailto:' + email; };
        if (navigator.clipboard && window.isSecureContext) {
            navigator.clipboard.writeText(email).then(ok, fallback);
        } else {
            var ta = document.createElement('textarea');
            ta.value = email; ta.setAttribute('readonly', ''); ta.style.position = 'fixed'; ta.style.opacity = '0';
            document.body.appendChild(ta); ta.select();
            try { document.execCommand('copy') ? ok() : fallback(); } catch (e) { fallback(); }
            document.body.removeChild(ta);
        }
    }
    $$('[data-copy]').forEach(function (b) { b.addEventListener('click', function () { copyEmail(b.getAttribute('data-copy')); }); });

    /* ---------- Mobile menu ---------- */
    var menuBtn = $('#menu-btn'), menu = $('#mobile-menu');
    function setMenu(open) {
        doc.classList.toggle('menu-open', open);
        if (!menuBtn) return;
        menuBtn.setAttribute('aria-expanded', String(open));
        menuBtn.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
        if (menu) menu.setAttribute('aria-hidden', String(!open));
    }
    if (menuBtn) menuBtn.addEventListener('click', function () { setMenu(!doc.classList.contains('menu-open')); });
    $$('#mobile-menu a').forEach(function (a) { a.addEventListener('click', function () { setMenu(false); }); });
    window.addEventListener('resize', function () { if (window.innerWidth >= 980) setMenu(false); });

    /* ---------- Theme ---------- */
    var themeBtn = $('#theme-toggle'), shader = null;
    function applyTheme(t) {
        doc.setAttribute('data-theme', t);
        try { localStorage.setItem('site-theme', t); } catch (e) { }
        var meta = $('meta[name="theme-color"]:not([media])');
        if (meta) meta.setAttribute('content', t === 'light' ? '#f3f3f1' : '#060607');
        if (shader) shader.setLight(t === 'light');
    }
    function toggleTheme() {
        var next = doc.getAttribute('data-theme') === 'light' ? 'dark' : 'light';
        if (!document.startViewTransition || reduceMotion || !themeBtn) { applyTheme(next); return; }
        var r = themeBtn.getBoundingClientRect();
        var x = r.left + r.width / 2, y = r.top + r.height / 2;
        var end = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y));
        var vt = document.startViewTransition(function () { applyTheme(next); });
        vt.ready.then(function () {
            doc.animate({ clipPath: ['circle(0px at ' + x + 'px ' + y + 'px)', 'circle(' + end + 'px at ' + x + 'px ' + y + 'px)'] },
                { duration: 600, easing: 'cubic-bezier(0.22, 1, 0.36, 1)', pseudoElement: '::view-transition-new(root)' });
        }).catch(function () { });
    }
    if (themeBtn) themeBtn.addEventListener('click', toggleTheme);

    /* ---------- Hero shader: slow, low-contrast liquid chrome ---------- */
    function createShader(canvas) {
        var gl = canvas.getContext('webgl', { antialias: false, alpha: false, powerPreference: 'low-power' });
        if (!gl) return null;
        var vs = 'attribute vec2 p;void main(){gl_Position=vec4(p,0.,1.);}';
        var fs = [
            'precision mediump float;',
            'uniform vec2 r;uniform float t;uniform float L;',
            'float h(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}',
            'float n(vec2 p){vec2 i=floor(p),f=fract(p);vec2 u=f*f*(3.-2.*f);',
            ' return mix(mix(h(i),h(i+vec2(1,0)),u.x),mix(h(i+vec2(0,1)),h(i+vec2(1,1)),u.x),u.y);}',
            'float fbm(vec2 p){float v=0.,a=.5;mat2 R=mat2(.8,.6,-.6,.8);for(int i=0;i<5;i++){v+=a*n(p);p=R*p*2.02;a*=.5;}return v;}',
            'void main(){',
            ' vec2 uv=(gl_FragCoord.xy-.5*r)/r.y;',
            ' float T=t*.035;',
            ' vec2 q=vec2(fbm(uv*1.2+T),fbm(uv*1.2+vec2(5.2,1.3)-T));',
            ' vec2 w=vec2(fbm(uv*1.2+2.6*q+vec2(1.7,9.2)+T*1.2),fbm(uv*1.2+2.6*q+vec2(8.3,2.8)-T));',
            ' float f=fbm(uv*1.2+3.*w);',
            ' float band=pow(.5+.5*sin(f*9.+t*.12+length(w)*3.),6.);',
            ' float c=.035+.30*f*f+.10*band;',
            ' c*=smoothstep(-.9,.9,uv.x+.25);',
            ' c*=1.-.5*smoothstep(.35,1.25,length(uv*vec2(.7,1.)));',
            ' vec3 col=vec3(c)*vec3(.98,.99,1.03);',
            ' if(L>.5){col=vec3(.955)-col*.42;}',
            ' gl_FragColor=vec4(col,1.);',
            '}'
        ].join('\n');
        function compile(type, src) {
            var s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s);
            return gl.getShaderParameter(s, gl.COMPILE_STATUS) ? s : null;
        }
        var v = compile(gl.VERTEX_SHADER, vs), f = compile(gl.FRAGMENT_SHADER, fs);
        if (!v || !f) return null;
        var pr = gl.createProgram(); gl.attachShader(pr, v); gl.attachShader(pr, f); gl.linkProgram(pr);
        if (!gl.getProgramParameter(pr, gl.LINK_STATUS)) return null;
        gl.useProgram(pr);
        gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
        var loc = gl.getAttribLocation(pr, 'p'); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
        var uR = gl.getUniformLocation(pr, 'r'), uT = gl.getUniformLocation(pr, 't'), uL = gl.getUniformLocation(pr, 'L');

        var running = false, visible = true, start = performance.now(), light = doc.getAttribute('data-theme') === 'light' ? 1 : 0;
        function resize() {
            var dpr = Math.min(window.devicePixelRatio || 1, 2) * 0.5;
            canvas.width = Math.max(1, Math.round(canvas.clientWidth * dpr));
            canvas.height = Math.max(1, Math.round(canvas.clientHeight * dpr));
            gl.viewport(0, 0, canvas.width, canvas.height);
            if (!running) draw(performance.now());
        }
        function draw(now) {
            gl.uniform2f(uR, canvas.width, canvas.height);
            gl.uniform1f(uT, reduceMotion ? 20 : (now - start) / 1000 + 20);
            gl.uniform1f(uL, light);
            gl.drawArrays(gl.TRIANGLES, 0, 3);
        }
        function frame(now) { if (!running) return; draw(now); requestAnimationFrame(frame); }
        function play() { if (reduceMotion) { draw(performance.now()); return; } if (running || !visible || document.hidden) return; running = true; requestAnimationFrame(frame); }
        function stop() { running = false; }
        resize();
        window.addEventListener('resize', resize);
        new IntersectionObserver(function (e) { visible = e[0].isIntersecting; visible ? play() : stop(); }).observe(canvas);
        document.addEventListener('visibilitychange', function () { document.hidden ? stop() : play(); });
        return { play: play, setLight: function (on) { light = on ? 1 : 0; draw(performance.now()); } };
    }
    var canvas = $('#hero-canvas');
    if (canvas) {
        try { shader = createShader(canvas); } catch (e) { shader = null; }
        if (shader) shader.play(); else canvas.style.display = 'none';
    }

    /* ---------- Pointer: one quiet dot, exact tracking ---------- */
    (function () {
        var cur = $('#cursor');
        if (!cur || !finePointer || reduceMotion) { if (cur) cur.style.display = 'none'; return; }
        doc.classList.add('has-cursor');
        window.addEventListener('pointermove', function (e) {
            if (e.pointerType && e.pointerType !== 'mouse') return;
            cur.style.transform = 'translate3d(' + e.clientX + 'px,' + e.clientY + 'px,0)';
            cur.classList.add('is-visible');
        }, { passive: true });
        document.addEventListener('mouseleave', function () { cur.classList.remove('is-visible'); });
        document.addEventListener('mouseover', function (e) {
            var t = e.target.closest ? e.target : e.target.parentElement;
            cur.classList.toggle('is-text', !!t.closest('input, textarea'));
            cur.classList.toggle('is-link', !!t.closest('a, button, [role="tab"], label'));
        });
        window.addEventListener('mousedown', function () { cur.classList.add('is-down'); });
        window.addEventListener('mouseup', function () { cur.classList.remove('is-down'); });
    })();

    /* ---------- Card spotlight (desktop only, subtle) ---------- */
    if (finePointer) {
        document.addEventListener('pointermove', function (e) {
            var card = e.target.closest && e.target.closest('.card--spot');
            if (!card) return;
            var r = card.getBoundingClientRect();
            card.style.setProperty('--mx', (e.clientX - r.left) + 'px');
            card.style.setProperty('--my', (e.clientY - r.top) + 'px');
        }, { passive: true });
    }

    /* ---------- Reveal on scroll ---------- */
    var revealEls = $$('.reveal');
    if (reduceMotion || !('IntersectionObserver' in window)) {
        revealEls.forEach(function (el) { el.classList.add('is-in'); });
    } else {
        var io = new IntersectionObserver(function (entries) {
            var batch = entries.filter(function (e) { return e.isIntersecting; });
            batch.forEach(function (e, i) {
                e.target.style.transitionDelay = Math.min(i * 70, 280) + 'ms';
                e.target.classList.add('is-in');
                io.unobserve(e.target);
            });
        }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });
        revealEls.forEach(function (el) { io.observe(el); });
    }

    /* ---------- Count-up (once, short) ---------- */
    function countUp(el) {
        var to = parseFloat(el.getAttribute('data-to')), pre = el.getAttribute('data-prefix') || '', suf = el.getAttribute('data-suffix') || '';
        var t0 = null, dur = 1400;
        function step(t) {
            if (!t0) t0 = t;
            var p = Math.min(1, (t - t0) / dur), eased = 1 - Math.pow(1 - p, 4);
            el.textContent = pre + Math.round(to * eased) + suf;
            if (p < 1) requestAnimationFrame(step);
        }
        requestAnimationFrame(step);
    }
    if (!reduceMotion && 'IntersectionObserver' in window) {
        var cio = new IntersectionObserver(function (entries) {
            entries.forEach(function (e) { if (e.isIntersecting) { countUp(e.target); cio.unobserve(e.target); } });
        }, { threshold: 0.6 });
        $$('.count').forEach(function (el) { cio.observe(el); });
    }

    /* ---------- Nav: scrolled state, progress, active section ---------- */
    var nav = $('#nav'), progress = $('#progress'), rail = $('#xp-rail'), xpList = $('#xp-list'), ticking = false;
    function onScroll() {
        ticking = false;
        var y = window.scrollY, max = doc.scrollHeight - innerHeight;
        if (progress) progress.style.transform = 'scaleX(' + (max > 0 ? y / max : 0) + ')';
        if (nav) nav.classList.toggle('is-scrolled', y > 24);
        if (rail && xpList && !reduceMotion) {
            var r = xpList.getBoundingClientRect(), mid = innerHeight * 0.6;
            var p = Math.max(0, Math.min(1, (mid - r.top) / r.height));
            rail.style.setProperty('--p', p.toFixed(3));
        }
    }
    window.addEventListener('scroll', function () { if (!ticking) { ticking = true; requestAnimationFrame(onScroll); } }, { passive: true });
    onScroll();

    var pill = $('#nav-pill'), links = $$('.nav__link');
    function movePill(link) {
        if (!pill) return;
        if (!link) { pill.style.opacity = '0'; return; }
        pill.style.opacity = '1';
        pill.style.width = link.offsetWidth + 'px';
        pill.style.transform = 'translateX(' + link.offsetLeft + 'px)';
    }
    var linkFor = {};
    links.forEach(function (l) { (l.getAttribute('data-for') || '').split(' ').forEach(function (id) { if (id) linkFor[id] = l; }); });
    if ('IntersectionObserver' in window) {
        var spy = new IntersectionObserver(function (entries) {
            entries.forEach(function (en) {
                if (!en.isIntersecting) return;
                var link = linkFor[en.target.id] || null;
                links.forEach(function (l) {
                    var on = l === link;
                    l.classList.toggle('is-active', on);
                    if (on) l.setAttribute('aria-current', 'true'); else l.removeAttribute('aria-current');
                });
                movePill(link);
            });
        }, { rootMargin: '-45% 0px -50% 0px' });
        $$('main > section[id]').forEach(function (s) { spy.observe(s); });
    }
    window.addEventListener('resize', function () { movePill($('.nav__link.is-active')); });

    /* ---------- Case study tabs ---------- */
    (function () {
        var tabs = $$('.case-tab'), panels = $$('.case');
        if (!tabs.length) return;
        function select(i, focus) {
            tabs.forEach(function (t, k) {
                var on = k === i;
                t.setAttribute('aria-selected', String(on));
                t.tabIndex = on ? 0 : -1;
                panels[k].hidden = !on;
                if (on) {
                    panels[k].classList.remove('is-entering'); void panels[k].offsetWidth; panels[k].classList.add('is-entering');
                    if (focus) t.focus();
                    if (t.scrollIntoView && window.innerWidth < 1000) t.parentElement.scrollTo({ left: t.offsetLeft - t.parentElement.offsetLeft - 20, behavior: reduceMotion ? 'auto' : 'smooth' });
                }
            });
        }
        tabs.forEach(function (t, i) {
            t.addEventListener('click', function () { select(i, false); });
            t.addEventListener('keydown', function (e) {
                var n = tabs.length, k = null;
                if (e.key === 'ArrowDown' || e.key === 'ArrowRight') k = (i + 1) % n;
                else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') k = (i - 1 + n) % n;
                else if (e.key === 'Home') k = 0; else if (e.key === 'End') k = n - 1;
                if (k !== null) { e.preventDefault(); select(k, true); }
            });
        });
        select(0, false);
        panels.forEach(function (p) { p.classList.remove('is-entering'); });
    })();

    /* ---------- Skills filter ---------- */
    var filters = $$('.filter');
    filters.forEach(function (b) {
        b.addEventListener('click', function () {
            var f = b.getAttribute('data-filter');
            filters.forEach(function (x) { x.setAttribute('aria-pressed', String(x === b)); });
            $$('.skill').forEach(function (s) {
                var cats = (s.getAttribute('data-cat') || '').split(' ');
                s.classList.toggle('is-dim', f !== 'all' && cats.indexOf(f) === -1);
            });
        });
    });

    /* ---------- Architecture: calm routing cycle ---------- */
    (function () {
        var agents = $$('#agents .agent'), log = $('#arch-log'), arch = $('#arch');
        if (!agents.length || !arch) return;
        var names = ['plan', 'build', 'review', 'test', 'release'];
        var i = 0, timer = null;
        function step() {
            agents.forEach(function (a, k) { a.classList.toggle('is-active', k === i); });
            if (log) log.textContent = 'orchestrator → ' + names[i] + '-agent';
            i = (i + 1) % agents.length;
        }
        step();
        if (reduceMotion) return;
        new IntersectionObserver(function (e) {
            if (e[0].isIntersecting) { if (!timer) timer = setInterval(step, 2200); }
            else { clearInterval(timer); timer = null; }
        }).observe(arch);
    })();

    /* ---------- Command palette (⌘K / Ctrl K) ---------- */
    (function () {
        var root = $('#cmdk'), input = $('#cmdk-input'), list = $('#cmdk-list'), openBtn = $('#cmdk-open'), kbd = $('#cmdk-kbd');
        if (!root) return;
        var isMac = /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);
        if (kbd) kbd.textContent = isMac ? '⌘K' : 'Ctrl K';
        var ic = {
            go: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg>',
            mail: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/></svg>',
            copy: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h10"/></svg>',
            file: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v12M7 10l5 5 5-5M4 21h16"/></svg>',
            link: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M7 17 17 7M8 7h9v9"/></svg>',
            theme: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 3v18a9 9 0 0 0 0-18z" fill="currentColor"/></svg>'
        };
        function go(id) { return function () { var el = document.getElementById(id); if (el) el.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth' }); }; }
        var items = [
            { g: 'Go to', t: 'About', k: 'bio profile summary', i: ic.go, run: go('about') },
            { g: 'Go to', t: 'Services', k: 'how I help offerings consulting', i: ic.go, run: go('services') },
            { g: 'Go to', t: 'Current engagement · Woven by Toyota', k: 'now agentic sdlc orchestrator remote agents aws', i: ic.go, run: go('now') },
            { g: 'Go to', t: 'Case studies', k: 'work engagements results', i: ic.go, run: go('work') },
            { g: 'Go to', t: 'Testimonials', k: 'recommendations references', i: ic.go, run: go('testimonials') },
            { g: 'Go to', t: 'Experience', k: 'career timeline ibm turing', i: ic.go, run: go('experience') },
            { g: 'Go to', t: 'Expertise', k: 'skills stack aws kubernetes', i: ic.go, run: go('expertise') },
            { g: 'Go to', t: 'Credentials', k: 'education certification claude mba', i: ic.go, run: go('credentials') },
            { g: 'Go to', t: 'Contact', k: 'hire talk email', i: ic.go, run: go('contact') },
            { g: 'Actions', t: 'Copy email address', k: 'mail', i: ic.copy, run: function () { copyEmail('shiraguppipavan@gmail.com'); } },
            { g: 'Actions', t: 'Send an email', k: 'contact mail', i: ic.mail, run: function () { location.href = 'mailto:shiraguppipavan@gmail.com'; } },
            { g: 'Actions', t: 'Download CV', k: 'resume pdf', i: ic.file, run: function () { var a = document.createElement('a'); a.href = 'resume.pdf'; a.download = ''; document.body.appendChild(a); a.click(); a.remove(); } },
            { g: 'Actions', t: 'Open LinkedIn profile', k: 'social', i: ic.link, run: function () { window.open('https://linkedin.com/in/pavan-shiraguppi', '_blank', 'noopener'); } },
            { g: 'Actions', t: 'Switch light / dark theme', k: 'mode appearance', i: ic.theme, run: toggleTheme }
        ];
        var filtered = items, sel = 0, lastFocus = null;
        function esc(s) { return s.replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
        function render() {
            var q = input.value.trim().toLowerCase();
            filtered = items.filter(function (it) { return !q || (it.t + ' ' + it.k).toLowerCase().indexOf(q) !== -1; });
            if (sel >= filtered.length) sel = 0;
            if (!filtered.length) { list.innerHTML = '<div class="cmdk__empty">No results for “' + esc(q) + '”</div>'; input.removeAttribute('aria-activedescendant'); return; }
            var html = '', group = '';
            filtered.forEach(function (it, idx) {
                if (it.g !== group) { group = it.g; html += '<div class="cmdk__group" role="presentation">' + group + '</div>'; }
                html += '<button type="button" class="cmdk__item" role="option" tabindex="-1" id="cmdk-opt-' + idx + '" data-idx="' + idx + '" aria-selected="' + (idx === sel) + '">' + it.i + '<span>' + esc(it.t) + '</span></button>';
            });
            list.innerHTML = html;
            input.setAttribute('aria-activedescendant', 'cmdk-opt-' + sel);
        }
        function highlight() {
            $$('.cmdk__item', list).forEach(function (b) { b.setAttribute('aria-selected', String(+b.getAttribute('data-idx') === sel)); });
            input.setAttribute('aria-activedescendant', 'cmdk-opt-' + sel);
            var cur = document.getElementById('cmdk-opt-' + sel); if (cur) cur.scrollIntoView({ block: 'nearest' });
        }
        function open() { lastFocus = document.activeElement; root.hidden = false; input.value = ''; sel = 0; render(); input.focus(); }
        function close() { if (root.hidden) return; root.hidden = true; if (lastFocus && lastFocus.focus) lastFocus.focus({ preventScroll: true }); }
        function run(idx) { var it = filtered[idx]; if (!it) return; close(); setTimeout(it.run, 40); }
        if (openBtn) openBtn.addEventListener('click', open);
        input.addEventListener('input', function () { sel = 0; render(); });
        list.addEventListener('click', function (e) { var b = e.target.closest('.cmdk__item'); if (b) run(+b.getAttribute('data-idx')); });
        list.addEventListener('mousemove', function (e) { var b = e.target.closest('.cmdk__item'); if (b && +b.getAttribute('data-idx') !== sel) { sel = +b.getAttribute('data-idx'); highlight(); } });
        root.addEventListener('click', function (e) { if (e.target.hasAttribute('data-cmdk-close')) close(); });
        root.addEventListener('keydown', function (e) {
            var n = Math.max(1, filtered.length);
            if (e.key === 'ArrowDown') { e.preventDefault(); sel = (sel + 1) % n; highlight(); }
            else if (e.key === 'ArrowUp') { e.preventDefault(); sel = (sel - 1 + n) % n; highlight(); }
            else if (e.key === 'Enter') { e.preventDefault(); run(sel); }
            else if (e.key === 'Escape') { e.preventDefault(); close(); }
            else if (e.key === 'Tab') { e.preventDefault(); input.focus(); }
        });
        document.addEventListener('keydown', function (e) {
            if ((e.metaKey || e.ctrlKey) && (e.key === 'k' || e.key === 'K')) { e.preventDefault(); root.hidden ? open() : close(); }
            else if (e.key === 'Escape') setMenu(false);
        });
    })();
})();
