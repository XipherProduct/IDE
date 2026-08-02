/* ============================================================
   ALaska Studio — content templates for each "file"
   Each entry: { name, ext, path, preamble, html }
============================================================ */

window.STUDIO_FILES = {

  /* ============== LEDING (landing) ============== */
  leding: {
    name: 'leding.tsx',
    ext: 'tsx',
    path: 'alaska-ai / src / pages / leding.tsx',
    description: 'главная — 64 строки',
    preamble: [
      ['1',  '<span class="kw">import</span> { <span class="fn">Hero</span>, <span class="fn">Features</span>, <span class="fn">CTA</span> } <span class="kw">from</span> <span class="str">"./blocks"</span>'],
      ['2',  '<span class="kw">import</span> { <span class="fn">ChatDemo</span> } <span class="kw">from</span> <span class="str">"./blocks/chat"</span>'],
      ['3',  ''],
      ['4',  '<span class="kw">export default function</span> <span class="fn">Landing</span>() {'],
      ['5',  '&nbsp;&nbsp;<span class="kw">return</span> ('],
      ['6',  '&nbsp;&nbsp;&nbsp;&nbsp;<span class="com">// рендер ниже — компоненты раскрываются как настоящие блоки</span>'],
    ],
    html: `
      <div class="block-tag">&lt;<b>Hero</b> /&gt;</div>
      <section class="cb file-hero">
        <h1>IDE, в которой <em>думает</em> чат.</h1>
        <p class="lede">
          ALaska — это <b>форк VS Code</b> с по-настоящему встроенным чатом: видит проект целиком,
          читает соседние файлы, правит код напрямую. Без расширений, без переключений вкладок.
        </p>
        <div class="actions">
          <a class="fb-btn primary" href="#/download">Скачать&nbsp;· 160 МБ</a>
          <a class="fb-btn" href="#/about">Кто это сделал →</a>
        </div>
      </section>

      <div class="block-tag">&lt;<b>Features</b> /&gt;</div>
      <section class="cb">
        <div class="fb-grid-3">
          <div class="fb-cell">
            <span class="num">01</span>
            <h4>Чат видит весь проект</h4>
            <p>Локальный индекс репо обновляется на лету. Ссылки на строки и файлы — без копипасты.</p>
          </div>
          <div class="fb-cell">
            <span class="num">02</span>
            <h4>Inline ⌘I — diff в редакторе</h4>
            <p>Выделите код, опишите словами — ALaska покажет diff. Применить ⇥, отменить Esc.</p>
          </div>
          <div class="fb-cell">
            <span class="num">03</span>
            <h4>OpenAI без VPN</h4>
            <p>Прямые маршруты к GPT 5.4 mini, 5.4, 5.5 через нашу инфраструктуру. Один счёт.</p>
          </div>
          <div class="fb-cell">
            <span class="num">04</span>
            <h4>160 МБ — и всё</h4>
            <p>Один бинарник. Без Electron-зоопарка обновлений и зависимостей.</p>
          </div>
          <div class="fb-cell">
            <span class="num">05</span>
            <h4>Совместим со всем</h4>
            <p>Расширения VS Code, темы, devcontainers, SSH — на месте, ничего перенастраивать не надо.</p>
          </div>
          <div class="fb-cell">
            <span class="num">06</span>
            <h4>Код не уезжает в облако</h4>
            <p>В чат уходит только то, что вы явно прикрепили. Локальный индекс остаётся локально.</p>
          </div>
        </div>
      </section>

      <div class="block-tag">&lt;<b>CTA</b> /&gt;</div>
      <section class="cb">
        <div style="background: linear-gradient(180deg, var(--panel) 0%, var(--bg-2) 100%); border: 1px solid var(--line-2); border-radius: 14px; padding: 36px 32px; text-align: center">
          <h3 style="font-size: 28px; font-weight: 500; letter-spacing:-0.02em; margin: 0 0 14px">Полярный старт за&nbsp;90 секунд.</h3>
          <p style="color: var(--ink-2); margin: 0 auto 22px; max-width: 50ch">Один файл, без админских прав на Windows, без menulib-зависимостей на Linux.</p>
          <div style="display: flex; gap: 10px; justify-content: center; flex-wrap: wrap">
            <a class="fb-btn primary" href="#/download">Скачать ALaska →</a>
            <a class="fb-btn" href="#/pricing">Цены</a>
          </div>
        </div>
      </section>
    `
  },

  /* ============== LOGIN ============== */
  login: {
    name: 'login.tsx',
    ext: 'tsx',
    path: 'alaska-ai / src / pages / login.tsx',
    description: 'вход — Google + email',
    preamble: [
      ['1', '<span class="kw">import</span> { <span class="fn">AuthCard</span> } <span class="kw">from</span> <span class="str">"./blocks/auth"</span>'],
      ['2', '<span class="kw">import</span> { <span class="fn">googleAuth</span> } <span class="kw">from</span> <span class="str">"~/lib/auth"</span>'],
      ['3', ''],
      ['4', '<span class="kw">export default function</span> <span class="fn">Login</span>() {'],
      ['5', '&nbsp;&nbsp;<span class="kw">return</span> <span class="var">&lt;AuthCard mode=<span class="str">"login"</span> /&gt;</span>'],
    ],
    html: `
      <div class="block-tag">&lt;<b>AuthCard</b> mode="login" /&gt;</div>
      <section class="cb">
        <div class="fb-auth-card">
          <div class="kicker">Вход</div>
          <h3>С возвращением.</h3>
          <p class="sub">Ещё нет аккаунта? <a href="#/register">Зарегистрируйтесь</a> — $1 в подарок.</p>

          <button class="gbtn" type="button">
            <svg viewBox="0 0 24 24" fill="none">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.75h3.57c2.08-1.92 3.28-4.74 3.28-8.07z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.75c-.98.66-2.24 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.12A6.61 6.61 0 0 1 5.5 12c0-.74.13-1.46.34-2.12V7.04H2.18A11 11 0 0 0 1 12c0 1.78.43 3.46 1.18 4.96l3.66-2.84z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.65l3.15-3.15C17.45 2.09 14.97 1 12 1A11 11 0 0 0 2.18 7.04l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38z"/>
            </svg>
            Войти через Google
          </button>

          <div class="divider">или почтой</div>

          <form onsubmit="event.preventDefault()">
            <div class="field">
              <label>Почта</label>
              <input type="email" placeholder="dev@alaska.ai" />
            </div>
            <div class="field">
              <label>Пароль</label>
              <input type="password" placeholder="••••••••" />
            </div>
            <button class="submit">Войти →</button>
          </form>
        </div>
      </section>

      <div class="block-tag">&lt;<b>Footer</b> /&gt;</div>
      <section class="cb" style="text-align: center; color: var(--mute); font-family: 'JetBrains Mono', monospace; font-size: 11.5px">
        <p style="margin: 0">SSO для команд — скоро · v0.42.1</p>
      </section>
    `
  },

  /* ============== REGISTER ============== */
  register: {
    name: 'register.tsx',
    ext: 'tsx',
    path: 'alaska-ai / src / pages / register.tsx',
    description: 'регистрация — Google + email',
    preamble: [
      ['1', '<span class="kw">import</span> { <span class="fn">AuthCard</span> } <span class="kw">from</span> <span class="str">"./blocks/auth"</span>'],
      ['2', ''],
      ['3', '<span class="kw">export default function</span> <span class="fn">Register</span>() {'],
      ['4', '&nbsp;&nbsp;<span class="kw">return</span> <span class="var">&lt;AuthCard mode=<span class="str">"signup"</span> gift={1} /&gt;</span>'],
    ],
    html: `
      <div class="block-tag">&lt;<b>AuthCard</b> mode="signup" gift={1} /&gt;</div>
      <section class="cb">
        <div class="fb-auth-card">
          <div class="kicker">Регистрация</div>
          <h3>Полярный старт.</h3>
          <p class="sub">$1 кредитов в подарок. Карта не нужна. <a href="#/login">Уже есть аккаунт?</a></p>

          <button class="gbtn" type="button">
            <svg viewBox="0 0 24 24" fill="none">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.75h3.57c2.08-1.92 3.28-4.74 3.28-8.07z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.75c-.98.66-2.24 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.12A6.61 6.61 0 0 1 5.5 12c0-.74.13-1.46.34-2.12V7.04H2.18A11 11 0 0 0 1 12c0 1.78.43 3.46 1.18 4.96l3.66-2.84z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.65l3.15-3.15C17.45 2.09 14.97 1 12 1A11 11 0 0 0 2.18 7.04l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38z"/>
            </svg>
            Регистрация через Google
          </button>

          <div class="divider">или почтой</div>

          <form onsubmit="event.preventDefault()">
            <div class="field">
              <label>Имя</label>
              <input type="text" placeholder="Иван Иванов" />
            </div>
            <div class="field">
              <label>Рабочая почта</label>
              <input type="email" placeholder="dev@alaska.ai" />
            </div>
            <div class="field">
              <label>Пароль</label>
              <input type="password" placeholder="минимум 10 символов" />
            </div>
            <button class="submit">Создать аккаунт →</button>
          </form>
        </div>
      </section>
    `
  },

  /* ============== ABOUT ============== */
  about: {
    name: 'about.mdx',
    ext: 'mdx',
    path: 'alaska-ai / src / pages / about.mdx',
    description: 'команда и принципы',
    preamble: [
      ['1', '<span class="com">---</span>'],
      ['2', '<span class="com">title: О нас</span>'],
      ['3', '<span class="com">team: 2 инженера · EU + RU</span>'],
      ['4', '<span class="com">funding: Клиенты</span>'],
      ['5', '<span class="com">---</span>'],
    ],
    html: `
      <div class="block-tag">&lt;<b>Statement</b> /&gt;</div>
      <section class="cb">
        <p class="fb-statement">
          Alaska AI — это IDE, которую <em>хочется иметь</em>, когда маркетинговый текст перестаёт что-то значить. Мы сделали её потому что существующие ассистенты либо <em>забивают курсор предложениями</em>, либо весят <em>300 МБ как Electron-монстры</em>, либо живут на <em>продаже твоего кода модели</em>. Ни одного из этих вариантов мы не хотели.
        </p>
      </section>

      <div class="block-tag">&lt;<b>Origin</b> /&gt;</div>
      <section class="cb">
        <h3 style="font-size: 24px; font-weight: 500; letter-spacing:-0.02em; margin: 0 0 14px">Штаб-квартиры нет. <em style="font-style:normal; color: var(--ice)">Работаем оттуда, где холодно.</em></h3>
        <p style="color: var(--ink-2); font-size: 15px; line-height: 1.65; margin: 0 0 20px; max-width: 64ch">
          Команда распределена по Санкт-Петербургу, Минску и Рейкьявику. Лично встречаемся два раза в год. Всё остальное время — пишем код.
        </p>
      </section>

      <div class="block-tag">&lt;<b>Stats</b> /&gt;</div>
      <section class="cb">
        <div class="fb-stats">
          <div><div class="k">инженеров</div><div class="v">2</div></div>
          <div><div class="k">регион</div><div class="v">EU + RU</div></div>
          <div><div class="k">финансирование</div><div class="v">Клиенты <small>без VC</small></div></div>
          <div><div class="k">вакансий</div><div class="v">— <small>сейчас</small></div></div>
        </div>
      </section>

      <div class="block-tag">&lt;<b>Cities</b> /&gt;</div>
      <section class="cb">
        <div class="fb-grid-3">
          <div class="fb-cell">
            <span class="num">59°57′N · 30°19′E</span>
            <h4>Санкт-Петербург</h4>
            <p>Архитектура IDE, ядро редактора, индекс проекта. Тот, кто отвечает за 160 МБ.</p>
          </div>
          <div class="fb-cell">
            <span class="num">53°54′N · 27°34′E</span>
            <h4>Минск</h4>
            <p>Чат, агенты, контекст. Объясняет ИИ, как читать ваш warehouse.ts.</p>
          </div>
          <div class="fb-cell">
            <span class="num">64°08′N · 21°56′W</span>
            <h4>Рейкьявик</h4>
            <p>Инфра и шлюз к OpenAI. Делает так, чтобы вам не приходилось трогать VPN.</p>
          </div>
        </div>
      </section>

      <div class="block-tag">&lt;<b>Contact</b> /&gt;</div>
      <section class="cb" style="margin-top: 24px">
        <div style="display:flex; gap: 10px; flex-wrap:wrap">
          <a class="fb-btn primary" href="mailto:hello@alaska.ai">hello@alaska.ai</a>
          <a class="fb-btn" href="#">Telegram</a>
          <a class="fb-btn" href="#">GitHub</a>
        </div>
      </section>
    `
  },

  /* ============== PRICING ============== */
  pricing: {
    name: 'pricing.tsx',
    ext: 'tsx',
    path: 'alaska-ai / src / pages / pricing.tsx',
    description: '4 плана + перенос кредитов',
    preamble: [
      ['1', '<span class="kw">import</span> { <span class="fn">PriceCard</span> } <span class="kw">from</span> <span class="str">"./blocks/pricing"</span>'],
      ['2', '<span class="kw">const</span> <span class="var">PLANS</span> = [<span class="str">"free"</span>, <span class="str">"pro"</span>, <span class="str">"max"</span>, <span class="str">"ultra"</span>]'],
      ['3', ''],
      ['4', '<span class="kw">export default function</span> <span class="fn">Pricing</span>() {'],
    ],
    html: `
      <div class="block-tag">&lt;<b>Header</b> /&gt;</div>
      <section class="cb">
        <h2 style="font-size: clamp(28px, 3.5vw, 40px); font-weight: 500; letter-spacing:-0.025em; margin: 0 0 12px">
          Платите за <em style="font-style:normal; background: linear-gradient(180deg, var(--ice) 0%, var(--ice-2) 100%); -webkit-background-clip: text; background-clip: text; -webkit-text-fill-color: transparent">токены</em>, а не за «безлимит».
        </h2>
        <p style="color: var(--ink-2); margin: 0 0 26px; font-size: 15.5px; max-width: 60ch">
          Четыре плана. Кредиты — это просто доллары. На Max и Ultra неиспользованное переносится на следующий месяц.
        </p>
      </section>

      <div class="block-tag">&lt;<b>Plans</b> /&gt;</div>
      <section class="cb">
        <div class="fb-price-grid">
          <div class="fb-price-card">
            <div class="tier">Free</div>
            <h4>Free</h4>
            <p class="pitch">Начните с Alaska AI прямо в редакторе.</p>
            <div class="amount"><span class="num">$0</span><span class="per">навсегда</span></div>
            <ul>
              <li>$1 месячных кредитов</li>
              <li>Только GPT 5.4 mini</li>
              <li>Десктоп-чат</li>
            </ul>
            <a class="cta" href="#/register">Начать бесплатно</a>
          </div>

          <div class="fb-price-card featured">
            <div class="tier">Pro</div>
            <h4>Pro</h4>
            <p class="pitch">Для повседневной работы.</p>
            <div class="amount"><span class="num">$12</span><span class="per">в месяц</span></div>
            <ul>
              <li>$12 кредитов</li>
              <li>Все модели — 5.4 mini, 5.4, 5.5</li>
              <li>GPT 5.5 — 3¢ за вызов</li>
              <li>Перенос +$3/мес</li>
            </ul>
            <a class="cta" href="#/register">Выбрать Pro →</a>
          </div>

          <div class="fb-price-card">
            <div class="tier">Max</div>
            <h4>Max</h4>
            <p class="pitch">Интенсивная работа каждый день.</p>
            <div class="amount"><span class="num">$30</span><span class="per">в месяц</span></div>
            <ul>
              <li>$30 кредитов</li>
              <li>Перенос включён</li>
              <li>До 8k токенов на ответ</li>
              <li>Всё из Pro</li>
            </ul>
            <a class="cta" href="#/register">Выбрать Max</a>
          </div>

          <div class="fb-price-card">
            <div class="tier">Ultra</div>
            <h4>Ultra</h4>
            <p class="pitch">Максимальная ёмкость.</p>
            <div class="amount"><span class="num">$60</span><span class="per">в месяц</span></div>
            <ul>
              <li>$60 кредитов</li>
              <li>Перенос 2× бюджета</li>
              <li>Тяжёлые нагрузки</li>
              <li>Всё из Max</li>
            </ul>
            <a class="cta" href="#/register">Выбрать Ultra</a>
          </div>
        </div>
      </section>

      <div class="block-tag">&lt;<b>Notes</b> /&gt;</div>
      <section class="cb" style="margin-top: 24px">
        <div class="fb-row-2">
          <div class="fb-cell" style="background: var(--panel); border-radius: 12px; border: 1px solid var(--line)">
            <span class="num">FAQ · 01</span>
            <h4>Что такое «токен»?</h4>
            <p>Примерно слово или знак препинания. 1¢ — это ≈4 ответа mini, 3¢ — один ответ 5.5 со средним контекстом.</p>
          </div>
          <div class="fb-cell" style="background: var(--panel); border-radius: 12px; border: 1px solid var(--line)">
            <span class="num">FAQ · 02</span>
            <h4>Можно отменить?</h4>
            <p>Да. Перенесённые кредиты остаются ещё месяц — пользуйтесь до конца, дальше Free.</p>
          </div>
        </div>
      </section>
    `
  },

  /* ============== DOWNLOAD ============== */
  download: {
    name: 'download.tsx',
    ext: 'tsx',
    path: 'alaska-ai / src / pages / download.tsx',
    description: 'дистрибутивы + sha256',
    preamble: [
      ['1', '<span class="kw">import</span> { <span class="fn">platform</span> } <span class="kw">from</span> <span class="str">"~/lib/os"</span>'],
      ['2', '<span class="kw">const</span> <span class="var">VERSION</span> = <span class="str">"0.42.1"</span> <span class="com">// 2026.05.08</span>'],
      ['3', '<span class="kw">const</span> <span class="var">SIZE_MB</span> = <span class="num">160</span>'],
    ],
    html: `
      <div class="block-tag">&lt;<b>Header</b> /&gt;</div>
      <section class="cb file-hero">
        <h1>Скачать <em>ALaska</em>.</h1>
        <p class="lede">Один бинарник в 160 МБ. Без админских прав на Windows, без menulib-зависимостей на Linux.</p>
      </section>

      <div class="block-tag">&lt;<b>Builds</b> /&gt;</div>
      <section class="cb">
        <div class="fb-dl">
          <a class="fb-dl-row" href="#">
            <span class="ico">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M3 5.5 10.5 4.4v7.1H3zM10.5 12.5v7.1L3 18.5v-6zm1 0H21v8L11.5 19zM21 3.5v8H11.5V4.6z"/></svg>
            </span>
            <span class="info">
              <div class="name">Windows 10 / 11</div>
              <div class="meta">ALaska-0.42.1-x64.exe · 160 МБ · Authenticode</div>
            </span>
            <span class="arrow">скачать ↓</span>
          </a>
          <a class="fb-dl-row" href="#">
            <span class="ico">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M12 2c-2 0-3 2-3 4 0 1 0 2 1 3-2 1-4 4-4 8 0 2 1 4 2 5 1 0 2-1 3-1 1 0 1 1 1 2-1 0-2 0-2 1 1 0 6 0 6-1 0-1-1-1-1-1 0-1 1-2 1-2 1 0 2 1 3 1 1-1 2-3 2-5 0-4-2-7-4-8 1-1 1-2 1-3 0-2-1-4-3-4z"/></svg>
            </span>
            <span class="info">
              <div class="name">Linux · .deb</div>
              <div class="meta">ALaska_0.42.1_amd64.deb · Debian/Ubuntu/Mint</div>
            </span>
            <span class="arrow">скачать ↓</span>
          </a>
          <a class="fb-dl-row" href="#">
            <span class="ico">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M12 2c-2 0-3 2-3 4 0 1 0 2 1 3-2 1-4 4-4 8 0 2 1 4 2 5 1 0 2-1 3-1 1 0 1 1 1 2-1 0-2 0-2 1 1 0 6 0 6-1 0-1-1-1-1-1 0-1 1-2 1-2 1 0 2 1 3 1 1-1 2-3 2-5 0-4-2-7-4-8 1-1 1-2 1-3 0-2-1-4-3-4z"/></svg>
            </span>
            <span class="info">
              <div class="name">Linux · AppImage</div>
              <div class="meta">ALaska-0.42.1-x86_64.AppImage · работает где угодно</div>
            </span>
            <span class="arrow">скачать ↓</span>
          </a>
          <a class="fb-dl-row disabled" href="#">
            <span class="ico">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M16.5 12.5a3.5 3.5 0 0 1 1.65-2.95 3.6 3.6 0 0 0-2.85-1.55c-1.2-.13-2.36.71-2.97.71-.62 0-1.57-.69-2.59-.67a3.77 3.77 0 0 0-3.18 1.94c-1.36 2.37-.35 5.86 1 7.78.65.94 1.4 1.99 2.4 1.95.97-.04 1.33-.62 2.49-.62 1.15 0 1.48.62 2.5.6 1.04-.02 1.69-.95 2.32-1.9.5-.75.83-1.55 1.07-2.39a3.42 3.42 0 0 1-2.04-2.9z"/></svg>
            </span>
            <span class="info">
              <div class="name">macOS</div>
              <div class="meta">Universal Binary · Intel + Apple Silicon</div>
            </span>
            <span class="arrow">скоро →</span>
          </a>
        </div>
      </section>

      <div class="block-tag">&lt;<b>OneLineInstall</b> /&gt;</div>
      <section class="cb">
        <div style="background: var(--panel); border: 1px solid var(--line); border-radius: 10px; padding: 16px 18px; font-family: 'JetBrains Mono', monospace; font-size: 13px; color: var(--ink-2); line-height: 1.75">
          <div><span style="color: var(--aurora)">~ $</span> curl -L alaska.ai/get | sh</div>
          <div style="color: var(--mute)">→ обнаружено: linux-x86_64</div>
          <div style="color: var(--mute)">→ sha256: ok · gpg: подпись валидна</div>
          <div style="color: var(--mute)">→ установлено в ~/.alaska</div>
          <div><span style="color: var(--aurora)">✓ запустите:</span> <span style="color: var(--ice)">alaska .</span></div>
        </div>
      </section>

      <div class="block-tag">&lt;<b>Verify</b> /&gt;</div>
      <section class="cb">
        <div style="font-family: 'JetBrains Mono', monospace; font-size: 12px; color: var(--mute); line-height: 1.7">
          <div>sha256: <span style="color: var(--ink-2)">a1f9c4d… 84d2</span></div>
          <div>gpg: <span style="color: var(--ink-2)">0xA1A9 B7C5 99D6 11E4</span></div>
        </div>
      </section>
    `
  }
};

