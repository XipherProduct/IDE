/* ============================================================
   ALaska Studio — blog + changelog
============================================================ */

Object.assign(window.STUDIO_FILES, {

  /* ============================================================
     CHANGELOG (src/changelog.mdx)
  ============================================================ */
  changelog: {
    name: 'changelog.mdx',
    ext: 'mdx',
    path: 'alaska-ai / src / changelog.mdx',
    description: { ru: 'история релизов', en: 'release history' },
    preamble: [
      ['1', '<span class="com">---</span>'],
      ['2', '<span class="com">title: Changelog</span>'],
      ['3', '<span class="com">updated: 2026-05-14</span>'],
      ['4', '<span class="com">---</span>'],
    ],
    html: {
      ru: `
        <div class="block-tag">&lt;<b>Head</b> /&gt;</div>
        <section class="cb">
          <h1 class="dash-h1">Changelog.</h1>
          <p class="dash-lede">Что менялось — от первого релиза в марте до сейчас. Каждая запись подписана GPG, ссылка на коммит в наших репо есть рядом с пунктами.</p>
        </section>

        <div class="block-tag">&lt;<b>Release v0.1.5</b> /&gt;</div>
        <section class="cb">
          <div class="cl-card">
            <div class="cl-head">
              <span class="cl-ver">v0.1.5</span>
              <span class="cl-date">2026-05-14</span>
              <span class="cl-tag">IDE: security-волна + полировка Run-карточек</span>
            </div>

            <h4 class="cl-section">добавлено</h4>
            <ul class="cl-list">
              <li>Селектор reasoning-effort в композере (low / medium / high / xhigh) для моделей, которые это поддерживают (gpt-5.5, gpt-5.4, grok-4). Сохраняется per-workspace.</li>
              <li>Чип с именем shell'а на каждой Run-карточке — видно, какой шелл агент выбрал: bash, zsh, pwsh, cmd или WSL.</li>
              <li>Три уровня цвета на Run-карточках: зелёный при exit 0, янтарный когда exit ≠ 0 но команда что-то вывела, красный только когда и exit плохой и output пустой.</li>
              <li>SHA-256 нового билда показывается в update-prompt'е — можно сверить с публичным манифестом перед скачиванием.</li>
              <li>Модель теперь знает, на какой ОС ты сидишь (linux / macos / windows) — выбирает синтаксис shell соответственно.</li>
            </ul>

            <h4 class="cl-section">изменено</h4>
            <ul class="cl-list">
              <li>Approval-плашка плана теперь sticky-док над композером, не плавает в середине треда. Опциональный auto-approve с 1.5-секундным Undo перед коммитом.</li>
              <li>Лимиты — недельные вместо месячных, с опциональным расписанием по дням. Carryover-аддон для Pro (+$3/мес).</li>
              <li>Welcome-страница больше не открывается автоматически при запуске.</li>
              <li>401 от API автоматически разлогинивает и подсказывает <code class="legal-code">Alaska AI: Sign In</code>.</li>
              <li>Глобальный 60-секундный middleware-таймаут больше не оборачивает /api/ai/chat — длинные turn'ы агента не режутся mid-stream.</li>
              <li>Тост VS Code «terminal process terminated with exit code N» подавлен для терминалов, которыми владеет Alaska AI.</li>
            </ul>

            <h4 class="cl-section cl-sec">безопасность</h4>
            <ul class="cl-list">
              <li>Полный аудит + 13 фиксов: JWT_SECRET ротирован на проде, MCP-consent keyed на хэш command+args+env, Restricted-Mode workspace-trust enforce'ится на каждый write/patch/delete, symlink-path-traversal заблокирован, SSRF-guard на @url mentions режет loopback / RFC1918 / link-local / cloud-metadata IPs.</li>
              <li>Убран blanket-tier «trust-workspace» на run-command. Из auto-safe выкинуты <code class="legal-code">npm test</code> / <code class="legal-code">cargo build</code> / <code class="legal-code">find</code> / <code class="legal-code">awk</code>.</li>
            </ul>

            <h4 class="cl-section">исправлено</h4>
            <ul class="cl-list">
              <li>HWID-генерация возвращала одинаковый хэш для всех инсталляций (sentinel + отсутствие process.platform в renderer) — каждый новый покупатель Pro auto-shadow-банился. Новый per-install UUID; ложные баны сняты.</li>
              <li>Tool-аргументы с content-перед-path больше не вызывают «wrong order»-ошибку.</li>
              <li>Windows EXE падал при запуске терминала с «Failed to load native module: conpty.node» — node-pty .node бинарники копируются в prebuilds/win32-x64.</li>
              <li><code class="legal-code">alaska_run_command</code> отклонял абсолютные <code class="legal-code">cwd</code> — при неудачном resolveSafe cwd падает на workspace-root.</li>
            </ul>
          </div>
        </section>

        <div class="block-tag">&lt;<b>Release v0.1.4</b> /&gt;</div>
        <section class="cb">
          <div class="cl-card">
            <div class="cl-head">
              <span class="cl-ver">v0.1.4</span>
              <span class="cl-date">2026-05-13</span>
              <span class="cl-tag">IDE: волна Cursor-фич #1</span>
            </div>
            <h4 class="cl-section">добавлено</h4>
            <ul class="cl-list">
              <li>Pill статуса провайдера в нижней панели — пингует upstream каждые 30 с, показывает зелёный / жёлтый / красный до отправки запроса.</li>
              <li><code class="legal-code">.alaskarules</code> — память проекта. Файл прокидывается в system-prompt и отслеживается живьём.</li>
              <li>Агент читает LSP-диагностику активного файла — может прямо чинить ошибки и ворнинги.</li>
              <li>Инструмент <code class="legal-code">alaska_run_command</code> — агент запускает shell-команды в воркспейсе, с deny-list и одноразовым согласием.</li>
              <li>Меншены <code class="legal-code">@file / @folder / @url / @diag</code> с автокомплитом.</li>
              <li><code class="legal-code">Ctrl+I</code> inline-edit — выделили текст, описали правку, потоковый превью, Принять или Отменить.</li>
              <li>Подтверждение мульти-файлового плана — карточка <code class="legal-code">alaska_announce_plan</code>. Пока не Одобришь — ничего не пишется.</li>
              <li>Поддержка MCP-серверов — внешние тулы декларируются в <code class="legal-code">.alaska/mcp.json</code>.</li>
            </ul>
            <h4 class="cl-section">изменено</h4>
            <ul class="cl-list">
              <li>Windows-инсталлер теперь собирается локально на Linux через wine + Inno Setup; устраняет ошибку «not a valid Win32 application».</li>
            </ul>
          </div>
        </section>

        <div class="block-tag">&lt;<b>Release v0.1.3</b> /&gt;</div>
        <section class="cb">
          <div class="cl-card">
            <div class="cl-head">
              <span class="cl-ver">v0.1.3</span>
              <span class="cl-date">2026-05-08</span>
              <span class="cl-tag">Hardening-проход</span>
            </div>
            <h4 class="cl-section cl-sec">безопасность</h4>
            <ul class="cl-list">
              <li>Ротация refresh-токенов с family-based детектом кражи (RFC 6819).</li>
              <li>HIBP k-anonymity при регистрации и смене пароля.</li>
              <li>Флоу подтверждения email — регистрация и смена email паркуются в <code class="legal-code">pending_email</code> до подтверждения.</li>
              <li>sshd закручен до ключей, fail2ban на systemd-бэкенде.</li>
            </ul>
            <h4 class="cl-section">изменено</h4>
            <ul class="cl-list">
              <li>JWT issuer + audience валидируются при каждом parse.</li>
              <li>CSP затянут: никакого inline script кроме того, что нужно Next.js.</li>
            </ul>
          </div>
        </section>

        <div class="block-tag">&lt;<b>Release v0.1.2</b> /&gt;</div>
        <section class="cb">
          <div class="cl-card">
            <div class="cl-head">
              <span class="cl-ver">v0.1.2</span>
              <span class="cl-date">2026-04-26</span>
              <span class="cl-tag">Биллинг в продакшене</span>
            </div>
            <h4 class="cl-section">добавлено</h4>
            <ul class="cl-list">
              <li>YooMoney quickpay + проверка подписи SHA-1 на webhook.</li>
              <li>CryptoBot invoice + проверка подписи HMAC-SHA-256 на webhook.</li>
              <li>Три тарифа: Pro $12 / Max $30 / Ultra $60.</li>
              <li>Колонка <code class="legal-code">plan_expires_at</code> + фоновый sweeper.</li>
            </ul>
          </div>
        </section>

        <div class="block-tag">&lt;<b>Release v0.1.1</b> /&gt;</div>
        <section class="cb">
          <div class="cl-card">
            <div class="cl-head">
              <span class="cl-ver">v0.1.1</span>
              <span class="cl-date">2026-04-10</span>
              <span class="cl-tag">IDE update probe + per-source usage</span>
            </div>
            <h4 class="cl-section">добавлено</h4>
            <ul class="cl-list">
              <li><code class="legal-code">GET /api/releases/check?platform=…&channel=…&current=…</code> — IDE опрашивает каждые 6 часов.</li>
              <li>Колонка <code class="legal-code">ai_usage.source</code> — разделяет chat / ide / api в дашборде.</li>
              <li>GitHub Actions пайплайн сборки IDE.</li>
            </ul>
            <h4 class="cl-section">исправлено</h4>
            <ul class="cl-list">
              <li>Streaming chat иногда терял последний токен в Safari.</li>
            </ul>
          </div>
        </section>

        <div class="block-tag">&lt;<b>Release v0.1.0</b> /&gt;</div>
        <section class="cb">
          <div class="cl-card cl-first">
            <div class="cl-head">
              <span class="cl-ver">v0.1.0</span>
              <span class="cl-date">2026-03-15</span>
              <span class="cl-tag">Первый публичный релиз</span>
            </div>
            <h4 class="cl-section">добавлено</h4>
            <ul class="cl-list">
              <li>Marketing-сайт, дашборд, логин, тарифы, docs.</li>
              <li>Серверный xAI прокси с per-user квотой + подпись запросов из IDE через checksum.</li>
              <li>OAuth Device Authorization Grant (RFC 8628) для входа из IDE.</li>
              <li>Ротация refresh-токенов, CSRF double-submit cookie.</li>
            </ul>
          </div>
        </section>
      `,
      en: `
        <div class="block-tag">&lt;<b>Head</b> /&gt;</div>
        <section class="cb">
          <h1 class="dash-h1">Changelog.</h1>
          <p class="dash-lede">What changed — from the first release in March to today. Every entry is GPG-signed, with a commit link in our repo next to its bullets.</p>
        </section>

        <div class="block-tag">&lt;<b>Release v0.1.5</b> /&gt;</div>
        <section class="cb">
          <div class="cl-card">
            <div class="cl-head">
              <span class="cl-ver">v0.1.5</span>
              <span class="cl-date">2026-05-14</span>
              <span class="cl-tag">IDE: security wave + Run-card polish</span>
            </div>

            <h4 class="cl-section">added</h4>
            <ul class="cl-list">
              <li>Reasoning-effort selector in the composer (low / medium / high / xhigh) for models that support it (gpt-5.5, gpt-5.4, grok-4). Stored per workspace.</li>
              <li>Shell-name chip on each Run card — you can see which shell the agent picked: bash, zsh, pwsh, cmd, or WSL.</li>
              <li>Three colour levels on Run cards: green on exit 0, amber on exit ≠ 0 with output, red only when both exit and output are bad.</li>
              <li>SHA-256 of the new build is shown in the update prompt — you can check it against the public manifest before downloading.</li>
              <li>The model now knows your OS (linux / macos / windows) and picks the right shell syntax.</li>
            </ul>

            <h4 class="cl-section">changed</h4>
            <ul class="cl-list">
              <li>Plan approval badge is now a sticky dock above the composer. Optional auto-approve with a 1.5-second Undo before commit.</li>
              <li>Quotas are weekly instead of monthly, with optional day scheduling. Pro adds a carryover add-on (+$3/mo).</li>
              <li>Welcome page no longer auto-opens on start.</li>
              <li>A 401 from the API auto-logs you out and suggests <code class="legal-code">Alaska AI: Sign In</code>.</li>
              <li>The global 60s middleware timeout no longer wraps /api/ai/chat — long agent turns aren't cut mid-stream.</li>
              <li>VS Code "terminal process terminated with exit code N" toast is suppressed for terminals owned by Alaska AI.</li>
            </ul>

            <h4 class="cl-section cl-sec">security</h4>
            <ul class="cl-list">
              <li>Full audit + 13 fixes: JWT_SECRET rotated in production, MCP consent keyed by hash of command+args+env (rebind RCE closed), Restricted-Mode workspace-trust enforced on every write/patch/delete and run-command, symlink path-traversal blocked, SSRF guard on @url mentions blocks loopback / RFC1918 / link-local / cloud-metadata IPs.</li>
              <li>Removed blanket "trust-workspace" tier for run-command. Auto-safe no longer includes <code class="legal-code">npm test</code> / <code class="legal-code">cargo build</code> / <code class="legal-code">find</code> / <code class="legal-code">awk</code>.</li>
            </ul>

            <h4 class="cl-section">fixed</h4>
            <ul class="cl-list">
              <li>HWID generation returned the same hash for every install — every new Pro buyer got auto-shadow-banned. New per-install UUID; false bans lifted.</li>
              <li>Tool args with content-before-path no longer trigger "wrong order".</li>
              <li>Windows EXE crashed on terminal launch with "Failed to load native module: conpty.node" — node-pty .node binaries are now also copied to prebuilds/win32-x64.</li>
              <li><code class="legal-code">alaska_run_command</code> rejected absolute <code class="legal-code">cwd</code> — failing resolveSafe now falls back to workspace root.</li>
            </ul>
          </div>
        </section>

        <div class="block-tag">&lt;<b>Release v0.1.4</b> /&gt;</div>
        <section class="cb">
          <div class="cl-card">
            <div class="cl-head">
              <span class="cl-ver">v0.1.4</span>
              <span class="cl-date">2026-05-13</span>
              <span class="cl-tag">IDE: Cursor-feature wave #1</span>
            </div>
            <h4 class="cl-section">added</h4>
            <ul class="cl-list">
              <li>Provider status pill in the status bar — pings upstream every 30s.</li>
              <li><code class="legal-code">.alaskarules</code> — project memory injected into the system prompt and watched live.</li>
              <li>Agent reads LSP diagnostics for the active file.</li>
              <li><code class="legal-code">alaska_run_command</code> — agent runs shell commands with deny-list and one-shot consent.</li>
              <li>Mentions <code class="legal-code">@file / @folder / @url / @diag</code> with autocomplete.</li>
              <li><code class="legal-code">Ctrl+I</code> inline edit — streaming preview, Accept or Reject.</li>
              <li>Multi-file plan confirmation — until you Approve nothing is written.</li>
              <li>MCP server support — external tools declared in <code class="legal-code">.alaska/mcp.json</code>.</li>
            </ul>
          </div>
        </section>

        <div class="block-tag">&lt;<b>Release v0.1.3</b> /&gt;</div>
        <section class="cb">
          <div class="cl-card">
            <div class="cl-head">
              <span class="cl-ver">v0.1.3</span>
              <span class="cl-date">2026-05-08</span>
              <span class="cl-tag">Hardening pass</span>
            </div>
            <h4 class="cl-section cl-sec">security</h4>
            <ul class="cl-list">
              <li>Refresh-token rotation with family-based theft detection (RFC 6819).</li>
              <li>HIBP k-anonymity check on signup and password change.</li>
              <li>Email verification flow — signup and email change parked in <code class="legal-code">pending_email</code>.</li>
              <li>sshd locked to keys, fail2ban on the systemd backend.</li>
            </ul>
          </div>
        </section>

        <div class="block-tag">&lt;<b>Release v0.1.2</b> /&gt;</div>
        <section class="cb">
          <div class="cl-card">
            <div class="cl-head">
              <span class="cl-ver">v0.1.2</span>
              <span class="cl-date">2026-04-26</span>
              <span class="cl-tag">Billing in production</span>
            </div>
            <h4 class="cl-section">added</h4>
            <ul class="cl-list">
              <li>YooMoney quickpay + SHA-1 webhook signature.</li>
              <li>CryptoBot invoice + HMAC-SHA-256 webhook signature.</li>
              <li>Three plans: Pro $12 / Max $30 / Ultra $60.</li>
            </ul>
          </div>
        </section>

        <div class="block-tag">&lt;<b>Release v0.1.1</b> /&gt;</div>
        <section class="cb">
          <div class="cl-card">
            <div class="cl-head">
              <span class="cl-ver">v0.1.1</span>
              <span class="cl-date">2026-04-10</span>
              <span class="cl-tag">IDE update probe + per-source usage</span>
            </div>
            <h4 class="cl-section">added</h4>
            <ul class="cl-list">
              <li><code class="legal-code">GET /api/releases/check</code> — IDE probes every 6 hours.</li>
              <li><code class="legal-code">ai_usage.source</code> column splits chat / ide / api in dashboard.</li>
              <li>GitHub Actions IDE build pipeline.</li>
            </ul>
            <h4 class="cl-section">fixed</h4>
            <ul class="cl-list">
              <li>Streaming chat sometimes dropped the last token in Safari.</li>
            </ul>
          </div>
        </section>

        <div class="block-tag">&lt;<b>Release v0.1.0</b> /&gt;</div>
        <section class="cb">
          <div class="cl-card cl-first">
            <div class="cl-head">
              <span class="cl-ver">v0.1.0</span>
              <span class="cl-date">2026-03-15</span>
              <span class="cl-tag">First public release</span>
            </div>
            <h4 class="cl-section">added</h4>
            <ul class="cl-list">
              <li>Marketing site, dashboard, login, pricing, docs.</li>
              <li>Server-side xAI proxy with per-user quota + IDE request signing.</li>
              <li>OAuth Device Authorization Grant (RFC 8628) for IDE sign-in.</li>
              <li>Refresh-token rotation, CSRF double-submit cookie.</li>
            </ul>
          </div>
        </section>
      `
    }
  },

  /* ============================================================
     BLOG INDEX (src/blog/index.mdx)
  ============================================================ */
  blogindex: {
    name: 'index.mdx',
    ext: 'mdx',
    path: 'alaska-ai / src / blog / index.mdx',
    description: { ru: 'блог — все посты', en: 'blog — all posts' },
    preamble: [
      ['1', '<span class="com">---</span>'],
      ['2', '<span class="com">section: blog</span>'],
      ['3', '<span class="com">posts: 3</span>'],
      ['4', '<span class="com">---</span>'],
    ],
    html: {
      ru: `
        <div class="block-tag">&lt;<b>Head</b> /&gt;</div>
        <section class="cb">
          <h1 class="dash-h1">Заметки с <em>холодного севера</em>.</h1>
          <p class="dash-lede">Пишем медленно. Только когда есть что сказать конкретного — постмортем, security-разбор или дизайн-решение, которое не стыдно защищать.</p>
        </section>

        <div class="block-tag">&lt;<b>Posts</b> /&gt;</div>
        <section class="cb">
          <div class="blog-list">
            <a class="blog-item" href="#/silentdefault">
              <div class="blog-meta">
                <span class="date">2026-05-08</span>
                <span class="cat">product</span>
              </div>
              <h3>Почему наша IDE по умолчанию молчит</h3>
              <p>Ghost-подсказки на каждое нажатие приучают игнорировать модель. Вот логика за нашим «скучным» дефолтом.</p>
              <div class="blog-foot"><span>6 мин чтения</span><span class="arrow">читать →</span></div>
            </a>

            <a class="blog-item" href="#/refreshtoken">
              <div class="blog-meta">
                <span class="date">2026-04-22</span>
                <span class="cat sec">security</span>
              </div>
              <h3>Как мы ловим кражу refresh-токена без ложных срабатываний</h3>
              <p>Параллельные вкладки браузера выглядят ровно как replay украденного токена. Вот grace-окно, которое их различает, и SQL, делающий это атомарно.</p>
              <div class="blog-foot"><span>8 мин чтения</span><span class="arrow">читать →</span></div>
            </a>

            <a class="blog-item" href="#/singlebinary">
              <div class="blog-meta">
                <span class="date">2026-04-01</span>
                <span class="cat eng">engineering</span>
              </div>
              <h3>Как мы запаковали IDE в один бинарник</h3>
              <p>Без установщика. Без фонового апдейтера. Один файл, шесть платформ, GitHub Actions matrix делает всю грязную работу.</p>
              <div class="blog-foot"><span>7 мин чтения</span><span class="arrow">читать →</span></div>
            </a>
          </div>
        </section>

        <div class="block-tag">&lt;<b>GuestPosts</b> /&gt;</div>
        <section class="cb">
          <div class="blog-cta">
            <p>Хотите написать гостевой пост? Пишите <a class="legal-link" href="mailto:hello@alaska-ai.shop">hello@alaska-ai.shop</a>.</p>
          </div>
        </section>
      `,
      en: `
        <div class="block-tag">&lt;<b>Head</b> /&gt;</div>
        <section class="cb">
          <h1 class="dash-h1">Notes from the <em>cold north</em>.</h1>
          <p class="dash-lede">We write slowly — only when we have something concrete to say: a postmortem, a security writeup, or a design choice we'd defend in public.</p>
        </section>

        <div class="block-tag">&lt;<b>Posts</b> /&gt;</div>
        <section class="cb">
          <div class="blog-list">
            <a class="blog-item" href="#/silentdefault">
              <div class="blog-meta">
                <span class="date">2026-05-08</span>
                <span class="cat">product</span>
              </div>
              <h3>Why our IDE is silent by default</h3>
              <p>Ghost suggestions on every keystroke teach you to ignore the model. Here's the logic behind our "boring" default.</p>
              <div class="blog-foot"><span>6 min read</span><span class="arrow">read →</span></div>
            </a>

            <a class="blog-item" href="#/refreshtoken">
              <div class="blog-meta">
                <span class="date">2026-04-22</span>
                <span class="cat sec">security</span>
              </div>
              <h3>How we catch refresh-token theft without false positives</h3>
              <p>Parallel browser tabs look exactly like a stolen-token replay. Here's the grace window that tells them apart, and the SQL that does it atomically.</p>
              <div class="blog-foot"><span>8 min read</span><span class="arrow">read →</span></div>
            </a>

            <a class="blog-item" href="#/singlebinary">
              <div class="blog-meta">
                <span class="date">2026-04-01</span>
                <span class="cat eng">engineering</span>
              </div>
              <h3>How we packed the IDE into one binary</h3>
              <p>No installer. No background updater. One file, six platforms, a GitHub Actions matrix doing the dirty work.</p>
              <div class="blog-foot"><span>7 min read</span><span class="arrow">read →</span></div>
            </a>
          </div>
        </section>

        <div class="block-tag">&lt;<b>GuestPosts</b> /&gt;</div>
        <section class="cb">
          <div class="blog-cta">
            <p>Want to write a guest post? Email <a class="legal-link" href="mailto:hello@alaska-ai.shop">hello@alaska-ai.shop</a>.</p>
          </div>
        </section>
      `
    }
  },

  /* ============================================================
     BLOG POST: SILENT DEFAULT (2026-05-08)
  ============================================================ */
  silentdefault: {
    name: 'silent-default.mdx',
    ext: 'mdx',
    path: 'alaska-ai / src / blog / silent-default.mdx',
    description: { ru: 'почему IDE молчит', en: 'why the IDE is quiet' },
    preamble: [
      ['1', '<span class="com">---</span>'],
      ['2', '<span class="com">category: product</span>'],
      ['3', '<span class="com">date: 2026-05-08</span>'],
      ['4', '<span class="com">reading: 6 min</span>'],
      ['5', '<span class="com">---</span>'],
    ],
    html: {
      ru: `
        <div class="block-tag">&lt;<b>PostHead</b> /&gt;</div>
        <section class="cb">
          <div class="post-meta">
            <span class="cat">product</span>
            <span>·</span>
            <span class="date">2026-05-08</span>
            <span>·</span>
            <span>6 мин чтения</span>
          </div>
          <h1 class="post-h1">Почему наша IDE по умолчанию <em>молчит</em></h1>
          <p class="post-sub">Ghost-подсказки на каждое нажатие приучают игнорировать модель. Вот логика за нашим «скучным» дефолтом.</p>
          <p class="post-byline">Опубликовано 2026-05-08 · автор Alaska team</p>
        </section>

        <div class="block-tag">&lt;<b>Body</b> /&gt;</div>
        <section class="cb post-body">
          <p>Откройте любой AI-редактор образца 2026 года — и в первые десять секунд за вашим курсором начинает ходить серая тень. Модель угадывает. Сначала сигнатуру функции, потом имя переменной, потом комментарий, который вы ещё не дописали. Иногда угадывает правильно. Иногда — нет. В обоих случаях глаз тянет на серый блок, а не на строку, которую вы пришли написать.</p>
          <p>Когда мы начинали Alaska AI, мы сделали очевидное — скопировали это поведение. Это был дефолт везде; значит, пользователям нравится. Через три недели dogfood-инга курсор был заражён. Мы уже не читали код — мы скользили по нему, выбирая, что из подсказанного принять или отбросить. Скорость падала, ревью страдали. Мы выключили — и в комнате стало тихо.</p>

          <h2 class="post-h2">Короткий эксперимент</h2>
          <p>Мы выкатили тихий дефолт двадцати внутренним пользователям и десяти внешним бета-тестерам. Через неделю задали один вопрос: «Вернуть подсказки?». Двадцать шесть сказали «нет». Трое попросили opt-in. Один сказал «да». Опцию мы выпустили в тот же вечер; тихий дефолт остался.</p>
          <p>Дело не в том, что подсказки везде плохи. Дело в том, что дефолт должен соответствовать тому, как идёт работа большую часть времени. Курсор 90% жизни находится внутри строк, которые модель не может осмысленно предсказать — внутренние нейминги, наполовину сформулированные мысли, осознанный исследовательский набор. Жечь 10% внимания ради 5% попадания — плохой обмен.</p>

          <h2 class="post-h2">Что значит «тишина по умолчанию» в Alaska</h2>
          <ul class="post-ul">
            <li>Никаких inline-подсказок, пока не нажат шорткат. Курсор стоит там, где вы его поставили.</li>
            <li>Никаких всплывающих хинтов от движения. Hover показывается только если вы остановились на токене на 600 мс и больше.</li>
            <li>Никакой болтовни про reindexing в статус-баре. Статус показывает только то, что вы попросили.</li>
            <li>Никаких внезапных диалогов. Любой модал коренится в том, на что вы кликнули.</li>
          </ul>

          <h2 class="post-h2">А когда модель нужна — она резкая</h2>
          <p>Обратная сторона «тишины» — когда вы зовёте модель (<kbd class="docs-kbd">⌘K</kbd> на выделении или <kbd class="docs-kbd">⌘I</kbd> в сайд-панели), ответ должен быть быстрый и без оговорок. Время ответа мы взяли как продуктовую метрику с первого дня. Медиана первого токена на хостимых моделях — около 280 мс в EU-Central.</p>

          <h2 class="post-h2">Каталог шорткатов</h2>
          <p>Шорткаты — это контракт, который заменяет фоновую подсказку. Мы выбрали четыре, покрывающих 95% вызовов; остальное — через палитру команд:</p>
          <table class="legal-table docs-kbd-table">
            <tbody>
              <tr><td><kbd class="docs-kbd">⌘K</kbd></td><td>inline-правка выделенного</td></tr>
              <tr><td><kbd class="docs-kbd">⌘I</kbd></td><td>открыть Alaska в сайд-панели</td></tr>
              <tr><td><kbd class="docs-kbd">⌘⇧K</kbd></td><td>inline-правка всего файла</td></tr>
              <tr><td><kbd class="docs-kbd">⌘.</kbd></td><td>quick fix у курсора</td></tr>
            </tbody>
          </table>
          <p style="color: var(--mute); font-size: 13.5px">На Linux/Windows подставьте Ctrl вместо ⌘.</p>

          <h2 class="post-h2">Где мы заведомо ошибаемся</h2>
          <p>Для однострочных скриптов, разовых ноутбуков и pair-программирования, где модель нужна в лицо — тихий дефолт неправильный. Эти сценарии настоящие. Поэтому опция в двух кликах: <b>Настройки → Редактор → Ghost-подсказки</b>.</p>
          <blockquote class="post-quote">
            Курсор должен оставаться там, где его поставил человек, пока человек не попросит иначе.
          </blockquote>
          <p style="color: var(--mute); font-size: 14px">Хотите ответить? Пишите <a class="legal-link" href="mailto:hello@alaska-ai.shop">hello@alaska-ai.shop</a>.</p>
        </section>

        <div class="block-tag">&lt;<b>More</b> /&gt;</div>
        <section class="cb">
          <h3 class="dash-h3">Ещё</h3>
          <div class="blog-list">
            <a class="blog-item" href="#/refreshtoken">
              <div class="blog-meta"><span class="date">2026-04-22</span><span class="cat sec">security</span></div>
              <h3>Как мы ловим кражу refresh-токена без ложных срабатываний</h3>
              <p>Параллельные вкладки выглядят как replay украденного токена. Grace-окно различает их.</p>
            </a>
            <a class="blog-item" href="#/singlebinary">
              <div class="blog-meta"><span class="date">2026-04-01</span><span class="cat eng">engineering</span></div>
              <h3>Как мы запаковали IDE в один бинарник</h3>
              <p>Один файл, шесть платформ, GitHub Actions matrix делает всю грязную работу.</p>
            </a>
          </div>
        </section>
      `,
      en: `
        <div class="block-tag">&lt;<b>PostHead</b> /&gt;</div>
        <section class="cb">
          <div class="post-meta">
            <span class="cat">product</span>
            <span>·</span>
            <span class="date">2026-05-08</span>
            <span>·</span>
            <span>6 min read</span>
          </div>
          <h1 class="post-h1">Why our IDE is <em>silent by default</em></h1>
          <p class="post-sub">Ghost suggestions on every keystroke teach you to ignore the model. Here's the logic behind our "boring" default.</p>
          <p class="post-byline">Posted 2026-05-08 · by the Alaska team</p>
        </section>

        <div class="block-tag">&lt;<b>Body</b> /&gt;</div>
        <section class="cb post-body">
          <p>Open any AI editor from 2026, and within the first ten seconds a grey shadow starts walking behind your cursor. The model is guessing. First the function signature, then a variable name, then a comment you hadn't finished. Sometimes it guesses right. Sometimes it doesn't. Either way, your eye is pulled to the grey block instead of the line you came to write.</p>
          <p>When we started Alaska AI we did the obvious thing — copied that behaviour. It was the default everywhere; clearly users like it. Three weeks of dogfooding later, the cursor was infected. We weren't reading code anymore — we were skimming, picking which suggestion to accept or drop. Speed went down, reviews suffered. We switched it off, and the room got quiet.</p>

          <h2 class="post-h2">A short experiment</h2>
          <p>We rolled the silent default to twenty internal users and ten external betas. A week later we asked one question: "Want suggestions back?". Twenty-six said no. Three asked for opt-in. One said yes. We shipped the option that same evening; the silent default stayed.</p>
          <p>It's not that suggestions are bad everywhere. It's that the default should match how the work goes most of the time. The cursor lives 90% of its life inside strings the model can't meaningfully predict — internal names, half-formed thoughts, deliberate exploratory typing. Burning 10% of your attention for 5% of hits is a bad trade.</p>

          <h2 class="post-h2">What "silent by default" means in Alaska</h2>
          <ul class="post-ul">
            <li>No inline suggestions until a shortcut is pressed. The cursor stays where you put it.</li>
            <li>No hover hints from motion. Hover shows only if you've parked on a token for 600 ms or more.</li>
            <li>No "reindexing" chatter in the status bar. The status only shows what you asked for.</li>
            <li>No surprise dialogs. Every modal is rooted in something you clicked.</li>
          </ul>

          <h2 class="post-h2">When the model is needed — it's sharp</h2>
          <p>The flip side of "silent" — when you call the model (<kbd class="docs-kbd">⌘K</kbd> on a selection or <kbd class="docs-kbd">⌘I</kbd> in the side panel), the reply should be fast and unhedged. Time-to-first-token has been a product metric since day one. Median TTFT on hosted models is around 280 ms in EU-Central.</p>

          <h2 class="post-h2">Shortcut catalogue</h2>
          <p>Shortcuts are the contract that replaces the background suggestion. We picked four covering 95% of calls; the rest is in the command palette:</p>
          <table class="legal-table docs-kbd-table">
            <tbody>
              <tr><td><kbd class="docs-kbd">⌘K</kbd></td><td>inline edit of selection</td></tr>
              <tr><td><kbd class="docs-kbd">⌘I</kbd></td><td>open Alaska side panel</td></tr>
              <tr><td><kbd class="docs-kbd">⌘⇧K</kbd></td><td>inline edit whole file</td></tr>
              <tr><td><kbd class="docs-kbd">⌘.</kbd></td><td>quick fix at cursor</td></tr>
            </tbody>
          </table>
          <p style="color: var(--mute); font-size: 13.5px">On Linux/Windows use Ctrl instead of ⌘.</p>

          <h2 class="post-h2">Where we're knowingly wrong</h2>
          <p>For one-liner scripts, throwaway notebooks, and pair-programming sessions where you want the model in your face — silent default is wrong. Those are real scenarios. So the option is two clicks: <b>Settings → Editor → Ghost suggestions</b>.</p>
          <blockquote class="post-quote">
            The cursor should stay where the human put it, until the human asks otherwise.
          </blockquote>
          <p style="color: var(--mute); font-size: 14px">Want to reply? Email <a class="legal-link" href="mailto:hello@alaska-ai.shop">hello@alaska-ai.shop</a>.</p>
        </section>

        <div class="block-tag">&lt;<b>More</b> /&gt;</div>
        <section class="cb">
          <h3 class="dash-h3">More</h3>
          <div class="blog-list">
            <a class="blog-item" href="#/refreshtoken">
              <div class="blog-meta"><span class="date">2026-04-22</span><span class="cat sec">security</span></div>
              <h3>How we catch refresh-token theft without false positives</h3>
              <p>Parallel tabs look like a stolen-token replay. A grace window tells them apart.</p>
            </a>
            <a class="blog-item" href="#/singlebinary">
              <div class="blog-meta"><span class="date">2026-04-01</span><span class="cat eng">engineering</span></div>
              <h3>How we packed the IDE into one binary</h3>
              <p>One file, six platforms, a GitHub Actions matrix doing the dirty work.</p>
            </a>
          </div>
        </section>
      `
    }
  },

  /* ============================================================
     BLOG POST: REFRESH TOKEN (2026-04-22)
  ============================================================ */
  refreshtoken: {
    name: 'refresh-token.mdx',
    ext: 'mdx',
    path: 'alaska-ai / src / blog / refresh-token.mdx',
    description: { ru: 'кража refresh-токена', en: 'refresh-token theft' },
    preamble: [
      ['1', '<span class="com">---</span>'],
      ['2', '<span class="com">category: security</span>'],
      ['3', '<span class="com">date: 2026-04-22</span>'],
      ['4', '<span class="com">reading: 8 min</span>'],
      ['5', '<span class="com">---</span>'],
    ],
    html: {
      ru: `
        <div class="block-tag">&lt;<b>PostHead</b> /&gt;</div>
        <section class="cb">
          <div class="post-meta">
            <span class="cat sec">security</span>
            <span>·</span>
            <span class="date">2026-04-22</span>
            <span>·</span>
            <span>8 мин чтения</span>
          </div>
          <h1 class="post-h1">Как мы ловим кражу refresh-токена без <em>ложных срабатываний</em></h1>
          <p class="post-sub">Параллельные вкладки браузера выглядят ровно как replay украденного токена. Вот grace-окно, которое их различает, и SQL, делающий это атомарно.</p>
          <p class="post-byline">Опубликовано 2026-04-22 · автор Alaska team</p>
        </section>

        <div class="block-tag">&lt;<b>Body</b> /&gt;</div>
        <section class="cb post-body">
          <p>Ротация refresh-токенов — защитная привычка OAuth 2.1 (и RFC 6819 §5.2.2.3 до него). Каждый раз, когда клиент обменивает refresh-токен на новый access-токен, сервер отзывает старый refresh и выпускает свежий. Если атакующий когда-то украдёт старый и попробует его replay-ить, сервер увидит «двойное использование» и убьёт сессию.</p>
          <p>В теории. На практике вы обнаруживаете, что легитимный браузер постоянно «дважды использует» собственные токены — три вкладки на дашборде гонятся за refresh — и график «убитых сессий» растёт от каждого вежливого пользователя, любящего ⌘ T.</p>

          <h2 class="post-h2">Что у нас есть на момент consume</h2>
          <p>Когда приходит refresh, в строке БД есть ровно это:</p>
          <ul class="post-ul">
            <li><code class="legal-code">token_hash</code> — то, что клиент только что предъявил.</li>
            <li><code class="legal-code">revoked_at</code> — NULL, если токен ещё не ротировался; иначе таймстемп.</li>
            <li><code class="legal-code">replaced_by</code> — UUID наследника, выпущенного при первой ротации.</li>
            <li><code class="legal-code">family_id</code> — идентификатор цепочки, общий для всех наследников.</li>
            <li><code class="legal-code">expires_at</code> — изначальный TTL 30 дней.</li>
          </ul>
          <p>Гонка параллельных вкладок выглядит идентично replay-атаке: тот же hash, revoked_at уже выставлен, replaced_by заполнен. Единственное различие — время.</p>

          <h2 class="post-h2">Grace-окно</h2>
          <p>Мы делаем калиброванный выбор: если токен replay-ится в течение N секунд после оригинального revoked_at, считаем это гонкой. За пределами окна — считаем кражей. Сам RFC 6819 рекомендует «небольшое окно»; мы взяли <b>десять секунд</b>.</p>

          <h2 class="post-h2">SQL, делающий это атомарно</h2>
          <p>SELECT и потом UPDATE в два шага — нельзя: второй refresh между ними даст ложную гонку. Мы используем один CTE, делающий и то и другое:</p>
          <pre class="docs-pre"><code>WITH src AS (
  SELECT id, user_id, family_id, replaced_by, revoked_at, expires_at
  FROM refresh_tokens
  WHERE token_hash = $1
),
upd AS (
  UPDATE refresh_tokens
  SET    revoked_at        = NOW(),
         revocation_reason = 'rotation'
  WHERE  token_hash = $1
    AND  revoked_at IS NULL
    AND  expires_at > NOW()
  RETURNING id
)
SELECT src.*, (upd.id IS NOT NULL) AS consumed
FROM   src LEFT JOIN upd ON upd.id = src.id;</code></pre>
          <p>Один round-trip. Четыре исхода, все выводимые из возвращённой строки:</p>
          <ul class="post-ul">
            <li><b>consumed = true</b> → свежая ротация, выпускаем новый токен, ставим replaced_by.</li>
            <li><b>consumed = false, revoked_at выставлен, в пределах grace-окна</b> → параллельная вкладка. Выпускаем новый токен в том же семействе.</li>
            <li><b>consumed = false, revoked_at выставлен, вне окна</b> → кража. Отзываем всё семейство, форсим re-auth.</li>
            <li><b>consumed = false, revoked_at NULL</b> → expired. Простой 401, без revoke семьи.</li>
          </ul>

          <h2 class="post-h2">Аудит-цепочка</h2>
          <p>Каждый revoke пишет причину в колонку <code class="legal-code">revocation_reason</code>. Значения сознательно стабильные строки: <code class="legal-code">rotation</code>, <code class="legal-code">theft</code>, <code class="legal-code">logout</code>, <code class="legal-code">logout_all</code>, <code class="legal-code">excess_active_tokens</code>, <code class="legal-code">expired_cleanup</code>, <code class="legal-code">admin</code>. Когда первый раз придётся объяснять клиенту, почему его сессия умерла в 3 утра — эта колонка объяснит за вас.</p>

          <h2 class="post-h2">Что мы всё равно поймать не можем</h2>
          <ul class="post-ul">
            <li>Атакующий, укравший живой refresh-токен И использовавший его раньше легитимного клиента. Здесь мы полагаемся на остальные слои (HttpOnly cookie, SameSite=Strict, CSRF double-submit).</li>
            <li>Атакующий, терпеливо ждущий часами между replay-ами. Наше grace-окно истекает через 10 секунд, и theft-детект сработает — но к этому моменту легитимная сессия уже однократно отротировалась, так что мы отзовём только клон цепочки у атакующего.</li>
            <li>Пользователь с украденным устройством. Это другая проблема; решается через <b>Настройки → Sign out everywhere</b>.</li>
          </ul>

          <blockquote class="post-quote">
            Хороший детектор — тот, что не может отличить параллельную вкладку от атакующего, и затем добавляет единственный отличающий сигнал — время.
          </blockquote>
          <p style="color: var(--mute); font-size: 14px">Полная реализация лежит в <code class="legal-code">internal/auth/store.go</code> нашего бэкенда. Будем открывать больше по мере того как привыкнем к threat-модели.</p>
        </section>

        <div class="block-tag">&lt;<b>More</b> /&gt;</div>
        <section class="cb">
          <h3 class="dash-h3">Ещё</h3>
          <div class="blog-list">
            <a class="blog-item" href="#/silentdefault">
              <div class="blog-meta"><span class="date">2026-05-08</span><span class="cat">product</span></div>
              <h3>Почему наша IDE по умолчанию молчит</h3>
              <p>Ghost-подсказки на каждое нажатие приучают игнорировать модель.</p>
            </a>
            <a class="blog-item" href="#/singlebinary">
              <div class="blog-meta"><span class="date">2026-04-01</span><span class="cat eng">engineering</span></div>
              <h3>Как мы запаковали IDE в один бинарник</h3>
              <p>Один файл, шесть платформ, GitHub Actions matrix.</p>
            </a>
          </div>
        </section>
      `,
      en: `
        <div class="block-tag">&lt;<b>PostHead</b> /&gt;</div>
        <section class="cb">
          <div class="post-meta">
            <span class="cat sec">security</span>
            <span>·</span>
            <span class="date">2026-04-22</span>
            <span>·</span>
            <span>8 min read</span>
          </div>
          <h1 class="post-h1">How we catch refresh-token theft without <em>false positives</em></h1>
          <p class="post-sub">Parallel browser tabs look exactly like a stolen-token replay. Here's the grace window that tells them apart, and the SQL that does it atomically.</p>
          <p class="post-byline">Posted 2026-04-22 · by the Alaska team</p>
        </section>

        <div class="block-tag">&lt;<b>Body</b> /&gt;</div>
        <section class="cb post-body">
          <p>Refresh-token rotation is a defensive habit from OAuth 2.1 (and RFC 6819 §5.2.2.3 before it). Every time a client trades a refresh for a new access token, the server revokes the old refresh and issues a fresh one. If an attacker ever steals the old token and tries to replay it, the server sees "double use" and kills the session.</p>
          <p>In theory. In practice you discover that a legitimate browser is constantly "double-using" its own tokens — three dashboard tabs racing for a refresh — and your "killed sessions" chart grows with every polite user who loves ⌘ T.</p>

          <h2 class="post-h2">What we have at consume time</h2>
          <p>When a refresh comes in, the row in the DB has exactly this:</p>
          <ul class="post-ul">
            <li><code class="legal-code">token_hash</code> — what the client just presented.</li>
            <li><code class="legal-code">revoked_at</code> — NULL if the token hasn't been rotated yet; otherwise a timestamp.</li>
            <li><code class="legal-code">replaced_by</code> — UUID of the successor issued at first rotation.</li>
            <li><code class="legal-code">family_id</code> — chain id shared by all successors.</li>
            <li><code class="legal-code">expires_at</code> — original 30-day TTL.</li>
          </ul>
          <p>A parallel-tab race looks identical to a replay: same hash, revoked_at set, replaced_by filled. The only difference is time.</p>

          <h2 class="post-h2">Grace window</h2>
          <p>We make a calibrated choice: if a token is replayed within N seconds of the original revoked_at, treat it as a race. Outside that window, treat it as theft. RFC 6819 itself recommends "a small window"; we picked <b>ten seconds</b>.</p>

          <h2 class="post-h2">SQL that does it atomically</h2>
          <p>SELECT then UPDATE in two steps is unsafe: a second refresh between them would create a false race. We use a single CTE:</p>
          <pre class="docs-pre"><code>WITH src AS (
  SELECT id, user_id, family_id, replaced_by, revoked_at, expires_at
  FROM refresh_tokens
  WHERE token_hash = $1
),
upd AS (
  UPDATE refresh_tokens
  SET    revoked_at        = NOW(),
         revocation_reason = 'rotation'
  WHERE  token_hash = $1
    AND  revoked_at IS NULL
    AND  expires_at > NOW()
  RETURNING id
)
SELECT src.*, (upd.id IS NOT NULL) AS consumed
FROM   src LEFT JOIN upd ON upd.id = src.id;</code></pre>
          <p>One round-trip. Four outcomes, all derivable from the returned row:</p>
          <ul class="post-ul">
            <li><b>consumed = true</b> → fresh rotation, issue new token, set replaced_by.</li>
            <li><b>consumed = false, revoked_at set, inside grace</b> → parallel tab. Issue a new token in the same family.</li>
            <li><b>consumed = false, revoked_at set, outside grace</b> → theft. Revoke the whole family, force re-auth.</li>
            <li><b>consumed = false, revoked_at NULL</b> → expired. Plain 401, no family revoke.</li>
          </ul>

          <h2 class="post-h2">Audit trail</h2>
          <p>Every revoke writes a reason in <code class="legal-code">revocation_reason</code>. The values are intentionally stable strings: <code class="legal-code">rotation</code>, <code class="legal-code">theft</code>, <code class="legal-code">logout</code>, <code class="legal-code">logout_all</code>, <code class="legal-code">excess_active_tokens</code>, <code class="legal-code">expired_cleanup</code>, <code class="legal-code">admin</code>. The first time you have to explain to a customer why their session died at 3 AM — that column explains for you.</p>

          <h2 class="post-h2">What we still can't catch</h2>
          <ul class="post-ul">
            <li>An attacker who steals a live refresh AND uses it before the legit client. Here we rely on other layers (HttpOnly cookie, SameSite=Strict, CSRF double-submit).</li>
            <li>An attacker patient enough to wait hours between replays. Our grace expires after 10 seconds, and theft detection fires — but by then the legit session has already rotated once, so we only revoke the attacker's clone of the chain.</li>
            <li>A user with a stolen device. Different problem; solved via <b>Settings → Sign out everywhere</b>.</li>
          </ul>

          <blockquote class="post-quote">
            A good detector is one that can't tell a parallel tab from an attacker, and then adds the one signal that distinguishes them — time.
          </blockquote>
          <p style="color: var(--mute); font-size: 14px">Full implementation lives in <code class="legal-code">internal/auth/store.go</code> in our backend. We'll open up more as we settle on the threat model.</p>
        </section>

        <div class="block-tag">&lt;<b>More</b> /&gt;</div>
        <section class="cb">
          <h3 class="dash-h3">More</h3>
          <div class="blog-list">
            <a class="blog-item" href="#/silentdefault">
              <div class="blog-meta"><span class="date">2026-05-08</span><span class="cat">product</span></div>
              <h3>Why our IDE is silent by default</h3>
              <p>Ghost suggestions on every keystroke teach you to ignore the model.</p>
            </a>
            <a class="blog-item" href="#/singlebinary">
              <div class="blog-meta"><span class="date">2026-04-01</span><span class="cat eng">engineering</span></div>
              <h3>How we packed the IDE into one binary</h3>
              <p>One file, six platforms, a GitHub Actions matrix.</p>
            </a>
          </div>
        </section>
      `
    }
  },

  /* ============================================================
     BLOG POST: SINGLE BINARY (2026-04-01)
  ============================================================ */
  singlebinary: {
    name: 'single-binary.mdx',
    ext: 'mdx',
    path: 'alaska-ai / src / blog / single-binary.mdx',
    description: { ru: 'IDE в одном файле', en: 'IDE in one file' },
    preamble: [
      ['1', '<span class="com">---</span>'],
      ['2', '<span class="com">category: engineering</span>'],
      ['3', '<span class="com">date: 2026-04-01</span>'],
      ['4', '<span class="com">reading: 7 min</span>'],
      ['5', '<span class="com">---</span>'],
    ],
    html: {
      ru: `
        <div class="block-tag">&lt;<b>PostHead</b> /&gt;</div>
        <section class="cb">
          <div class="post-meta">
            <span class="cat eng">engineering</span>
            <span>·</span>
            <span class="date">2026-04-01</span>
            <span>·</span>
            <span>7 мин чтения</span>
          </div>
          <h1 class="post-h1">Как мы запаковали IDE в <em>один бинарник</em></h1>
          <p class="post-sub">Без установщика. Без фонового апдейтера. Один файл, шесть платформ, GitHub Actions matrix делает всю грязную работу.</p>
          <p class="post-byline">Опубликовано 2026-04-01 · автор Alaska team</p>
        </section>

        <div class="block-tag">&lt;<b>Body</b> /&gt;</div>
        <section class="cb post-body">
          <p>Когда вы выпускаете редактор, в который встроен браузерный движок, вы наследуете проблему упаковки. Каждый Electron-конкурент из тех, что мы смотрели, занимал 300–500 МБ на диске, тащил отдельный процесс auto-updater, лежал в трёх местах файловой системы и просил elevated-права чтобы обновиться. Ничего из этого нам не нравилось.</p>
          <p>Наша цель — планка, которую CLI-инструменты берут по умолчанию: один файл, который можно скопировать куда угодно, запустить и удалить.</p>

          <h2 class="post-h2">Билд-матрица</h2>
          <p>Шесть платформенных таргетов покрывают ~99% наших пользователей сегодня:</p>
          <pre class="docs-pre"><code>macos-arm64    macOS 12+ Apple Silicon
macos-x64      macOS 12+ Intel
linux-x64      glibc 2.31+
linux-arm64    glibc 2.31+
windows-x64    Windows 10 21H2+
windows-arm64  Windows 11 22H2+</code></pre>
          <p>Каждая строка — job в matrix GitHub Actions.</p>

          <h2 class="post-h2">Подписи, нотаризация и длинный хвост предупреждений</h2>
          <ul class="post-ul">
            <li><b>macOS:</b> <code class="legal-code">codesign</code> + <code class="legal-code">notarytool</code>. Apple хочет тикет нотаризации.</li>
            <li><b>Windows:</b> <code class="legal-code">signtool</code> с EV code-signing сертификатом. Репутация SmartScreen набирается неделями.</li>
            <li><b>Linux:</b> рядом с <code class="legal-code">.tar.xz</code> лежит <code class="legal-code">.sha256</code> и хватит.</li>
          </ul>
          <p>Подпись и нотаризация — часть билда, не ручной шаг. Секреты живут в GitHub Actions, sealed-box encrypted; job завершается non-zero при любой неудачной проверке.</p>

          <h2 class="post-h2">Авто-обновление без фонового демона</h2>
          <p>Самое спорное решение — убрать отдельный auto-updater-процесс. Мы заменили его одним HTTP-запросом из самого редактора, раз в шесть часов, пока вы печатаете:</p>
          <pre class="docs-pre"><code>GET /api/releases/check?platform=macos-arm64&channel=stable&current=0.1.3</code></pre>
          <p>Сервер сравнивает вашу текущую версию с актуальной, возвращает подписанный URL + SHA-256 если есть что-то новее, и редактор предлагает скачать на следующем pause.</p>
          <p>Нет фонового процесса. Нет тихих установок. Нет записей в <code class="legal-code">~/Library/LaunchAgents/</code>, которые вы туда не клали.</p>

          <h2 class="post-h2">Что внутри артефакта</h2>
          <ul class="post-ul">
            <li>Сам редактор (TypeScript → JS, бандлинг через Vite).</li>
            <li>Один <code class="legal-code">asar</code>-архив со статикой.</li>
            <li>Зафиксированный билд Chromium (унаследован от апстрим-редактора).</li>
            <li>Короткий нативный shim, указывающий runtime на правильный config dir.</li>
          </ul>
          <p>Сжатый размер для <code class="legal-code">macos-arm64</code> сегодня: <b>158 МБ</b>. Это весь редактор + весь рантайм Chromium + все темы. Маркетинговая фраза «~160 МБ» — честное число.</p>

          <h2 class="post-h2">Проверка загрузки</h2>
          <pre class="docs-pre"><code># macOS / Linux
shasum -a 256 alaska-darwin-arm64

# Windows (PowerShell)
Get-FileHash .\\alaska-windows-x64.exe -Algorithm SHA256</code></pre>

          <h2 class="post-h2">Чего мы ещё НЕ сделали</h2>
          <ul class="post-ul">
            <li><b>Воспроизводимые сборки.</b> Два GitHub-runner-а, собирающие один и тот же исходник, всё равно дают слегка разные артефакты. План есть.</li>
            <li><b>.deb / .rpm пайплайн.</b> Сегодня linux-пользователи получают tarball или install-скрипт.</li>
            <li><b>Differential-обновления.</b> Сегодня обновление качает все 158 МБ. Дифф-патчи — задача следующего квартала.</li>
          </ul>
          <blockquote class="post-quote">
            Один файл, никаких сюрпризов, каждый релиз одной формы.
          </blockquote>
          <p style="color: var(--mute); font-size: 14px">Пайплайн лежит в <code class="legal-code">.github/workflows/ide.yml</code>. Отдельно напишем про signing-шаг.</p>
        </section>

        <div class="block-tag">&lt;<b>More</b> /&gt;</div>
        <section class="cb">
          <h3 class="dash-h3">Ещё</h3>
          <div class="blog-list">
            <a class="blog-item" href="#/silentdefault">
              <div class="blog-meta"><span class="date">2026-05-08</span><span class="cat">product</span></div>
              <h3>Почему наша IDE по умолчанию молчит</h3>
              <p>Ghost-подсказки на каждое нажатие приучают игнорировать модель.</p>
            </a>
            <a class="blog-item" href="#/refreshtoken">
              <div class="blog-meta"><span class="date">2026-04-22</span><span class="cat sec">security</span></div>
              <h3>Как мы ловим кражу refresh-токена без ложных срабатываний</h3>
              <p>Параллельные вкладки выглядят как replay украденного токена.</p>
            </a>
          </div>
        </section>
      `,
      en: `
        <div class="block-tag">&lt;<b>PostHead</b> /&gt;</div>
        <section class="cb">
          <div class="post-meta">
            <span class="cat eng">engineering</span>
            <span>·</span>
            <span class="date">2026-04-01</span>
            <span>·</span>
            <span>7 min read</span>
          </div>
          <h1 class="post-h1">How we packed the IDE into <em>one binary</em></h1>
          <p class="post-sub">No installer. No background updater. One file, six platforms, a GitHub Actions matrix doing the dirty work.</p>
          <p class="post-byline">Posted 2026-04-01 · by the Alaska team</p>
        </section>

        <div class="block-tag">&lt;<b>Body</b> /&gt;</div>
        <section class="cb post-body">
          <p>When you ship an editor with an embedded browser engine, you inherit a packaging problem. Every Electron competitor we looked at took 300–500 MB on disk, dragged a separate auto-updater process, lived in three places on the filesystem, and asked for elevated rights to update. None of that appealed.</p>
          <p>Our goal is the bar CLI tools set by default: one file, copyable anywhere, runnable and deletable.</p>

          <h2 class="post-h2">Build matrix</h2>
          <p>Six platform targets cover ~99% of our users today:</p>
          <pre class="docs-pre"><code>macos-arm64    macOS 12+ Apple Silicon
macos-x64      macOS 12+ Intel
linux-x64      glibc 2.31+
linux-arm64    glibc 2.31+
windows-x64    Windows 10 21H2+
windows-arm64  Windows 11 22H2+</code></pre>
          <p>Each row is a job in the GitHub Actions matrix.</p>

          <h2 class="post-h2">Signing, notarization, and the long tail of warnings</h2>
          <ul class="post-ul">
            <li><b>macOS:</b> <code class="legal-code">codesign</code> + <code class="legal-code">notarytool</code>. Apple wants a notarization ticket.</li>
            <li><b>Windows:</b> <code class="legal-code">signtool</code> with an EV code-signing cert. SmartScreen reputation builds over weeks.</li>
            <li><b>Linux:</b> a <code class="legal-code">.sha256</code> next to the <code class="legal-code">.tar.xz</code> is enough.</li>
          </ul>
          <p>Signing and notarization are part of the build, not a manual step. Secrets live in GitHub Actions, sealed-box encrypted; the job exits non-zero on any failed check.</p>

          <h2 class="post-h2">Auto-update without a background daemon</h2>
          <p>The most controversial decision — removing the auto-updater process. We replaced it with one HTTP call from the editor itself, every six hours while you type:</p>
          <pre class="docs-pre"><code>GET /api/releases/check?platform=macos-arm64&channel=stable&current=0.1.3</code></pre>
          <p>The server compares your current version with the latest, returns a signed URL + SHA-256 if there's something newer, and the editor offers a download at your next pause.</p>
          <p>No background process. No silent installs. No <code class="legal-code">~/Library/LaunchAgents/</code> entries you didn't put there.</p>

          <h2 class="post-h2">What's inside the artifact</h2>
          <ul class="post-ul">
            <li>The editor itself (TypeScript → JS, bundled with Vite).</li>
            <li>One <code class="legal-code">asar</code> archive of static assets.</li>
            <li>A pinned Chromium build (inherited from the upstream editor).</li>
            <li>A short native shim pointing the runtime to the right config dir.</li>
          </ul>
          <p>Compressed size for <code class="legal-code">macos-arm64</code> today: <b>158 MB</b>. The entire editor + entire Chromium runtime + all bundled themes. The marketing line "~160 MB" is honest.</p>

          <h2 class="post-h2">Verifying a download</h2>
          <pre class="docs-pre"><code># macOS / Linux
shasum -a 256 alaska-darwin-arm64

# Windows (PowerShell)
Get-FileHash .\\alaska-windows-x64.exe -Algorithm SHA256</code></pre>

          <h2 class="post-h2">What we have NOT yet done</h2>
          <ul class="post-ul">
            <li><b>Reproducible builds.</b> Two GitHub runners building the same source still produce slightly different artifacts. We have a plan.</li>
            <li><b>.deb / .rpm pipeline.</b> Today Linux users get a tarball or an install script.</li>
            <li><b>Differential updates.</b> Today an update downloads all 158 MB. Diff-patches are next quarter.</li>
          </ul>
          <blockquote class="post-quote">
            One file, no surprises, every release the same shape.
          </blockquote>
          <p style="color: var(--mute); font-size: 14px">The pipeline lives in <code class="legal-code">.github/workflows/ide.yml</code>. Separate post on the signing step.</p>
        </section>

        <div class="block-tag">&lt;<b>More</b> /&gt;</div>
        <section class="cb">
          <h3 class="dash-h3">More</h3>
          <div class="blog-list">
            <a class="blog-item" href="#/silentdefault">
              <div class="blog-meta"><span class="date">2026-05-08</span><span class="cat">product</span></div>
              <h3>Why our IDE is silent by default</h3>
              <p>Ghost suggestions on every keystroke teach you to ignore the model.</p>
            </a>
            <a class="blog-item" href="#/refreshtoken">
              <div class="blog-meta"><span class="date">2026-04-22</span><span class="cat sec">security</span></div>
              <h3>How we catch refresh-token theft without false positives</h3>
              <p>Parallel browser tabs look like a stolen-token replay.</p>
            </a>
          </div>
        </section>
      `
    }
  }
});

