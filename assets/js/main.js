/* ==========================================================================
   Pavan Shiraguppi — Portfolio interactions
   Everything degrades gracefully: without GSAP/Lenis/WebGL the page is static
   but complete.
   ========================================================================== */
(function () {
    'use strict';

    var doc = document.documentElement;
    var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    var finePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
    var hasGsap = typeof window.gsap !== 'undefined' && typeof window.ScrollTrigger !== 'undefined';
    var $ = function (s, c) { return (c || document).querySelector(s); };
    var $$ = function (s, c) { return Array.prototype.slice.call((c || document).querySelectorAll(s)); };

    if (!hasGsap) { doc.classList.add('reveal-all'); }
    else { gsap.registerPlugin(ScrollTrigger); }

    /* ---------- Small utilities ---------- */
    var yearEl = $('#year');
    if (yearEl) yearEl.textContent = new Date().getFullYear();

    var clockEl = $('#clock');
    function tick() {
        if (!clockEl) return;
        try {
            clockEl.textContent = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Kolkata' }).format(new Date());
        } catch (e) { clockEl.textContent = ''; }
    }
    tick(); setInterval(tick, 15000);

    var toastEl = $('#toast'), toastText = $('#toast-text'), toastTimer;
    function toast(msg) {
        if (!toastEl) return;
        toastText.textContent = msg;
        toastEl.classList.add('is-on');
        clearTimeout(toastTimer);
        toastTimer = setTimeout(function () { toastEl.classList.remove('is-on'); }, 2200);
    }

    function copy(text) {
        var done = function () { toast('Email copied to clipboard'); };
        if (navigator.clipboard && window.isSecureContext) {
            navigator.clipboard.writeText(text).then(done, function () { window.location.href = 'mailto:' + text; });
        } else {
            var ta = document.createElement('textarea');
            ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
            document.body.appendChild(ta); ta.select();
            try { document.execCommand('copy'); done(); } catch (e) { window.location.href = 'mailto:' + text; }
            document.body.removeChild(ta);
        }
    }

    /* ---------- Smooth scroll (Lenis) ---------- */
    var lenis = null;
    if (typeof window.Lenis !== 'undefined' && !reduceMotion) {
        lenis = new Lenis({ duration: 1.15, easing: function (t) { return Math.min(1, 1.001 - Math.pow(2, -10 * t)); } });
        if (hasGsap) {
            lenis.on('scroll', ScrollTrigger.update);
            gsap.ticker.add(function (t) { lenis.raf(t * 1000); });
            gsap.ticker.lagSmoothing(0);
        } else {
            var raf = function (t) { lenis.raf(t); requestAnimationFrame(raf); };
            requestAnimationFrame(raf);
        }
    }

    function scrollToTarget(target) {
        var el = typeof target === 'string' ? $(target) : target;
        if (!el) return;
        var offset = el.id === 'hero' ? 0 : -24;
        if (lenis) lenis.scrollTo(el, { offset: offset, duration: 1.4 });
        else el.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' });
        if (el.id && history.replaceState) history.replaceState(null, '', el.id === 'hero' ? location.pathname : '#' + el.id);
    }

    document.addEventListener('click', function (e) {
        var a = e.target.closest && e.target.closest('a[href^="#"]');
        if (!a) return;
        var id = a.getAttribute('href');
        if (id.length < 2) return;
        var el = $(id);
        if (!el) return;
        e.preventDefault();
        closeMenu();
        scrollToTarget(el);
        if (id === '#main' || id === '#hero') return;
        el.setAttribute('tabindex', '-1');
        el.focus({ preventScroll: true });
    });

    /* ---------- Mobile menu ---------- */
    var menuBtn = $('#menu-btn');
    function openMenu() {
        doc.classList.add('menu-open');
        menuBtn.setAttribute('aria-expanded', 'true');
        menuBtn.setAttribute('aria-label', 'Close menu');
        if (lenis) lenis.stop();
    }
    function closeMenu() {
        if (!doc.classList.contains('menu-open')) return;
        doc.classList.remove('menu-open');
        menuBtn.setAttribute('aria-expanded', 'false');
        menuBtn.setAttribute('aria-label', 'Open menu');
        if (lenis) lenis.start();
    }
    if (menuBtn) menuBtn.addEventListener('click', function () {
        doc.classList.contains('menu-open') ? closeMenu() : openMenu();
    });

    /* ---------- Theme (with circular View Transition) ---------- */
    var themeBtn = $('#theme-toggle');
    var shader = null; // set later
    function applyTheme(t) {
        doc.setAttribute('data-theme', t);
        try { localStorage.setItem('site-theme', t); } catch (e) { }
        if (shader) shader.setLight(t === 'light');
    }
    function toggleTheme(originEl) {
        var next = doc.getAttribute('data-theme') === 'light' ? 'dark' : 'light';
        if (!document.startViewTransition || reduceMotion) { applyTheme(next); return; }
        var r = (originEl || themeBtn).getBoundingClientRect();
        var x = r.left + r.width / 2, y = r.top + r.height / 2;
        var end = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y));
        var vt = document.startViewTransition(function () { applyTheme(next); });
        vt.ready.then(function () {
            doc.animate({ clipPath: ['circle(0px at ' + x + 'px ' + y + 'px)', 'circle(' + end + 'px at ' + x + 'px ' + y + 'px)'] },
                { duration: 750, easing: 'cubic-bezier(0.65, 0, 0.35, 1)', pseudoElement: '::view-transition-new(root)' });
        });
    }
    if (themeBtn) themeBtn.addEventListener('click', function () { toggleTheme(themeBtn); });

    /* ---------- Hero shader: liquid chrome ---------- */
    function createShader(canvas) {
        var gl = canvas.getContext('webgl', { antialias: false, alpha: false, powerPreference: 'low-power' });
        if (!gl) return null;
        var vs = 'attribute vec2 p;void main(){gl_Position=vec4(p,0.,1.);}';
        var fs = [
            'precision highp float;',
            'uniform vec2 r;uniform float t;uniform vec2 m;uniform float L;',
            'float h(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}',
            'float n(vec2 p){vec2 i=floor(p),f=fract(p);vec2 u=f*f*(3.-2.*f);',
            ' return mix(mix(h(i),h(i+vec2(1,0)),u.x),mix(h(i+vec2(0,1)),h(i+vec2(1,1)),u.x),u.y);}',
            'float fbm(vec2 p){float v=0.,a=.5;mat2 R=mat2(.8,.6,-.6,.8);for(int i=0;i<5;i++){v+=a*n(p);p=R*p*2.02;a*=.5;}return v;}',
            'void main(){',
            ' vec2 uv=(gl_FragCoord.xy-.5*r)/r.y;',
            ' vec2 mm=(m-.5*r)/r.y; float d=length(uv-mm);',
            ' float T=t*.06;',
            ' vec2 q=vec2(fbm(uv*1.3+T),fbm(uv*1.3+vec2(5.2,1.3)-T));',
            ' vec2 w=vec2(fbm(uv*1.3+2.8*q+vec2(1.7,9.2)+T*1.3+.35*exp(-d*2.5)),fbm(uv*1.3+2.8*q+vec2(8.3,2.8)-T*1.1));',
            ' float f=fbm(uv*1.3+3.2*w);',
            ' float band=pow(.5+.5*sin(f*11.+t*.25+length(w)*4.),5.);',
            ' float c=.03+.42*f*f+.2*band+.08*exp(-d*3.);',
            ' c*=1.-.65*smoothstep(.3,1.3,length(uv*vec2(.75,1.)));',
            ' vec3 col=vec3(c)*vec3(.97,.99,1.05);',
            ' if(L>.5){col=vec3(.93)-col*.55;}',
            ' col+= (h(gl_FragCoord.xy+t)-.5)*.02;',
            ' gl_FragColor=vec4(col,1.);',
            '}'
        ].join('\n');
        function sh(type, src) {
            var s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s);
            if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) { return null; }
            return s;
        }
        var v = sh(gl.VERTEX_SHADER, vs), f = sh(gl.FRAGMENT_SHADER, fs);
        if (!v || !f) return null;
        var pr = gl.createProgram(); gl.attachShader(pr, v); gl.attachShader(pr, f); gl.linkProgram(pr);
        if (!gl.getProgramParameter(pr, gl.LINK_STATUS)) return null;
        gl.useProgram(pr);
        var buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buf);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
        var loc = gl.getAttribLocation(pr, 'p'); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
        var uR = gl.getUniformLocation(pr, 'r'), uT = gl.getUniformLocation(pr, 't'), uM = gl.getUniformLocation(pr, 'm'), uL = gl.getUniformLocation(pr, 'L');

        var scale = 0.5, running = false, visible = true, start = performance.now();
        var mouse = { x: 0, y: 0, tx: 0, ty: 0 }, light = doc.getAttribute('data-theme') === 'light' ? 1 : 0;
        function resize() {
            var w = canvas.clientWidth, hgt = canvas.clientHeight;
            var dpr = Math.min(window.devicePixelRatio || 1, 2) * scale;
            canvas.width = Math.max(1, Math.round(w * dpr)); canvas.height = Math.max(1, Math.round(hgt * dpr));
            gl.viewport(0, 0, canvas.width, canvas.height);
            mouse.tx = mouse.x = canvas.width * 0.65; mouse.ty = mouse.y = canvas.height * 0.6;
        }
        function frame(now) {
            if (!running) return;
            mouse.x += (mouse.tx - mouse.x) * 0.05; mouse.y += (mouse.ty - mouse.y) * 0.05;
            gl.uniform2f(uR, canvas.width, canvas.height);
            gl.uniform1f(uT, reduceMotion ? 12 : (now - start) / 1000);
            gl.uniform2f(uM, mouse.x, mouse.y);
            gl.uniform1f(uL, light);
            gl.drawArrays(gl.TRIANGLES, 0, 3);
            if (reduceMotion) { running = false; return; }
            requestAnimationFrame(frame);
        }
        function play() { if (running || !visible) return; running = true; requestAnimationFrame(frame); }
        function stop() { running = false; }
        resize();
        window.addEventListener('resize', resize);
        canvas.parentElement.addEventListener('pointermove', function (e) {
            var rc = canvas.getBoundingClientRect();
            mouse.tx = (e.clientX - rc.left) / rc.width * canvas.width;
            mouse.ty = (1 - (e.clientY - rc.top) / rc.height) * canvas.height;
        });
        new IntersectionObserver(function (ents) {
            visible = ents[0].isIntersecting;
            visible && !document.hidden ? play() : stop();
        }).observe(canvas);
        document.addEventListener('visibilitychange', function () { document.hidden ? stop() : play(); });
        return {
            play: play,
            setLight: function (on) { light = on ? 1 : 0; if (!running) { running = true; requestAnimationFrame(function (n) { frame(n); if (reduceMotion) running = false; }); } }
        };
    }
    var canvas = $('#hero-canvas');
    if (canvas) {
        try { shader = createShader(canvas); } catch (e) { shader = null; }
        if (shader) shader.play(); else canvas.style.display = 'none';
    }

    /* ---------- Custom cursor ---------- */
    if (finePointer && !reduceMotion) {
        var cursor = $('#cursor'), label = $('#cursor-label');
        doc.classList.add('has-cursor');
        var cx = innerWidth / 2, cy = innerHeight / 2, rx = cx, ry = cy;
        var dot = $('.cursor__dot', cursor), ring = $('.cursor__ring', cursor);
        window.addEventListener('pointermove', function (e) { cx = e.clientX; cy = e.clientY; cursor.classList.remove('is-hidden'); }, { passive: true });
        document.addEventListener('pointerleave', function () { cursor.classList.add('is-hidden'); });
        (function loop() {
            rx += (cx - rx) * 0.18; ry += (cy - ry) * 0.18;
            dot.style.transform = 'translate3d(' + cx + 'px,' + cy + 'px,0)';
            ring.style.transform = 'translate3d(' + rx + 'px,' + ry + 'px,0)';
            requestAnimationFrame(loop);
        })();
        document.addEventListener('pointerover', function (e) {
            var t = e.target.closest && e.target.closest('[data-cursor], [data-cursor-hover], a, button, .chip-btn');
            if (!t) { cursor.classList.remove('is-hover', 'has-label'); return; }
            var l = t.getAttribute('data-cursor');
            if (l) { label.textContent = l; cursor.classList.add('has-label'); cursor.classList.remove('is-hover'); }
            else { cursor.classList.add('is-hover'); cursor.classList.remove('has-label'); }
        });
    } else {
        var c = $('#cursor'); if (c) c.style.display = 'none';
    }

    /* ---------- Magnetic buttons ---------- */
    if (finePointer && !reduceMotion) {
        $$('.magnetic').forEach(function (el) {
            el.addEventListener('pointermove', function (e) {
                var r = el.getBoundingClientRect();
                var x = e.clientX - r.left - r.width / 2, y = e.clientY - r.top - r.height / 2;
                el.style.transform = 'translate(' + x * 0.25 + 'px,' + y * 0.35 + 'px)';
            });
            el.addEventListener('pointerleave', function () { el.style.transform = ''; });
        });
    }

    /* ---------- Card spotlight ---------- */
    if (finePointer) {
        document.addEventListener('pointermove', function (e) {
            var card = e.target.closest && e.target.closest('.card');
            if (!card) return;
            var r = card.getBoundingClientRect();
            card.style.setProperty('--mx', (e.clientX - r.left) + 'px');
            card.style.setProperty('--my', (e.clientY - r.top) + 'px');
        }, { passive: true });
    }

    /* ---------- Nav: hide on scroll down, active section pill, progress ---------- */
    var nav = $('#nav'), progress = $('#progress'), lastY = 0;
    function onScroll() {
        var y = window.scrollY || window.pageYOffset;
        var max = document.documentElement.scrollHeight - innerHeight;
        if (progress) progress.style.transform = 'scaleX(' + (max > 0 ? y / max : 0) + ')';
        if (!doc.classList.contains('menu-open')) {
            if (y > lastY + 4 && y > 400) nav.classList.add('is-hidden');
            else if (y < lastY - 4) nav.classList.remove('is-hidden');
        }
        lastY = y;
    }
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();

    var pill = $('#nav-pill'), links = $$('.nav__link');
    function movePill(link) {
        if (!pill) return;
        if (!link) { pill.style.opacity = '0'; return; }
        pill.style.opacity = '1';
        pill.style.width = link.offsetWidth + 'px';
        pill.style.transform = 'translateX(' + link.offsetLeft + 'px)';
    }
    var sectionMap = {};
    links.forEach(function (l) { sectionMap[l.dataset.section] = l; });
    var activeId = null;
    var spy = new IntersectionObserver(function (entries) {
        entries.forEach(function (en) {
            if (en.isIntersecting) {
                var id = en.target.id;
                var link = sectionMap[id] || null;
                if (id === 'impact') link = sectionMap.now;
                if (id === 'process') link = sectionMap.work;
                if (id === 'projects' || id === 'credentials' || id === 'testimonials') link = sectionMap.expertise;
                if (id === 'hero') link = null;
                activeId = id;
                links.forEach(function (l) { l.classList.toggle('is-active', l === link); if (l === link) l.setAttribute('aria-current', 'true'); else l.removeAttribute('aria-current'); });
                movePill(link);
            }
        });
    }, { rootMargin: '-45% 0px -50% 0px' });
    $$('main > section').forEach(function (s) { spy.observe(s); });
    window.addEventListener('resize', function () { movePill($('.nav__link.is-active')); });

    /* ---------- Skills filter ---------- */
    var filterBtns = $$('.chip-btn[data-filter]');
    filterBtns.forEach(function (b) {
        b.addEventListener('click', function () {
            var f = b.dataset.filter;
            filterBtns.forEach(function (x) { x.setAttribute('aria-pressed', x === b ? 'true' : 'false'); });
            $$('.skill').forEach(function (s) {
                var cats = (s.dataset.cat || '').split(' ');
                s.classList.toggle('is-dim', f !== 'all' && cats.indexOf(f) === -1);
            });
        });
    });

    /* ---------- Copy email ---------- */
    var emailBtn = $('#email-copy');
    if (emailBtn) emailBtn.addEventListener('click', function () { copy(emailBtn.dataset.email); });

    /* ---------- Architecture diagram: orchestrator routing ---------- */
    (function () {
        var agents = $$('#agents .agent'), log = $('#arch-log'), arch = $('#arch');
        if (!agents.length || !arch) return;
        var names = ['plan', 'build', 'review', 'test', 'release'];
        var verbs = ['task dispatched', 'context attached', 'result returned', 'checks passed', 'handoff complete'];
        var i = 0, timer = null;
        function step() {
            agents.forEach(function (a, k) { a.classList.toggle('is-active', k === i); });
            if (log) log.textContent = 'orchestrator → ' + names[i] + '-agent · ' + verbs[(i + Math.floor(Math.random() * 2)) % verbs.length];
            i = (i + 1) % agents.length;
        }
        step();
        if (reduceMotion) return;
        new IntersectionObserver(function (e) {
            if (e[0].isIntersecting) { if (!timer) timer = setInterval(step, 1500); }
            else { clearInterval(timer); timer = null; }
        }).observe(arch);
    })();

    /* ---------- Command palette ---------- */
    (function () {
        var root = $('#cmdk'), input = $('#cmdk-input'), list = $('#cmdk-list'), openBtn = $('#cmdk-open'), kbd = $('#cmdk-kbd');
        if (!root) return;
        if (kbd && !/Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent)) kbd.textContent = 'Ctrl K';
        var I = {
            arrow: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg>',
            mail: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/></svg>',
            copy: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h10"/></svg>',
            file: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v12M7 10l5 5 5-5M4 21h16"/></svg>',
            link: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M7 17 17 7M8 7h9v9"/></svg>',
            theme: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 3v18a9 9 0 0 0 0-18z" fill="currentColor"/></svg>'
        };
        var go = function (id) { return function () { scrollToTarget('#' + id); }; };
        var items = [
            { g: 'Navigate', t: 'About', k: 'intro bio profile', i: I.arrow, run: go('about') },
            { g: 'Navigate', t: 'Now building · Woven by Toyota', k: 'current agentic sdlc orchestrator remote agents aws', i: I.arrow, run: go('now') },
            { g: 'Navigate', t: 'Impact', k: 'numbers metrics revenue', i: I.arrow, run: go('impact') },
            { g: 'Navigate', t: 'Experience', k: 'career timeline jobs ibm turing', i: I.arrow, run: go('experience') },
            { g: 'Navigate', t: 'Case studies', k: 'work engagements projects', i: I.arrow, run: go('work') },
            { g: 'Navigate', t: 'Process', k: 'how I work method', i: I.arrow, run: go('process') },
            { g: 'Navigate', t: 'Expertise', k: 'skills stack aws kubernetes', i: I.arrow, run: go('expertise') },
            { g: 'Navigate', t: 'Projects', k: 'videos robotics demos', i: I.arrow, run: go('projects') },
            { g: 'Navigate', t: 'Credentials', k: 'education certification claude mba', i: I.arrow, run: go('credentials') },
            { g: 'Navigate', t: 'Testimonials', k: 'recommendations quotes', i: I.arrow, run: go('testimonials') },
            { g: 'Navigate', t: 'Contact', k: 'hire talk', i: I.arrow, run: go('contact') },
            { g: 'Actions', t: 'Copy email address', k: 'mail', i: I.copy, run: function () { copy('shiraguppipavan@gmail.com'); } },
            { g: 'Actions', t: 'Send an email', k: 'contact mail', i: I.mail, run: function () { location.href = 'mailto:shiraguppipavan@gmail.com'; } },
            { g: 'Actions', t: 'Download CV', k: 'resume pdf', i: I.file, run: function () { var a = document.createElement('a'); a.href = 'resume.pdf'; a.download = ''; document.body.appendChild(a); a.click(); a.remove(); } },
            { g: 'Actions', t: 'Open LinkedIn', k: 'social profile', i: I.link, run: function () { window.open('https://linkedin.com/in/pavan-shiraguppi', '_blank', 'noopener'); } },
            { g: 'Actions', t: 'Toggle light / dark theme', k: 'mode appearance', i: I.theme, hint: 'T', run: function () { toggleTheme(); } }
        ];
        var filtered = items, sel = 0, lastFocus = null;

        function render() {
            var q = input.value.trim().toLowerCase();
            filtered = items.filter(function (it) { return !q || (it.t + ' ' + it.k + ' ' + it.g).toLowerCase().indexOf(q) !== -1; });
            if (sel >= filtered.length) sel = Math.max(0, filtered.length - 1);
            if (!filtered.length) { list.innerHTML = '<div class="cmdk__empty">No results for “' + q.replace(/[<>&"]/g, '') + '”</div>'; input.removeAttribute('aria-activedescendant'); return; }
            var html = '', group = '';
            filtered.forEach(function (it, idx) {
                if (it.g !== group) { group = it.g; html += '<div class="cmdk__group" role="presentation">' + group + '</div>'; }
                html += '<button type="button" class="cmdk__item" role="option" id="cmdk-opt-' + idx + '" data-idx="' + idx + '" aria-selected="' + (idx === sel) + '">' + it.i + '<span>' + it.t + '</span>' + (it.hint ? '<small>' + it.hint + '</small>' : '') + '</button>';
            });
            list.innerHTML = html;
            input.setAttribute('aria-activedescendant', 'cmdk-opt-' + sel);
        }
        function highlight() {
            $$('.cmdk__item', list).forEach(function (b) { b.setAttribute('aria-selected', String(+b.dataset.idx === sel)); });
            input.setAttribute('aria-activedescendant', 'cmdk-opt-' + sel);
            var cur = $('#cmdk-opt-' + sel); if (cur) cur.scrollIntoView({ block: 'nearest' });
        }
        function open() {
            lastFocus = document.activeElement;
            root.hidden = false; input.value = ''; sel = 0; render();
            if (lenis) lenis.stop();
            setTimeout(function () { input.focus(); }, 10);
        }
        function close() {
            if (root.hidden) return;
            root.hidden = true;
            if (lenis) lenis.start();
            if (lastFocus && lastFocus.focus) lastFocus.focus({ preventScroll: true });
        }
        function run(idx) { var it = filtered[idx]; if (!it) return; close(); setTimeout(it.run, 60); }

        if (openBtn) openBtn.addEventListener('click', open);
        input.addEventListener('input', function () { sel = 0; render(); });
        list.addEventListener('click', function (e) { var b = e.target.closest('.cmdk__item'); if (b) run(+b.dataset.idx); });
        list.addEventListener('pointermove', function (e) { var b = e.target.closest('.cmdk__item'); if (b && +b.dataset.idx !== sel) { sel = +b.dataset.idx; highlight(); } });
        root.addEventListener('click', function (e) { if (e.target.hasAttribute('data-cmdk-close')) close(); });
        root.addEventListener('keydown', function (e) {
            if (e.key === 'ArrowDown') { e.preventDefault(); sel = (sel + 1) % Math.max(1, filtered.length); highlight(); }
            else if (e.key === 'ArrowUp') { e.preventDefault(); sel = (sel - 1 + filtered.length) % Math.max(1, filtered.length); highlight(); }
            else if (e.key === 'Enter') { e.preventDefault(); run(sel); }
            else if (e.key === 'Escape') { e.preventDefault(); close(); }
            else if (e.key === 'Tab') { e.preventDefault(); input.focus(); }
        });
        document.addEventListener('keydown', function (e) {
            var typing = /INPUT|TEXTAREA|SELECT/.test((e.target.tagName || '')) || e.target.isContentEditable;
            if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); root.hidden ? open() : close(); return; }
            if (typing || e.metaKey || e.ctrlKey || e.altKey) return;
            if (e.key === '/' && root.hidden) { e.preventDefault(); open(); }
            else if (e.key.toLowerCase() === 't' && root.hidden) { toggleTheme(); }
            else if (e.key === 'Escape') { closeMenu(); }
        });
    })();

    /* ================= GSAP-powered motion ================= */
    if (!hasGsap) { window.__siteReady = true; return; }

    /* Split helpers */
    function splitWords(el, wrapClass) {
        var frag = document.createDocumentFragment();
        Array.prototype.slice.call(el.childNodes).forEach(function (node) {
            var isEl = node.nodeType === 1, text = node.textContent, cls = isEl ? node.className : '';
            text.split(/(\s+)/).forEach(function (part) {
                if (!part) return;
                if (/^\s+$/.test(part)) { frag.appendChild(document.createTextNode(' ')); return; }
                var outer = document.createElement('span'); outer.className = wrapClass;
                if (wrapClass === 'line') {
                    var inner = document.createElement('span'); inner.className = 'line-inner' + (cls ? ' ' + cls : '');
                    inner.textContent = part; outer.appendChild(inner);
                } else { outer.textContent = part; if (cls) outer.className += ' ' + cls; }
                frag.appendChild(outer);
            });
        });
        el.innerHTML = ''; el.appendChild(frag);
    }

    var mm = gsap.matchMedia();

    /* Reveal-on-scroll */
    if (reduceMotion) {
        gsap.set('.reveal', { opacity: 1, y: 0 });
    } else {
        ScrollTrigger.batch('.reveal', {
            start: 'top 88%',
            once: true,
            onEnter: function (els) { gsap.to(els, { opacity: 1, y: 0, duration: 1, ease: 'expo.out', stagger: 0.08, overwrite: true }); }
        });

        $$('.split').forEach(function (el) {
            splitWords(el, 'line');
            gsap.from($$('.line-inner', el), {
                yPercent: 110, rotate: 4, duration: 1.2, ease: 'expo.out', stagger: 0.06,
                scrollTrigger: { trigger: el, start: 'top 88%', once: true }
            });
        });
    }

    /* About statement: words light up as you read */
    $$('[data-words]').forEach(function (el) {
        splitWords(el, 'w');
        if (reduceMotion) { gsap.set($$('.w', el), { opacity: 1 }); return; }
        gsap.to($$('.w', el), {
            opacity: 1, ease: 'none', stagger: 0.1,
            scrollTrigger: { trigger: el, start: 'top 80%', end: 'bottom 45%', scrub: 0.6 }
        });
    });

    /* Counters */
    $$('.count').forEach(function (el) {
        var to = parseFloat(el.dataset.to), pre = el.dataset.prefix || '', suf = el.dataset.suffix || '';
        if (reduceMotion) return;
        var o = { v: 0 };
        el.textContent = pre + '0' + suf;
        ScrollTrigger.create({
            trigger: el, start: 'top 90%', once: true,
            onEnter: function () { gsap.to(o, { v: to, duration: 2.2, ease: 'expo.out', onUpdate: function () { el.textContent = pre + Math.round(o.v) + suf; } }); }
        });
    });

    /* Meter + sparkline */
    $$('.meter i').forEach(function (bar) {
        gsap.to(bar, { scaleX: 1, duration: 1.8, ease: 'expo.out', scrollTrigger: { trigger: bar, start: 'top 92%', once: true } });
    });
    var spark = $('#spark-line');
    if (spark && spark.getTotalLength) {
        var len = spark.getTotalLength();
        gsap.set(spark, { strokeDasharray: len, strokeDashoffset: len });
        gsap.to(spark, { strokeDashoffset: 0, duration: 2.2, ease: 'power2.inOut', scrollTrigger: { trigger: spark, start: 'top 92%', once: true } });
    }

    /* Experience rail + active dots */
    var rail = $('#xp-rail');
    if (rail) {
        gsap.to(rail, { scaleY: 1, ease: 'none', scrollTrigger: { trigger: '#xp-list', start: 'top 60%', end: 'bottom 60%', scrub: true } });
        $$('.job').forEach(function (job) {
            ScrollTrigger.create({ trigger: job, start: 'top 62%', onEnter: function () { job.classList.add('is-on'); }, onLeaveBack: function () { job.classList.remove('is-on'); } });
        });
    }

    /* Case studies: sticky stack with depth */
    mm.add('(min-width: 1000px) and (min-height: 700px) and (prefers-reduced-motion: no-preference)', function () {
        var cards = $$('#cases .case');
        $('#cases').classList.add('is-stacking');
        function setTops() {
            var navOff = 96;
            cards.forEach(function (c, i) {
                var top = Math.min(navOff + i * 14, innerHeight - c.offsetHeight - 24);
                c.style.top = top + 'px';
            });
        }
        setTops();
        window.addEventListener('resize', setTops);
        cards.forEach(function (card, i) {
            var next = cards[i + 1];
            if (!next) return;
            var st = { trigger: next, start: 'top bottom', end: 'top ' + (96 + (i + 1) * 14) + 'px', scrub: true };
            gsap.to(card, { scale: 0.94, ease: 'none', scrollTrigger: st });
            gsap.to(card.children, { opacity: 0.25, ease: 'none', scrollTrigger: st });
        });
        return function () { window.removeEventListener('resize', setTops); $('#cases').classList.remove('is-stacking'); cards.forEach(function (c) { c.style.top = ''; }); };
    });

    /* Process numbers parallax */
    if (!reduceMotion) {
        $$('.step__n').forEach(function (n) {
            gsap.fromTo(n, { yPercent: 30 }, { yPercent: -10, ease: 'none', scrollTrigger: { trigger: n, start: 'top bottom', end: 'bottom top', scrub: true } });
        });
        $$('.project__media img').forEach(function (img) {
            gsap.fromTo(img, { yPercent: -6 }, { yPercent: 6, ease: 'none', scrollTrigger: { trigger: img.parentElement, start: 'top bottom', end: 'bottom top', scrub: true } });
        });
        gsap.fromTo('.footer__word', { yPercent: 40 }, { yPercent: 12, ease: 'none', scrollTrigger: { trigger: '.footer', start: 'top bottom', end: 'bottom bottom', scrub: true } });
    }

    /* Velocity band */
    (function () {
        var rows = $$('.band__row');
        if (!rows.length || reduceMotion) return;
        var state = rows.map(function (row) {
            var kids = Array.prototype.slice.call(row.children);
            kids.forEach(function (k) { row.appendChild(k.cloneNode(true)); });
            kids.forEach(function (k) { row.appendChild(k.cloneNode(true)); });
            return { row: row, dir: +row.dataset.dir || 1, x: 0, w: 0 };
        });
        function measure() { state.forEach(function (s) { s.w = s.row.scrollWidth / 3; }); }
        measure(); window.addEventListener('resize', measure);
        var vel = 0, running = false;
        if (lenis) lenis.on('scroll', function (e) { vel = e.velocity || 0; });
        else { var ly = scrollY; window.addEventListener('scroll', function () { vel = scrollY - ly; ly = scrollY; }, { passive: true }); }
        function loop() {
            if (!running) return;
            var boost = Math.max(-40, Math.min(40, vel)) * 0.6;
            state.forEach(function (s) {
                s.x -= (1.1 + Math.abs(boost)) * s.dir * (boost < 0 ? -1 : 1);
                if (s.x <= -s.w) s.x += s.w;
                if (s.x > 0) s.x -= s.w;
                s.row.style.transform = 'translate3d(' + s.x + 'px,0,0) skewX(' + (-boost * 0.25) + 'deg)';
            });
            vel *= 0.92;
            requestAnimationFrame(loop);
        }
        new IntersectionObserver(function (e) {
            if (e[0].isIntersecting && !running) { running = true; requestAnimationFrame(loop); }
            else if (!e[0].isIntersecting) running = false;
        }).observe($('.band'));
    })();

    /* Hero: role scramble */
    function scramble(el) {
        var target = el.dataset.text || el.textContent, chars = '!<>-_\\/[]{}=+*^?#', q = [], frame = 0;
        for (var i = 0; i < target.length; i++) { var s = Math.floor(Math.random() * 30); q.push({ to: target[i], s: s, e: s + 10 + Math.floor(Math.random() * 30) }); }
        (function up() {
            var out = '', done = 0;
            q.forEach(function (c) {
                if (frame >= c.e) { done++; out += c.to; }
                else if (frame >= c.s) out += '<span class="scr">' + chars[Math.floor(Math.random() * chars.length)] + '</span>';
                else out += ' ';
            });
            el.innerHTML = out; frame++;
            if (done < q.length) requestAnimationFrame(up); else el.textContent = target;
        })();
    }

    /* Hero intro */
    var title = $('#hero-title');
    $$('.row--1 > span', title).forEach(function (w) {
        var txt = w.textContent; w.textContent = '';
        txt.split('').forEach(function (ch) { var s = document.createElement('span'); s.className = 'char'; s.textContent = ch; w.appendChild(s); });
    });
    function heroIntro() {
        window.__siteReady = true;
        if (reduceMotion) { gsap.set('.hero-in', { opacity: 1 }); return; }
        var tl = gsap.timeline({ defaults: { ease: 'expo.out' } });
        tl.from('.hero__title .char', { yPercent: 115, rotate: 6, duration: 1.4, stagger: 0.035 })
            .from('.hero__title .row--2 > span', { yPercent: 115, duration: 1.4 }, 0.18)
            .from('.hero-in', { opacity: 0, y: 24, duration: 1.1, stagger: 0.1 }, 0.35)
            .add(function () { var r = $('#hero-role'); if (r) scramble(r); }, 0.45)
            .from('.logos', { opacity: 0, duration: 1 }, 0.9);
        // Title parallax as the hero scrolls away
        gsap.to('.hero__title', { yPercent: -18, ease: 'none', scrollTrigger: { trigger: '#hero', start: 'top top', end: 'bottom top', scrub: true } });
        gsap.to('.hero__canvas', { scale: 1.08, opacity: 0.4, ease: 'none', scrollTrigger: { trigger: '#hero', start: 'top top', end: 'bottom top', scrub: true } });
    }

    /* Preloader: once per session */
    var loader = $('#loader'), seen = false;
    try { seen = sessionStorage.getItem('ps-intro') === '1'; } catch (e) { seen = true; }
    if (loader && !seen && !reduceMotion) {
        try { sessionStorage.setItem('ps-intro', '1'); } catch (e) { }
        loader.hidden = false;
        if (lenis) lenis.stop();
        var count = $('#loader-count'), o = { v: 0 };
        var lt = gsap.timeline({
            onComplete: function () { loader.hidden = true; if (lenis) lenis.start(); }
        });
        lt.from('.loader__name span', { yPercent: 110, duration: 0.9, ease: 'expo.out' })
            .to(o, { v: 100, duration: 1.3, ease: 'power2.inOut', onUpdate: function () { count.textContent = String(Math.round(o.v)).padStart(3, '0'); } }, 0.1)
            .to('.loader__bar i', { scaleX: 1, duration: 1.3, ease: 'power2.inOut' }, 0.1)
            .to('.loader__inner', { opacity: 0, y: -20, duration: 0.5, ease: 'power2.in' }, '+=0.1')
            .to(loader, { clipPath: 'inset(0 0 100% 0)', duration: 0.9, ease: 'expo.inOut' }, '-=0.1')
            .add(heroIntro, '-=0.55');
    } else {
        heroIntro();
    }

    window.addEventListener('load', function () { ScrollTrigger.refresh(); });
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { ScrollTrigger.refresh(); });
})();
