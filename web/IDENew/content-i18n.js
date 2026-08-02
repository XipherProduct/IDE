/* ============================================================
   ALaska Studio — English overlay for existing 6 marketing files
   Loaded after content.js; converts description/html → {ru, en}
============================================================ */

(() => {
  const F = window.STUDIO_FILES;
  if (!F) return;

  const EN = {

    leding: {
      description: 'home page',
      html: `
        <div class="block-tag">&lt;<b>Hero</b> /&gt;</div>
        <section class="cb file-hero">
          <h1>An IDE where the <em>chat thinks</em>.</h1>
          <p class="lede">
            ALaska is a <b>VS Code fork</b> with a truly built-in chat: it sees the whole project,
            reads neighboring files, and edits code directly. No extensions, no tab-switching.
          </p>
          <div class="actions">
            <a class="fb-btn primary" href="#/download">Download · 160 MB</a>
            <a class="fb-btn" href="#/about">Who built this →</a>
          </div>
          <div class="leding-hero-strip">
            <div><div class="k">size</div><div class="v">160 MB</div></div>
            <div><div class="k">cold start</div><div class="v">1.2 s</div></div>
            <div><div class="k">median TTFT</div><div class="v">280 ms</div></div>
            <div><div class="k">releases since March</div><div class="v">6</div></div>
          </div>
        </section>

        <div class="block-tag">&lt;<b>LiveMockup</b> /&gt;</div>
        <section class="cb">
          <div class="leding-ide" aria-label="Editor demo">
            <div class="lide-titlebar">
              <div class="dots"><i></i><i></i><i></i></div>
              <span class="crumb">alaska-monorepo · src/warehouse · <b>warehouse.ts</b></span>
              <span class="branch">main · ahead 2</span>
            </div>
            <div class="lide-grid">
              <aside class="lide-side">
                <div class="row open">▾ src</div>
                <div class="row deep">app.ts</div>
                <div class="row deep active">warehouse.ts</div>
                <div class="row deep">router.ts</div>
                <div class="row deep">types.ts</div>
                <div class="row">▸ tests</div>
                <div class="row">▸ migrations</div>
                <div class="row file">package.json</div>
                <div class="row file">.alaskarules</div>
              </aside>
              <main class="lide-code">
                <div class="line"><span class="n">14</span><span class="kw">export function</span> <span class="fn">moveItem</span>(<span class="var">id</span>: <span class="ty">ItemId</span>, <span class="var">to</span>: <span class="ty">BinId</span>) {</div>
                <div class="line"><span class="n">15</span>  <span class="kw">const</span> <span class="var">item</span> = <span class="fn">items</span>.<span class="fn">find</span>(<span class="var">i</span> =&gt; <span class="var">i</span>.<span class="var">id</span> === <span class="var">id</span>)</div>
                <div class="line"><span class="n">16</span>  <span class="kw">if</span> (!<span class="var">item</span>) <span class="kw">throw new</span> <span class="ty">NotFound</span>(<span class="str">"item missing"</span>)</div>
                <div class="line ghost"><span class="n">17</span><span class="ghost-mark">+</span> <span class="kw">if</span> (<span class="var">item</span>.<span class="var">locked</span>) <span class="kw">throw new</span> <span class="ty">Conflict</span>(<span class="str">"locked"</span>)</div>
                <div class="line"><span class="n">18</span>  <span class="var">item</span>.<span class="var">bin</span> = <span class="var">to</span></div>
                <div class="line"><span class="n">19</span>  <span class="kw">return</span> <span class="var">item</span></div>
                <div class="line"><span class="n">20</span>}</div>
              </main>
              <aside class="lide-chat">
                <div class="chead">
                  <span class="dot"></span>
                  <span class="title">Project chat</span>
                  <span class="model">5.5</span>
                </div>
                <div class="msg user">
                  <span class="who">you</span>
                  <span class="body">check the lock before moving</span>
                </div>
                <div class="tools">
                  <div class="tool ok">▸ read warehouse.ts</div>
                  <div class="tool ok">▸ found 3 tests for moveItem</div>
                  <div class="tool run">▸ proposing patch…</div>
                </div>
                <div class="msg ai">
                  <span class="who">alaska</span>
                  <span class="body">Added a guard on <code>item.locked</code> before the write. Local tests pass.</span>
                </div>
              </aside>
            </div>
            <div class="lide-statusbar">
              <span class="aur">● connected · 5.5</span>
              <span>TypeScript</span>
              <span>UTF-8</span>
              <span>LF</span>
              <span class="tokens">tokens: 1,248 / 8,000</span>
            </div>
          </div>
        </section>

        <div class="block-tag">&lt;<b>Shortcuts</b> /&gt;</div>
        <section class="cb">
          <div class="leding-chord">
            <div class="chord-head">
              <span class="ch-eyebrow">⌨ keyboard / most used</span>
              <span class="ch-meta">avg per user / day · 2026-05</span>
            </div>
            <ol class="chord-rows">
              <li>
                <span class="rank">01</span>
                <span class="keys"><kbd>⌘</kbd><kbd>K</kbd></span>
                <span class="label">inline edit on selection — describe in words, diff streams in the editor</span>
                <span class="count">38× / day</span>
                <span class="vol"><i style="width:100%"></i></span>
              </li>
              <li>
                <span class="rank">02</span>
                <span class="keys"><kbd>⌘</kbd><kbd>I</kbd></span>
                <span class="label">side chat — sees the repo and live LSP diagnostics</span>
                <span class="count">22× / day</span>
                <span class="vol"><i style="width:58%"></i></span>
              </li>
              <li>
                <span class="rank">03</span>
                <span class="keys"><kbd>⌘</kbd><kbd>⇧</kbd><kbd>K</kbd></span>
                <span class="label">whole-file edit — when the change doesn't fit a selection</span>
                <span class="count">9× / day</span>
                <span class="vol"><i style="width:24%"></i></span>
              </li>
              <li>
                <span class="rank">04</span>
                <span class="keys"><kbd>⌘</kbd><kbd>.</kbd></span>
                <span class="label">quick fix at cursor — fixes LSP diagnostics, no dialogs</span>
                <span class="count">7× / day</span>
                <span class="vol"><i style="width:18%"></i></span>
              </li>
            </ol>
            <div class="chord-foot">
              <span>11 more shortcuts — in the command palette <kbd>⌘</kbd><kbd>/</kbd></span>
              <a class="chord-link" href="#/docs">full list →</a>
            </div>
          </div>
        </section>

        <div class="block-tag">&lt;<b>Features</b> /&gt;</div>
        <section class="cb">
          <div class="fb-grid-3">
            <div class="fb-cell">
              <span class="num">01</span>
              <h4>Chat sees the whole repo</h4>
              <p>Local repo index updates on the fly. Links to lines and files — no copy-pasting.</p>
            </div>
            <div class="fb-cell">
              <span class="num">02</span>
              <h4>Inline ⌘I — diff in the editor</h4>
              <p>Select code, describe what you want — ALaska shows a diff. Apply ⇥, discard Esc.</p>
            </div>
            <div class="fb-cell">
              <span class="num">03</span>
              <h4>OpenAI without VPN drama</h4>
              <p>Direct routes to GPT 5.4 mini, 5.4, 5.5 through our infrastructure. One bill.</p>
            </div>
            <div class="fb-cell">
              <span class="num">04</span>
              <h4>160 MB — that's it</h4>
              <p>One binary. No Electron zoo of updates and dependencies.</p>
            </div>
            <div class="fb-cell">
              <span class="num">05</span>
              <h4>Compatible with everything</h4>
              <p>VS Code extensions, themes, devcontainers, SSH — all there, nothing to reconfigure.</p>
            </div>
            <div class="fb-cell">
              <span class="num">06</span>
              <h4>Your code stays local</h4>
              <p>Only what you explicitly attach reaches the model. The local index stays on your machine.</p>
            </div>
          </div>
        </section>

        <div class="block-tag">&lt;<b>VS</b> /&gt;</div>
        <section class="cb">
          <h3 class="leding-section-h">Alaska vs "AI-IDE monsters"</h3>
          <p class="leding-section-sub">Numbers are medians from our tooling and public competitor releases as of 2026-05.</p>
          <div class="leding-vs">
            <div class="vs-row vs-head">
              <span></span>
              <span class="ice">Alaska</span>
              <span class="them">Electron rival</span>
            </div>
            <div class="vs-row">
              <span class="lbl">binary size</span>
              <span class="bar"><i class="us" style="width:33%"></i><span class="val">160 MB</span></span>
              <span class="bar"><i class="them" style="width:100%"></i><span class="val them">480 MB</span></span>
            </div>
            <div class="vs-row">
              <span class="lbl">cold start</span>
              <span class="bar"><i class="us" style="width:25%"></i><span class="val">1.2 s</span></span>
              <span class="bar"><i class="them" style="width:100%"></i><span class="val them">4.8 s</span></span>
            </div>
            <div class="vs-row">
              <span class="lbl">background updater</span>
              <span class="us-text">none, GET /releases every 6 h</span>
              <span class="them-text">separate process</span>
            </div>
            <div class="vs-row">
              <span class="lbl">billing</span>
              <span class="us-text">credits, weekly carryover</span>
              <span class="them-text">"unlimited that limits"</span>
            </div>
            <div class="vs-row">
              <span class="lbl">trains on your code</span>
              <span class="us-text"><span class="ok">no</span> · prompt not stored</span>
              <span class="them-text">opt-out, fine print</span>
            </div>
          </div>
        </section>

        <div class="block-tag">&lt;<b>Models</b> /&gt;</div>
        <section class="cb">
          <h3 class="leding-section-h">Three models — pick yours</h3>
          <p class="leding-section-sub">Every chat can switch any time — even mid-conversation.</p>
          <div class="leding-models" data-m-active="std">
            <div class="m-tabs">
              <button class="m-tab" data-m-tab="mini">5.4 mini</button>
              <button class="m-tab active" data-m-tab="std">5.4</button>
              <button class="m-tab" data-m-tab="flag">5.5 <small>flagship</small></button>
            </div>
            <div class="m-card" data-m-id="mini">
              <div class="m-head">
                <h4>GPT 5.4 mini</h4>
                <span class="m-tag">fast, cheap</span>
              </div>
              <p>Inline edits, renames, regex, typography. Call it often.</p>
              <div class="m-stats">
                <div><div class="k">cost</div><div class="v">1¢ / call</div></div>
                <div><div class="k">TTFT</div><div class="v">~180 ms</div></div>
                <div><div class="k">context</div><div class="v">32k</div></div>
                <div><div class="k">min plan</div><div class="v">Free</div></div>
              </div>
            </div>
            <div class="m-card" data-m-id="std">
              <div class="m-head">
                <h4>GPT 5.4</h4>
                <span class="m-tag">balanced</span>
              </div>
              <p>Multi-step edits, project search, medium-size refactors. The default.</p>
              <div class="m-stats">
                <div><div class="k">cost</div><div class="v">1¢ / call</div></div>
                <div><div class="k">TTFT</div><div class="v">~280 ms</div></div>
                <div><div class="k">context</div><div class="v">128k</div></div>
                <div><div class="k">min plan</div><div class="v">Pro</div></div>
              </div>
            </div>
            <div class="m-card" data-m-id="flag">
              <div class="m-head">
                <h4>GPT 5.5</h4>
                <span class="m-tag aur">flagship, reasoning</span>
              </div>
              <p>Long plans, migrations, debugging through stack traces and logs. When accuracy matters.</p>
              <div class="m-stats">
                <div><div class="k">cost</div><div class="v">3¢ / call</div></div>
                <div><div class="k">TTFT</div><div class="v">~620 ms</div></div>
                <div><div class="k">context</div><div class="v">256k</div></div>
                <div><div class="k">min plan</div><div class="v">Pro</div></div>
              </div>
            </div>
          </div>
        </section>

        <div class="block-tag">&lt;<b>TeamMap</b> /&gt;</div>
        <section class="cb">
          <h3 class="leding-section-h">A team from three cities</h3>
          <p class="leding-section-sub">Distributed across the cold belt. Every commit is signed.</p>
          <div class="leding-map">
            <svg viewBox="0 0 600 220" preserveAspectRatio="xMidYMid meet" aria-hidden="true">
              <defs>
                <linearGradient id="auroraStrokeEn" x1="0" x2="1">
                  <stop offset="0" stop-color="oklch(0.83 0.10 220)"/>
                  <stop offset="0.5" stop-color="oklch(0.78 0.16 155)"/>
                  <stop offset="1" stop-color="oklch(0.83 0.10 220)"/>
                </linearGradient>
              </defs>
              <path d="M 0,80 Q 150,30 300,90 T 600,60" stroke="oklch(0.78 0.16 155)" stroke-opacity=".22" stroke-width="1" fill="none"/>
              <path d="M 0,140 Q 200,90 400,150 T 600,110" stroke="oklch(0.83 0.10 220)" stroke-opacity=".18" stroke-width="1" fill="none"/>
              <path d="M 120,120 Q 200,60 320,110 Q 420,150 470,90" stroke="url(#auroraStrokeEn)" stroke-width="1.5" stroke-dasharray="3 4" fill="none"/>
              <circle cx="120" cy="120" r="6" fill="oklch(0.83 0.10 220)"/>
              <circle cx="320" cy="110" r="6" fill="oklch(0.83 0.10 220)"/>
              <circle cx="470" cy="90" r="6" fill="oklch(0.83 0.10 220)"/>
            </svg>
            <div class="map-pins">
              <div class="pin" style="left:13%; top:54%">
                <div class="name">Saint Petersburg</div>
                <div class="role">core · IDE agents</div>
                <div class="weather">+3°C · gulf wind</div>
              </div>
              <div class="pin" style="left:48%; top:45%">
                <div class="name">Minsk</div>
                <div class="role">front · billing</div>
                <div class="weather">+5°C</div>
              </div>
              <div class="pin" style="left:73%; top:33%">
                <div class="name">Reykjavík</div>
                <div class="role">infra · models</div>
                <div class="weather">−2°C · clear</div>
              </div>
            </div>
          </div>
        </section>

        <div class="block-tag">&lt;<b>Install</b> /&gt;</div>
        <section class="cb">
          <h3 class="leding-section-h">One-line install</h3>
          <p class="leding-section-sub">Same binary, same SHA-256. No installer because it doesn't need one.</p>
          <div class="leding-install" data-ic-active="mac">
            <div class="ic-tabs">
              <button class="ic-tab active" data-ic-tab="mac">macOS</button>
              <button class="ic-tab" data-ic-tab="lin">Linux</button>
              <button class="ic-tab" data-ic-tab="win">Windows</button>
            </div>
            <div class="ic-card" data-ic-id="mac">
              <pre class="ic-cmd"><span class="prompt">$</span> brew install alaska-ai/tap/alaska</pre>
              <div class="ic-out">
                <div><span class="ok">✓</span> downloaded 158 MB in 4.2 s</div>
                <div><span class="ok">✓</span> SHA-256 matches manifest</div>
                <div><span class="ok">✓</span> Apple signature valid, notarized</div>
                <div><span class="ice">▸</span> run: <code>alaska</code></div>
              </div>
            </div>
            <div class="ic-card" data-ic-id="lin">
              <pre class="ic-cmd"><span class="prompt">$</span> curl -fsSL alaska-ai.shop/install.sh | sh</pre>
              <div class="ic-out">
                <div><span class="ok">✓</span> detected platform: linux-x64 · glibc 2.35</div>
                <div><span class="ok">✓</span> SHA-256 + GPG signature OK</div>
                <div><span class="ok">✓</span> installed to /opt/alaska</div>
                <div><span class="ice">▸</span> run: <code>alaska</code></div>
              </div>
            </div>
            <div class="ic-card" data-ic-id="win">
              <pre class="ic-cmd"><span class="prompt">PS&gt;</span> winget install AlaskaAI.Alaska</pre>
              <div class="ic-out">
                <div><span class="ok">✓</span> manifest verified · EV signature OK</div>
                <div><span class="ok">✓</span> installed to %LOCALAPPDATA%\\Programs\\Alaska</div>
                <div><span class="ok">✓</span> added to PATH</div>
                <div><span class="ice">▸</span> run: <code>alaska</code></div>
              </div>
            </div>
          </div>
        </section>

        <div class="block-tag">&lt;<b>FAQ</b> /&gt;</div>
        <section class="cb">
          <h3 class="leding-section-h">Frequently asked</h3>
          <div class="leding-faq">
            <details>
              <summary>Do you train models on my code?</summary>
              <p>No. Prompts and replies are never written to our DB. <code>ai_usage</code> stores only model id, tokens, source, success/error. Details in <a class="legal-link" href="#/privacy">privacy</a>.</p>
            </details>
            <details>
              <summary>Can I use my own OpenAI key?</summary>
              <p>Yes — Settings → Models → BYO Key, or environment variables. BYO traffic doesn't pass through our server and doesn't count against Alaska quota.</p>
            </details>
            <details>
              <summary>What if my quota runs out?</summary>
              <p>The chat offers to top up or wait until Monday 00:00 UTC reset. The IDE keeps working locally and with a BYO key, just without AI features.</p>
            </details>
            <details>
              <summary>Does it run on ARM Linux and Apple Silicon?</summary>
              <p>Yes. The build matrix produces 6 artifacts: macOS arm64/x64, Linux arm64/x64, Windows arm64/x64. All signed.</p>
            </details>
            <details>
              <summary>How is this different from fork-X?</summary>
              <p>Smaller — 160 MB vs 480. No separate updater. Billing on real tokens, not "unlimited". Ghost suggestions are off by default.</p>
            </details>
            <details>
              <summary>Is there an API?</summary>
              <p>Yes, <code>api.alaska-ai.shop/api/*</code>. Bearer JWT, CSRF on mutations. Full list at <a class="legal-link" href="#/docs">docs</a>.</p>
            </details>
          </div>
        </section>

        <div class="block-tag">&lt;<b>CTA</b> /&gt;</div>
        <section class="cb">
          <div style="background: linear-gradient(180deg, var(--panel) 0%, var(--bg-2) 100%); border: 1px solid var(--line-2); border-radius: 14px; padding: 36px 32px; text-align: center">
            <h3 style="font-size: 28px; font-weight: 500; letter-spacing:-0.02em; margin: 0 0 14px">Polar start in 90 seconds.</h3>
            <p style="color: var(--ink-2); margin: 0 auto 22px; max-width: 50ch">One file, no admin rights on Windows, no menulib deps on Linux.</p>
            <div style="display: flex; gap: 10px; justify-content: center; flex-wrap: wrap">
              <a class="fb-btn primary" href="#/download">Download ALaska →</a>
              <a class="fb-btn" href="#/pricing">Pricing</a>
            </div>
          </div>
        </section>
      `
    },

    login: {
      description: 'sign in — Google + email',
      html: `
        <div class="block-tag">&lt;<b>AuthCard</b> mode="login" /&gt;</div>
        <section class="cb">
          <div class="fb-auth-card">
            <div class="kicker">Sign in</div>
            <h3>Welcome back.</h3>
            <p class="sub">No account yet? <a href="#/register">Sign up</a> — $1 on the house.</p>

            <button class="gbtn" type="button">
              <svg viewBox="0 0 24 24" fill="none">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.75h3.57c2.08-1.92 3.28-4.74 3.28-8.07z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.75c-.98.66-2.24 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.12A6.61 6.61 0 0 1 5.5 12c0-.74.13-1.46.34-2.12V7.04H2.18A11 11 0 0 0 1 12c0 1.78.43 3.46 1.18 4.96l3.66-2.84z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.65l3.15-3.15C17.45 2.09 14.97 1 12 1A11 11 0 0 0 2.18 7.04l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38z"/>
              </svg>
              Continue with Google
            </button>

            <div class="divider">or by email</div>

            <form onsubmit="event.preventDefault()">
              <div class="field">
                <label>Email</label>
                <input type="email" placeholder="dev@alaska.ai" />
              </div>
              <div class="field">
                <label>Password</label>
                <input type="password" placeholder="••••••••" />
              </div>
              <button class="submit">Sign in →</button>
            </form>
          </div>
        </section>

        <div class="block-tag">&lt;<b>Footer</b> /&gt;</div>
        <section class="cb" style="text-align: center; color: var(--mute); font-family: 'JetBrains Mono', monospace; font-size: 11.5px">
          <p style="margin: 0">Team SSO — coming soon · v0.42.1</p>
        </section>
      `
    },

    register: {
      description: 'sign up — Google + email',
      html: `
        <div class="block-tag">&lt;<b>AuthCard</b> mode="signup" gift={1} /&gt;</div>
        <section class="cb">
          <div class="fb-auth-card">
            <div class="kicker">Sign up</div>
            <h3>Polar start.</h3>
            <p class="sub">$1 of credits on signup. No card required. <a href="#/login">Already have an account?</a></p>

            <button class="gbtn" type="button">
              <svg viewBox="0 0 24 24" fill="none">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.75h3.57c2.08-1.92 3.28-4.74 3.28-8.07z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.75c-.98.66-2.24 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.12A6.61 6.61 0 0 1 5.5 12c0-.74.13-1.46.34-2.12V7.04H2.18A11 11 0 0 0 1 12c0 1.78.43 3.46 1.18 4.96l3.66-2.84z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.65l3.15-3.15C17.45 2.09 14.97 1 12 1A11 11 0 0 0 2.18 7.04l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38z"/>
              </svg>
              Sign up with Google
            </button>

            <div class="divider">or by email</div>

            <form onsubmit="event.preventDefault()">
              <div class="field">
                <label>Name</label>
                <input type="text" placeholder="Jane Doe" />
              </div>
              <div class="field">
                <label>Work email</label>
                <input type="email" placeholder="dev@alaska.ai" />
              </div>
              <div class="field">
                <label>Password</label>
                <input type="password" placeholder="minimum 10 characters" />
              </div>
              <button class="submit">Create account →</button>
            </form>
          </div>
        </section>
      `
    },

    about: {
      description: 'team and principles',
      html: `
        <div class="block-tag">&lt;<b>Statement</b> /&gt;</div>
        <section class="cb">
          <p class="fb-statement">
            Alaska AI is an IDE you <em>actually want to own</em>, for when marketing copy stops meaning anything. We built it because the existing assistants either <em>spam your cursor with suggestions</em>, weigh <em>300 MB like Electron monsters</em>, or live by <em>selling your code to the model</em>. We wanted none of those.
          </p>
        </section>

        <div class="block-tag">&lt;<b>Origin</b> /&gt;</div>
        <section class="cb">
          <h3 style="font-size: 24px; font-weight: 500; letter-spacing:-0.02em; margin: 0 0 14px">No HQ. <em style="font-style:normal; color: var(--ice)">We work from places that are cold.</em></h3>
          <p style="color: var(--ink-2); font-size: 15px; line-height: 1.65; margin: 0 0 20px; max-width: 64ch">
            Team is distributed across Saint Petersburg, Minsk, and Reykjavík. We meet in person twice a year. The rest of the time — we write code.
          </p>
        </section>

        <div class="block-tag">&lt;<b>Stats</b> /&gt;</div>
        <section class="cb">
          <div class="fb-stats">
            <div><div class="k">engineers</div><div class="v">2</div></div>
            <div><div class="k">region</div><div class="v">EU + RU</div></div>
            <div><div class="k">funding</div><div class="v">Customers <small>no VC</small></div></div>
            <div><div class="k">open roles</div><div class="v">— <small>right now</small></div></div>
          </div>
        </section>

        <div class="block-tag">&lt;<b>Cities</b> /&gt;</div>
        <section class="cb">
          <div class="fb-grid-3">
            <div class="fb-cell">
              <span class="num">59°57′N · 30°19′E</span>
              <h4>Saint Petersburg</h4>
              <p>IDE architecture, editor core, project index. The person responsible for the 160 MB.</p>
            </div>
            <div class="fb-cell">
              <span class="num">53°54′N · 27°34′E</span>
              <h4>Minsk</h4>
              <p>Chat, agents, context. Explains to the AI how to read your warehouse.ts.</p>
            </div>
            <div class="fb-cell">
              <span class="num">64°08′N · 21°56′W</span>
              <h4>Reykjavík</h4>
              <p>Infra and the OpenAI gateway. Makes sure you don't have to touch VPN.</p>
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

    pricing: {
      description: '4 plans + credit rollover',
      html: `
        <div class="block-tag">&lt;<b>Header</b> /&gt;</div>
        <section class="cb">
          <h2 style="font-size: clamp(28px, 3.5vw, 40px); font-weight: 500; letter-spacing:-0.025em; margin: 0 0 12px">
            Pay for <em style="font-style:normal; background: linear-gradient(180deg, var(--ice) 0%, var(--ice-2) 100%); -webkit-background-clip: text; background-clip: text; -webkit-text-fill-color: transparent">tokens</em>, not for "unlimited".
          </h2>
          <p style="color: var(--ink-2); margin: 0 0 26px; font-size: 15.5px; max-width: 60ch">
            Four plans. Credits are just dollars. On Max and Ultra, unused credits roll over to the next month.
          </p>
        </section>

        <div class="block-tag">&lt;<b>Plans</b> /&gt;</div>
        <section class="cb">
          <div class="fb-price-grid">
            <div class="fb-price-card">
              <div class="tier">Free</div>
              <h4>Free</h4>
              <p class="pitch">Start with Alaska AI right in the editor.</p>
              <div class="amount"><span class="num">$0</span><span class="per">forever</span></div>
              <ul>
                <li>$1 monthly credits</li>
                <li>GPT 5.4 mini only</li>
                <li>Desktop chat</li>
              </ul>
              <a class="cta" href="#/register">Start free</a>
            </div>

            <div class="fb-price-card featured">
              <div class="tier">Pro</div>
              <h4>Pro</h4>
              <p class="pitch">For everyday work.</p>
              <div class="amount"><span class="num">$12</span><span class="per">per month</span></div>
              <ul>
                <li>$12 in credits</li>
                <li>All models — 5.4 mini, 5.4, 5.5</li>
                <li>GPT 5.5 — 3¢ per call</li>
                <li>Rollover +$3/mo</li>
              </ul>
              <a class="cta" href="#/register">Choose Pro →</a>
            </div>

            <div class="fb-price-card">
              <div class="tier">Max</div>
              <h4>Max</h4>
              <p class="pitch">Intensive daily work.</p>
              <div class="amount"><span class="num">$30</span><span class="per">per month</span></div>
              <ul>
                <li>$30 in credits</li>
                <li>Rollover included</li>
                <li>Up to 8k tokens per reply</li>
                <li>Everything from Pro</li>
              </ul>
              <a class="cta" href="#/register">Choose Max</a>
            </div>

            <div class="fb-price-card">
              <div class="tier">Ultra</div>
              <h4>Ultra</h4>
              <p class="pitch">Maximum capacity.</p>
              <div class="amount"><span class="num">$60</span><span class="per">per month</span></div>
              <ul>
                <li>$60 in credits</li>
                <li>Rollover up to 2× budget</li>
                <li>Heavy workloads</li>
                <li>Everything from Max</li>
              </ul>
              <a class="cta" href="#/register">Choose Ultra</a>
            </div>
          </div>
        </section>

        <div class="block-tag">&lt;<b>Notes</b> /&gt;</div>
        <section class="cb" style="margin-top: 24px">
          <div class="fb-row-2">
            <div class="fb-cell" style="background: var(--panel); border-radius: 12px; border: 1px solid var(--line)">
              <span class="num">FAQ · 01</span>
              <h4>What is a "token"?</h4>
              <p>Roughly a word or a punctuation mark. 1¢ ≈ 4 mini replies, 3¢ is one GPT 5.5 reply with average context.</p>
            </div>
            <div class="fb-cell" style="background: var(--panel); border-radius: 12px; border: 1px solid var(--line)">
              <span class="num">FAQ · 02</span>
              <h4>Can I cancel?</h4>
              <p>Yes. Rolled-over credits last another month — use them up, then you drop to Free.</p>
            </div>
          </div>
        </section>
      `
    },

    download: {
      description: 'builds + sha256',
      html: `
        <div class="block-tag">&lt;<b>Header</b> /&gt;</div>
        <section class="cb file-hero">
          <h1>Download <em>ALaska</em>.</h1>
          <p class="lede">One binary, 160 MB. No admin rights on Windows, no menulib deps on Linux.</p>
        </section>

        <div class="block-tag">&lt;<b>Builds</b> /&gt;</div>
        <section class="cb">
          <div class="fb-dl">
            <a class="fb-dl-row" href="#">
              <span class="ico"><svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M3 5.5 10.5 4.4v7.1H3zM10.5 12.5v7.1L3 18.5v-6zm1 0H21v8L11.5 19zM21 3.5v8H11.5V4.6z"/></svg></span>
              <span class="info">
                <div class="name">Windows 10 / 11</div>
                <div class="meta">ALaska-0.42.1-x64.exe · 160 MB · Authenticode</div>
              </span>
              <span class="arrow">download ↓</span>
            </a>
            <a class="fb-dl-row" href="#">
              <span class="ico"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M12 2c-2 0-3 2-3 4 0 1 0 2 1 3-2 1-4 4-4 8 0 2 1 4 2 5 1 0 2-1 3-1 1 0 1 1 1 2-1 0-2 0-2 1 1 0 6 0 6-1 0-1-1-1-1-1 0-1 1-2 1-2 1 0 2 1 3 1 1-1 2-3 2-5 0-4-2-7-4-8 1-1 1-2 1-3 0-2-1-4-3-4z"/></svg></span>
              <span class="info">
                <div class="name">Linux · .deb</div>
                <div class="meta">ALaska_0.42.1_amd64.deb · Debian/Ubuntu/Mint</div>
              </span>
              <span class="arrow">download ↓</span>
            </a>
            <a class="fb-dl-row" href="#">
              <span class="ico"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M12 2c-2 0-3 2-3 4 0 1 0 2 1 3-2 1-4 4-4 8 0 2 1 4 2 5 1 0 2-1 3-1 1 0 1 1 1 2-1 0-2 0-2 1 1 0 6 0 6-1 0-1-1-1-1-1 0-1 1-2 1-2 1 0 2 1 3 1 1-1 2-3 2-5 0-4-2-7-4-8 1-1 1-2 1-3 0-2-1-4-3-4z"/></svg></span>
              <span class="info">
                <div class="name">Linux · AppImage</div>
                <div class="meta">ALaska-0.42.1-x86_64.AppImage · runs anywhere</div>
              </span>
              <span class="arrow">download ↓</span>
            </a>
            <a class="fb-dl-row disabled" href="#">
              <span class="ico"><svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M16.5 12.5a3.5 3.5 0 0 1 1.65-2.95 3.6 3.6 0 0 0-2.85-1.55c-1.2-.13-2.36.71-2.97.71-.62 0-1.57-.69-2.59-.67a3.77 3.77 0 0 0-3.18 1.94c-1.36 2.37-.35 5.86 1 7.78.65.94 1.4 1.99 2.4 1.95.97-.04 1.33-.62 2.49-.62 1.15 0 1.48.62 2.5.6 1.04-.02 1.69-.95 2.32-1.9.5-.75.83-1.55 1.07-2.39a3.42 3.42 0 0 1-2.04-2.9z"/></svg></span>
              <span class="info">
                <div class="name">macOS</div>
                <div class="meta">Universal Binary · Intel + Apple Silicon</div>
              </span>
              <span class="arrow">soon →</span>
            </a>
          </div>
        </section>

        <div class="block-tag">&lt;<b>OneLineInstall</b> /&gt;</div>
        <section class="cb">
          <div style="background: var(--panel); border: 1px solid var(--line); border-radius: 10px; padding: 16px 18px; font-family: 'JetBrains Mono', monospace; font-size: 13px; color: var(--ink-2); line-height: 1.75">
            <div><span style="color: var(--aurora)">~ $</span> curl -L alaska.ai/get | sh</div>
            <div style="color: var(--mute)">→ detected: linux-x86_64</div>
            <div style="color: var(--mute)">→ sha256: ok · gpg: signature valid</div>
            <div style="color: var(--mute)">→ installed to ~/.alaska</div>
            <div><span style="color: var(--aurora)">✓ run:</span> <span style="color: var(--ice)">alaska .</span></div>
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

  // Apply overlay: convert description + html to {ru, en}
  Object.keys(EN).forEach(id => {
    if (!F[id]) return;
    const ruDesc = F[id].description;
    const ruHtml = F[id].html;
    F[id].description = { ru: ruDesc, en: EN[id].description };
    F[id].html = { ru: ruHtml, en: EN[id].html };
  });
})();


/* ============================================================
   CHROME I18N TABLE
============================================================ */
window.STUDIO_I18N = {
  ru: {
    'pathbar.placeholder': 'впишите путь… (напр. /login)',
    'langToggle.title':    'Переключить язык',
    'tree.title':          'Обозреватель',
    'tree.collapseAll':    'Свернуть всё',
    'tree.refresh':        'Обновить',
    'tree.files':          'файлов',
    'tree.version':        'версия',
    'tree.anchorage':      'анкоридж',
    'badge.reading':       'читает',
    'chat.title':          'Чат сайта',
    'chat.notice':         'Это демо-чат сайта. Прикреплять файлы нельзя — в реальной IDE чат видит весь проект.',
    'chat.placeholder':    'спросите про ALaska, модели, цены, установку…',
    'chat.kbd.send':       'Enter — отправить',
    'chat.kbd.newline':    'Shift+Enter — новая строка',
    'chat.connected':      '● подключён',
    'chat.networkError':   'сорян, что-то с сетью. попробуй ещё раз.',
    'status.connected':    '● alaska подключён',
    'status.errors':       '0 ошибок',
    'status.warnings':     '0 предупреждений',
    'status.telemetry':    'телеметрия: локально',
    'desktop.activities':  'Activities',
    'desktop.hint':        'двойной клик · открыть приложение',
    'vpn.tagline':         'один клик до спокойствия',
    'vpn.disconnected':    'не подключено',
    'vpn.connecting':      'подключение…',
    'vpn.connected':       'подключено',
    'vpn.location':        'локация',
    'vpn.connect':         'Подключить →',
    'vpn.disconnect':      'Отключить',
    'folder.root':         'alaska-ai',
    'folder.src':          'src',
    'folder.pages':        'pages',
    'folder.dashboard':    'dashboard',
    'folder.legal':        'legal',
    'folder.blog':        'blog',
    'folder.blocks':       'blocks',
    'folder.lib':          'lib'
  },
  en: {
    'pathbar.placeholder': 'type a path… (e.g. /login)',
    'langToggle.title':    'Switch language',
    'tree.title':          'Explorer',
    'tree.collapseAll':    'Collapse all',
    'tree.refresh':        'Refresh',
    'tree.files':          'files',
    'tree.version':        'version',
    'tree.anchorage':      'anchorage',
    'badge.reading':       'reading',
    'chat.title':          'Site chat',
    'chat.notice':         "This is a demo chat. File attachments are off — in the real IDE the chat sees your whole project.",
    'chat.placeholder':    'ask about ALaska, models, pricing, install…',
    'chat.kbd.send':       'Enter — send',
    'chat.kbd.newline':    'Shift+Enter — newline',
    'chat.connected':      '● connected',
    'chat.networkError':   'sorry, network glitch. try again.',
    'status.connected':    '● alaska connected',
    'status.errors':       '0 errors',
    'status.warnings':     '0 warnings',
    'status.telemetry':    'telemetry: local-only',
    'desktop.activities':  'Activities',
    'desktop.hint':        'double-click · launch app',
    'vpn.tagline':         'one click to calm',
    'vpn.disconnected':    'disconnected',
    'vpn.connecting':      'connecting…',
    'vpn.connected':       'connected',
    'vpn.location':        'location',
    'vpn.connect':         'Connect →',
    'vpn.disconnect':      'Disconnect',
    'folder.root':         'alaska-ai',
    'folder.src':          'src',
    'folder.pages':        'pages',
    'folder.dashboard':    'dashboard',
    'folder.legal':        'legal',
    'folder.blog':        'blog',
    'folder.blocks':       'blocks',
    'folder.lib':          'lib'
  }
};
