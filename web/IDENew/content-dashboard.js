/* ============================================================
   ALaska Studio — dashboard files
   overview / chat / usage / billing / settings
============================================================ */

Object.assign(window.STUDIO_FILES, {

  /* ============================================================
     OVERVIEW (Обзор)
  ============================================================ */
  overview: {
    name: 'overview.tsx',
    ext: 'tsx',
    path: 'alaska-ai / src / dashboard / overview.tsx',
    description: { ru: 'добро пожаловать', en: 'welcome' },
    preamble: [
      ['1', '<span class="kw">import</span> { <span class="fn">Stats</span>, <span class="fn">PlanCard</span>, <span class="fn">QuickActions</span> } <span class="kw">from</span> <span class="str">"./blocks"</span>'],
      ['2', '<span class="kw">const</span> <span class="var">USER</span> = { name: <span class="str">"Alex"</span>, plan: <span class="str">"Pro"</span> }'],
      ['3', ''],
    ],
    html: {
      ru: `
        <div class="block-tag">&lt;<b>Greeting</b> /&gt;</div>
        <section class="cb">
          <h1 class="dash-h1">С возвращением, <em>Alex</em>.</h1>
          <p class="dash-lede">Эта неделя пока выглядит спокойнее прошлой. Топ-модель — <b>GPT 5.5</b>.</p>
        </section>

        <div class="block-tag">&lt;<b>Stats</b> /&gt;</div>
        <section class="cb">
          <div class="dash-stats">
            <div><div class="k">Запросы</div><div class="v">1 248</div><div class="d aur">+18% к прошлой неделе</div></div>
            <div><div class="k">Токены</div><div class="v">2,79M</div><div class="d">in 2.41M · out 0.38M</div></div>
            <div><div class="k">Активные дни</div><div class="v">5 / 7</div><div class="d">Пн–Пт</div></div>
            <div><div class="k">Топ-модель</div><div class="v ice">GPT 5.5</div><div class="d">62% запросов</div></div>
          </div>
        </section>

        <div class="block-tag">&lt;<b>Plan</b> /&gt;</div>
        <section class="cb">
          <div class="dash-plan">
            <div class="dash-plan-l">
              <div class="ver">текущий тариф</div>
              <h3 class="ice">Pro · $12 / мес</h3>
              <p>$12 месячных кредитов · все модели · перенос за +$3</p>
            </div>
            <div class="dash-plan-r">
              <div class="kk">осталось кредитов</div>
              <div class="vv">$4.80<small> / $12</small></div>
              <div class="bar"><i style="width: 40%"></i></div>
              <div class="kk" style="margin-top:8px">сброс через <b style="color:var(--ink-2)">15 дней</b></div>
            </div>
            <a class="fb-btn primary" href="#/pricing">Сменить тариф →</a>
          </div>
        </section>

        <div class="block-tag">&lt;<b>Activity</b> /&gt;</div>
        <section class="cb">
          <h3 class="dash-h3">Активность</h3>
          <div class="dash-activity">
            <div class="row"><span class="t">14:23</span><span class="m">Чат в IDE · <code>warehouse.ts:42</code></span><span class="r">GPT 5.4</span></div>
            <div class="row"><span class="t">11:08</span><span class="m">Inline-правка · 11 строк</span><span class="r">GPT 5.5</span></div>
            <div class="row"><span class="t">09:42</span><span class="m">Чат в браузере</span><span class="r">GPT 5.4 mini</span></div>
            <div class="row"><span class="t">вчера 22:15</span><span class="m">Inline-правка · 4 файла</span><span class="r">GPT 5.5</span></div>
            <div class="row"><span class="t">вчера 18:30</span><span class="m">Refactor через палитру</span><span class="r">GPT 5.5</span></div>
          </div>
        </section>

        <div class="block-tag">&lt;<b>QuickActions</b> /&gt;</div>
        <section class="cb">
          <h3 class="dash-h3">Быстрые действия</h3>
          <div class="dash-quick">
            <a class="dash-quick-card" href="#/download">
              <span class="ico"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M12 3v10m0 0 3-3m-3 3-3-3M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2"/></svg></span>
              <div><div class="t">Установить редактор</div><div class="d">160 МБ · Windows / Linux / macOS</div></div>
            </a>
            <a class="dash-quick-card disabled">
              <span class="ico"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><circle cx="9" cy="12" r="6"/><path d="m15 12 6 0M19 10v4"/></svg></span>
              <div><div class="t">Создать API-ключ <small class="aur">скоро</small></div><div class="d">в следующем обновлении</div></div>
            </a>
            <a class="dash-quick-card" href="#">
              <span class="ico"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8M22 11h-6M19 8v6"/></svg></span>
              <div><div class="t">Пригласить коллегу</div><div class="d">$5 в кредит, когда подключится</div></div>
            </a>
            <a class="dash-quick-card" href="#/docs">
              <span class="ico"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M4 4h12a4 4 0 0 1 4 4v12M4 4v16h16M4 4a4 4 0 0 1 4-4h0M8 8h8M8 12h8M8 16h5"/></svg></span>
              <div><div class="t">Читать документацию</div><div class="d">онбординг · API · диагностика</div></div>
            </a>
          </div>
        </section>
      `,
      en: `
        <div class="block-tag">&lt;<b>Greeting</b> /&gt;</div>
        <section class="cb">
          <h1 class="dash-h1">Welcome back, <em>Alex</em>.</h1>
          <p class="dash-lede">This week looks calmer than last. Top model — <b>GPT 5.5</b>.</p>
        </section>

        <div class="block-tag">&lt;<b>Stats</b> /&gt;</div>
        <section class="cb">
          <div class="dash-stats">
            <div><div class="k">Requests</div><div class="v">1,248</div><div class="d aur">+18% vs last week</div></div>
            <div><div class="k">Tokens</div><div class="v">2.79M</div><div class="d">in 2.41M · out 0.38M</div></div>
            <div><div class="k">Active days</div><div class="v">5 / 7</div><div class="d">Mon–Fri</div></div>
            <div><div class="k">Top model</div><div class="v ice">GPT 5.5</div><div class="d">62% of requests</div></div>
          </div>
        </section>

        <div class="block-tag">&lt;<b>Plan</b> /&gt;</div>
        <section class="cb">
          <div class="dash-plan">
            <div class="dash-plan-l">
              <div class="ver">current plan</div>
              <h3 class="ice">Pro · $12 / mo</h3>
              <p>$12 monthly credits · all models · rollover +$3</p>
            </div>
            <div class="dash-plan-r">
              <div class="kk">credits left</div>
              <div class="vv">$4.80<small> / $12</small></div>
              <div class="bar"><i style="width: 40%"></i></div>
              <div class="kk" style="margin-top:8px">resets in <b style="color:var(--ink-2)">15 days</b></div>
            </div>
            <a class="fb-btn primary" href="#/pricing">Change plan →</a>
          </div>
        </section>

        <div class="block-tag">&lt;<b>Activity</b> /&gt;</div>
        <section class="cb">
          <h3 class="dash-h3">Activity</h3>
          <div class="dash-activity">
            <div class="row"><span class="t">14:23</span><span class="m">Chat in IDE · <code>warehouse.ts:42</code></span><span class="r">GPT 5.4</span></div>
            <div class="row"><span class="t">11:08</span><span class="m">Inline edit · 11 lines</span><span class="r">GPT 5.5</span></div>
            <div class="row"><span class="t">09:42</span><span class="m">Chat in browser</span><span class="r">GPT 5.4 mini</span></div>
            <div class="row"><span class="t">yesterday 22:15</span><span class="m">Inline edit · 4 files</span><span class="r">GPT 5.5</span></div>
            <div class="row"><span class="t">yesterday 18:30</span><span class="m">Refactor via palette</span><span class="r">GPT 5.5</span></div>
          </div>
        </section>

        <div class="block-tag">&lt;<b>QuickActions</b> /&gt;</div>
        <section class="cb">
          <h3 class="dash-h3">Quick actions</h3>
          <div class="dash-quick">
            <a class="dash-quick-card" href="#/download">
              <span class="ico"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M12 3v10m0 0 3-3m-3 3-3-3M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2"/></svg></span>
              <div><div class="t">Install the editor</div><div class="d">160 MB · Windows / Linux / macOS</div></div>
            </a>
            <a class="dash-quick-card disabled">
              <span class="ico"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><circle cx="9" cy="12" r="6"/><path d="m15 12 6 0M19 10v4"/></svg></span>
              <div><div class="t">Create API key <small class="aur">soon</small></div><div class="d">in the next release</div></div>
            </a>
            <a class="dash-quick-card" href="#">
              <span class="ico"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8M22 11h-6M19 8v6"/></svg></span>
              <div><div class="t">Invite a teammate</div><div class="d">$5 credit when they join</div></div>
            </a>
            <a class="dash-quick-card" href="#/docs">
              <span class="ico"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M4 4h12a4 4 0 0 1 4 4v12M4 4v16h16M4 4a4 4 0 0 1 4-4h0M8 8h8M8 12h8M8 16h5"/></svg></span>
              <div><div class="t">Read the docs</div><div class="d">onboarding · API · troubleshooting</div></div>
            </a>
          </div>
        </section>
      `
    }
  },

  /* ============================================================
     CHAT (Чат) — full-pane chat duplicate
  ============================================================ */
  chatpage: {
    name: 'chat.tsx',
    ext: 'tsx',
    path: 'alaska-ai / src / dashboard / chat.tsx',
    description: { ru: 'чат · полная версия', en: 'chat · full view' },
    preamble: [
      ['1', '<span class="kw">import</span> { <span class="fn">ChatStream</span> } <span class="kw">from</span> <span class="str">"./blocks"</span>'],
      ['2', ''],
    ],
    html: {
      ru: `
        <div class="block-tag">&lt;<b>Chat</b> /&gt;</div>
        <section class="cb">
          <div class="chatpage">
            <div class="chatpage-head">
              <div class="left">
                <span class="dot-aur"></span>
                <h2>Чат сайта</h2>
                <span class="hint">все диалоги хранятся локально в браузере</span>
              </div>
              <div class="right">
                <span class="model-pill">GPT&nbsp;5.5</span>
                <button class="fb-btn" data-action="chat-clear">Очистить</button>
              </div>
            </div>
            <div class="chatpage-body" id="chatpage-body"></div>
            <div class="chatpage-input">
              <div class="box">
                <textarea id="chatpage-ta" placeholder="спросите про ALaska, модели, цены, установку…"></textarea>
                <button id="chatpage-send" class="send">↵</button>
              </div>
              <div class="row">
                <div class="acts">
                  <span>Enter — отправить</span>
                  <span>Shift+Enter — новая строка</span>
                  <span style="color:var(--aurora)">● подключён</span>
                </div>
                <span>история синхронизирована с боковой панелью</span>
              </div>
            </div>
          </div>
        </section>
      `,
      en: `
        <div class="block-tag">&lt;<b>Chat</b> /&gt;</div>
        <section class="cb">
          <div class="chatpage">
            <div class="chatpage-head">
              <div class="left">
                <span class="dot-aur"></span>
                <h2>Site chat</h2>
                <span class="hint">all conversations stored locally in your browser</span>
              </div>
              <div class="right">
                <span class="model-pill">GPT&nbsp;5.5</span>
                <button class="fb-btn" data-action="chat-clear">Clear</button>
              </div>
            </div>
            <div class="chatpage-body" id="chatpage-body"></div>
            <div class="chatpage-input">
              <div class="box">
                <textarea id="chatpage-ta" placeholder="ask about ALaska, models, pricing, install…"></textarea>
                <button id="chatpage-send" class="send">↵</button>
              </div>
              <div class="row">
                <div class="acts">
                  <span>Enter — send</span>
                  <span>Shift+Enter — newline</span>
                  <span style="color:var(--aurora)">● connected</span>
                </div>
                <span>history synced with sidebar</span>
              </div>
            </div>
          </div>
        </section>
      `
    }
  },

  /* ============================================================
     USAGE (Использование)
  ============================================================ */
  usage: {
    name: 'usage.tsx',
    ext: 'tsx',
    path: 'alaska-ai / src / dashboard / usage.tsx',
    description: { ru: 'метрики потребления', en: 'consumption metrics' },
    preamble: [
      ['1', '<span class="kw">import</span> { <span class="fn">Heatmap</span>, <span class="fn">ModelBars</span> } <span class="kw">from</span> <span class="str">"./charts"</span>'],
      ['2', '<span class="kw">const</span> <span class="var">RANGE</span> = <span class="str">"month-to-date"</span>'],
      ['3', ''],
    ],
    html: {
      ru: `
        <div class="block-tag">&lt;<b>Header</b> /&gt;</div>
        <section class="cb">
          <h1 class="dash-h1">Использование.</h1>
          <p class="dash-lede">Текущий календарный месяц, по убыванию запросов.</p>
        </section>

        <div class="block-tag">&lt;<b>Stats</b> /&gt;</div>
        <section class="cb">
          <div class="dash-stats">
            <div><div class="k">Запросы</div><div class="v">1 248</div><div class="d">за май</div></div>
            <div><div class="k">Токены</div><div class="v">2,79M</div><div class="d">in 2.41M · out 0.38M</div></div>
            <div><div class="k">Списано провайдером</div><div class="v">$218,40</div><div class="d">api.openai.com</div></div>
            <div><div class="k">Тариф</div><div class="v ice">Pro</div><div class="d">$12 / мес</div></div>
          </div>
        </section>

        <div class="block-tag">&lt;<b>ModelBreakdown</b> /&gt;</div>
        <section class="cb">
          <h3 class="dash-h3">Разбивка по моделям</h3>
          <div class="usage-models">
            <div class="row">
              <span class="name">GPT 5.5</span>
              <span class="bar"><i data-fill="62%"></i></span>
              <span class="val">774 · $164.40</span>
            </div>
            <div class="row">
              <span class="name">GPT 5.4</span>
              <span class="bar"><i data-fill="30%"></i></span>
              <span class="val">374 · $46.20</span>
            </div>
            <div class="row">
              <span class="name">GPT 5.4 mini</span>
              <span class="bar"><i data-fill="8%"></i></span>
              <span class="val">100 · $7.80</span>
            </div>
          </div>
        </section>

        <div class="block-tag">&lt;<b>Heatmap</b> /&gt;</div>
        <section class="cb">
          <h3 class="dash-h3">Активность · последние 4 недели</h3>
          <p class="dash-mini">Дни недели × часы (UTC). Темнее = больше запросов.</p>
          <div class="usage-heatmap" id="usage-heatmap"></div>
          <div class="usage-heatmap-legend">
            <span>меньше</span>
            <span class="sw" style="background: var(--panel)"></span>
            <span class="sw" style="background: oklch(0.45 0.06 220)"></span>
            <span class="sw" style="background: oklch(0.60 0.08 220)"></span>
            <span class="sw" style="background: oklch(0.75 0.10 220)"></span>
            <span class="sw" style="background: oklch(0.83 0.10 220)"></span>
            <span>больше</span>
          </div>
        </section>
      `,
      en: `
        <div class="block-tag">&lt;<b>Header</b> /&gt;</div>
        <section class="cb">
          <h1 class="dash-h1">Usage.</h1>
          <p class="dash-lede">Current calendar month, sorted by requests.</p>
        </section>

        <div class="block-tag">&lt;<b>Stats</b> /&gt;</div>
        <section class="cb">
          <div class="dash-stats">
            <div><div class="k">Requests</div><div class="v">1,248</div><div class="d">in May</div></div>
            <div><div class="k">Tokens</div><div class="v">2.79M</div><div class="d">in 2.41M · out 0.38M</div></div>
            <div><div class="k">Charged by provider</div><div class="v">$218.40</div><div class="d">api.openai.com</div></div>
            <div><div class="k">Plan</div><div class="v ice">Pro</div><div class="d">$12 / mo</div></div>
          </div>
        </section>

        <div class="block-tag">&lt;<b>ModelBreakdown</b> /&gt;</div>
        <section class="cb">
          <h3 class="dash-h3">By model</h3>
          <div class="usage-models">
            <div class="row">
              <span class="name">GPT 5.5</span>
              <span class="bar"><i data-fill="62%"></i></span>
              <span class="val">774 · $164.40</span>
            </div>
            <div class="row">
              <span class="name">GPT 5.4</span>
              <span class="bar"><i data-fill="30%"></i></span>
              <span class="val">374 · $46.20</span>
            </div>
            <div class="row">
              <span class="name">GPT 5.4 mini</span>
              <span class="bar"><i data-fill="8%"></i></span>
              <span class="val">100 · $7.80</span>
            </div>
          </div>
        </section>

        <div class="block-tag">&lt;<b>Heatmap</b> /&gt;</div>
        <section class="cb">
          <h3 class="dash-h3">Activity · last 4 weeks</h3>
          <p class="dash-mini">Day-of-week × hour (UTC). Darker = more requests.</p>
          <div class="usage-heatmap" id="usage-heatmap"></div>
          <div class="usage-heatmap-legend">
            <span>less</span>
            <span class="sw" style="background: var(--panel)"></span>
            <span class="sw" style="background: oklch(0.45 0.06 220)"></span>
            <span class="sw" style="background: oklch(0.60 0.08 220)"></span>
            <span class="sw" style="background: oklch(0.75 0.10 220)"></span>
            <span class="sw" style="background: oklch(0.83 0.10 220)"></span>
            <span>more</span>
          </div>
        </section>
      `
    }
  },

  /* ============================================================
     BILLING (Оплата и счета)
  ============================================================ */
  billing: {
    name: 'billing.tsx',
    ext: 'tsx',
    path: 'alaska-ai / src / dashboard / billing.tsx',
    description: { ru: 'оплата и счета', en: 'billing and invoices' },
    preamble: [
      ['1', '<span class="kw">import</span> { <span class="fn">WeekBudget</span>, <span class="fn">Invoices</span> } <span class="kw">from</span> <span class="str">"./blocks"</span>'],
      ['2', ''],
    ],
    html: {
      ru: `
        <div class="block-tag">&lt;<b>WeekBudget</b> /&gt;</div>
        <section class="cb">
          <div class="bill-card">
            <div class="bill-card-head">
              <span class="ver">ULTRA · недельный бюджет</span>
              <span class="rollover">перенос: ВКЛ · перенесено $1 000,00</span>
            </div>
            <div class="bill-card-main">
              <div class="bill-amount">
                <span class="num">$1,15</span>
                <span class="of">/ $1 015,00</span>
              </div>
              <div class="bill-bar">
                <i style="width: 0.11%"></i>
              </div>
              <div class="bill-foot">
                <span>Неделя от <b style="color:var(--ink-2)">2026-05-11</b></span>
                <span>Сброс в <b style="color:var(--ink-2)">Пн 00:00 UTC</b> · через 3д 2ч</span>
              </div>
            </div>

            <div class="bill-week">
              <div class="day on"><span class="d">Пн</span><span class="v">$0.85</span></div>
              <div class="day on"><span class="d">Вт</span><span class="v">$0.30</span></div>
              <div class="day"><span class="d">Ср</span><span class="v">—</span></div>
              <div class="day"><span class="d">Чт</span><span class="v">—</span></div>
              <div class="day"><span class="d">Пт</span><span class="v">—</span></div>
              <div class="day"><span class="d">Сб</span><span class="v">—</span></div>
              <div class="day"><span class="d">Вс</span><span class="v">—</span></div>
            </div>

            <div class="bill-actions">
              <a class="fb-btn" href="#/pricing">Настроить расписание</a>
              <a class="fb-btn" href="#/pricing">Сменить план</a>
            </div>
          </div>
        </section>

        <div class="block-tag">&lt;<b>Invoices</b> /&gt;</div>
        <section class="cb">
          <h3 class="dash-h3">История платежей</h3>
          <div class="bill-table">
            <div class="head"><span>Дата</span><span>Тариф</span><span>Сумма</span><span>Статус</span><span></span></div>
            <div class="row">
              <span class="t">2026-04-15</span>
              <span>Ultra · 30 дней</span>
              <span class="num">$60.00</span>
              <span class="st ok">оплачено</span>
              <a class="fb-btn" href="#">PDF</a>
            </div>
            <div class="row">
              <span class="t">2026-03-15</span>
              <span>Ultra · 30 дней</span>
              <span class="num">$60.00</span>
              <span class="st ok">оплачено</span>
              <a class="fb-btn" href="#">PDF</a>
            </div>
            <div class="row">
              <span class="t">2026-02-15</span>
              <span>Pro → Ultra</span>
              <span class="num">$48.00</span>
              <span class="st ok">оплачено</span>
              <a class="fb-btn" href="#">PDF</a>
            </div>
            <div class="row">
              <span class="t">2026-01-15</span>
              <span>Pro · 30 дней</span>
              <span class="num">$12.00</span>
              <span class="st ok">оплачено</span>
              <a class="fb-btn" href="#">PDF</a>
            </div>
          </div>
        </section>

        <div class="block-tag">&lt;<b>Renew</b> /&gt;</div>
        <section class="cb">
          <div class="bill-renew">
            <div>
              <h3 class="dash-h3" style="margin:0 0 8px">Продлить или сменить тариф</h3>
              <p style="margin:0; color: var(--ink-2)">Текущий период заканчивается <b style="color:var(--ink-2)">15 мая</b>. Автопродления нет — мы напомним за 3 дня.</p>
            </div>
            <a class="fb-btn primary" href="#/pricing">Перейти к тарифам →</a>
          </div>
        </section>
      `,
      en: `
        <div class="block-tag">&lt;<b>WeekBudget</b> /&gt;</div>
        <section class="cb">
          <div class="bill-card">
            <div class="bill-card-head">
              <span class="ver">ULTRA · weekly budget</span>
              <span class="rollover">rollover: ON · carried $1,000.00</span>
            </div>
            <div class="bill-card-main">
              <div class="bill-amount">
                <span class="num">$1.15</span>
                <span class="of">/ $1,015.00</span>
              </div>
              <div class="bill-bar">
                <i style="width: 0.11%"></i>
              </div>
              <div class="bill-foot">
                <span>Week of <b style="color:var(--ink-2)">2026-05-11</b></span>
                <span>Resets <b style="color:var(--ink-2)">Mon 00:00 UTC</b> · in 3d 2h</span>
              </div>
            </div>

            <div class="bill-week">
              <div class="day on"><span class="d">Mon</span><span class="v">$0.85</span></div>
              <div class="day on"><span class="d">Tue</span><span class="v">$0.30</span></div>
              <div class="day"><span class="d">Wed</span><span class="v">—</span></div>
              <div class="day"><span class="d">Thu</span><span class="v">—</span></div>
              <div class="day"><span class="d">Fri</span><span class="v">—</span></div>
              <div class="day"><span class="d">Sat</span><span class="v">—</span></div>
              <div class="day"><span class="d">Sun</span><span class="v">—</span></div>
            </div>

            <div class="bill-actions">
              <a class="fb-btn" href="#/pricing">Configure schedule</a>
              <a class="fb-btn" href="#/pricing">Change plan</a>
            </div>
          </div>
        </section>

        <div class="block-tag">&lt;<b>Invoices</b> /&gt;</div>
        <section class="cb">
          <h3 class="dash-h3">Payment history</h3>
          <div class="bill-table">
            <div class="head"><span>Date</span><span>Plan</span><span>Amount</span><span>Status</span><span></span></div>
            <div class="row">
              <span class="t">2026-04-15</span>
              <span>Ultra · 30 days</span>
              <span class="num">$60.00</span>
              <span class="st ok">paid</span>
              <a class="fb-btn" href="#">PDF</a>
            </div>
            <div class="row">
              <span class="t">2026-03-15</span>
              <span>Ultra · 30 days</span>
              <span class="num">$60.00</span>
              <span class="st ok">paid</span>
              <a class="fb-btn" href="#">PDF</a>
            </div>
            <div class="row">
              <span class="t">2026-02-15</span>
              <span>Pro → Ultra</span>
              <span class="num">$48.00</span>
              <span class="st ok">paid</span>
              <a class="fb-btn" href="#">PDF</a>
            </div>
            <div class="row">
              <span class="t">2026-01-15</span>
              <span>Pro · 30 days</span>
              <span class="num">$12.00</span>
              <span class="st ok">paid</span>
              <a class="fb-btn" href="#">PDF</a>
            </div>
          </div>
        </section>

        <div class="block-tag">&lt;<b>Renew</b> /&gt;</div>
        <section class="cb">
          <div class="bill-renew">
            <div>
              <h3 class="dash-h3" style="margin:0 0 8px">Renew or change plan</h3>
              <p style="margin:0; color: var(--ink-2)">Current period ends <b style="color:var(--ink-2)">May 15</b>. No auto-renew — we'll remind you 3 days ahead.</p>
            </div>
            <a class="fb-btn primary" href="#/pricing">Go to pricing →</a>
          </div>
        </section>
      `
    }
  },

  /* ============================================================
     SETTINGS (Настройки)
  ============================================================ */
  settings: {
    name: 'settings.tsx',
    ext: 'tsx',
    path: 'alaska-ai / src / dashboard / settings.tsx',
    description: { ru: 'настройки аккаунта', en: 'account settings' },
    preamble: [
      ['1', '<span class="kw">import</span> { <span class="fn">SettingsSection</span> } <span class="kw">from</span> <span class="str">"./blocks"</span>'],
      ['2', ''],
    ],
    html: {
      ru: `
        <div class="block-tag">&lt;<b>Header</b> /&gt;</div>
        <section class="cb">
          <h1 class="dash-h1">Настройки.</h1>
        </section>

        <div class="block-tag">&lt;<b>Profile</b> /&gt;</div>
        <section class="cb">
          <div class="settings-section">
            <h3>Профиль</h3>
            <div class="settings-field">
              <label>Отображаемое имя</label>
              <input type="text" value="Alex" />
            </div>
            <div class="settings-field">
              <label>Email</label>
              <input type="email" value="dev@alaska-ai.shop" />
              <p class="hint">Смена email вступает в силу сразу. Убедитесь, что новый адрес доступен.</p>
            </div>
            <div class="settings-actions">
              <button class="fb-btn primary">Сохранить</button>
            </div>
          </div>
        </section>

        <div class="block-tag">&lt;<b>Security</b> /&gt;</div>
        <section class="cb">
          <div class="settings-section">
            <h3>Безопасность</h3>

            <div class="settings-subsection">
              <h4>Смена пароля</h4>
              <div class="settings-field">
                <label>Текущий пароль</label>
                <input type="password" placeholder="••••••••" />
              </div>
              <div class="settings-field">
                <label>Новый пароль</label>
                <input type="password" placeholder="минимум 10 символов" />
              </div>
              <div class="settings-field">
                <label>Подтвердите пароль</label>
                <input type="password" placeholder="повторите новый пароль" />
              </div>
              <div class="settings-actions">
                <button class="fb-btn primary">Сменить пароль</button>
              </div>
            </div>

            <div class="settings-subsection">
              <h4>Выйти на всех устройствах</h4>
              <p class="hint">Отзывает все активные сессии. Потребуется повторный вход на всех устройствах.</p>
              <div class="settings-actions">
                <button class="fb-btn danger">Выйти везде</button>
              </div>
            </div>
          </div>
        </section>

        <div class="block-tag">&lt;<b>ApiTokens</b> /&gt;</div>
        <section class="cb">
          <div class="settings-section">
            <h3>API-токены</h3>
            <p class="hint">Создавайте долгосрочные токены для вызова Alaska AI API из своих инструментов и скриптов.</p>
            <div class="settings-empty">
              <span class="dot-aur"></span>
              <span>Управление токенами выйдет в <b>следующем релизе</b>.</span>
            </div>
          </div>
        </section>

        <div class="block-tag">&lt;<b>Support</b> /&gt;</div>
        <section class="cb">
          <div class="settings-section">
            <h3>Поддержка</h3>
            <div class="settings-links">
              <a class="settings-link" href="#/docs">
                <span class="lbl">Документация</span>
                <span class="hint">онбординг · API · диагностика</span>
              </a>
              <a class="settings-link" href="mailto:hello@alaska-ai.shop">
                <span class="lbl">Связаться с нами</span>
                <span class="hint">hello@alaska-ai.shop · ответ в течение 7 дней</span>
              </a>
            </div>
          </div>
        </section>

        <div class="block-tag">&lt;<b>DangerZone</b> /&gt;</div>
        <section class="cb">
          <div class="settings-section danger">
            <h3 class="danger-h3">Опасная зона</h3>
            <p class="hint">Удаление аккаунта стирает всё, связанное с user_id, в течение 24 часов — кроме платежей.</p>
            <div class="settings-actions">
              <button class="fb-btn danger">Удалить аккаунт навсегда</button>
            </div>
          </div>
        </section>
      `,
      en: `
        <div class="block-tag">&lt;<b>Header</b> /&gt;</div>
        <section class="cb">
          <h1 class="dash-h1">Settings.</h1>
        </section>

        <div class="block-tag">&lt;<b>Profile</b> /&gt;</div>
        <section class="cb">
          <div class="settings-section">
            <h3>Profile</h3>
            <div class="settings-field">
              <label>Display name</label>
              <input type="text" value="Alex" />
            </div>
            <div class="settings-field">
              <label>Email</label>
              <input type="email" value="dev@alaska-ai.shop" />
              <p class="hint">Email change takes effect immediately. Make sure the new address is accessible.</p>
            </div>
            <div class="settings-actions">
              <button class="fb-btn primary">Save</button>
            </div>
          </div>
        </section>

        <div class="block-tag">&lt;<b>Security</b> /&gt;</div>
        <section class="cb">
          <div class="settings-section">
            <h3>Security</h3>

            <div class="settings-subsection">
              <h4>Change password</h4>
              <div class="settings-field">
                <label>Current password</label>
                <input type="password" placeholder="••••••••" />
              </div>
              <div class="settings-field">
                <label>New password</label>
                <input type="password" placeholder="minimum 10 characters" />
              </div>
              <div class="settings-field">
                <label>Confirm password</label>
                <input type="password" placeholder="repeat new password" />
              </div>
              <div class="settings-actions">
                <button class="fb-btn primary">Change password</button>
              </div>
            </div>

            <div class="settings-subsection">
              <h4>Sign out everywhere</h4>
              <p class="hint">Revokes all active sessions. You'll need to sign in again on every device.</p>
              <div class="settings-actions">
                <button class="fb-btn danger">Sign out everywhere</button>
              </div>
            </div>
          </div>
        </section>

        <div class="block-tag">&lt;<b>ApiTokens</b> /&gt;</div>
        <section class="cb">
          <div class="settings-section">
            <h3>API tokens</h3>
            <p class="hint">Create long-lived tokens to call the Alaska AI API from your own tools and scripts.</p>
            <div class="settings-empty">
              <span class="dot-aur"></span>
              <span>Token management ships in <b>the next release</b>.</span>
            </div>
          </div>
        </section>

        <div class="block-tag">&lt;<b>Support</b> /&gt;</div>
        <section class="cb">
          <div class="settings-section">
            <h3>Support</h3>
            <div class="settings-links">
              <a class="settings-link" href="#/docs">
                <span class="lbl">Documentation</span>
                <span class="hint">onboarding · API · troubleshooting</span>
              </a>
              <a class="settings-link" href="mailto:hello@alaska-ai.shop">
                <span class="lbl">Contact us</span>
                <span class="hint">hello@alaska-ai.shop · reply within 7 days</span>
              </a>
            </div>
          </div>
        </section>

        <div class="block-tag">&lt;<b>DangerZone</b> /&gt;</div>
        <section class="cb">
          <div class="settings-section danger">
            <h3 class="danger-h3">Danger zone</h3>
            <p class="hint">Deleting your account wipes everything tied to your user_id within 24 hours — except payments.</p>
            <div class="settings-actions">
              <button class="fb-btn danger">Delete account permanently</button>
            </div>
          </div>
        </section>
      `
    }
  }
});