window.STUDIO_ORDER = ['leding', 'login', 'register', 'about', 'pricing', 'download'];

window.STUDIO_ICONS = {
  tsx: `<svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor"><rect x="1" y="2" width="14" height="12" rx="1" fill="none" stroke="currentColor" stroke-width="1"/><text x="3" y="11" font-family="monospace" font-size="6" fill="currentColor" font-weight="700">TSX</text></svg>`,
  mdx: `<svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor"><rect x="1" y="2" width="14" height="12" rx="1" fill="none" stroke="currentColor" stroke-width="1"/><text x="3" y="11" font-family="monospace" font-size="6" fill="currentColor" font-weight="700">MD</text></svg>`,
  folder: `<svg width="13" height="13" viewBox="0 0 16 16" fill="currentColor"><path d="M1 3 a1 1 0 0 1 1 -1 h4 l1.5 1.5 H14 a1 1 0 0 1 1 1 V13 a1 1 0 0 1 -1 1 H2 a1 1 0 0 1 -1 -1 Z" stroke="currentColor" stroke-width="1" fill="none"/></svg>`,
  folder_open: `<svg width="13" height="13" viewBox="0 0 16 16" fill="currentColor"><path d="M1 3 a1 1 0 0 1 1 -1 h4 l1.5 1.5 H14 a1 1 0 0 1 1 1 V5 H1 Z M1 5 H15 L14 13 a1 1 0 0 1 -1 1 H2 a1 1 0 0 1 -1 -1 Z" stroke="currentColor" stroke-width="1" fill="none"/></svg>`,
};
