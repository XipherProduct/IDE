/* ============================================================
   ALaska Studio — extra files: legal + dashboard
   Each entry: { name, ext, path, description:{ru,en},
                 preamble, html:{ru,en} }
============================================================ */

Object.assign(window.STUDIO_FILES, {

  /* ============================================================
     LEGAL × 4
  ============================================================ */

  privacy: {
    name: 'privacy.mdx',
    ext: 'mdx',
    path: 'alaska-ai / src / legal / privacy.mdx',
    description: { ru: 'политика приватности', en: 'privacy policy' },
    preamble: [
      ['1', '<span class="com">---</span>'],
      ['2', '<span class="com">title: Приватность</span>'],
      ['3', '<span class="com">updated: 2026-05-15</span>'],
      ['4', '<span class="com">---</span>'],
    ],
    html: {
      ru: `
        <div class="block-tag">&lt;<b>Statement</b> /&gt;</div>
        <section class="cb">
          <h1 style="font-size: clamp(36px, 4.5vw, 52px); font-weight: 500; letter-spacing:-0.025em; margin:0 0 16px; line-height: 1.0">Приватность.<br><em style="font-style:normal; background: linear-gradient(180deg, var(--ice) 0%, var(--ice-2) 100%); -webkit-background-clip:text; background-clip:text; -webkit-text-fill-color:transparent">Человеческим языком.</em></h1>
          <p style="font-size: 16px; color: var(--ink-2); margin: 0 0 28px; max-width: 60ch; line-height: 1.6">
            Мы не продаём ваши данные. Мы не обучаемся на ваших промптах. Мы собираем минимум, нужный для работы продукта. Полный документ ниже; буллеты сразу после этого абзаца — честное резюме.
          </p>
        </section>

        <div class="block-tag">&lt;<b>TLDR</b> /&gt;</div>
        <section class="cb">
          <div class="legal-tldr">
            <h3>TL;DR</h3>
            <ul>
              <li><b>Аккаунт:</b> email, хэш пароля (bcrypt), имя (опционально), Google sub если входили через OAuth.</li>
              <li><b>AI-запросы:</b> имя модели, количество токенов, источник, таймстемп — ни промпт, ни ответ не хранятся.</li>
              <li><b>Биллинг:</b> провайдер платежей, план, сумма, статус. Карты и кошелька мы не видим.</li>
              <li><b>Cookies:</b> один HttpOnly refresh-token и CSRF-куки. Никакой аналитики, никакой рекламы.</li>
              <li><b>Удалить аккаунт:</b> Настройки → Опасная зона или письмом.</li>
            </ul>
          </div>
        </section>

        <div class="block-tag">&lt;<b>Collect</b> /&gt;</div>
        <section class="cb">
          <h2 class="legal-h2">Что мы собираем</h2>
          <p class="legal-p">Три категории данных:</p>
          <dl class="legal-dl">
            <dt>Аккаунт</dt>
            <dd>email · имя (опционально) · bcrypt-12 хэш пароля · Google OpenID sub · таймстемпы создания и обновления</dd>
            <dt>Использование</dt>
            <dd>id модели · input/output токены · флаг успеха/ошибки · источник (chat | ide | api) · таймстемпы. <span class="aur">Промпты и ответы НЕ хранятся.</span></dd>
            <dt>Биллинг</dt>
            <dd>план · сумма в USD/RUB · id транзакции у провайдера · статус (pending | paid | refunded | failed) · таймстемпы. Данные карты на наши серверы не попадают.</dd>
          </dl>
        </section>

        <div class="block-tag">&lt;<b>Use</b> /&gt;</div>
        <section class="cb">
          <h2 class="legal-h2">Как мы это используем</h2>
          <ul class="legal-ul">
            <li>Чтобы работал сервис: аутентифицируем вас, маршрутизируем AI-запросы, считаем квоту плана.</li>
            <li>Чтобы корректно списывать оплату и делать возвраты.</li>
            <li>Для борьбы со злоупотреблениями: брутфорс /auth, кража refresh-токенов, накрутка AI-квоты.</li>
            <li>Для улучшения продукта: агрегаты (не персональные) по latency и ошибкам.</li>
          </ul>
          <p class="legal-p" style="margin-top:18px">
            <b>Мы не обучаем модели на ваших данных.</b> Мы не обогащаем профиль из сторонних источников. Мы не показываем таргетированную рекламу — мы вообще не показываем рекламу.
          </p>
        </section>

        <div class="block-tag">&lt;<b>Share</b> /&gt;</div>
        <section class="cb">
          <h2 class="legal-h2">С кем мы делимся</h2>
          <p class="legal-p">Три провайдера, поимённо:</p>
          <ul class="legal-ul">
            <li><b>xAI</b> — получает промпт и id модели для инференса. К этому трафику применяется политика хранения xAI.</li>
            <li><b>Google</b> — только если нажали «Continue with Google»: стандартные OAuth-скоупы (openid, email, profile).</li>
            <li><b>YooMoney / CryptoBot</b> — обработка платежей. Мы передаём план + сумму + наш payment id.</li>
          </ul>
          <p class="legal-p" style="margin-top:14px; color: var(--mute); font-size: 14px">
            Данные правоохранительным органам — только по действительному правовому акту и только то, что предписано.
          </p>
        </section>

        <div class="block-tag">&lt;<b>Retention</b> /&gt;</div>
        <section class="cb">
          <h2 class="legal-h2">Хранение</h2>
          <table class="legal-table">
            <tbody>
              <tr><td>Строка пользователя</td><td>до удаления вами</td></tr>
              <tr><td>Refresh-токены</td><td>30 дней; revoked-строки удаляются через 7</td></tr>
              <tr><td>Строки AI usage</td><td>для биллинга и квоты; агрегируется через 12 мес</td></tr>
              <tr><td>Строки платежей</td><td>7 лет (налоговое требование)</td></tr>
              <tr><td>Email-токены верификации</td><td>24 часа после использования или истечения</td></tr>
            </tbody>
          </table>
        </section>

        <div class="block-tag">&lt;<b>Rights</b> /&gt;</div>
        <section class="cb">
          <h2 class="legal-h2">Ваши права</h2>
          <p class="legal-p">
            Запросить копию данных, исправить, перенести в другое место или удалить. Удаление аккаунта стирает всё, связанное с user_id, в течение 24 часов — кроме платежей, которые мы обязаны хранить по закону.
          </p>
          <p class="legal-p" style="margin-top:10px">
            Пишите <a href="mailto:privacy@alaska-ai.shop" class="legal-link">privacy@alaska-ai.shop</a> — отвечаем в течение 7 дней.
          </p>
        </section>

        <div class="block-tag">&lt;<b>Cookies</b> /&gt;</div>
        <section class="cb">
          <h2 class="legal-h2">Cookies</h2>
          <p class="legal-p">Две функциональные куки, обе first-party:</p>
          <ul class="legal-ul">
            <li><code class="legal-code">__Secure-refresh_token</code> — HttpOnly, SameSite=Strict, 30 дней.</li>
            <li><code class="legal-code">csrf_token</code> — читаемый из SPA для X-CSRF-Token, 30 дней.</li>
          </ul>
          <p class="legal-p" style="color: var(--mute); margin-top: 10px">Никаких аналитических кук. Никаких рекламных. Никаких третьих сторон.</p>
        </section>

        <div class="block-tag">&lt;<b>Kids</b> /&gt;</div>
        <section class="cb">
          <h2 class="legal-h2">Дети</h2>
          <p class="legal-p">Alaska AI не для пользователей младше 13 лет. Мы сознательно не принимаем такие аккаунты.</p>
        </section>

        <div class="block-tag">&lt;<b>Contacts</b> /&gt;</div>
        <section class="cb">
          <p class="legal-p" style="font-family:'JetBrains Mono',monospace; font-size: 13px">
            Приватность · <a href="mailto:privacy@alaska-ai.shop" class="legal-link">privacy@alaska-ai.shop</a><br>
            Общие · <a href="mailto:hello@alaska-ai.shop" class="legal-link">hello@alaska-ai.shop</a>
          </p>
        </section>
      `,
      en: `
        <div class="block-tag">&lt;<b>Statement</b> /&gt;</div>
        <section class="cb">
          <h1 style="font-size: clamp(36px, 4.5vw, 52px); font-weight: 500; letter-spacing:-0.025em; margin:0 0 16px; line-height: 1.0">Privacy.<br><em style="font-style:normal; background: linear-gradient(180deg, var(--ice) 0%, var(--ice-2) 100%); -webkit-background-clip:text; background-clip:text; -webkit-text-fill-color:transparent">In plain language.</em></h1>
          <p style="font-size: 16px; color: var(--ink-2); margin: 0 0 28px; max-width: 60ch; line-height: 1.6">
            We don't sell your data. We don't train on your prompts. We collect only the minimum needed to run the product. Full document below; bullets right after this paragraph are the honest summary.
          </p>
        </section>

        <div class="block-tag">&lt;<b>TLDR</b> /&gt;</div>
        <section class="cb">
          <div class="legal-tldr">
            <h3>TL;DR</h3>
            <ul>
              <li><b>Account:</b> email, password hash (bcrypt), name (optional), Google sub if you signed in via OAuth.</li>
              <li><b>AI requests:</b> model name, token count, source, timestamp — neither prompt nor reply is stored.</li>
              <li><b>Billing:</b> payment provider, plan, amount, status. We never see your card or wallet.</li>
              <li><b>Cookies:</b> one HttpOnly refresh-token and a CSRF cookie. No analytics, no ads.</li>
              <li><b>Delete account:</b> Settings → Danger Zone or by email.</li>
            </ul>
          </div>
        </section>

        <div class="block-tag">&lt;<b>Collect</b> /&gt;</div>
        <section class="cb">
          <h2 class="legal-h2">What we collect</h2>
          <p class="legal-p">Three data categories:</p>
          <dl class="legal-dl">
            <dt>Account</dt>
            <dd>email · name (optional) · bcrypt-12 password hash · Google OpenID sub · created/updated timestamps</dd>
            <dt>Usage</dt>
            <dd>model id · input/output tokens · success/error flag · source (chat | ide | api) · timestamps. <span class="aur">Prompts and replies are NOT stored.</span></dd>
            <dt>Billing</dt>
            <dd>plan · amount in USD/RUB · provider transaction id · status (pending | paid | refunded | failed) · timestamps. Card data never reaches our servers.</dd>
          </dl>
        </section>

        <div class="block-tag">&lt;<b>Use</b> /&gt;</div>
        <section class="cb">
          <h2 class="legal-h2">How we use it</h2>
          <ul class="legal-ul">
            <li>To run the service: authenticate you, route AI requests, count plan quota.</li>
            <li>To process payments and issue refunds.</li>
            <li>To fight abuse: brute-force /auth, refresh-token theft, AI quota gaming.</li>
            <li>To improve the product: aggregate (non-personal) latency and error stats.</li>
          </ul>
          <p class="legal-p" style="margin-top:18px">
            <b>We don't train models on your data.</b> We don't enrich your profile from third parties. We don't show targeted ads — we don't show ads at all.
          </p>
        </section>

        <div class="block-tag">&lt;<b>Share</b> /&gt;</div>
        <section class="cb">
          <h2 class="legal-h2">Who we share with</h2>
          <p class="legal-p">Three providers, by name:</p>
          <ul class="legal-ul">
            <li><b>xAI</b> — receives prompt and model id for inference. xAI's own retention policy applies.</li>
            <li><b>Google</b> — only if you tap "Continue with Google": standard OAuth scopes (openid, email, profile).</li>
            <li><b>YooMoney / CryptoBot</b> — payment processing. We send plan + amount + our payment id.</li>
          </ul>
          <p class="legal-p" style="margin-top:14px; color: var(--mute); font-size: 14px">
            Data to law enforcement — only on a valid legal request and only what's specifically required.
          </p>
        </section>

        <div class="block-tag">&lt;<b>Retention</b> /&gt;</div>
        <section class="cb">
          <h2 class="legal-h2">Retention</h2>
          <table class="legal-table">
            <tbody>
              <tr><td>User row</td><td>until you delete it</td></tr>
              <tr><td>Refresh tokens</td><td>30 days; revoked rows purged after 7</td></tr>
              <tr><td>AI usage rows</td><td>billing + quota; aggregated after 12 months</td></tr>
              <tr><td>Payment rows</td><td>7 years (tax requirement)</td></tr>
              <tr><td>Email verification tokens</td><td>24 hours after use or expiry</td></tr>
            </tbody>
          </table>
        </section>

        <div class="block-tag">&lt;<b>Rights</b> /&gt;</div>
        <section class="cb">
          <h2 class="legal-h2">Your rights</h2>
          <p class="legal-p">
            Request a copy of your data, correct it, port it elsewhere, or delete it. Account deletion wipes everything tied to your user_id within 24 hours — except payments, which we're legally required to retain.
          </p>
          <p class="legal-p" style="margin-top:10px">
            Email <a href="mailto:privacy@alaska-ai.shop" class="legal-link">privacy@alaska-ai.shop</a> — we reply within 7 days.
          </p>
        </section>

        <div class="block-tag">&lt;<b>Cookies</b> /&gt;</div>
        <section class="cb">
          <h2 class="legal-h2">Cookies</h2>
          <p class="legal-p">Two functional cookies, both first-party:</p>
          <ul class="legal-ul">
            <li><code class="legal-code">__Secure-refresh_token</code> — HttpOnly, SameSite=Strict, 30 days.</li>
            <li><code class="legal-code">csrf_token</code> — readable by the SPA for X-CSRF-Token, 30 days.</li>
          </ul>
          <p class="legal-p" style="color: var(--mute); margin-top: 10px">No analytics cookies. No ad cookies. No third parties.</p>
        </section>

        <div class="block-tag">&lt;<b>Kids</b> /&gt;</div>
        <section class="cb">
          <h2 class="legal-h2">Children</h2>
          <p class="legal-p">Alaska AI is not for users under 13. We don't knowingly accept such accounts.</p>
        </section>

        <div class="block-tag">&lt;<b>Contacts</b> /&gt;</div>
        <section class="cb">
          <p class="legal-p" style="font-family:'JetBrains Mono',monospace; font-size: 13px">
            Privacy · <a href="mailto:privacy@alaska-ai.shop" class="legal-link">privacy@alaska-ai.shop</a><br>
            General · <a href="mailto:hello@alaska-ai.shop" class="legal-link">hello@alaska-ai.shop</a>
          </p>
        </section>
      `
    }
  },

  terms: {
    name: 'terms.mdx',
    ext: 'mdx',
    path: 'alaska-ai / src / legal / terms.mdx',
    description: { ru: 'условия использования', en: 'terms of service' },
    preamble: [
      ['1', '<span class="com">---</span>'],
      ['2', '<span class="com">title: Условия использования</span>'],
      ['3', '<span class="com">updated: 2026-05-15</span>'],
      ['4', '<span class="com">---</span>'],
    ],
    html: {
      ru: `
        <div class="block-tag">&lt;<b>Statement</b> /&gt;</div>
        <section class="cb">
          <h1 style="font-size: clamp(36px, 4.5vw, 52px); font-weight:500; letter-spacing:-0.025em; margin:0 0 16px; line-height:1.0">Условия использования.<br><em style="font-style:normal; background: linear-gradient(180deg, var(--ice) 0%, var(--ice-2) 100%); -webkit-background-clip:text; background-clip:text; -webkit-text-fill-color:transparent">Без сюрпризов.</em></h1>
          <p class="legal-p" style="max-width: 60ch">
            Эти условия регулируют использование Alaska AI — сайта, IDE, API, хостимых моделей. Использование любого из них означает согласие с тем, что ниже.
          </p>
        </section>

        <div class="block-tag">&lt;<b>WhoWeAre</b> /&gt;</div>
        <section class="cb">
          <h2 class="legal-h2">Кто мы</h2>
          <p class="legal-p">«Alaska AI», «мы», «нас» — операторы alaska-ai.shop. Связаться: <a class="legal-link" href="mailto:hello@alaska-ai.shop">hello@alaska-ai.shop</a>.</p>
        </section>

        <div class="block-tag">&lt;<b>Account</b> /&gt;</div>
        <section class="cb">
          <h2 class="legal-h2">Ваш аккаунт</h2>
          <p class="legal-p">Вы отвечаете за сохранность учётных данных. Один аккаунт на человека; можно быть залогиненным с нескольких устройств. Передача аккаунта другим — нарушение условий, бан без возврата.</p>
          <p class="legal-p" style="margin-top:10px">Минимальный возраст — 13 лет. Если в вашей стране установлен более высокий возраст цифрового согласия, действует он.</p>
        </section>

        <div class="block-tag">&lt;<b>AcceptableUse</b> /&gt;</div>
        <section class="cb">
          <h2 class="legal-h2">Допустимое использование</h2>
          <p class="legal-p">Запрещено использовать Alaska AI для:</p>
          <ul class="legal-ul">
            <li>создания или распространения нелегальных материалов;</li>
            <li>создания вредоносного ПО, эксплойтов под чужие системы, контента для травли реальных людей;</li>
            <li>обхода квот (мульти-аккаунты, скрейпинг моделей, реверс IDE для снятия авторизации);</li>
            <li>попыток чтения чужих данных, злоупотребления инфраструктурой, атак на третьи стороны.</li>
          </ul>
          <p class="legal-p" style="margin-top:10px; color: var(--mute)">Нарушение — мгновенный бан с отзывом refresh-токенов.</p>
        </section>

        <div class="block-tag">&lt;<b>Billing</b> /&gt;</div>
        <section class="cb">
          <h2 class="legal-h2">Тарифы и биллинг</h2>
          <p class="legal-p">Тарифы, цены, квоты — на <a class="legal-link" href="#/pricing">/pricing</a>. Платные тарифы действуют 30 дней с успешной оплаты. <b>Автопродления нет</b> — пере-покупаете, когда готовы.</p>
          <p class="legal-p" style="margin-top:10px">Принимаем оплату через YooMoney (₽) и CryptoBot (USDT, TON, BTC). Провайдеры обрабатывают транзакцию; карту мы не видим.</p>
        </section>

        <div class="block-tag">&lt;<b>Refunds</b> /&gt;</div>
        <section class="cb">
          <h2 class="legal-h2">Возвраты</h2>
          <p class="legal-p">В течение 7 дней после оплаты — полный возврат без вопросов. После 7 дня неиспользованное время не возвращается. Пишите на <a class="legal-link" href="mailto:billing@alaska-ai.shop">billing@alaska-ai.shop</a> с payment id.</p>
        </section>

        <div class="block-tag">&lt;<b>IP</b> /&gt;</div>
        <section class="cb">
          <h2 class="legal-h2">Ваш код — ваш IP</h2>
          <p class="legal-p">Код, который вы пишете, и любой ответ/трансформация, сделанные Alaska от вашего имени — принадлежат вам. <b>Мы не претендуем на права.</b> Мы не обучаем на нём модели. Мы инструмент, не соавтор.</p>
          <p class="legal-p" style="margin-top:10px">Бинарник IDE, сайт, бренд и исходники бэкенда — наши.</p>
        </section>

        <div class="block-tag">&lt;<b>Availability</b> /&gt;</div>
        <section class="cb">
          <h2 class="legal-h2">Доступность сервиса</h2>
          <p class="legal-p">Стараемся, но без SLA. Команда маленькая. Деплой в один регион. Хостимые модели зависят от апстрим-провайдеров.</p>
        </section>

        <div class="block-tag">&lt;<b>Disclaimer</b> /&gt;</div>
        <section class="cb">
          <h2 class="legal-h2">Без гарантий</h2>
          <p class="legal-p">Alaska AI предоставляется «как есть», без гарантий: пригодности, товарного качества, точности, ненарушения прав. Вывод LLM может ошибаться — проверяйте перед использованием.</p>
        </section>

        <div class="block-tag">&lt;<b>Liability</b> /&gt;</div>
        <section class="cb">
          <h2 class="legal-h2">Лимит ответственности</h2>
          <p class="legal-p">В пределах, разрешённых законом, наша общая ответственность ограничена суммой, уплаченной вами за 12 месяцев до требования, или USD 50 — что больше.</p>
        </section>

        <div class="block-tag">&lt;<b>Termination</b> /&gt;</div>
        <section class="cb">
          <h2 class="legal-h2">Прекращение</h2>
          <p class="legal-p">Вы можете удалить аккаунт в любой момент. Мы можем приостановить ваш за нарушение условий; неиспользованное оплаченное время вернём пропорционально, кроме случаев бана за злоупотребление.</p>
        </section>

        <div class="block-tag">&lt;<b>Law</b> /&gt;</div>
        <section class="cb">
          <h2 class="legal-h2">Применимое право</h2>
          <p class="legal-p">Условия регулируются законодательством Российской Федерации. Споры рассматриваются компетентным судом по месту нашего нахождения.</p>
        </section>

        <div class="block-tag">&lt;<b>Changes</b> /&gt;</div>
        <section class="cb">
          <h2 class="legal-h2">Изменения</h2>
          <p class="legal-p">Существенные изменения — за 14 дней баннером в дашборде. Дальнейшее использование после вступления в силу — согласие с новой версией.</p>
        </section>
      `,
      en: `
        <div class="block-tag">&lt;<b>Statement</b> /&gt;</div>
        <section class="cb">
          <h1 style="font-size: clamp(36px, 4.5vw, 52px); font-weight:500; letter-spacing:-0.025em; margin:0 0 16px; line-height:1.0">Terms of Service.<br><em style="font-style:normal; background: linear-gradient(180deg, var(--ice) 0%, var(--ice-2) 100%); -webkit-background-clip:text; background-clip:text; -webkit-text-fill-color:transparent">No surprises.</em></h1>
          <p class="legal-p" style="max-width: 60ch">
            These terms govern your use of Alaska AI — the site, IDE, API, hosted models. Using any of them means you accept what's below.
          </p>
        </section>

        <div class="block-tag">&lt;<b>WhoWeAre</b> /&gt;</div>
        <section class="cb">
          <h2 class="legal-h2">Who we are</h2>
          <p class="legal-p">"Alaska AI", "we", "us" — operators of alaska-ai.shop. Contact: <a class="legal-link" href="mailto:hello@alaska-ai.shop">hello@alaska-ai.shop</a>.</p>
        </section>

        <div class="block-tag">&lt;<b>Account</b> /&gt;</div>
        <section class="cb">
          <h2 class="legal-h2">Your account</h2>
          <p class="legal-p">You're responsible for keeping your credentials safe. One account per person; multiple devices ok. Sharing your account is a violation — ban without refund.</p>
          <p class="legal-p" style="margin-top:10px">Minimum age — 13. If your country has a higher digital consent age, that applies.</p>
        </section>

        <div class="block-tag">&lt;<b>AcceptableUse</b> /&gt;</div>
        <section class="cb">
          <h2 class="legal-h2">Acceptable use</h2>
          <p class="legal-p">You may not use Alaska AI to:</p>
          <ul class="legal-ul">
            <li>create or distribute illegal materials;</li>
            <li>build malware, exploits against systems you don't own, or harassment content;</li>
            <li>circumvent quotas (multi-account, scraping hosted models, reversing the IDE);</li>
            <li>access others' data, abuse our infrastructure, or attack third parties.</li>
          </ul>
          <p class="legal-p" style="margin-top:10px; color: var(--mute)">Violation — instant ban with refresh-token revocation.</p>
        </section>

        <div class="block-tag">&lt;<b>Billing</b> /&gt;</div>
        <section class="cb">
          <h2 class="legal-h2">Plans and billing</h2>
          <p class="legal-p">Plans, prices, quotas — at <a class="legal-link" href="#/pricing">/pricing</a>. Paid plans last 30 days from successful payment. <b>No auto-renewal</b> — you re-buy when ready.</p>
          <p class="legal-p" style="margin-top:10px">We accept payments via YooMoney (₽) and CryptoBot (USDT, TON, BTC). Providers process the transaction; we never see card details.</p>
        </section>

        <div class="block-tag">&lt;<b>Refunds</b> /&gt;</div>
        <section class="cb">
          <h2 class="legal-h2">Refunds</h2>
          <p class="legal-p">Within 7 days of payment — full refund, no questions. After day 7, unused time isn't refunded. Email <a class="legal-link" href="mailto:billing@alaska-ai.shop">billing@alaska-ai.shop</a> with your payment id.</p>
        </section>

        <div class="block-tag">&lt;<b>IP</b> /&gt;</div>
        <section class="cb">
          <h2 class="legal-h2">Your code, your IP</h2>
          <p class="legal-p">The code you write and any reply/transformation Alaska does on your behalf — belong to you. <b>We claim no rights.</b> We don't train models on it. We're a tool, not a co-author.</p>
          <p class="legal-p" style="margin-top:10px">The IDE binary, the site, the brand, and backend sources are ours.</p>
        </section>

        <div class="block-tag">&lt;<b>Availability</b> /&gt;</div>
        <section class="cb">
          <h2 class="legal-h2">Service availability</h2>
          <p class="legal-p">Best effort, no SLA. Small team. Single region. Hosted models depend on upstream providers.</p>
        </section>

        <div class="block-tag">&lt;<b>Disclaimer</b> /&gt;</div>
        <section class="cb">
          <h2 class="legal-h2">No warranties</h2>
          <p class="legal-p">Alaska AI is provided "as is", with no warranties of fitness, merchantability, accuracy, or non-infringement. LLM output can be wrong — verify before using.</p>
        </section>

        <div class="block-tag">&lt;<b>Liability</b> /&gt;</div>
        <section class="cb">
          <h2 class="legal-h2">Liability cap</h2>
          <p class="legal-p">Within the limits allowed by law, our total liability is capped at what you paid in the 12 months before the claim, or USD 50 — whichever is greater.</p>
        </section>

        <div class="block-tag">&lt;<b>Termination</b> /&gt;</div>
        <section class="cb">
          <h2 class="legal-h2">Termination</h2>
          <p class="legal-p">You may delete your account anytime. We may suspend yours for violating these terms; unused paid time is refunded pro-rata, except in abuse bans.</p>
        </section>

        <div class="block-tag">&lt;<b>Law</b> /&gt;</div>
        <section class="cb">
          <h2 class="legal-h2">Governing law</h2>
          <p class="legal-p">The terms are governed by Russian law. Disputes are resolved by the competent court at our location.</p>
        </section>

        <div class="block-tag">&lt;<b>Changes</b> /&gt;</div>
        <section class="cb">
          <h2 class="legal-h2">Changes</h2>
          <p class="legal-p">Material changes — 14 days' notice via dashboard banner. Continued use after the effective date is acceptance.</p>
        </section>
      `
    }
  },

  security: {
    name: 'security.mdx',
    ext: 'mdx',
    path: 'alaska-ai / src / legal / security.mdx',
    description: { ru: 'безопасность', en: 'security' },
    preamble: [
      ['1', '<span class="com">---</span>'],
      ['2', '<span class="com">title: Безопасность</span>'],
      ['3', '<span class="com">updated: 2026-05-15</span>'],
      ['4', '<span class="com">---</span>'],
    ],
    html: {
      ru: `
        <div class="block-tag">&lt;<b>Statement</b> /&gt;</div>
        <section class="cb">
          <h1 style="font-size: clamp(36px, 4.5vw, 52px); font-weight:500; letter-spacing:-0.025em; margin:0 0 16px; line-height:1.0">Безопасность.<br><em style="font-style:normal; background: linear-gradient(180deg, var(--ice) 0%, var(--ice-2) 100%); -webkit-background-clip:text; background-clip:text; -webkit-text-fill-color:transparent">Скучного типа.</em></h1>
          <p class="legal-p" style="max-width: 60ch">
            Безопасность — рутинная работа: непрерывная, без хайпа, с записанной моделью угроз. Ниже — от чего защищаемся и как. Нашли дыру? <a class="legal-link" href="#vuln">listайте до отчёта</a>.
          </p>
        </section>

        <div class="block-tag">&lt;<b>Principles</b> /&gt;</div>
        <section class="cb">
          <h2 class="legal-h2">Принципы</h2>
          <ul class="legal-ul">
            <li><b>Скучная крипта:</b> HS256 + bcrypt + SHA-256 HMAC. Никаких самописных примитивов.</li>
            <li><b>Эшелонированная защита:</b> каждый слой считает, что слой выше упал.</li>
            <li><b>Маленький blast radius:</b> scoped-токены, family-based ротация refresh, per-user HMAC.</li>
            <li><b>Проверенные границы:</b> подписи webhook, CSRF, rate-limit на каждом входе.</li>
          </ul>
        </section>

        <div class="block-tag">&lt;<b>Auth</b> /&gt;</div>
        <section class="cb">
          <h2 class="legal-h2">Аутентификация</h2>
          <ul class="legal-ul">
            <li>Пароли — bcrypt, cost 12, минимум 8 символов (NIST).</li>
            <li>HIBP k-anonymity-проверка при регистрации и смене пароля.</li>
            <li>Gmail-адреса заходят только через Google OAuth.</li>
            <li>Лимит на /auth: 10 запросов / 10 минут, скользящее окно.</li>
          </ul>
        </section>

        <div class="block-tag">&lt;<b>Sessions</b> /&gt;</div>
        <section class="cb">
          <h2 class="legal-h2">Сессии</h2>
          <ul class="legal-ul">
            <li>Access-токены: HS256 JWT, TTL 15 минут, scope по issuer + audience.</li>
            <li>Refresh-токены: 48-байтный секрет, хранится как SHA-256, TTL 30 дней, ротация при использовании (RFC 6819).</li>
            <li>Family-based детект кражи — replay уже отротированного refresh отзывает всё семейство.</li>
            <li>Жёсткий лимит 20 активных refresh-токенов на юзера.</li>
            <li>Refresh-куки: HttpOnly, Secure, SameSite=Strict; мутации требуют X-CSRF-Token (double-submit).</li>
          </ul>
        </section>

        <div class="block-tag">&lt;<b>Crypto</b> /&gt;</div>
        <section class="cb">
          <h2 class="legal-h2">Криптография</h2>
          <ul class="legal-ul">
            <li>TLS 1.2+ везде — HSTS preload, без fallback на plain.</li>
            <li>bcrypt cost 12 для хранения паролей.</li>
            <li>SHA-256 HMAC для refresh-токенов и IDE-чексумы.</li>
            <li>Per-user HMAC secret — derive из server-master через HMAC-SHA-256.</li>
            <li><b>Никаких самописных протоколов. Никаких самопальных примитивов.</b></li>
          </ul>
        </section>

        <div class="block-tag">&lt;<b>Infra</b> /&gt;</div>
        <section class="cb">
          <h2 class="legal-h2">Инфраструктура</h2>
          <ul class="legal-ul">
            <li>Один Linux-сервер, sshd закручен (только ключи, без root password), ufw пропускает только 22/80/443.</li>
            <li>fail2ban на journal sshd — 5 попыток / 10 мин = бан на час.</li>
            <li>Caddy перед всеми HTTP-сервисами. Auto-TLS через Let's Encrypt.</li>
            <li>Postgres 17, ролевая модель, без публичного слушателя.</li>
            <li>CSP, X-Frame-Options DENY, Referrer-Policy strict-origin-when-cross-origin, COOP same-origin.</li>
          </ul>
        </section>

        <div class="block-tag">&lt;<b>IDESec</b> /&gt;</div>
        <section class="cb">
          <h2 class="legal-h2">Безопасность IDE</h2>
          <ul class="legal-ul">
            <li>Каждый /api/ai/* запрос подписывает per-user HMAC ключом (выдан раз при device approval). Окно ±5 минут.</li>
            <li>macOS-сборки нотаризованы. Linux- и Windows-сборки подписаны; чексумы публикуются рядом.</li>
            <li>Локальные секреты — в OS keychain (macOS Keychain / Linux Secret Service / Windows Credential Manager).</li>
            <li>Канал телеметрии — opt-in, ни исходник, ни ответ модели не отправляет — только id модели, latency, код ошибки.</li>
          </ul>
        </section>

        <div class="block-tag">&lt;<b>Payments</b> /&gt;</div>
        <section class="cb">
          <h2 class="legal-h2">Платежи</h2>
          <ul class="legal-ul">
            <li>Подпись webhook YooMoney: SHA-1 от (secret + amount + label + provider-id), сравнение в const-time.</li>
            <li>Подпись webhook CryptoBot: HMAC-SHA-256 от тела запроса, сравнение в const-time.</li>
            <li>Карта/кошелёк на наши серверы никогда не попадают.</li>
            <li>Апгрейд плана — атомарно с записью платежа (одна транзакция).</li>
          </ul>
        </section>

        <div class="block-tag" id="vuln">&lt;<b>Report</b> /&gt;</div>
        <section class="cb">
          <h2 class="legal-h2">Сообщить об уязвимости</h2>
          <p class="legal-p">Отправляйте на <a class="legal-link" href="mailto:security@alaska-ai.shop">security@alaska-ai.shop</a>. Зашифрованные отчёты приоритетнее.</p>
          <table class="legal-table">
            <thead><tr><th>Severity</th><th>SLA</th></tr></thead>
            <tbody>
              <tr><td>Critical (RCE, обход auth)</td><td class="aur">≤ 24ч</td></tr>
              <tr><td>High (повышение прав, утечка)</td><td>≤ 7д</td></tr>
              <tr><td>Medium</td><td>≤ 30д</td></tr>
              <tr><td>Low</td><td>следующий релиз</td></tr>
            </tbody>
          </table>
          <p class="legal-p" style="margin-top:14px">После фикса публикуем короткий post-mortem в <a class="legal-link" href="#">/changelog</a>. Указываем имя исследователя, если не попросите иначе.</p>
        </section>

        <div class="block-tag">&lt;<b>SafeHarbor</b> /&gt;</div>
        <section class="cb">
          <h2 class="legal-h2">Safe-harbor</h2>
          <p class="legal-p">Действуете добросовестно — тестируете только свой аккаунт, не пивотите, не лезете в чужие данные, даёте время на фикс до раскрытия — преследовать юридически не будем. Доступ к данным реальных пользователей, DoS или социалка сотрудников — вне safe-harbor.</p>
        </section>
      `,
      en: `
        <div class="block-tag">&lt;<b>Statement</b> /&gt;</div>
        <section class="cb">
          <h1 style="font-size: clamp(36px, 4.5vw, 52px); font-weight:500; letter-spacing:-0.025em; margin:0 0 16px; line-height:1.0">Security.<br><em style="font-style:normal; background: linear-gradient(180deg, var(--ice) 0%, var(--ice-2) 100%); -webkit-background-clip:text; background-clip:text; -webkit-text-fill-color:transparent">The boring kind.</em></h1>
          <p class="legal-p" style="max-width: 60ch">
            Security is routine work — continuous, no hype, with a written threat model. Below: what we defend against and how. Found a hole? <a class="legal-link" href="#vuln">scroll to "Report"</a>.
          </p>
        </section>

        <div class="block-tag">&lt;<b>Principles</b> /&gt;</div>
        <section class="cb">
          <h2 class="legal-h2">Principles</h2>
          <ul class="legal-ul">
            <li><b>Boring crypto:</b> HS256 + bcrypt + SHA-256 HMAC. No homemade primitives.</li>
            <li><b>Defense in depth:</b> each layer assumes the one above failed.</li>
            <li><b>Small blast radius:</b> scoped tokens, family-based refresh rotation, per-user HMAC.</li>
            <li><b>Checked boundaries:</b> webhook signatures, CSRF, rate-limit at every entrypoint.</li>
          </ul>
        </section>

        <div class="block-tag">&lt;<b>Auth</b> /&gt;</div>
        <section class="cb">
          <h2 class="legal-h2">Authentication</h2>
          <ul class="legal-ul">
            <li>Passwords — bcrypt cost 12, minimum 8 chars (NIST).</li>
            <li>HIBP k-anonymity check on signup and password change.</li>
            <li>Gmail addresses sign in only via Google OAuth.</li>
            <li>/auth rate limit: 10 requests / 10 minutes, sliding window.</li>
          </ul>
        </section>

        <div class="block-tag">&lt;<b>Sessions</b> /&gt;</div>
        <section class="cb">
          <h2 class="legal-h2">Sessions</h2>
          <ul class="legal-ul">
            <li>Access tokens: HS256 JWT, 15-minute TTL, scoped by issuer + audience.</li>
            <li>Refresh tokens: 48-byte secret stored as SHA-256, 30-day TTL, rotated on use (RFC 6819).</li>
            <li>Family-based theft detection — replaying a rotated refresh revokes the whole family.</li>
            <li>Hard cap of 20 active refresh tokens per user.</li>
            <li>Refresh cookies: HttpOnly, Secure, SameSite=Strict; mutations require X-CSRF-Token (double-submit).</li>
          </ul>
        </section>

        <div class="block-tag">&lt;<b>Crypto</b> /&gt;</div>
        <section class="cb">
          <h2 class="legal-h2">Cryptography</h2>
          <ul class="legal-ul">
            <li>TLS 1.2+ everywhere — HSTS preload, no fallback to plain.</li>
            <li>bcrypt cost 12 for password storage.</li>
            <li>SHA-256 HMAC for refresh tokens and IDE checksum.</li>
            <li>Per-user HMAC secret — derived from a server master via HMAC-SHA-256.</li>
            <li><b>No homemade protocols. No bespoke primitives.</b></li>
          </ul>
        </section>

        <div class="block-tag">&lt;<b>Infra</b> /&gt;</div>
        <section class="cb">
          <h2 class="legal-h2">Infrastructure</h2>
          <ul class="legal-ul">
            <li>One Linux server, sshd hardened (keys only, no root password), ufw allows only 22/80/443.</li>
            <li>fail2ban on sshd journal — 5 attempts / 10 min = 1-hour ban.</li>
            <li>Caddy in front of all HTTP services. Auto-TLS via Let's Encrypt.</li>
            <li>Postgres 17, role-based access, no public listener.</li>
            <li>CSP, X-Frame-Options DENY, Referrer-Policy strict-origin-when-cross-origin, COOP same-origin.</li>
          </ul>
        </section>

        <div class="block-tag">&lt;<b>IDESec</b> /&gt;</div>
        <section class="cb">
          <h2 class="legal-h2">IDE security</h2>
          <ul class="legal-ul">
            <li>Every /api/ai/* request is signed with a per-user HMAC key (issued once at device approval). ±5-minute window.</li>
            <li>macOS builds are notarized. Linux and Windows builds are signed; checksums published alongside.</li>
            <li>Local secrets in the OS keychain (macOS Keychain / Linux Secret Service / Windows Credential Manager).</li>
            <li>Telemetry channel — opt-in, sends neither source nor model reply — only model id, latency, error code.</li>
          </ul>
        </section>

        <div class="block-tag">&lt;<b>Payments</b> /&gt;</div>
        <section class="cb">
          <h2 class="legal-h2">Payments</h2>
          <ul class="legal-ul">
            <li>YooMoney webhook signature: SHA-1 of (secret + amount + label + provider-id), compared in const-time.</li>
            <li>CryptoBot webhook signature: HMAC-SHA-256 of the request body, compared in const-time.</li>
            <li>Card/wallet data never reaches our servers.</li>
            <li>Plan upgrade is atomic with the payment row (one transaction).</li>
          </ul>
        </section>

        <div class="block-tag" id="vuln">&lt;<b>Report</b> /&gt;</div>
        <section class="cb">
          <h2 class="legal-h2">Report a vulnerability</h2>
          <p class="legal-p">Email <a class="legal-link" href="mailto:security@alaska-ai.shop">security@alaska-ai.shop</a>. Encrypted reports take priority.</p>
          <table class="legal-table">
            <thead><tr><th>Severity</th><th>SLA</th></tr></thead>
            <tbody>
              <tr><td>Critical (RCE, auth bypass)</td><td class="aur">≤ 24h</td></tr>
              <tr><td>High (priv-esc, data leak)</td><td>≤ 7d</td></tr>
              <tr><td>Medium</td><td>≤ 30d</td></tr>
              <tr><td>Low</td><td>next release</td></tr>
            </tbody>
          </table>
          <p class="legal-p" style="margin-top:14px">After the fix we publish a short post-mortem in <a class="legal-link" href="#">/changelog</a>. We credit the researcher unless asked otherwise.</p>
        </section>

        <div class="block-tag">&lt;<b>SafeHarbor</b> /&gt;</div>
        <section class="cb">
          <h2 class="legal-h2">Safe harbor</h2>
          <p class="legal-p">Act in good faith — test only your own account, don't pivot, don't touch others' data, give us time to fix before disclosure — and we won't pursue you legally. Access to real-user data, DoS, or social-engineering staff are outside safe harbor.</p>
        </section>
      `
    }
  },

  docs: {
    name: 'docs.mdx',
    ext: 'mdx',
    path: 'alaska-ai / src / legal / docs.mdx',
    description: { ru: 'документация · онбординг', en: 'documentation · onboarding' },
    preamble: [
      ['1', '<span class="com">---</span>'],
      ['2', '<span class="com">title: Документация</span>'],
      ['3', '<span class="com">section: onboarding</span>'],
      ['4', '<span class="com">---</span>'],
    ],
    html: {
      ru: `
        <div class="block-tag">&lt;<b>Statement</b> /&gt;</div>
        <section class="cb">
          <h1 style="font-size: clamp(36px, 4.5vw, 52px); font-weight:500; letter-spacing:-0.025em; margin:0 0 14px; line-height:1.0">Онбординг<br>за пять минут.</h1>
          <p class="legal-p" style="max-width: 60ch">
            Поставить бинарь, войти, выбрать модель, писать код. Дальше — справочник. Если застряли — переходите на Диагностика или <a class="legal-link" href="mailto:hello@alaska-ai.shop">/contact</a>.
          </p>
        </section>

        <div class="block-tag">&lt;<b>Install</b> /&gt;</div>
        <section class="cb">
          <h2 class="legal-h2">Установка</h2>
          <p class="legal-p">Один бинарь, ~160 МБ, без Electron. Выберите канал и выполните одну команду.</p>
          <div class="docs-install">
            <div class="docs-install-row">
              <span class="lbl">macOS · Homebrew</span>
              <code class="docs-cmd">brew install alaska-ai/tap/alaska</code>
            </div>
            <div class="docs-install-row">
              <span class="lbl">Linux · curl</span>
              <code class="docs-cmd">curl -fsSL https://alaska-ai.shop/install.sh | sh</code>
            </div>
            <div class="docs-install-row">
              <span class="lbl">Windows · winget</span>
              <code class="docs-cmd">winget install AlaskaAI.Alaska</code>
            </div>
            <div class="docs-install-row">
              <span class="lbl">Скачать вручную</span>
              <a class="legal-link" href="#/download">/download — подписанные бинари + SHA-256</a>
            </div>
          </div>
        </section>

        <div class="block-tag">&lt;<b>FirstRun</b> /&gt;</div>
        <section class="cb">
          <h2 class="legal-h2">Первый запуск</h2>
          <ol class="legal-ol">
            <li>Откройте Alaska. Welcome-панель предложит «Войти» или «Пропустить».</li>
            <li>Вход через device flow: введите 8-значный код, который IDE показывает.</li>
            <li>Выберите модель в нижней панели. <code class="legal-code">gpt-5.4-mini</code> работает на Free.</li>
            <li>Нажмите <kbd class="docs-kbd">⌘K</kbd> на строке кода и попросите изменение.</li>
          </ol>
          <p class="legal-p" style="color: var(--mute); margin-top: 12px; font-size: 14px">
            Входить необязательно — local-only режим работает с Ollama / LM Studio совсем без аккаунта.
          </p>
        </section>

        <div class="block-tag">&lt;<b>Hotkeys</b> /&gt;</div>
        <section class="cb">
          <h2 class="legal-h2">Горячие клавиши</h2>
          <table class="legal-table docs-kbd-table">
            <tbody>
              <tr><td><kbd class="docs-kbd">⌘K</kbd></td><td>Inline-правка выделенного</td></tr>
              <tr><td><kbd class="docs-kbd">⌘I</kbd></td><td>Открыть Alaska сбоку</td></tr>
              <tr><td><kbd class="docs-kbd">⌘⇧K</kbd></td><td>Inline-правка всего файла</td></tr>
              <tr><td><kbd class="docs-kbd">⌘⏎</kbd></td><td>Принять предложение</td></tr>
              <tr><td><kbd class="docs-kbd">Esc</kbd></td><td>Отбросить предложение</td></tr>
              <tr><td><kbd class="docs-kbd">⌘.</kbd></td><td>Quick fix у курсора</td></tr>
              <tr><td><kbd class="docs-kbd">⌘⇧M</kbd></td><td>Переключить модель</td></tr>
              <tr><td><kbd class="docs-kbd">⌘/</kbd></td><td>Палитра команд</td></tr>
            </tbody>
          </table>
          <p class="legal-p" style="color: var(--mute); margin-top: 12px; font-size: 13px">Linux / Windows: вместо ⌘ используйте Ctrl.</p>
        </section>

        <div class="block-tag">&lt;<b>Models</b> /&gt;</div>
        <section class="cb">
          <h2 class="legal-h2">Хостимые модели</h2>
          <p class="legal-p">Квота считается в центах USD за неделю.</p>
          <table class="legal-table">
            <thead><tr><th>Модель</th><th>Мин. план</th><th>Стоимость</th></tr></thead>
            <tbody>
              <tr><td><code class="legal-code">gpt-5.4-mini</code></td><td>Free</td><td>1¢</td></tr>
              <tr><td><code class="legal-code">gpt-5.4</code></td><td>Pro</td><td>1¢</td></tr>
              <tr><td><code class="legal-code">gpt-5.5</code></td><td>Pro</td><td class="aur">3¢</td></tr>
            </tbody>
          </table>
        </section>

        <div class="block-tag">&lt;<b>BYOK</b> /&gt;</div>
        <section class="cb">
          <h2 class="legal-h2">Свой ключ (BYO Key)</h2>
          <p class="legal-p">Settings → Models → BYO Key, или через env:</p>
          <pre class="docs-pre"><code>export ALASKA_PROVIDER_URL=https://api.openai.com/v1
export ALASKA_PROVIDER_KEY=sk-...</code></pre>
          <p class="legal-p" style="color: var(--mute); font-size: 14px">BYO-трафик не проходит через наш сервер. Промпт мы не видим и в квоту он не идёт.</p>
        </section>

        <div class="block-tag">&lt;<b>Workspace</b> /&gt;</div>
        <section class="cb">
          <h2 class="legal-h2">Per-workspace override</h2>
          <p class="legal-p">Положите <code class="legal-code">.alaska/config.json</code> в корень workspace:</p>
          <pre class="docs-pre"><code>{
  "model": "gpt-5.4",
  "region": "eu-central",
  "providerUrl": null,
  "telemetry": false
}</code></pre>
        </section>

        <div class="block-tag">&lt;<b>API</b> /&gt;</div>
        <section class="cb">
          <h2 class="legal-h2">HTTP API</h2>
          <p class="legal-p">Стабильная поверхность — под <code class="legal-code">api.alaska-ai.shop/api/*</code>. Авторизация — bearer JWT. Мутирующие эндпоинты требуют CSRF-заголовок.</p>
          <table class="legal-table docs-api">
            <tbody>
              <tr><td><code class="legal-code">POST /api/auth/login</code></td><td>email + пароль → access JWT</td></tr>
              <tr><td><code class="legal-code">POST /api/auth/refresh</code></td><td>ротация refresh + новый access</td></tr>
              <tr><td><code class="legal-code">POST /api/auth/logout</code></td><td>отзыв семейства</td></tr>
              <tr><td><code class="legal-code">GET /api/me</code></td><td>текущий пользователь</td></tr>
              <tr><td><code class="legal-code">POST /api/ai/chat</code></td><td>стриминг чат-комплишен (SSE)</td></tr>
              <tr><td><code class="legal-code">GET /api/ai/usage</code></td><td>месячные счётчики</td></tr>
              <tr><td><code class="legal-code">GET /api/billing/plans</code></td><td>каталог тарифов</td></tr>
              <tr><td><code class="legal-code">POST /api/billing/checkout</code></td><td>создать платёж</td></tr>
            </tbody>
          </table>
        </section>

        <div class="block-tag">&lt;<b>Troubleshooting</b> /&gt;</div>
        <section class="cb">
          <h2 class="legal-h2">Диагностика</h2>
          <dl class="legal-dl">
            <dt>«Вход постоянно редиректит»</dt>
            <dd>Заблокированы third-party cookies. Разрешите для <code class="legal-code">alaska-ai.shop</code> и <code class="legal-code">api.alaska-ai.shop</code>.</dd>
            <dt>«Quota exceeded» до конца недели</dt>
            <dd>Каждая модель считается в недельном бюджете. Переключитесь на меньшую модель или апгрейдьте план. Все планы сбрасываются в понедельник 00:00 UTC.</dd>
            <dt>«Ollama не найден»</dt>
            <dd>Проверьте дефолтный порт <code class="legal-code">11434</code>. Если поменяли — переопределите через <code class="legal-code">.alaska/config.json</code>.</dd>
          </dl>
        </section>

        <div class="block-tag">&lt;<b>FAQ</b> /&gt;</div>
        <section class="cb">
          <h2 class="legal-h2">FAQ</h2>
          <dl class="legal-dl">
            <dt>Вы обучаетесь на моём коде?</dt>
            <dd>Нет. Мы даже промпты и ответы не храним.</dd>
            <dt>Можно работать офлайн?</dt>
            <dd>Да, с локальной моделью. Сама IDE после установки работает полностью офлайн.</dd>
            <dt>Есть бесплатный план?</dt>
            <dd>Да — $0.25 недельных кредитов на маленькой модели + unlimited local / BYO навсегда.</dd>
            <dt>Где вы находитесь?</dt>
            <dd>Санкт-Петербург + remote. См. <a class="legal-link" href="#/about">/about</a>.</dd>
          </dl>
        </section>
      `,
      en: `
        <div class="block-tag">&lt;<b>Statement</b> /&gt;</div>
        <section class="cb">
          <h1 style="font-size: clamp(36px, 4.5vw, 52px); font-weight:500; letter-spacing:-0.025em; margin:0 0 14px; line-height:1.0">Onboarding<br>in five minutes.</h1>
          <p class="legal-p" style="max-width: 60ch">
            Install the binary, sign in, pick a model, write code. The rest is reference. Stuck? Try the Troubleshooting section or <a class="legal-link" href="mailto:hello@alaska-ai.shop">/contact</a>.
          </p>
        </section>

        <div class="block-tag">&lt;<b>Install</b> /&gt;</div>
        <section class="cb">
          <h2 class="legal-h2">Install</h2>
          <p class="legal-p">One binary, ~160 MB, no Electron. Pick a channel and run one command.</p>
          <div class="docs-install">
            <div class="docs-install-row">
              <span class="lbl">macOS · Homebrew</span>
              <code class="docs-cmd">brew install alaska-ai/tap/alaska</code>
            </div>
            <div class="docs-install-row">
              <span class="lbl">Linux · curl</span>
              <code class="docs-cmd">curl -fsSL https://alaska-ai.shop/install.sh | sh</code>
            </div>
            <div class="docs-install-row">
              <span class="lbl">Windows · winget</span>
              <code class="docs-cmd">winget install AlaskaAI.Alaska</code>
            </div>
            <div class="docs-install-row">
              <span class="lbl">Manual download</span>
              <a class="legal-link" href="#/download">/download — signed binaries + SHA-256</a>
            </div>
          </div>
        </section>

        <div class="block-tag">&lt;<b>FirstRun</b> /&gt;</div>
        <section class="cb">
          <h2 class="legal-h2">First run</h2>
          <ol class="legal-ol">
            <li>Open Alaska. The Welcome panel offers Sign in / Skip.</li>
            <li>Sign in via device flow: enter the 8-digit code the IDE shows you.</li>
            <li>Pick a model in the bottom bar. <code class="legal-code">gpt-5.4-mini</code> works on Free.</li>
            <li>Press <kbd class="docs-kbd">⌘K</kbd> on a line of code and ask for a change.</li>
          </ol>
          <p class="legal-p" style="color: var(--mute); margin-top: 12px; font-size: 14px">
            Signing in is optional — local-only mode works with Ollama / LM Studio without an account.
          </p>
        </section>

        <div class="block-tag">&lt;<b>Hotkeys</b> /&gt;</div>
        <section class="cb">
          <h2 class="legal-h2">Hotkeys</h2>
          <table class="legal-table docs-kbd-table">
            <tbody>
              <tr><td><kbd class="docs-kbd">⌘K</kbd></td><td>Inline edit of selection</td></tr>
              <tr><td><kbd class="docs-kbd">⌘I</kbd></td><td>Open Alaska sidebar</td></tr>
              <tr><td><kbd class="docs-kbd">⌘⇧K</kbd></td><td>Inline edit whole file</td></tr>
              <tr><td><kbd class="docs-kbd">⌘⏎</kbd></td><td>Accept suggestion</td></tr>
              <tr><td><kbd class="docs-kbd">Esc</kbd></td><td>Discard suggestion</td></tr>
              <tr><td><kbd class="docs-kbd">⌘.</kbd></td><td>Quick fix at cursor</td></tr>
              <tr><td><kbd class="docs-kbd">⌘⇧M</kbd></td><td>Switch model</td></tr>
              <tr><td><kbd class="docs-kbd">⌘/</kbd></td><td>Command palette</td></tr>
            </tbody>
          </table>
          <p class="legal-p" style="color: var(--mute); margin-top: 12px; font-size: 13px">Linux / Windows: use Ctrl instead of ⌘.</p>
        </section>

        <div class="block-tag">&lt;<b>Models</b> /&gt;</div>
        <section class="cb">
          <h2 class="legal-h2">Hosted models</h2>
          <p class="legal-p">Quota is counted in US cents per week.</p>
          <table class="legal-table">
            <thead><tr><th>Model</th><th>Min plan</th><th>Cost</th></tr></thead>
            <tbody>
              <tr><td><code class="legal-code">gpt-5.4-mini</code></td><td>Free</td><td>1¢</td></tr>
              <tr><td><code class="legal-code">gpt-5.4</code></td><td>Pro</td><td>1¢</td></tr>
              <tr><td><code class="legal-code">gpt-5.5</code></td><td>Pro</td><td class="aur">3¢</td></tr>
            </tbody>
          </table>
        </section>

        <div class="block-tag">&lt;<b>BYOK</b> /&gt;</div>
        <section class="cb">
          <h2 class="legal-h2">Bring Your Own Key</h2>
          <p class="legal-p">Settings → Models → BYO Key, or via env:</p>
          <pre class="docs-pre"><code>export ALASKA_PROVIDER_URL=https://api.openai.com/v1
export ALASKA_PROVIDER_KEY=sk-...</code></pre>
          <p class="legal-p" style="color: var(--mute); font-size: 14px">BYO traffic doesn't pass through our server. We don't see the prompt and it doesn't count toward your Alaska quota.</p>
        </section>

        <div class="block-tag">&lt;<b>Workspace</b> /&gt;</div>
        <section class="cb">
          <h2 class="legal-h2">Per-workspace override</h2>
          <p class="legal-p">Drop <code class="legal-code">.alaska/config.json</code> in the workspace root:</p>
          <pre class="docs-pre"><code>{
  "model": "gpt-5.4",
  "region": "eu-central",
  "providerUrl": null,
  "telemetry": false
}</code></pre>
        </section>

        <div class="block-tag">&lt;<b>API</b> /&gt;</div>
        <section class="cb">
          <h2 class="legal-h2">HTTP API</h2>
          <p class="legal-p">Stable surface — <code class="legal-code">api.alaska-ai.shop/api/*</code>. Auth: bearer JWT. Mutating endpoints require a CSRF header.</p>
          <table class="legal-table docs-api">
            <tbody>
              <tr><td><code class="legal-code">POST /api/auth/login</code></td><td>email + password → access JWT</td></tr>
              <tr><td><code class="legal-code">POST /api/auth/refresh</code></td><td>rotate refresh + new access</td></tr>
              <tr><td><code class="legal-code">POST /api/auth/logout</code></td><td>revoke family</td></tr>
              <tr><td><code class="legal-code">GET /api/me</code></td><td>current user</td></tr>
              <tr><td><code class="legal-code">POST /api/ai/chat</code></td><td>streaming chat completion (SSE)</td></tr>
              <tr><td><code class="legal-code">GET /api/ai/usage</code></td><td>monthly counters</td></tr>
              <tr><td><code class="legal-code">GET /api/billing/plans</code></td><td>plan catalog</td></tr>
              <tr><td><code class="legal-code">POST /api/billing/checkout</code></td><td>create payment</td></tr>
            </tbody>
          </table>
        </section>

        <div class="block-tag">&lt;<b>Troubleshooting</b> /&gt;</div>
        <section class="cb">
          <h2 class="legal-h2">Troubleshooting</h2>
          <dl class="legal-dl">
            <dt>"Sign-in keeps redirecting"</dt>
            <dd>Third-party cookies are blocked. Allow cookies for <code class="legal-code">alaska-ai.shop</code> and <code class="legal-code">api.alaska-ai.shop</code>.</dd>
            <dt>"Quota exceeded" until end of week</dt>
            <dd>Each model is counted in your weekly budget. Switch to a smaller model or upgrade. All plans reset Monday 00:00 UTC.</dd>
            <dt>"Ollama not found"</dt>
            <dd>Check default port <code class="legal-code">11434</code>. If you changed it — override via <code class="legal-code">.alaska/config.json</code>.</dd>
          </dl>
        </section>

        <div class="block-tag">&lt;<b>FAQ</b> /&gt;</div>
        <section class="cb">
          <h2 class="legal-h2">FAQ</h2>
          <dl class="legal-dl">
            <dt>Do you train on my code?</dt>
            <dd>No. We don't even store prompts or replies.</dd>
            <dt>Can it work offline?</dt>
            <dd>Yes, with a local model. The IDE itself runs fully offline after install.</dd>
            <dt>Is there a free plan?</dt>
            <dd>Yes — $0.25 of weekly credits on the small model + unlimited local / BYO forever.</dd>
            <dt>Where are you based?</dt>
            <dd>Saint Petersburg + remote. See <a class="legal-link" href="#/about">/about</a>.</dd>
          </dl>
        </section>
      `
    }
  }
});