/* ============================================================
   TREE STRUCTURE — declarative, multi-folder
============================================================ */
window.STUDIO_TREE = [
  { type: 'folder', id: 'root',      name: 'alaska-ai', indent: 0, open: true },
  { type: 'folder', id: 'src',       name: 'src',       indent: 1, open: true },
  { type: 'folder', id: 'pages',     name: 'pages',     indent: 2, open: true },
  { type: 'file',   id: 'leding',    indent: 3, parent: 'pages' },
  { type: 'file',   id: 'login',     indent: 3, parent: 'pages' },
  { type: 'file',   id: 'register',  indent: 3, parent: 'pages' },
  { type: 'file',   id: 'about',     indent: 3, parent: 'pages' },
  { type: 'file',   id: 'pricing',   indent: 3, parent: 'pages' },
  { type: 'file',   id: 'download',  indent: 3, parent: 'pages' },
  { type: 'folder', id: 'dashboard', name: 'dashboard', indent: 2, open: true },
  { type: 'file',   id: 'overview',  indent: 3, parent: 'dashboard' },
  { type: 'file',   id: 'chatpage',  indent: 3, parent: 'dashboard' },
  { type: 'file',   id: 'usage',     indent: 3, parent: 'dashboard' },
  { type: 'file',   id: 'billing',   indent: 3, parent: 'dashboard' },
  { type: 'file',   id: 'settings',  indent: 3, parent: 'dashboard' },
  { type: 'folder', id: 'legal',     name: 'legal',     indent: 2, open: false },
  { type: 'file',   id: 'privacy',   indent: 3, parent: 'legal' },
  { type: 'file',   id: 'terms',     indent: 3, parent: 'legal' },
  { type: 'file',   id: 'security',  indent: 3, parent: 'legal' },
  { type: 'file',   id: 'docs',      indent: 3, parent: 'legal' },
  { type: 'folder', id: 'blocks',    name: 'blocks',    indent: 2, open: false, decorative: true },
  { type: 'folder', id: 'lib',       name: 'lib',       indent: 2, open: false, decorative: true },
  { type: 'file',   id: '_pkg',      indent: 1, parent: 'root', name: 'package.json', ext: 'json', readonly: true },
  { type: 'file',   id: '_readme',   indent: 1, parent: 'root', name: 'README.md',    ext: 'mdx',  readonly: true },
];