/* ============================================================
   Extend STUDIO_TREE with blog folder + changelog file
============================================================ */
(() => {
  if (!window.STUDIO_TREE) return;
  const T = window.STUDIO_TREE;

  // Find insertion points
  const legalIdx = T.findIndex(n => n.id === 'legal');
  const decorativeIdx = T.findIndex(n => n.decorative);

  // Insert changelog right before blocks/lib decorative folders, after legal block
  const legalEndIdx = T.findIndex((n, i) => i > legalIdx && n.type === 'folder' && n.id !== 'legal');
  const insertAt = legalEndIdx >= 0 ? legalEndIdx : (decorativeIdx >= 0 ? decorativeIdx : T.length);

  const blogNodes = [
    { type: 'folder', id: 'blog', name: 'blog', indent: 2, open: false },
    { type: 'file',   id: 'blogindex',   indent: 3, parent: 'blog' },
    { type: 'file',   id: 'silentdefault', indent: 3, parent: 'blog' },
    { type: 'file',   id: 'refreshtoken',  indent: 3, parent: 'blog' },
    { type: 'file',   id: 'singlebinary',  indent: 3, parent: 'blog' },
    { type: 'file',   id: 'changelog',     indent: 2, parent: 'src' }
  ];
  T.splice(insertAt, 0, ...blogNodes);

  // Extend ORDER + ALIASES
  window.STUDIO_ORDER.push('blogindex', 'silentdefault', 'refreshtoken', 'singlebinary', 'changelog');
  Object.assign(window.STUDIO_ALIASES, {
    blogindex:    ['blog', 'blogindex', 'index', 'posts', 'блог'],
    silentdefault:['silent', 'silentdefault', 'тишина', 'silent-default', 'silent_default'],
    refreshtoken: ['refresh', 'refreshtoken', 'token', 'refresh-token', 'refresh_token', 'theft', 'кража'],
    singlebinary: ['binary', 'singlebinary', 'single-binary', 'single_binary', 'бинарник', 'один файл'],
    changelog:    ['changelog', 'changes', 'releases', 'история', 'релизы']
  });
})();
