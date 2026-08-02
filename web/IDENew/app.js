/* ============================================================
   ALaska.ai — interactions
   Drift-snow canvas, chat typewriter loop, file-read flash,
   ghost-code line reveal + apply, counters, sparkline,
   model switcher, keyboard chord, progress bars on view.
============================================================ */

(() => {

  // -----------------------------------------------------------
  // SNOW — slow, drifting flakes, biased by gentle wind
  // -----------------------------------------------------------
  const canvas = document.getElementById('snow');
  if (canvas) {
    const ctx = canvas.getContext('2d');
    let W = 0, H = 0, dpr = Math.min(window.devicePixelRatio || 1, 2);
    let flakes = [];
    const FLAKE_COUNT = Math.min(80, Math.floor(window.innerWidth / 20));

    function resize() {
      W = window.innerWidth;
      H = window.innerHeight;
      canvas.width = W * dpr;
      canvas.height = H * dpr;
      canvas.style.width = W + 'px';
      canvas.style.height = H + 'px';
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    resize();
    window.addEventListener('resize', resize);

    function makeFlake(initial) {
      return {
        x: Math.random() * W,
        y: initial ? Math.random() * H : -10,
        r: 0.6 + Math.random() * 1.6,
        vy: 0.15 + Math.random() * 0.45,
        vx: -0.05 - Math.random() * 0.15,
        a: 0.35 + Math.random() * 0.55,
        wob: Math.random() * Math.PI * 2,
        ws: 0.005 + Math.random() * 0.01,
      };
    }
    for (let i = 0; i < FLAKE_COUNT; i++) flakes.push(makeFlake(true));

    let raf;
    function tick() {
      ctx.clearRect(0, 0, W, H);
      for (const f of flakes) {
        f.wob += f.ws;
        f.x += f.vx + Math.sin(f.wob) * 0.25;
        f.y += f.vy;
        if (f.y > H + 4) {
          f.x = Math.random() * (W + 100);
          f.y = -10;
        }
        if (f.x < -10) f.x = W + 10;
        ctx.beginPath();
        ctx.fillStyle = `rgba(236, 229, 211, ${f.a})`;
        ctx.arc(f.x, f.y, f.r, 0, Math.PI * 2);
        ctx.fill();
      }
      raf = requestAnimationFrame(tick);
    }
    tick();
  }

  // -----------------------------------------------------------
  // Hero subtitle: animate the rise of each "word" stagger
  // -----------------------------------------------------------
  document.querySelectorAll('h1.title .word > span').forEach((el, i) => {
    el.style.animationDelay = (0.05 + i * 0.08) + 's';
  });

  // -----------------------------------------------------------
  // Count-up for hero stat numbers
  // -----------------------------------------------------------
  function countUp(el, target, dur = 1400) {
    const start = performance.now();
    const from = 0;
    function frame(t) {
      const p = Math.min(1, (t - start) / dur);
      const eased = 1 - Math.pow(1 - p, 3);
      const v = Math.round(from + (target - from) * eased);
      el.textContent = v.toLocaleString('ru-RU');
      if (p < 1) requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
  }
  document.querySelectorAll('[data-countup]').forEach(el => {
    const tgt = parseInt(el.dataset.countup, 10);
    new IntersectionObserver(([entry], obs) => {
      if (entry.isIntersecting) { countUp(el, tgt); obs.disconnect(); }
    }, { threshold: 0.4 }).observe(el);
  });

  // -----------------------------------------------------------
  // Sparkline — append a new point every tick, scroll left
  // -----------------------------------------------------------
  const spark = document.getElementById('spark');
  if (spark) {
    const W = 400, H = 90;
    let points = [];
    for (let i = 0; i < 30; i++) points.push(20 + Math.random() * 45);

    function render() {
      const path = points.map((p, i) => `${(i / (points.length - 1)) * W},${H - p}`).join(' ');
      const area = `M0,${H} L${path.split(' ').map(p => p).join(' L')} L${W},${H} Z`;
      spark.innerHTML = `
        <defs>
          <linearGradient id="sg" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stop-color="oklch(0.83 0.10 220)" stop-opacity=".5"/>
            <stop offset="100%" stop-color="oklch(0.83 0.10 220)" stop-opacity="0"/>
          </linearGradient>
        </defs>
        <path d="${area}" fill="url(#sg)"/>
        <polyline points="${path}" stroke="oklch(0.83 0.10 220)" stroke-width="1.5" fill="none"/>
        <circle cx="${W}" cy="${H - points[points.length-1]}" r="3" fill="oklch(0.78 0.16 155)"/>
      `;
    }
    render();
    setInterval(() => {
      points.push(15 + Math.random() * 55);
      points = points.slice(-30);
      render();
    }, 1400);
  }

  // -----------------------------------------------------------
  // Bars-on-view: trigger width animations when in viewport
  // -----------------------------------------------------------
  document.querySelectorAll('[data-fill]').forEach(el => {
    new IntersectionObserver(([entry], obs) => {
      if (entry.isIntersecting) {
        requestAnimationFrame(() => { el.style.width = el.dataset.fill; });
        obs.disconnect();
      }
    }, { threshold: 0.3 }).observe(el);
  });

  // -----------------------------------------------------------
  // Installer progress bar — loops every 11s
  // -----------------------------------------------------------
  const instBar = document.querySelector('.installer .progress .bar > i');
  if (instBar) {
    function loop() {
      instBar.style.transition = 'none';
      instBar.style.width = '0%';
      requestAnimationFrame(() => {
        instBar.style.transition = 'width 8s linear';
        instBar.style.width = '100%';
      });
    }
    loop();
    setInterval(loop, 11000);
  }

  // -----------------------------------------------------------
  // Keyboard chord animation — cycles through chords forever
  // -----------------------------------------------------------
  const chordSequence = [
    ['cmd', 'l'],   // open chat
    ['cmd', 'i'],   // inline edit
    ['cmd', 'p'],   // file picker
    ['cmd', 'k'],   // command palette
  ];
  const chordLabels = ['открыть чат', 'inline-правка', 'выбор файла', 'палитра команд'];
  const chordEl = document.querySelector('.chord');
  const chordLabel = document.querySelector('[data-chord-label]');
  if (chordEl) {
    let idx = 0;
    function playChord() {
      const keys = chordSequence[idx];
      if (chordLabel) chordLabel.textContent = chordLabels[idx];
      chordEl.querySelectorAll('.key').forEach(k => k.classList.remove('pressed'));
      keys.forEach((k, i) => {
        setTimeout(() => {
          const el = chordEl.querySelector(`[data-key="${k}"]`);
          if (el) el.classList.add('pressed');
        }, i * 220);
      });
      setTimeout(() => {
        chordEl.querySelectorAll('.key').forEach(k => k.classList.remove('pressed'));
      }, 1800);
      idx = (idx + 1) % chordSequence.length;
    }
    playChord();
    setInterval(playChord, 2600);
  }

  // -----------------------------------------------------------
  // Model switcher — tabs swap meta + bench bars
  // -----------------------------------------------------------
  const modelData = {
    'mini': {
      quote: 'Дешёвый автокомплит и быстрые правки.',
      points: [
        '≈ 80 ткн/сек — отвечает быстрее, чем вы дочитываете',
        'Идеально для rename, регэкспов, мелких рефакторов',
        'Самая дешёвая модель — для рутины'
      ],
      price: '0,15 ₽',
      bench: { speed: 95, ctx: 32, accuracy: 71, cost: 8 }
    },
    'std': {
      quote: 'Рабочая лошадка для большинства задач.',
      points: [
        'Контекст 200k — читает целый сервис',
        'Хорошо держит код-стайл вашей кодовой базы',
        'Баланс цены и качества на каждый день'
      ],
      price: '0,90 ₽',
      bench: { speed: 70, ctx: 80, accuracy: 86, cost: 32 }
    },
    'flag': {
      quote: 'Сложный рефакторинг и архитектурные задачи.',
      points: [
        'Размышляет шагами, видит связи между модулями',
        'Лучший выбор для дебага «почему оно вообще работает»',
        'Reasoning-режим включается автоматически'
      ],
      price: '2,40 ₽',
      bench: { speed: 48, ctx: 100, accuracy: 96, cost: 84 }
    }
  };

  function switchModel(id) {
    document.querySelectorAll('.model-tab').forEach(t => {
      t.classList.toggle('active', t.dataset.model === id);
    });
    const d = modelData[id];
    const meta = document.getElementById('model-meta');
    if (!meta) return;
    meta.style.opacity = '0';
    setTimeout(() => {
      meta.querySelector('.quote').innerHTML = d.quote;
      const ul = meta.querySelector('ul');
      ul.innerHTML = d.points.map(p => `<li>${p}</li>`).join('');
      meta.querySelector('.price b').textContent = d.price;
      // bench
      document.querySelectorAll('.bench .row').forEach(row => {
        const k = row.dataset.bench;
        const i = row.querySelector('.b > i');
        const v = row.querySelector('.v');
        const val = d.bench[k];
        i.style.width = '0%';
        requestAnimationFrame(() => { i.style.width = val + '%'; });
        const labels = { speed: 'ткн/сек', ctx: 'контекст', accuracy: '%', cost: '/ 1k' };
        const display = {
          speed: val + ' ткн/с',
          ctx: (val * 2) + 'k',
          accuracy: val + '%',
          cost: (val / 35).toFixed(2) + ' ₽'
        };
        v.textContent = display[k];
      });
      meta.style.opacity = '1';
    }, 220);
  }
  document.querySelectorAll('.model-tab').forEach(t => {
    t.addEventListener('click', () => switchModel(t.dataset.model));
  });
  setTimeout(() => switchModel('std'), 100);

  // -----------------------------------------------------------
  // IDE chat — typewriter loop with file-read flashes,
  //            ghost-code line reveal, token counter ramp,
  //            "apply" diff that ghost→commit cycles
  // -----------------------------------------------------------
  const chatBody = document.querySelector('.chat-body');
  const tokFill = document.querySelector('.tok-bar > i');
  const tokVal = document.querySelector('[data-tok-val]');
  const tabsRow = document.querySelector('.tabs');

  if (chatBody) {

    const userMsg = 'почему findEmptyBin такой медленный на больших паллетах? предложи замену с индексом, не ломая API.';
    const aiPara1 = 'Линейный обход <code>pallets</code> делает поиск <code>O(n)</code> на каждый вызов. Внутри тика складского контроллера это происходит 12 раз — отсюда залипания.';
    const aiPara2 = 'Предлагаю добавить <code>buildBinIndex()</code> и новую функцию рядом — старый API оставляю:';

    function el(html) {
      const div = document.createElement('div');
      div.innerHTML = html;
      return div.firstElementChild;
    }

    function typeInto(target, text, speed = 18) {
      return new Promise(resolve => {
        let i = 0;
        // place a cursor span after we're done
        target.innerHTML = '';
        const cursor = document.createElement('span');
        cursor.className = 'cursor-blink';
        target.appendChild(cursor);
        const step = () => {
          if (i >= text.length) { resolve(); return; }
          const ch = text[i++];
          cursor.before(document.createTextNode(ch));
          setTimeout(step, speed + Math.random() * 30);
        };
        step();
      });
    }

    function typeHTMLInto(target, html, speed = 14) {
      // Strip into chunks: text vs <code>…</code>
      // simplistic parser — we know the source
      return new Promise(async resolve => {
        target.innerHTML = '';
        const cursor = document.createElement('span');
        cursor.className = 'cursor-blink';
        target.appendChild(cursor);
        const tmp = document.createElement('div');
        tmp.innerHTML = html;
        const nodes = Array.from(tmp.childNodes);
        for (const node of nodes) {
          if (node.nodeType === 3) {
            const text = node.textContent;
            for (let i = 0; i < text.length; i++) {
              cursor.before(document.createTextNode(text[i]));
              await new Promise(r => setTimeout(r, speed + Math.random() * 25));
            }
          } else {
            // element node — insert whole (e.g. <code>)
            cursor.before(node.cloneNode(true));
            await new Promise(r => setTimeout(r, 60));
          }
        }
        cursor.remove();
        resolve();
      });
    }

    function flashRead(filenames) {
      filenames.forEach((name, i) => {
        setTimeout(() => {
          const li = document.querySelector(`.tree li[data-readable="${name}"]`);
          if (li) {
            li.classList.add('reading');
            setTimeout(() => li.classList.remove('reading'), 1100);
          }
        }, i * 350);
      });
    }

    function setTokens(val) {
      if (tokVal) tokVal.textContent = val.toLocaleString('ru-RU');
      if (tokFill) tokFill.style.width = Math.min(100, (val / 200000) * 100 * 18) + '%';
    }

    async function cycle() {
      chatBody.innerHTML = '';
      setTokens(0);

      // user message
      const userM = el(`
        <div class="msg">
          <div class="avatar user">Я</div>
          <div class="body">
            <div class="who"><b>вы</b> · warehouse.ts:15</div>
            <p data-typing></p>
          </div>
        </div>
      `);
      chatBody.appendChild(userM);
      await typeInto(userM.querySelector('p'), userMsg, 16);
      userM.querySelector('.cursor-blink')?.remove();

      // tiny pause + start "reading"
      await sleep(400);
      const aiM = el(`
        <div class="msg">
          <div class="avatar ai">A</div>
          <div class="body">
            <div class="who"><b>alaska</b> · <span data-read-label>читает проект…</span></div>
            <div data-tools></div>
            <p data-p1 style="min-height:1.2em"></p>
            <p data-p2 style="min-height:1.2em; margin-top:6px"></p>
            <div data-cb></div>
            <p data-status style="margin-top:8px; color: var(--mute); font-size:12px; font-family:'JetBrains Mono',monospace"></p>
          </div>
        </div>
      `);
      chatBody.appendChild(aiM);

      // tool steps
      const tools = aiM.querySelector('[data-tools]');
      const t1 = el(`<div class="tool-step run"><span class="ic">↻</span>читает <span style="color:var(--ice)">warehouse.ts</span><span class="meta">312 строк</span></div>`);
      tools.appendChild(t1);
      flashRead(['warehouse.ts']);
      await sleep(900);
      t1.classList.remove('run'); t1.classList.add('ok');

      const t2 = el(`<div class="tool-step run"><span class="ic">↻</span>читает <span style="color:var(--ice)">types.ts, index.ts</span><span class="meta">2 файла</span></div>`);
      tools.appendChild(t2);
      flashRead(['types.ts', 'index.ts']);
      await sleep(1000);
      t2.classList.remove('run'); t2.classList.add('ok');

      const t3 = el(`<div class="tool-step run"><span class="ic">↻</span>ищет вызовы <code style="background:transparent; border:none; color:var(--ice); padding:0">findEmptyBin</code> в репозитории<span class="meta">12 совпадений</span></div>`);
      tools.appendChild(t3);
      flashRead(['index.ts', 'tools', 'README.md']);
      await sleep(1100);
      t3.classList.remove('run'); t3.classList.add('ok');

      aiM.querySelector('[data-read-label]').textContent = '4 файла прочитано';

      // start streaming reply
      setTokens(820);
      await typeHTMLInto(aiM.querySelector('[data-p1]'), aiPara1, 12);
      setTokens(1640);
      await typeHTMLInto(aiM.querySelector('[data-p2]'), aiPara2, 12);

      // diff
      const cb = aiM.querySelector('[data-cb]');
      cb.innerHTML = `
        <div class="codeblock">
          <div class="h"><span>warehouse.ts</span><span class="aur">+11 −0</span></div>
<pre><span class="plus">+ export function findEmptyBinFast(</span>
<span class="plus">+   pallets: Pallet[],</span>
<span class="plus">+   index = buildBinIndex(pallets)</span>
<span class="plus">+ ): Bin | null {</span>
<span class="plus">+   for (const bin of index.values()) {</span>
<span class="plus">+     if (bin.free) return bin</span>
<span class="plus">+   }</span>
<span class="plus">+   return null</span>
<span class="plus">+ }</span></pre>
        </div>
      `;
      cb.style.opacity = '0';
      cb.style.transform = 'translateY(6px)';
      cb.style.transition = 'opacity .4s, transform .4s';
      requestAnimationFrame(() => { cb.style.opacity = '1'; cb.style.transform = 'none'; });

      // show ghost lines in the editor synchronized with diff insertion
      showGhostLines();

      setTokens(2140);
      aiM.querySelector('[data-status]').innerHTML = `<span class="cursor-blink"></span> пишет тесты для bin-index…`;

      // wait a bit then "apply" & reset
      await sleep(5500);
      hideGhostLines();
      await sleep(1200);
    }

    function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

    function showGhostLines() {
      document.querySelectorAll('.code .ghost').forEach((line, i) => {
        setTimeout(() => line.classList.add('show'), i * 70);
      });
    }
    function hideGhostLines() {
      document.querySelectorAll('.code .ghost').forEach(line => line.classList.remove('show'));
    }

    // run loop
    (async () => {
      while (true) {
        await cycle();
      }
    })();
  }

  // -----------------------------------------------------------
  // Live "Anchorage time" + temperature ticker
  // -----------------------------------------------------------
  function updateClock() {
    const el = document.querySelector('[data-anch-time]');
    if (!el) return;
    // Alaska time = UTC-9 (AKST) / UTC-8 (AKDT). Approx with UTC-8.
    const now = new Date();
    const utc = now.getTime() + now.getTimezoneOffset() * 60000;
    const ak = new Date(utc + (-8) * 3600000);
    const hh = ak.getHours().toString().padStart(2, '0');
    const mm = ak.getMinutes().toString().padStart(2, '0');
    el.textContent = `${hh}:${mm} АКDT`;
  }
  updateClock();
  setInterval(updateClock, 30000);

  // temperature wobble
  let temp = -14;
  function tempTick() {
    const el = document.querySelector('[data-temp]');
    if (!el) return;
    temp = -14 + Math.round((Math.random() - 0.5) * 4);
    el.textContent = `${temp > 0 ? '+' : ''}${temp}°C`;
  }
  setInterval(tempTick, 4000);

  // -----------------------------------------------------------
  // Readout graph (model accuracy cell): random heights, refresh
  // -----------------------------------------------------------
  const ro = document.querySelector('.readout-graph');
  if (ro) {
    const bars = Array.from({ length: 24 }, () => 30 + Math.random() * 70);
    function paint() {
      ro.innerHTML = bars.map(b => `<i style="height:${b}%"></i>`).join('');
    }
    paint();
    setInterval(() => {
      bars.shift();
      bars.push(30 + Math.random() * 70);
      paint();
    }, 1500);
  }

})();