/* Update aliases for path bar */
window.STUDIO_ORDER = [
  'leding', 'login', 'register', 'about', 'pricing', 'download',
  'overview', 'chatpage', 'usage', 'billing', 'settings',
  'privacy', 'terms', 'security', 'docs'
];

window.STUDIO_ALIASES = {
  leding:   ['leding', 'landing', 'index', '/', 'home', 'главная'],
  login:    ['login', 'signin', 'вход'],
  register: ['register', 'signup', 'регистрация'],
  about:    ['about', 'team', 'о нас', 'о_нас'],
  pricing:  ['pricing', 'plans', 'цены', 'тарифы'],
  download: ['download', 'get', 'скачать'],
  overview: ['overview', 'dashboard', 'обзор', 'home', 'добро'],
  chatpage: ['chat', 'chatpage', 'чат'],
  usage:    ['usage', 'metrics', 'использование', 'метрики'],
  billing:  ['billing', 'invoices', 'оплата', 'счета'],
  settings: ['settings', 'account', 'настройки'],
  privacy:  ['privacy', 'приватность', 'политика'],
  terms:    ['terms', 'tos', 'условия'],
  security: ['security', 'безопасность'],
  docs:     ['docs', 'documentation', 'onboarding', 'документация', 'онбординг']
};
