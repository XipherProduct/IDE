# Xipher Web "Code" Platform — Consolidated Architecture

This is the build spec. It folds the agent-core design, the executor design, and every finding from the security review into one model. The governing principle from the review: **path-jails and command denylists are UX filters, not boundaries.** The four real boundaries are (1) OS-level confinement of every tool executor, (2) transport-verified `userId` with per-op ownership checks (an id is never a capability), (3) fail-closed approval for mutating/egress tools in headless runs, and (4) IP-resolved SSRF blocking. Every decision below serves one of those.

---

## 1. Architecture overview

The agent brain moves **server-side** into `ide-backend`: a new `agentLoop.mjs` runs the MAX_TURNS turn-loop that today lives in the desktop renderer (`alaskaChatViewPane.ts submit()`), reusing `omniChatStream` and the exact wire-translation, so the model contract stays byte-identical. Sessions, messages, and workspace bindings live in a per-user `agentStore.mjs` (atomic JSON, `userId`-scoped, monotonic `seq`), and a per-session `agentBus.mjs` EventEmitter fans one live event stream to every subscriber, which is what makes a browser and a desktop watching the same session both see identical streaming (requirement #2). Tools never touch a workspace directly — they dispatch through a single `Executor` interface with three implementations: **local** (a zero-dep `xipher-agent` CLI the user runs in their project, paired to their account, reachable over a hand-rolled WebSocket), **ssh** (backend spawns the system `ssh` client, ships the same agent bundle, runs it in `--stdio` JSON-RPC mode), and **ide-relay** (an authenticated desktop IDE registers its live session and its existing `AlaskaToolExecutor` runs the frames). Workspace-free tools (`web_search`/`web_fetch`/`open_browser`) run in a `ServerExecutor` on an egress-restricted namespace with IP-resolved SSRF blocking. The browser connects over one authenticated WebSocket carrying both the subscribe stream and inbound control frames (`user_message`/`cancel`/`approve_plan`/`tool_permission`), authenticated by a short-lived single-use ticket (never the session token in a URL) with an `Origin` allowlist on the upgrade. Persistent user memory is a separate `userId`-scoped store injected read-only into the system prompt. Regular (non-code) chat is the same loop bound to a no-workspace executor with tools disabled.

**A browser turn, end-to-end:** the web UI POSTs (authenticated, same-origin) to mint a single-use WS ticket → opens `wss://ide.xipher.pro/ide-api/agent/ws?ticket=…`, upgrade checks `Origin` + burns the ticket → client sends `{type:'user_message',content,model,agentMode,permissionMode}` → server resolves `userId` from the ticket (never the body), `agentStore.withSessionLock` takes the turn (409 if one is active), `siteAuthorize(userId,cost)` + `modelAllowed(plan,model)` gate the round-trip → `agentLoop` builds wire messages (server-pinned system prompt + recalled memory + history), calls `omniChatStream`, and publishes `reasoning`/`delta`/`tool_delta` frames to the bus → on a finalized `tool_call`, the server re-runs the command guard and permission-mode check server-side; in a headless run any mutating/egress tool **fails closed** and emits an approval event, awaiting a `tool_permission` frame bound to that `callId` → `resolveExecutor(session)` dispatches the RPC to the owning executor (ownership re-checked: `executor.userId===session.userId===caller`), which runs it inside OS confinement and streams progress → `tool_result` is persisted (`appendMessage`→`seq`) and appended to wire messages, `siteCharge` fires with a per-round-trip idempotency key → loop repeats until no tool calls, then `done`. Every frame reaches the desktop subscriber too, so the turn appears live in both places.

---

## 2. Security model

**Identity & isolation.** `userId` comes **only** from the verified transport — HMAC `verifyRequest` for desktop, a site-backend session-resolve (`POST /xapi/internal/session` guarded by `X-Internal-Secret`, using `users.mjs sessionUser`) for web — never from any request body. `agentStore` enforces `session.userId===userId` on every read/append/delete; a leaked `sessionId` is not a capability. The same rule governs executors (`executor.userId===callerUserId`), buses (`subscribe`/`publishControl` assert `userId===session.userId`), and the IDE-relay forward. Ownership is checked at **bind time** and re-checked at **every dispatch** — closing the M1 cross-user-executor hole.

**Executor confinement (the real boundary).** The command denylist (`evaluateRunCommandDenial` + `RUN_COMMAND_DENY_RULES`) and the string path-jail (`resolveSafe`) are kept only as fast UX filters — they are **not** trusted. Actual containment:
- The **local daemon** runs `run_command` in a restricted context: a dedicated low-privilege uid where available, cwd pinned to the project root, a **scrubbed environment** (drop `AWS_*`, `SSH_*`, `*_TOKEN`, cloud creds), no ambient network egress except an allowlist. The daemon's own bearer/HMAC/pairing secret is held out-of-band and **never** placed in any child env (fixes C3 exfil-of-own-creds).
- **File tools** enforce containment with `realpath`/`openat`+`O_NOFOLLOW` on the **final resolved** path immediately before the syscall, in one atomic sequence, for **every** FS op (write/patch/delete/read), verifying the realpath is still under the project root — closing the H3 symlink/TOCTOU gap. Identical code runs in the local daemon and the remote `--stdio` agent (single vendored `exec-guard.mjs`).
- **Headless fail-closed (C4).** In any non-interactive web run, all mutating tools (`write`/`patch`/`delete`/`run_command`) and all egress tools (`web_fetch`/`web_search`) require an explicit `tool_permission`/`approve_plan` control frame bound to the pending `callId`. There is **no** auto-approve allowlist by default. Once any untrusted content (a file read, a fetched page) enters the context, egress tools stay approval-gated (taint).
- The `ServerExecutor` (web tools) runs on an **egress-restricted network namespace**.

**SSRF (C2/M5).** `web_fetch`/`web_search` resolve the hostname themselves, check **every** resolved A/AAAA against the block set (loopback, link-local `169.254.0.0/16`, RFC1918, `127.0.0.1:8097`/`:8096`), and **pin the socket to the vetted IP** via a custom `lookup`/dispatcher, re-validating on **every redirect hop**. Non-http(s) schemes and IP-literal/decimal/octal encodings are rejected. Outbound URLs are capped and logged; even a perfect SSRF fix does not stop exfil to a public host, so egress remains approval-gated after taint (M5).

**Transport integrity (H2).** The HMAC checksum is extended to sign `SHA-256(body)` + a per-request **nonce** tracked server-side for the acceptance window; the window is shortened. The WS/executor HELLO handshake is bound to a **server-issued challenge nonce** so a captured handshake cannot be replayed.

**Browser WebSocket (H1).** Every `upgrade` enforces an `Origin` allowlist (mirroring site-backend `ALLOW_ORIGINS`). The browser authenticates with a **short-lived single-use ticket** minted by an authenticated same-origin POST — never the long-lived session token in the query string. Every inbound control frame is authorized to `userId===session.userId`; `approve_plan`/`tool_permission` are idempotent and bound to a specific pending `callId` so a racing second connection cannot approve another's prompt. Frame limits: unmasked client frames rejected, 4 MiB payload cap, per-user connection cap, PING/PONG heartbeat, backpressure (L3).

**Pairing & scoping (M2).** The local-daemon device-code flow's approval UI displays the daemon **hostname + exact project dir + a short verification phrase** and requires typed confirmation; approval is bound to the specific authenticated web session and the executor is scoped to that one project root. The admin-token approval fallback is **not** exposed to web users.

**SSH (H4/H5).** No TOFU for a code-exec channel: the user supplies/confirms and we **pin** the host fingerprint (no `accept-new`). The decrypted key is fed via `ssh-agent`/an fd or `mkstemp`+immediate-unlink, never left on disk. The remote bundle is staged in `mktemp -d` (0700) under the user's home, ownership-verified, exec'd with `O_NOFOLLOW`; missing remote `node` is a hard capability error (no raw-shell fallback). SSH creds are **AES-256-GCM** sealed. The **sealing key lives separately** from the sealed blobs and from the `auth.mjs` store; user HMAC/client secrets move to sealed/hashed form so the data dir alone is not full-impersonation material (H5).

**Loop-level.** Plan + credit gate on **every** round-trip (`siteAuthorize` + `modelAllowed` from the transport-resolved plan, never a body-supplied tier — M3); a mid-loop 429 injects `{error,code:'quota_exhausted'}` and stops. `withSessionLock` serializes one turn per session (M4). `siteCharge` carries a per-round-trip idempotency key for reconcile (L5). Sub-agent fan-out is depth- and parallel-capped as a **hard** server limit tied to `siteAuthorize` (L2). `req.on('close')`→`AbortController` tears down the loop, the omniroute stream, **and** any in-flight executor RPC (L1); xpcore's idle timeout must match `server.timeout=0`. Tool results are strictly data; the system prompt is pinned server-side (injection mitigation, acknowledged as non-enforceable at the model layer — confinement + approval are the actual controls).

---

## 3. Wire protocols

### 3.1 Browser ↔ ide-backend WebSocket

**Ticket mint (same-origin, authenticated):**
```
POST /ide-api/api/agent/ws-ticket        Authorization: Bearer <site-session-token>
→ { ticket, expiresInMs: 30000 }         # single-use, bound to userId, 30s TTL
```
**Upgrade:** `GET /ide-api/agent/ws?ticket=<t>` → server checks `Origin` ∈ allowlist, burns ticket, resolves `userId`. Reject (403) on bad origin / spent / expired ticket.

**Client → server frames** (masked, ≤4 MiB, JSON):
```
{ type:'subscribe',       sessionId, sinceSeq? }          # catch-up resync from seq
{ type:'user_message',    sessionId, content, model, agentMode, permissionMode, reasoningEffort }
{ type:'cancel',          sessionId }
{ type:'approve_plan',    sessionId, callId, approved:bool, plan? }
{ type:'tool_permission', sessionId, callId, allow:bool }
```
Every frame re-authorized to `userId===session.userId`; `approve_plan`/`tool_permission` idempotent per `callId`.

**Server → client frames** (superset of existing `chunkToFrames`, so the desktop parser at `alaskaChatService.ts:740` still works):
```
{ reasoning: str }
{ delta: str }
{ tool_delta:  { index, id, name, arguments } }
{ tool_call:   { id, name, arguments } }                  # finalized, about to run
{ activity:    { callId, name, status:'start'|'progress'|'awaiting_approval', label } }
{ tool_result: { callId, name, content, edit? } }
{ message:     { …persisted IThreadMessage, seq } }       # cross-client sync
{ turn:        { index, finish_reason, usage:{input,output} } }
{ done:        { finish_reason, usage, sessionId } }
{ error:       { message, code } }                        # e.g. quota_exhausted, executor_unavailable
```

### 3.2 Executor WebSocket handshake (daemon + IDE-relay)

Path `/ide-api/executor/ws`. Zero-dep RFC6455 on the `upgrade` event. `Origin` allowlist enforced.
```
Server → { type:'challenge', nonce }
Client → { type:'hello', executorId, kind:'local'|'ide', os, root, caps,
           sig: HMAC(secret, executorId + nonce + SHA256(hello-body)) }   # nonce-bound, no replay
Server → { type:'welcome', executorId } | { type:'error', code }
Heartbeat: PING/PONG; unmasked client frames rejected; 4 MiB cap; per-user conn cap.
```
Registry marks executor `online`, records `root/os/caps`.

### 3.3 Executor tool-call RPC (transport-neutral)

Sent over the daemon WS, the SSH `--stdio` pipe, or the ide-relay bus — identical shape:
```
request  { op:'readFile'|'writeFile'|'patch'|'deleteFile'|'grep'|'listDir'
              |'runCommand'|'terminalStart'|'terminalSend'|'terminalRead'
              |'terminalWait'|'terminalStop'|'terminalList',
           args, workspaceRef, callId, sessionId }
progress { callId, status:'progress', chunk }                  # streamed, optional
reply    { callId, ok, content, edit?:{ action, path, content?, find?, newSnippet? } }
                                                              # matches IAlaskaToolResult (alaskaTools.ts:37)
```
Before dispatch the server independently re-runs `evaluateRunCommandDenial` + jail mirror (defense-in-depth); the executor re-runs them locally too (single source `exec-guard.mjs`). Result content is treated strictly as data.

---

## 4. Data model

| Record | Store / file | Key | Fields |
|---|---|---|---|
| **Session** | `ide-backend/data/agent.json` `.sessions` (atomic tmp+rename, per `plans.mjs:49`) | `sessionId` | `id, userId, title, createdAt, updatedAt, model, agentMode, permissionMode, workspace:{kind:'local'\|'ssh'\|'ide', ref}, seq`. Workspace **immutable after create**; `ref` validated for ownership at bind. |
| **Message** | `data/agent.json` `.messages` | `sessionId → [msg]` | `id, seq, role:'user'\|'assistant'\|'tool'\|'system'\|'error', content, tool_calls?, tool_call_id?, model?, usage?:{input,output}, credits?, ts` — IThreadMessage-compatible (`alaskaChatService.ts:36`). Per-session monotonic `seq` drives `messagesSince` catch-up. |
| **Executor** | `ide-backend/data/executors.json` (**separate** from `auth.mjs` store) | `executorId` | `id, userId, kind, name, root, os, caps, status, lastSeen, fingerprint?` (SSH host-key pin). Owned by exactly one `userId`. |
| **SSH secret** | `data/executors.json` `.sealed` | `executorId` | AES-256-GCM `{iv, tag, ciphertext}`; **sealing key stored separately** (distinct file / KMS), per-user derived subkey. Plaintext never returned to any client. |
| **WS ticket** | in-memory (TTL map) | `ticket` | `userId, sessionId?, expiresAt, spent` — single-use, 30 s. |
| **Nonce ledger** | in-memory (window map) | `nonce` | seen-nonces for HMAC replay defense within the acceptance window. |
| **User memory** | `ide-backend/data/memory.json` | `userId → [fact]` | `{ id, text, source, createdAt, updatedAt }`, `userId`-scoped; injected read-only into the system prompt. |
| **Credit ledger** | *unchanged* — authoritative on site-backend via `siteAuthorize`/`siteCharge` | — | Not duplicated; `plans.mjs` remains offline fallback. Round-trip idempotency key added. |
| **Web session resolve** | *unchanged* — site-backend `users.mjs sessionUser(token)` | — | New internal route `POST /xapi/internal/session`. |

---

## 5. File-level plan

### agent-core (ide-backend)
| Path | Purpose |
|---|---|
| `ide-backend/translate.mjs` | **New.** Extract `toOpenAIMessages`/`buildOpenAIBody`/`chunkToFrames` from `server.mjs:64-116`; shared by `handleChat` + `agentLoop` (parity proof). |
| `ide-backend/agentLoop.mjs` | **New.** Server port of `submit()` turn-loop; per-round `siteAuthorize`/`modelAllowed`/`siteCharge`(idempotent); tool dispatch through Executor with server-side guard + permission-mode + headless fail-closed; sub-agent caps; announce_plan/`ask` approval round-trip; empty/truncation retries; `/goal` continuation; emits to bus. |
| `ide-backend/agentStore.mjs` | **New.** `userId`-scoped session/message store, atomic writes, `seq`, `withSessionLock`, `messagesSince`. |
| `ide-backend/agentBus.mjs` | **New.** Per-session EventEmitter, ownership-checked `subscribe`/`publishControl`. |
| `ide-backend/agentTools.mjs` | **New.** Verbatim JSON port of `TOOL_DEFINITIONS`; `toolsForMode`; imports guards from `exec-guard.mjs`. |
| `ide-backend/agentPrompt.mjs` | **New.** Port of `buildPayload` prompts (`TOOL_USAGE_CONTRACT` + `buildModePrompt` + goal harness) with a memory-injection slot. |
| `ide-backend/memory.mjs` | **New.** `userId`-scoped fact store; `recall(userId)`→memory block; `remember`/`forget`. |
| `ide-backend/server.mjs` | **Edit.** Add `/api/agent/*` routes + `/agent/ws-ticket`; `resolveWebUser(bearer)`; extend HMAC checksum to cover body+nonce; import `translate.mjs`; keep `server.timeout=0`. |

### executors (ide-backend + agent package)
| Path | Purpose |
|---|---|
| `ide-backend/executors.mjs` | **New.** Executor abstraction + registry + authz (`dispatch` hard-checks `executor.userId===callerUserId` + session binding + server-side guard re-run); pair-init/poll/approve; `sealSecret`/`openSecret` (separate key). |
| `ide-backend/executor-ws.mjs` | **New.** RFC6455 upgrade handler on `/ide-api/executor/ws`; `Origin` allowlist; nonce-bound HELLO; heartbeat, frame caps, backpressure, per-user conn cap. |
| `ide-backend/executor-ssh.mjs` | **New.** System `ssh` ControlMaster; pinned host key (no TOFU); key via agent/fd or unlink; bundle to `mktemp -d` 0700, `O_NOFOLLOW`, `node --stdio`; cleanup. |
| `ide-backend/exec-guard.mjs` | **New.** Zero-dep port of deny-rules + `isReadOnlyRunCommand` + realpath/`O_NOFOLLOW` containment; **single source**, vendored into the CLI at build. |
| `ide-backend/serverExecutor.mjs` | **New.** `web_search`/`web_fetch` (IP-resolved SSRF + socket pinning + redirect re-check) / `open_browser` passthrough; egress-restricted namespace. |
| `ide-backend/web.mjs` | **Edit.** Replace string `isBlockedHost` with resolve-all-A/AAAA + pinned-IP `lookup`; per-hop redirect re-validation; scheme/encoding rejection. |
| `ide-backend/auth.mjs` | **Edit.** Body+nonce in `signChecksum`/`verifyRequest`; shorten window; move user secrets to sealed/hashed form. |
| `xipher-agent/bin/xipher-agent.mjs` | **New.** Zero-dep CLI: device-code pair; WS to backend; execute TOOL_CALL only in project root with vendored `exec-guard`; confined `run_command` (scrubbed env, pinned cwd, low-priv). |
| `xipher-agent/lib/rpc.mjs`, `lib/exec-guard.mjs`, `package.json` | **New.** `--stdio` JSON-RPC mode (SSH reuse) + vendored guard + zero-dep manifest. |

### site-backend
| Path | Purpose |
|---|---|
| `site-backend/server.mjs` | **Edit.** `POST /xapi/internal/session` (guarded by `X-Internal-Secret`, mirrors `handleInternalAuthorize`) → `{userId}`. |
| `site-backend/users.mjs` | **Edit (if needed).** Export `sessionUser(token)` for the internal route. |

### web-studio (browser UI)
| Path | Purpose |
|---|---|
| `web-studio/src/pages/Code.tsx` | **New.** Session list + open. |
| `web-studio/src/pages/CodeSession.tsx` | **New.** Chat view: streaming text, tool activity, model picker, approval prompts. |
| `web-studio/src/pages/Chat.tsx` | **New.** Regular (no-workspace) chat + memory surface. |
| `web-studio/src/pages/Executors.tsx` | **New.** Pair daemon (hostname+dir+phrase confirm), add/pin SSH host, list/revoke. |
| `web-studio/src/lib/agentWs.ts` | **New.** Ticket mint → WS client, subscribe/`sinceSeq` resync, control frames. |
| `web-studio/src/lib/api.ts` | **Edit.** `/ide-api/api/agent/*` typed calls. |
| `web-studio/src/App.tsx`, `styles.css` | **Edit.** Hash routes `#/code`, `#/chat`, `#/executors`. |

### IDE-relay (desktop, minimal)
| Path | Purpose |
|---|---|
| `xipher-ide/.../alaskaChatViewPane.ts` | **Edit.** On session open, register session as an executor over `/ide-api/executor/ws` (nonce HELLO) and route inbound TOOL_CALL frames into existing `AlaskaToolExecutor`; publish local turn events to the shared bus (requirement #2). |

---

## 6. Phased rollout

Each phase is independently shippable. Security controls that gate a phase's surface ship **with** that phase, not later.

**Phase 1 — The spine (web → server agent-core → echo executor → streamed back).**
Ship: `translate.mjs` (extract, prove parity in `handleChat`), `agentStore.mjs`, `agentBus.mjs`, `agentPrompt.mjs`, `agentTools.mjs`, `exec-guard.mjs` (guard functions only), `agentLoop.mjs`, `serverExecutor.mjs` (web tools + a built-in **EchoExecutor** for workspace tools), `server.mjs` routes + `ws-ticket` + `resolveWebUser`, the `site-backend` internal route, `agentWs.ts`, `Code.tsx`/`CodeSession.tsx`. Security in-phase: transport-only `userId`, `agentStore` ownership checks, `Origin` allowlist, single-use WS ticket, per-frame authz, `withSessionLock`, per-round credit/model gate, **SSRF fix in `web.mjs`** (web tools are live from day one). **Proves:** a browser user picks a model, sends a message, and sees streaming text + tool activity end-to-end with real isolation and billing. *Depends on: nothing.*

**Phase 2 — Real executors (local daemon + SSH).**
Ship: `executors.mjs` (registry + authz + pairing + seal/open), `executor-ws.mjs` (RFC6455 + nonce HELLO + limits), `xipher-agent` CLI (pair + WS + confined `run_command` + realpath containment), `executor-ssh.mjs` (pinned host key, key-via-agent, `mktemp -d` bundle), `Executors.tsx`. Security in-phase: OS confinement (C1/C3), realpath/`O_NOFOLLOW` FS containment (H3), headless fail-closed approval (C4), pairing UI verification (M2), separate sealing key (H5), HMAC body+nonce (H2). **Proves:** the agent does real work in a real local/remote project. *Depends on: Phase 1 (Executor interface, dispatch, bus).*

**Phase 3 — IDE live-sync (requirement #2).**
Ship: desktop registers its session as an `ide`-kind executor over the same WS; `IdeRelayExecutor` forwards frames onto that user's own bus; desktop publishes its local turn events so the browser mirrors them, and browser control frames reach the desktop. Security in-phase: ownership at bind + every dispatch (M1), executor-unavailable fallback instead of hang. **Proves:** a message from web appears in the active desktop IDE and vice-versa, streaming both ways. *Depends on: Phase 1 (bus) + Phase 2 (executor registry/WS).*

**Phase 4 — Memory + regular chat.**
Ship: `memory.mjs` (userId-scoped facts, recall/remember/forget), injection slot wired in `agentPrompt.mjs`, `Chat.tsx` (no-workspace executor, tools disabled), memory surfacing in the UI. Security in-phase: memory store `userId`-scoped, injected read-only (never model-writable without an explicit `remember` tool that is itself approval/allowlist-bound). **Proves:** a persistent-memory regular chat that recalls user facts across sessions. *Depends on: Phase 1 (loop + prompt builder).*

**Phase 5 — Polish & hardening.**
Ship: `siteCharge` idempotency reconcile (L5), sub-agent hard caps tied to `siteAuthorize` (L2), `agent.json` per-session compaction/pruning (L4), full teardown chain on `req.close`/tab-close incl. executor RPC abort + xpcore idle-timeout alignment (L1), WS frame-limit/connection-cap tuning (L3), audit logging of egress URLs + approval decisions, `siteCharge` outage handling. *Depends on: all prior phases (this hardens their surfaces).*

---

**Key files referenced (absolute):** `/home/alex/Документы/Xipher/IDE/ide-backend/server.mjs`, `.../ide-backend/auth.mjs`, `.../ide-backend/web.mjs`, `.../ide-backend/plans.mjs`, `/home/alex/Документы/Xipher/IDE/xipher-ide/src/vs/workbench/contrib/alaskaChat/browser/alaskaChatViewPane.ts`, `.../alaskaChat/browser/alaskaTools.ts`, `.../alaskaChat/browser/alaskaChatService.ts`, `/home/alex/Документы/Xipher/IDE/site-backend/server.mjs`, `.../site-backend/users.mjs`, `/home/alex/Документы/Xipher/IDE/web-studio/src/lib/api.ts`, `.../web-studio/src/lib/auth.tsx`. New files to create are listed with absolute-path stems under the same three repo roots in §5.