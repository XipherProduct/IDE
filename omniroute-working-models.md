# OmniRoute — рабочие модели

**Проверено:** 2026-07-17 · **Где:** `ide.xipher.pro/admin/provider` (OmniRoute на проде, IP сервера `82.97.245.247`)
**Метод:** живой `POST /v1/chat/completions` (`max_tokens:1`) по каждой модели каталога (1084 реальных) · рабочих: **27 ID → 18 уникальных** (алиасы `ds-web/`, `zmf/`, `no-think/` схлопнуты)

> ⚠️ Список актуален для запросов **с IP сервера**. Много провайдеров режут дата-центровый IP — с резидентным прокси/донастройкой кредов рабочих станет больше. Перегнать тест: `ssh xipher 'python3 /root/omni-modeltest.py'` → результат в `/root/omni-modeltest.jsonl`.

## ✅ Рабочие — одной строкой

```
agentrouter/claude-opus-4-6, deepseek-web/deepseek-v4-flash, deepseek-web/deepseek-v4-flash-search, deepseek-web/deepseek-v4-flash-think, deepseek-web/deepseek-v4-flash-think-search, deepseek-web/deepseek-v4-pro, deepseek-web/deepseek-v4-pro-search, deepseek-web/deepseek-v4-pro-think, deepseek-web/deepseek-v4-pro-think-search, kimi-web/k2d6, kimi-web/k3, qwen-web/qwen3.6-plus, qwen-web/qwen3.7-max, qwen-web/qwen3.7-plus, zenmux-free/deepseek/deepseek-chat, zenmux-free/deepseek/deepseek-reasoner, zenmux-free/deepseek/deepseek-v4-pro, zenmux-free/z-ai/glm-4.7-flash-free
```

## ✅ Рабочие — по провайдерам

### deepseek-web (8)  *(алиас: `ds-web/…`)*
- `deepseek-web/deepseek-v4-flash`
- `deepseek-web/deepseek-v4-flash-search`
- `deepseek-web/deepseek-v4-flash-think`
- `deepseek-web/deepseek-v4-flash-think-search`
- `deepseek-web/deepseek-v4-pro`
- `deepseek-web/deepseek-v4-pro-search`
- `deepseek-web/deepseek-v4-pro-think`
- `deepseek-web/deepseek-v4-pro-think-search`

### zenmux-free (4)  *(алиас: `zmf/…`)*
- `zenmux-free/deepseek/deepseek-chat`
- `zenmux-free/deepseek/deepseek-reasoner`
- `zenmux-free/deepseek/deepseek-v4-pro`
- `zenmux-free/z-ai/glm-4.7-flash-free`

### qwen-web (3)
- `qwen-web/qwen3.6-plus`
- `qwen-web/qwen3.7-max`
- `qwen-web/qwen3.7-plus`

### kimi-web (2)
- `kimi-web/k2d6`
- `kimi-web/k3`

### agentrouter (1)  *(есть вариант `no-think/agentrouter/claude-opus-4-6`)*
- `agentrouter/claude-opus-4-6`

## ❌ Провайдеры, которые НЕ отдали ни одной модели — и почему

| Провайдер | Моделей | Код | Причина / что делать |
|---|---:|---|---|
| api-airforce | 432 | 403 | Cloudflare режет IP сервера → нужен резидентный прокси |
| zenmux | 304 | 403 | «no permission» — ключу нужен доступ/баланс |
| lmarena | 129 | 404 | «No active credentials» — не залогинен |
| t3-web | 46 | 400 | Вставить полный Cookie-заголовок t3.chat |
| theoldllm | 26 | 403 | Forbidden — блок IP |
| huggingchat | 24 | 502 | Апстрим/сессия |
| agy ×3 | 17 | 422 | «Missing Google projectId» (Antigravity) |
| auggie | 15 | 502 | Нет `auggie` CLI на сервере (+ `auggie login`) |
| zai-web | 6 | 404 | Not Found |
| opencode | 6 | 403 | Блок IP |
| duckduckgo-web | 6 | 429/418 | Rate-limit + анти-абуз (временное) |
| veoaifree-web | 6 | timeout | Видео-ген, не chat |
| grok-cli | 4 | 401 | Токен протух — перелогиниться |
| chipotle / mimocode / pepper | 3 | 502 | Апстрим/пустой ответ |

**Провайдеры с валидным коннектом (connection-test):** zenmux, zenmux-free, api-airforce, t3-web, huggingchat, kimi-web, deepseek-web, lmarena, github, agentrouter, zai-web, qwen-web (12/16). `agy`×3 и `grok-cli` — connection-test не поддерживают.
