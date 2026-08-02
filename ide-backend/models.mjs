// Model branding layer.
// Public model IDs hide the routing source (no `web/`, no provider prefix) and
// carry a credit multiplier + minimum tier. `provider` is the model FAMILY
// brand (DeepSeek / Qwen / ...), NOT the upstream source.

import { modelAllowed, planOf } from './plans.mjs';

// publicId -> { omni, label, provider, ctx, reasoning, vision, mult, minTier }
//
// EVERY model here is verified tool-calling capable (real agent). Providers that
// silently ignore tools or drop the system role (claude-web, kimi-web, zenmux-free)
// are excluded — they cannot read/edit files, so they are not usable in the IDE.
export const MODEL_MAP = {
	// FREE — plentiful web agent models, cheap multipliers
	'deepseek-v4-flash':      { omni: 'deepseek-web/deepseek-v4-flash',          label: 'DeepSeek V4 Flash',        provider: 'DeepSeek', ctx: 131072, reasoning: false, mult: 0.5, minTier: 'free' },
	'deepseek-v4-flash-think':{ omni: 'deepseek-web/deepseek-v4-flash-think',    label: 'DeepSeek V4 Flash (Think)',provider: 'DeepSeek', ctx: 131072, reasoning: true,  mult: 0.6, minTier: 'free' },
	'qwen3.6-plus':           { omni: 'qwen-web/qwen3.6-plus',                   label: 'Qwen3.6 Plus',             provider: 'Qwen',     ctx: 131072, reasoning: false, mult: 0.8, minTier: 'free' },

	// PRO — stronger agent models (web + Kiro API accounts)
	'qwen3.7-plus':           { omni: 'qwen-web/qwen3.7-plus',                   label: 'Qwen3.7 Plus',             provider: 'Qwen',     ctx: 131072, reasoning: false, mult: 1.2, minTier: 'pro' },
	'qwen3.7-max':            { omni: 'qwen-web/qwen3.7-max',                    label: 'Qwen3.7 Max',              provider: 'Qwen',     ctx: 262144, reasoning: false, mult: 1.5, minTier: 'pro' },
	'deepseek-v4-pro':        { omni: 'deepseek-web/deepseek-v4-pro',            label: 'DeepSeek V4 Pro',          provider: 'DeepSeek', ctx: 131072, reasoning: false, mult: 1.3, minTier: 'pro' },
	'deepseek-v4-pro-think':  { omni: 'deepseek-web/deepseek-v4-pro-think',      label: 'DeepSeek V4 Pro (Think)',  provider: 'DeepSeek', ctx: 131072, reasoning: true,  mult: 1.5, minTier: 'pro' },
	'deepseek-3.2':           { omni: 'kiro/deepseek-3.2',                       label: 'DeepSeek 3.2',             provider: 'DeepSeek', ctx: 131072, reasoning: false, mult: 1.0, minTier: 'pro' },
	'qwen3-coder':            { omni: 'kiro/qwen3-coder-next',                   label: 'Qwen3 Coder',              provider: 'Qwen',     ctx: 262144, reasoning: false, mult: 1.0, minTier: 'pro' },
	'glm-5':                  { omni: 'kiro/glm-5',                              label: 'GLM 5',                    provider: 'GLM',      ctx: 200000, reasoning: false, mult: 1.2, minTier: 'pro' },
	'minimax-m2.1':           { omni: 'kiro/minimax-m2.1',                       label: 'MiniMax M2.1',             provider: 'MiniMax',  ctx: 204800, reasoning: false, mult: 1.1, minTier: 'pro' },
	'minimax-m2.5':           { omni: 'kiro/minimax-m2.5',                       label: 'MiniMax M2.5',             provider: 'MiniMax',  ctx: 204800, reasoning: false, mult: 1.3, minTier: 'pro' },
	// Claude — routed through OmniRoute's agentrouter/* provider (AgentRouter, a
	// Claude-subscription proxy). Switched off the direct claude/* Anthropic path
	// after those accounts died. agentrouter serves only the 4.x Opus line, and only
	// opus-4-8 / opus-4-6 are reliably live (opus-4-7 + haiku time out), so every
	// public id below collapses onto those two: premium/5-series → opus-4-8,
	// lower tier → opus-4-6. Labels/tiers/multipliers are kept as the user-facing brand.
	'claude-opus-5':          { omni: 'agentrouter/claude-opus-4-8',             label: 'Claude Opus 5',            provider: 'Claude',   ctx: 1000000, reasoning: false, mult: 3.0, minTier: 'pro' },
	'claude-sonnet-5':        { omni: 'agentrouter/claude-opus-4-8',             label: 'Claude Sonnet 5',          provider: 'Claude',   ctx: 1000000, reasoning: false, mult: 2.0, minTier: 'pro' },
	'claude-fable-5':         { omni: 'agentrouter/claude-opus-4-8',             label: 'Claude Fable 5',           provider: 'Claude',   ctx: 1000000, reasoning: false, mult: 4.0, minTier: 'pro' },
	'claude-opus-4-8':        { omni: 'agentrouter/claude-opus-4-8',             label: 'Claude Opus 4.8',          provider: 'Claude',   ctx: 1000000, reasoning: false, mult: 2.8, minTier: 'pro' },
	'claude-opus-4-7':        { omni: 'agentrouter/claude-opus-4-8',             label: 'Claude Opus 4.7',          provider: 'Claude',   ctx: 1000000, reasoning: false, mult: 2.5, minTier: 'pro' },
	'claude-opus-4-6':        { omni: 'agentrouter/claude-opus-4-6',             label: 'Claude Opus 4.6',          provider: 'Claude',   ctx: 1000000, reasoning: false, mult: 2.2, minTier: 'pro' },
	'claude-sonnet-4-6':      { omni: 'agentrouter/claude-opus-4-6',             label: 'Claude Sonnet 4.6',        provider: 'Claude',   ctx: 1000000, reasoning: false, mult: 2.0, minTier: 'pro' },
	'claude-sonnet-4-5':      { omni: 'agentrouter/claude-opus-4-6',             label: 'Claude Sonnet 4.5',        provider: 'Claude',   ctx: 1000000, reasoning: false, mult: 2.0, minTier: 'pro' },
	'claude-haiku-4-5':       { omni: 'agentrouter/claude-opus-4-6',             label: 'Claude Haiku 4.5',         provider: 'Claude',   ctx: 1000000, reasoning: false, mult: 1.0, minTier: 'pro' },
};

export const DEFAULT_MODEL = 'deepseek-v4-flash';

export function resolveOmniId(publicId) {
	if (publicId && MODEL_MAP[publicId]) return MODEL_MAP[publicId].omni;
	return MODEL_MAP[DEFAULT_MODEL].omni;
}

export function modelMultiplier(publicId) {
	return (publicId && MODEL_MAP[publicId] && MODEL_MAP[publicId].mult) || 1;
}

// Build the /api/ai/models response, gated + annotated for the user's plan.
export function buildModelsResponse(planId = 'free') {
	const plan = planOf(planId);
	const items = Object.entries(MODEL_MAP).map(([id, m]) => {
		const allowed = modelAllowed(plan.id, m);
		return {
			id,
			label: m.label,
			provider: m.provider,
			description: '',
			context_tokens: m.ctx,
			requires_plan: m.minTier || 'free',
			supports_reasoning_effort: !!m.reasoning,
			supports_vision: !!m.vision,
			credit_multiplier: m.mult,
			locked: !allowed,
		};
	});
	return { items, plan: plan.id, plan_label: plan.label };
}
