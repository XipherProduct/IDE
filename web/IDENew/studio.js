/* ============================================================
   ALaska Studio — orchestrator
   Splash boot → IDE shell mount → file switching → fade-in
   → chat with Claude API.
============================================================ */

(() => {

  const FILES = window.STUDIO_FILES;
  const ORDER = window.STUDIO_ORDER;
  const ICONS = window.STUDIO_ICONS;
  const TREE  = window.STUDIO_TREE;

  let openTabs = [];        // file ids in order
  let activeFile = null;
  let chatHistory = [];     // {role, content}[]
  let isThinking = false;

  // ============= LANG =============
  const I18N = window.STUDIO_I18N || {};
  let currentLang = (localStorage.getItem('studio.lang') || 'ru');
  if (currentLang !== 'ru' && currentLang !== 'en') currentLang = 'ru';
  document.documentElement.setAttribute('lang', currentLang);

  function L(field) {
    if (!field) return '';
    if (typeof field === 'string') return field;
    if (typeof field === 'object') return field[currentLang] || field.ru || field.en || '';
    return '';
  }

  function t(key) {
    return (I18N[currentLang] && I18N[currentLang][key]) || (I18N.ru && I18N.ru[key]) || key;
  }

  function applyChromeI18n() {
    document.querySelectorAll('[data-i18n]').forEach(el => {
      const k = el.dataset.i18n;
      el.textContent = t(k);
    });
    document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
      const k = el.dataset.i18nPlaceholder;
      el.setAttribute('placeholder', t(k));
    });
    document.querySelectorAll('[data-i18n-title]').forEach(el => {
      const k = el.dataset.i18nTitle;
      el.setAttribute('title', t(k));
    });
    // sync lang button label
    const btn = document.querySelector('[data-lang-toggle]');
    if (btn) btn.textContent = currentLang === 'ru' ? 'EN' : 'RU';
    document.documentElement.setAttribute('lang', currentLang);
  }

  function setLang(lang) {
    if (lang !== 'ru' && lang !== 'en') return;
    if (lang === currentLang) return;
    currentLang = lang;
    localStorage.setItem('studio.lang', lang);
    applyChromeI18n();
    rebuildTreeLabels();
    if (activeFile) {
      renderTabs();
      renderEditor(activeFile);
      updateTitlebar(activeFile);
    }
  }
  window.__studioSetLang = setLang;
  window.__studioGetLang = () => currentLang;

  // =================== INIT =====================
  document.addEventListener('DOMContentLoaded', () => {
    applyChromeI18n();
    bindLangToggle();
    runSplash();
    buildTree();
    bindChat();
    bindHashRouter();
  });

  function bindLangToggle() {
    const btn = document.querySelector('[data-lang-toggle]');
    if (!btn) return;
    btn.addEventListener('click', () => {
      setLang(currentLang === 'ru' ? 'en' : 'ru');
    });
  }

  // =================== SPLASH ===================
  function runSplash() {
    const lines = document.querySelectorAll('.splash-card .lines > div');
    const STEP = 180;
    lines.forEach((el, i) => {
      el.style.animationDelay = (i * STEP) + 'ms';
    });

    const totalMs = lines.length * STEP + 180;
    setTimeout(() => {
      const splash = document.querySelector('.splash');
      const studio = document.querySelector('.studio');
      splash.classList.add('gone');
      studio.classList.add('in');
      setTimeout(() => splash.remove(), 400);

      // open initial file from hash, or default
      const initial = currentHashFile() || 'leding';
      openFile(initial, { initial: true });
    }, totalMs);
  }

  // =================== TREE =====================
  function buildTree() {
    const treeEl = document.getElementById('tree');
    if (!treeEl) return;
    const items = [];

    TREE.forEach(node => {
      const indentClass = node.indent ? `indent-${node.indent}` : '';
      const padLeft = node.indent ? `style="padding-left:${10 + node.indent * 16}px"` : '';

      if (node.type === 'folder') {
        const openCls = node.open ? 'open' : '';
        const caret = node.open ? '▾' : '▸';
        const ico = node.open ? ICONS.folder_open : ICONS.folder;
        const labelKey = `folder.${node.id}`;
        items.push(`<li><div class="tree-row folder ${openCls} ${indentClass}"
          data-folder="${node.id}" ${padLeft}>
          <span class="caret">${caret}</span>
          <span class="ico">${ico}</span>
          <span class="name" data-i18n-folder="${node.id}">${node.name}</span>
        </div></li>`);
      } else if (node.type === 'file') {
        const f = FILES[node.id];
        if (!f && !node.readonly) return;
        const displayName = node.name || (f ? f.name : node.id);
        const ext = node.ext || (f ? f.ext : 'tsx');
        const ico = ICONS[ext] || ICONS.tsx;
        if (node.readonly) {
          items.push(`<li><div class="tree-row file ${indentClass}"
            data-file-readonly="${displayName}" ${padLeft}>
            <span class="ico" style="color: var(--mute)">${ico}</span>
            <span class="name" style="color: var(--mute)">${displayName}</span>
          </div></li>`);
        } else {
          items.push(`<li><div class="tree-row file ${indentClass}"
            data-file="${node.id}" data-parent="${node.parent || ''}" ${padLeft}>
            <span class="ico">${ico}</span>
            <span class="name">${displayName}</span>
            <span class="badge" data-i18n="badge.reading">${t('badge.reading')}</span>
          </div></li>`);
        }
      }
    });

    treeEl.innerHTML = items.join('');

    treeEl.querySelectorAll('[data-file]').forEach(el => {
      el.addEventListener('click', () => openFile(el.dataset.file));
    });

    treeEl.querySelectorAll('[data-folder]').forEach(el => {
      el.addEventListener('click', () => {
        const isOpen = el.classList.toggle('open');
        const caret = el.querySelector('.caret');
        if (caret) caret.textContent = isOpen ? '▾' : '▸';
        const ico = el.querySelector('.ico');
        if (ico) ico.innerHTML = isOpen ? ICONS.folder_open : ICONS.folder;
        if (typeof window.__applyFolderVisibility === 'function') {
          setTimeout(window.__applyFolderVisibility, 0);
        }
      });
    });
  }

  function rebuildTreeLabels() {
    // re-translate folder names
    TREE.forEach(node => {
      if (node.type !== 'folder') return;
      const el = document.querySelector(`[data-folder="${node.id}"] .name`);
      if (el) {
        const localized = t(`folder.${node.id}`);
        el.textContent = (localized && localized !== `folder.${node.id}`) ? localized : node.name;
      }
    });
  }

  // =================== HASH ROUTER ===================
  function currentHashFile() {
    const m = location.hash.match(/^#\/([a-z]+)$/);
    return m && FILES[m[1]] ? m[1] : null;
  }
  function bindHashRouter() {
    window.addEventListener('hashchange', () => {
      const id = currentHashFile();
      if (id && id !== activeFile) openFile(id);
    });
  }

  // =================== FILE OPENING ===================
  function openFile(id, opts = {}) {
    if (!FILES[id]) return;
    if (id === activeFile && !opts.initial) return;

    // ensure tab exists
    if (!openTabs.includes(id)) openTabs.push(id);
    activeFile = id;
    location.hash = '#/' + id;

    // tree state
    document.querySelectorAll('.tree-row.file').forEach(el => {
      el.classList.toggle('active', el.dataset.file === id);
      el.classList.toggle('reading', el.dataset.file === id);
    });
    // after a brief "reading" pulse, drop the badge
    setTimeout(() => {
      const el = document.querySelector(`.tree-row.file[data-file="${id}"]`);
      if (el) el.classList.remove('reading');
    }, 1600);

    renderTabs();
    renderEditor(id);
    updateTitlebar(id);
  }

  function closeTab(id) {
    const idx = openTabs.indexOf(id);
    if (idx === -1) return;
    openTabs.splice(idx, 1);
    if (id === activeFile) {
      const next = openTabs[idx] || openTabs[idx - 1] || 'leding';
      openFile(next);
    } else {
      renderTabs();
    }
  }

  function renderTabs() {
    const tabbar = document.getElementById('tabbar');
    if (!tabbar) return;
    tabbar.innerHTML = openTabs.map(id => {
      const f = FILES[id];
      const active = id === activeFile ? 'active' : '';
      return `<div class="tab ${active}" data-tab="${id}">
        <span class="ico">${ICONS[f.ext] || ICONS.tsx}</span>
        <span>${f.name}</span>
        <span class="x" data-close="${id}">×</span>
      </div>`;
    }).join('');
    tabbar.querySelectorAll('[data-tab]').forEach(el => {
      el.addEventListener('click', e => {
        if (e.target.dataset.close) return;
        openFile(el.dataset.tab);
      });
    });
    tabbar.querySelectorAll('[data-close]').forEach(el => {
      el.addEventListener('click', e => {
        e.stopPropagation();
        if (openTabs.length === 1) return; // can't close last tab
        closeTab(el.dataset.close);
      });
    });
  }

  function renderEditor(id) {
    const f = FILES[id];
    const stage = document.getElementById('stage');
    if (!stage) return;

    const preambleHTML = f.preamble.map(([n, code]) =>
      `<div class="ln"><span class="n">${n}</span><span>${code}</span></div>`
    ).join('');

    stage.innerHTML = `
      <div class="preamble">${preambleHTML}</div>
      ${L(f.html)}
    `;

    // animate blocks in
    const blocks = stage.querySelectorAll('.cb');
    blocks.forEach((b, i) => {
      setTimeout(() => b.classList.add('in'), 120 + i * 140);
    });

    // also fade preamble
    const pre = stage.querySelector('.preamble');
    pre.style.opacity = '0';
    pre.style.transition = 'opacity .4s ease';
    requestAnimationFrame(() => { pre.style.opacity = '1'; });

    // tag fade-in for .block-tag (treat as block too)
    stage.querySelectorAll('.block-tag').forEach((t, i) => {
      t.style.opacity = '0';
      t.style.transition = 'opacity .4s ease';
      setTimeout(() => { t.style.opacity = '1'; }, 100 + i * 140);
    });

    // scroll to top
    document.querySelector('.editor-scroll').scrollTo({ top: 0, behavior: 'instant' });

    // page-specific bindings
    if (id === 'chatpage' && typeof window.__bindChatPage === 'function') {
      window.__bindChatPage();
    }
    if (id === 'usage' && typeof window.__renderHeatmap === 'function') {
      window.__renderHeatmap();
    }
    // re-apply [data-fill] bars (used in usage breakdown)
    stage.querySelectorAll('[data-fill]').forEach(el => {
      const target = el.dataset.fill;
      el.style.width = '0%';
      setTimeout(() => { el.style.width = target; }, 250);
    });
  }

  function updateTitlebar(id) {
    const f = FILES[id];
    const bc = document.getElementById('crumb');
    if (bc) {
      bc.innerHTML = f.path.split(' / ').map((p, i, arr) =>
        i === arr.length - 1
          ? `<b>${p}</b>`
          : `<span>${p}</span><span class="slash">/</span>`
      ).join('');
    }
    const desc = document.getElementById('file-desc');
    if (desc) desc.textContent = L(f.description);
  }

  // =================== CHAT ===================

  const SYS_PROMPT = `Ты — ALaska AI, чат внутри сайта ALaska Studio (демо). ALaska — это IDE, форк VS Code с встроенным чатом, поддерживает модели OpenAI GPT 5.4 mini, GPT 5.4 и GPT 5.5. Бинарник 160 МБ, работает на Windows и Linux. 4 тарифа: Free $0, Pro $12, Max $30, Ultra $60 в месяц.

Помогай посетителю разобраться: что внутри продукта, какие модели и сколько стоят, как установить, кто его сделал. Команда — два инженера в Санкт-Петербурге, Минске и Рейкьявике. Финансирование — клиенты.

Отвечай по-русски, коротко (2-4 предложения), тепло, без официоза. Если спрашивают помощь по коду — мягко напомни, что здесь только демо-чат без доступа к файлам; в реальной IDE чат видит весь проект. Никогда не упоминай конкурентов по именам.`;

  function bindChat() {
    const sendBtn = document.getElementById('cinput-send');
    const ta = document.getElementById('cinput-ta');
    if (!sendBtn || !ta) return;

    function trySend() {
      const text = ta.value.trim();
      if (!text || isThinking) return;
      ta.value = '';
      ta.style.height = '36px';
      sendChat(text);
    }

    sendBtn.addEventListener('click', trySend);

    ta.addEventListener('keydown', e => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        trySend();
      }
    });

    ta.addEventListener('input', () => {
      ta.style.height = 'auto';
      ta.style.height = Math.min(120, ta.scrollHeight) + 'px';
      sendBtn.disabled = !ta.value.trim();
    });

    sendBtn.disabled = true;

    // welcome message
    setTimeout(() => {
      appendBubble('ai', 'Привет! Я ALaska AI. Спросите про модели, цены, как установить — или просто поздоровайтесь. Здесь у меня нет доступа к файлам, это демо-чат.');
    }, 2200);
  }

  async function sendChat(userText) {
    appendBubble('user', userText);
    chatHistory.push({ role: 'user', content: userText });
    refreshChatPageIfOpen();

    const thinking = appendBubble('ai', '<i></i><i></i><i></i>', { thinking: true });
    isThinking = true;
    refreshChatPageIfOpen();
    const sendBtn = document.getElementById('cinput-send');
    if (sendBtn) sendBtn.disabled = true;
    const cpSendBtn = document.getElementById('chatpage-send');
    if (cpSendBtn) cpSendBtn.disabled = true;

    try {
      // Build messages with system in first user (window.claude.complete accepts messages)
      const messages = [
        { role: 'user', content: SYS_PROMPT + '\n\n---\n\nПользователь: ' + userText }
      ];
      // include short history (last 6 exchanges)
      if (chatHistory.length > 1) {
        const tail = chatHistory.slice(-7, -1);
        const ctx = tail.map(m => (m.role === 'user' ? 'Пользователь' : 'ALaska') + ': ' + m.content).join('\n');
        messages[0].content = SYS_PROMPT + '\n\nКонтекст диалога:\n' + ctx + '\n\n---\n\nПользователь: ' + userText;
      }

      const reply = await window.claude.complete({ messages });
      chatHistory.push({ role: 'assistant', content: reply });
      replaceBubble(thinking, formatReply(reply));
      refreshChatPageIfOpen();
    } catch (err) {
      replaceBubble(thinking, '<span style="color: var(--red)">' + t('chat.networkError') + '</span>');
      console.error(err);
    } finally {
      isThinking = false;
      const sendBtn = document.getElementById('cinput-send');
      const ta = document.getElementById('cinput-ta');
      if (sendBtn && ta) sendBtn.disabled = !ta.value.trim();
      const cpSend = document.getElementById('chatpage-send');
      const cpTa = document.getElementById('chatpage-ta');
      if (cpSend && cpTa) cpSend.disabled = !cpTa.value.trim();
    }
  }

  function refreshChatPageIfOpen() {
    const body = document.getElementById('chatpage-body');
    if (!body) return;
    body.innerHTML = '';
    chatHistory.forEach(msg => {
      const role = msg.role === 'user' ? 'user' : 'ai';
      const text = role === 'user' ? escapeText(msg.content) : formatReply(msg.content);
      body.appendChild(buildBubble(role, text));
    });
    if (isThinking) {
      const t = buildBubble('ai', '<i></i><i></i><i></i>', { thinking: true });
      body.appendChild(t);
    }
    body.scrollTop = body.scrollHeight;
  }

  function escapeText(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  function buildBubble(role, html, opts = {}) {
    const wrap = document.createElement('div');
    wrap.className = 'cmsg' + (opts.thinking ? ' thinking' : '');
    wrap.innerHTML = `
      <div class="avatar ${role}">${role === 'ai' ? 'A' : (currentLang === 'en' ? 'U' : 'Я')}</div>
      <div class="body">
        <div class="who"><b>${role === 'ai' ? 'alaska' : (currentLang === 'en' ? 'you' : 'вы')}</b> · ${new Date().toLocaleTimeString(currentLang === 'en' ? 'en-US' : 'ru-RU', {hour:'2-digit', minute:'2-digit'})}</div>
        <div class="text">${html}</div>
      </div>
    `;
    return wrap;
  }

  // Expose chatpage binding so renderEditor can call it when chatpage opens
  window.__bindChatPage = function() {
    refreshChatPageIfOpen();
    const ta = document.getElementById('chatpage-ta');
    const sendBtn = document.getElementById('chatpage-send');
    const clearBtn = document.querySelector('[data-action="chat-clear"]');
    if (!ta || !sendBtn) return;

    function trySend() {
      const text = ta.value.trim();
      if (!text || isThinking) return;
      ta.value = '';
      ta.style.height = '36px';
      sendChat(text);
    }
    sendBtn.addEventListener('click', trySend);
    ta.addEventListener('keydown', e => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault(); trySend();
      }
    });
    ta.addEventListener('input', () => {
      ta.style.height = 'auto';
      ta.style.height = Math.min(160, ta.scrollHeight) + 'px';
      sendBtn.disabled = !ta.value.trim();
    });
    sendBtn.disabled = true;

    if (clearBtn) clearBtn.addEventListener('click', () => {
      chatHistory.length = 0;
      const cbody = document.getElementById('cbody');
      if (cbody) cbody.innerHTML = '';
      refreshChatPageIfOpen();
    });
  };

  // Usage heatmap renderer
  window.__renderHeatmap = function() {
    const root = document.getElementById('usage-heatmap');
    if (!root) return;
    // 7 days × 24 hours = 168 cells, weighted to look like a work pattern
    const cells = [];
    for (let d = 0; d < 7; d++) {
      for (let h = 0; h < 24; h++) {
        // base: work-day evening cluster + weekend dip
        let v = 0;
        const isWeekend = d === 5 || d === 6;
        if (h >= 9 && h <= 22) v = 1 + Math.floor(Math.random() * 3);
        if (h >= 14 && h <= 20) v += Math.floor(Math.random() * 3);
        if (isWeekend) v = Math.max(0, v - 2);
        v = Math.min(4, Math.max(0, v + Math.floor(Math.random() * 2 - 1)));
        cells.push(v);
      }
    }
    const COLORS = [
      'var(--panel)',
      'oklch(0.45 0.06 220)',
      'oklch(0.60 0.08 220)',
      'oklch(0.75 0.10 220)',
      'oklch(0.83 0.10 220)'
    ];
    const dayLabels = currentLang === 'en'
      ? ['Mon','Tue','Wed','Thu','Fri','Sat','Sun']
      : ['Пн','Вт','Ср','Чт','Пт','Сб','Вс'];

    const head = '<div class="hm-row hm-head"><div class="hm-d"></div>' +
      Array.from({length: 24}, (_, h) => `<div class="hm-h">${h % 6 === 0 ? h : ''}</div>`).join('') + '</div>';
    const rows = dayLabels.map((lab, d) => {
      const day = cells.slice(d * 24, (d + 1) * 24);
      const cellsHtml = day.map(v => `<div class="hm-c" style="background:${COLORS[v]}"></div>`).join('');
      return `<div class="hm-row"><div class="hm-d">${lab}</div>${cellsHtml}</div>`;
    }).join('');
    root.innerHTML = head + rows;
  };

  function appendBubble(role, html, opts = {}) {
    const body = document.getElementById('cbody');
    if (!body) return null;
    const wrap = document.createElement('div');
    wrap.className = 'cmsg' + (opts.thinking ? ' thinking' : '');
    wrap.innerHTML = `
      <div class="avatar ${role}">${role === 'ai' ? 'A' : 'Я'}</div>
      <div class="body">
        <div class="who"><b>${role === 'ai' ? 'alaska' : 'вы'}</b> · ${new Date().toLocaleTimeString('ru-RU', {hour:'2-digit', minute:'2-digit'})}</div>
        <div class="text">${html}</div>
      </div>
    `;
    body.appendChild(wrap);
    body.scrollTop = body.scrollHeight;
    return wrap;
  }

  function replaceBubble(wrap, html) {
    if (!wrap) return;
    wrap.classList.remove('thinking');
    const text = wrap.querySelector('.text');
    if (text) {
      // typewriter effect for the response
      text.innerHTML = '';
      typeIntoElement(text, html, 12);
    }
    const body = document.getElementById('cbody');
    if (body) body.scrollTop = body.scrollHeight;
  }

  function typeIntoElement(target, html, speed) {
    // simple char-by-char typer; preserves HTML tags by inserting in chunks
    const tmp = document.createElement('div');
    tmp.innerHTML = html;
    const nodes = Array.from(tmp.childNodes);
    let i = 0;
    function step() {
      if (i >= nodes.length) return;
      const node = nodes[i++];
      if (node.nodeType === 3) {
        // text — type char by char
        const text = node.textContent;
        let j = 0;
        const span = document.createTextNode('');
        target.appendChild(span);
        function char() {
          if (j < text.length) {
            span.textContent += text[j++];
            const body = document.getElementById('cbody');
            if (body) body.scrollTop = body.scrollHeight;
            setTimeout(char, speed);
          } else {
            step();
          }
        }
        char();
      } else {
        target.appendChild(node.cloneNode(true));
        setTimeout(step, 30);
      }
    }
    step();
  }

  function formatReply(text) {
    // safe escape, then wrap inline code in backticks
    const esc = text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
    const withCode = esc.replace(/`([^`]+)`/g, '<code>$1</code>');
    return withCode;
  }

  // =================== STATUSBAR clock ===================
  function tickClock() {
    const el = document.querySelector('[data-anch-time]');
    if (el) {
      const now = new Date();
      const utc = now.getTime() + now.getTimezoneOffset() * 60000;
      const ak = new Date(utc + -8 * 3600000);
      const hh = ak.getHours().toString().padStart(2, '0');
      const mm = ak.getMinutes().toString().padStart(2, '0');
      el.textContent = `${hh}:${mm} АКDT`;
    }
  }
  tickClock();
  setInterval(tickClock, 30000);

})();


/* ============================================================
   ALaska Studio — window chrome, path bar, desktop, dock, VPN
   (separate IIFE — does not depend on internal state above)
============================================================ */
(() => {
  const FILES = window.STUDIO_FILES || {};
  const ORDER = window.STUDIO_ORDER || [];

  let winState = 'fullscreen'; // 'fullscreen' | 'windowed' | 'minimized' | 'closed'
  const dockEntries = new Set();

  document.addEventListener('DOMContentLoaded', () => {
    bindTrafficLights();
    bindTreeActions();
    bindPathBar();
    bindDesktop();
    bindVPN();
    tickDesktopClock();
    setInterval(tickDesktopClock, 30000);
  });

  // ============= TRAFFIC LIGHTS =============
  function bindTrafficLights() {
    document.querySelectorAll('.titlebar .dots .dot').forEach(btn => {
      btn.addEventListener('click', () => {
        const action = btn.dataset.win;
        if (action === 'close')    closeStudio();
        if (action === 'minimize') minimizeStudio();
        if (action === 'zoom')     zoomStudio();
      });
    });
  }

  function closeStudio() {
    const studio = document.querySelector('.studio');
    studio.classList.remove('windowed', 'minimized');
    studio.classList.add('closed');
    showDesktop();
    winState = 'closed';
    // remove all dock entries — app is "closed"
    document.getElementById('dock').innerHTML = '';
    document.getElementById('dock').classList.remove('has-items');
    dockEntries.clear();
  }

  function minimizeStudio() {
    const studio = document.querySelector('.studio');
    studio.classList.remove('closed');
    studio.classList.add('minimized');
    showDesktop();
    addDockEntry();
    winState = 'minimized';
  }

  function zoomStudio() {
    const studio = document.querySelector('.studio');
    if (winState === 'closed' || winState === 'minimized') {
      // restore first
      restoreStudio();
      return;
    }
    if (studio.classList.contains('windowed')) {
      studio.classList.remove('windowed');
      winState = 'fullscreen';
    } else {
      studio.classList.add('windowed');
      winState = 'windowed';
    }
  }

  function restoreStudio() {
    const studio = document.querySelector('.studio');
    studio.classList.remove('closed', 'minimized');
    hideDesktop();
    winState = studio.classList.contains('windowed') ? 'windowed' : 'fullscreen';
    // remove dock entries since app is back in focus
    document.getElementById('dock').innerHTML = '';
    document.getElementById('dock').classList.remove('has-items');
    dockEntries.clear();
  }

  function showDesktop() {
    const desktop = document.getElementById('desktop');
    if (desktop) desktop.classList.add('show');
  }
  function hideDesktop() {
    const desktop = document.getElementById('desktop');
    if (desktop) desktop.classList.remove('show');
    // also close vpn modal if open
    const vpn = document.getElementById('vpn-modal');
    if (vpn && !vpn.hidden) vpn.hidden = true;
  }

  function addDockEntry() {
    if (dockEntries.has('alaska')) return;
    dockEntries.add('alaska');
    const dock = document.getElementById('dock');
    if (!dock) return;
    const btn = document.createElement('button');
    btn.className = 'dock-item';
    btn.title = 'ALaska Studio';
    btn.innerHTML = `
      <span class="dock-ico">
        <svg viewBox="0 0 26 26" fill="none">
          <path d="M13 1 L25 13 L13 25 L1 13 Z" stroke="oklch(0.83 0.10 220)" stroke-width="1.2" stroke-opacity=".5"></path>
          <path d="M13 7 L19 13 L13 19 L7 13 Z" fill="oklch(0.83 0.10 220)"></path>
        </svg>
      </span>
    `;
    btn.addEventListener('click', restoreStudio);
    dock.appendChild(btn);
    dock.classList.add('has-items');
  }

  // ============= DESKTOP APP ICONS =============
  function bindDesktop() {
    document.querySelectorAll('.dapp').forEach(btn => {
      btn.addEventListener('dblclick', () => launchApp(btn.dataset.app, btn));
      btn.addEventListener('click', () => {
        // single click also works (lower bar to use)
        btn.classList.add('bouncing');
        setTimeout(() => btn.classList.remove('bouncing'), 500);
      });
    });
  }

  function launchApp(name, btn) {
    if (btn) {
      btn.classList.add('bouncing');
      setTimeout(() => btn.classList.remove('bouncing'), 500);
    }
    if (name === 'alaska') {
      setTimeout(restoreStudio, 220);
    }
    if (name === 'telegram') {
      window.open('https://t.me/', '_blank', 'noopener');
    }
    if (name === 'panicvpn') {
      const vpn = document.getElementById('vpn-modal');
      if (vpn) vpn.hidden = false;
    }
  }

  // ============= PANIC VPN =============
  let vpnState = 'idle'; // idle | connecting | connected
  let vpnTimer = null;

  function bindVPN() {
    const x = document.querySelector('[data-close-vpn]');
    if (x) x.addEventListener('click', () => {
      const vpn = document.getElementById('vpn-modal');
      if (vpn) vpn.hidden = true;
    });

    const toggle = document.getElementById('vpn-toggle');
    if (!toggle) return;
    toggle.addEventListener('click', () => {
      if (vpnState === 'connected') vpnDisconnect();
      else vpnConnect();
    });
  }

  function vpnLog(line, cls = '') {
    const log = document.getElementById('vpn-log');
    if (!log) return;
    const el = document.createElement('div');
    if (cls) el.className = cls;
    el.textContent = line;
    log.appendChild(el);
    log.scrollTop = log.scrollHeight;
  }

  function vpnConnect() {
    if (vpnState !== 'idle') return;
    vpnState = 'connecting';
    const status = document.getElementById('vpn-status');
    const toggle = document.getElementById('vpn-toggle');
    const loc = document.getElementById('vpn-loc').value;

    status.className = 'vpn-status connecting';
    status.querySelector('.vpn-label').textContent = 'подключение…';
    toggle.disabled = true;
    toggle.textContent = 'Подключение…';

    vpnLog('▸ инициализация туннеля → ' + loc, 'info');
    setTimeout(() => vpnLog('✓ TLS handshake', 'ok'), 500);
    setTimeout(() => vpnLog('✓ маршрут получен', 'ok'), 1100);
    setTimeout(() => vpnLog('✓ DNS перенаправлен', 'ok'), 1600);
    vpnTimer = setTimeout(() => {
      vpnState = 'connected';
      status.className = 'vpn-status connected';
      status.querySelector('.vpn-label').textContent = 'подключено · ' + loc;
      toggle.disabled = false;
      toggle.textContent = 'Отключить';
      toggle.classList.add('disconnect');
      vpnLog('✓ туннель активен', 'ok');
    }, 2200);
  }

  function vpnDisconnect() {
    if (vpnState !== 'connected') return;
    if (vpnTimer) clearTimeout(vpnTimer);
    vpnState = 'idle';
    const status = document.getElementById('vpn-status');
    const toggle = document.getElementById('vpn-toggle');
    status.className = 'vpn-status';
    status.querySelector('.vpn-label').textContent = 'не подключено';
    toggle.textContent = 'Подключить →';
    toggle.classList.remove('disconnect');
    vpnLog('▸ отключено', 'info');
  }

  // ============= TREE ACTIONS (collapse / refresh) =============
  function bindTreeActions() {
    const head = document.querySelector('.tree-pane .head .actions');
    if (!head) return;
    const spans = head.querySelectorAll('span');
    if (spans[0]) {
      spans[0].addEventListener('click', () => {
        document.querySelectorAll('.tree-row.folder').forEach(row => {
          // keep "root" open, collapse the rest
          if (row.dataset.folder === 'root') return;
          row.classList.remove('open');
          const caret = row.querySelector('.caret');
          if (caret) caret.textContent = '▸';
        });
        // re-evaluate which child rows are visible
        applyFolderVisibility();
      });
    }
    if (spans[1]) {
      spans[1].addEventListener('click', () => {
        // refresh animation: spin the ↻
        spans[1].style.transition = 'transform .6s ease';
        spans[1].style.transform = 'rotate(360deg)';
        setTimeout(() => {
          spans[1].style.transition = 'none';
          spans[1].style.transform = '';
        }, 700);
        // visually re-trigger reading on current file
        const active = document.querySelector('.tree-row.file.active');
        if (active) {
          active.classList.add('reading');
          setTimeout(() => active.classList.remove('reading'), 1200);
        }
      });
    }

    // listen on folder clicks to (re)compute visibility AFTER existing handler ran
    document.querySelectorAll('.tree-row.folder').forEach(row => {
      row.addEventListener('click', () => {
        // give existing toggle handler a tick to settle
        setTimeout(applyFolderVisibility, 0);
      });
    });
    // initial pass
    applyFolderVisibility();
  }

  function applyFolderVisibility() {
    // Folders have ancestors in tree based on indent classes. If a parent
    // folder is collapsed, all its descendants (rows with higher indent
    // immediately after it, up to next same-or-lower indent folder) hide.
    const rows = Array.from(document.querySelectorAll('.tree-pane .tree-row'));
    let hideUntilIndent = null;
    rows.forEach(row => {
      const indent = getRowIndent(row);
      if (hideUntilIndent !== null) {
        if (indent > hideUntilIndent) {
          row.parentElement.style.display = 'none';
          return;
        } else {
          hideUntilIndent = null;
        }
      }
      row.parentElement.style.display = '';
      if (row.classList.contains('folder') && !row.classList.contains('open')) {
        hideUntilIndent = indent;
      }
    });
  }
  function getRowIndent(row) {
    if (row.classList.contains('indent-3')) return 3;
    if (row.classList.contains('indent-2')) return 2;
    if (row.classList.contains('indent-1')) return 1;
    return 0;
  }

  // expose so the main IIFE's tree builder can re-evaluate visibility
  window.__applyFolderVisibility = applyFolderVisibility;

  // ============= PATH BAR =============
  function bindPathBar() {
    const input = document.getElementById('pathbar-input');
    const suggest = document.getElementById('pathbar-suggest');
    const wrap = input ? input.closest('.pathbar') : null;
    if (!input || !suggest || !wrap) return;

    const ALIASES = window.STUDIO_ALIASES || {};

    function suggestionsFor(q) {
      const query = q.trim().toLowerCase().replace(/^\/+/, '').replace(/\.tsx$|\.mdx$/, '');
      if (!query) {
        return ORDER.map(id => ({ id, score: 1, label: FILES[id].name, path: FILES[id].path, matchStart: -1, matchLen: 0 }));
      }
      const results = [];
      ORDER.forEach(id => {
        const f = FILES[id];
        const haystack = (id + ' ' + f.name + ' ' + (ALIASES[id] || []).join(' ')).toLowerCase();
        let score = 0;
        let matchStart = -1, matchLen = 0;

        // exact alias
        if ((ALIASES[id] || []).some(a => a === query)) { score = 100; matchStart = 0; matchLen = query.length; }
        // file name starts with
        else if (f.name.toLowerCase().startsWith(query)) { score = 80; matchStart = 0; matchLen = query.length; }
        // id starts with
        else if (id.startsWith(query)) { score = 70; matchStart = 0; matchLen = query.length; }
        // includes
        else if (haystack.includes(query)) { score = 30; matchStart = id.indexOf(query); matchLen = query.length; }

        if (score > 0) results.push({ id, score, label: f.name, path: f.path, matchStart, matchLen });
      });
      results.sort((a, b) => b.score - a.score);
      return results;
    }

    let highlighted = 0;

    function render() {
      const q = input.value;
      const items = suggestionsFor(q);
      if (items.length === 0) {
        suggest.innerHTML = '<div class="pathbar-suggest-empty">нет совпадений</div>';
        return;
      }
      highlighted = Math.min(highlighted, items.length - 1);
      suggest.innerHTML = items.map((it, i) => {
        const fileIcon = window.STUDIO_ICONS[FILES[it.id].ext] || window.STUDIO_ICONS.tsx;
        let displayName = it.label;
        if (it.matchStart >= 0 && it.matchLen > 0) {
          const lower = displayName.toLowerCase();
          const idx = lower.indexOf(q.toLowerCase().replace(/^\/+/, ''));
          if (idx >= 0) {
            displayName = displayName.substring(0, idx) +
              '<span class="match">' + displayName.substring(idx, idx + it.matchLen) + '</span>' +
              displayName.substring(idx + it.matchLen);
          }
        }
        return `<div class="pathbar-suggest-item ${i === highlighted ? 'hl' : ''}" data-id="${it.id}">
          <span class="ico">${fileIcon}</span>
          <span>${displayName}</span>
          <span class="path">${it.path.split(' / ').slice(-3).join('/')}</span>
        </div>`;
      }).join('');
      suggest.querySelectorAll('[data-id]').forEach(el => {
        el.addEventListener('click', () => navigateTo(el.dataset.id));
      });
    }

    function navigateTo(id) {
      if (!FILES[id]) return;
      location.hash = '#/' + id;
      input.value = '';
      wrap.classList.remove('open');
      input.blur();
    }

    input.addEventListener('focus', () => { wrap.classList.add('open'); render(); });
    input.addEventListener('blur', () => {
      setTimeout(() => wrap.classList.remove('open'), 150);
    });
    input.addEventListener('input', () => { highlighted = 0; render(); });
    input.addEventListener('keydown', e => {
      const items = suggest.querySelectorAll('.pathbar-suggest-item');
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        highlighted = Math.min(items.length - 1, highlighted + 1);
        render();
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        highlighted = Math.max(0, highlighted - 1);
        render();
      } else if (e.key === 'Enter') {
        e.preventDefault();
        const hl = suggest.querySelector('.pathbar-suggest-item.hl');
        if (hl) navigateTo(hl.dataset.id);
      } else if (e.key === 'Escape') {
        input.blur();
      }
    });

    // ⌘P / Ctrl+P shortcut to focus pathbar
    document.addEventListener('keydown', e => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'p') {
        e.preventDefault();
        input.focus();
        input.select();
      }
    });
  }

  // ============= DESKTOP CLOCK =============
  function tickDesktopClock() {
    const el = document.querySelector('[data-desktop-clock]');
    if (!el) return;
    const now = new Date();
    const hh = now.getHours().toString().padStart(2, '0');
    const mm = now.getMinutes().toString().padStart(2, '0');
    const d = now.toLocaleDateString('ru-RU', { day: '2-digit', month: 'short' });
    el.textContent = d + ' · ' + hh + ':' + mm;
  }

})();


/* ============================================================
   MOBILE DRAWERS
============================================================ */
(() => {
  document.addEventListener('DOMContentLoaded', () => {
    const treePane  = document.querySelector('.tree-pane');
    const chatPane  = document.querySelector('.chat-pane');
    const backdrop  = document.querySelector('[data-drawer-backdrop]');

    function closeAll(){
      if (treePane) treePane.classList.remove('open');
      if (chatPane) chatPane.classList.remove('open');
      if (backdrop) backdrop.classList.remove('show');
    }
    function openDrawer(which){
      closeAll();
      if (which === 'tree' && treePane) treePane.classList.add('open');
      if (which === 'chat' && chatPane) chatPane.classList.add('open');
      if (backdrop) backdrop.classList.add('show');
    }

    document.querySelectorAll('[data-mobile-toggle]').forEach(btn => {
      btn.addEventListener('click', () => {
        const which = btn.dataset.mobileToggle;
        const isOpen = which === 'tree'
          ? treePane && treePane.classList.contains('open')
          : chatPane && chatPane.classList.contains('open');
        if (isOpen) closeAll(); else openDrawer(which);
      });
    });
    if (backdrop) backdrop.addEventListener('click', closeAll);

    // close tree drawer after picking a file (mobile only)
    document.addEventListener('click', e => {
      const t = e.target.closest('[data-file]');
      if (t && window.matchMedia('(max-width: 900px)').matches) {
        setTimeout(closeAll, 250);
      }
    });
  });
})();


/* ============================================================
   LEDING — tab switches (event delegation)
============================================================ */
(() => {
  document.addEventListener('click', (e) => {
    const mTab = e.target.closest('[data-m-tab]');
    if (mTab) {
      const root = mTab.closest('.leding-models');
      if (root) {
        root.dataset.mActive = mTab.dataset.mTab;
        root.querySelectorAll('[data-m-tab]').forEach(t => t.classList.toggle('active', t === mTab));
      }
    }
    const icTab = e.target.closest('[data-ic-tab]');
    if (icTab) {
      const root = icTab.closest('.leding-install');
      if (root) {
        root.dataset.icActive = icTab.dataset.icTab;
        root.querySelectorAll('[data-ic-tab]').forEach(t => t.classList.toggle('active', t === icTab));
      }
    }
  });
})();
