export type ModelPricing = {
  inputPerMTok: number  // USD per 1M input tokens
  outputPerMTok: number // USD per 1M output tokens
}

// Source: anthropic.com/pricing (snapshot 2026-04-28).
// Update this table when Anthropic publishes new pricing; cost snapshots
// already stored on consultations remain unchanged.
export const MODEL_PRICING: Record<string, ModelPricing> = {
  'claude-sonnet-4-6': { inputPerMTok: 3.0, outputPerMTok: 15.0 },
}

export type Usage = {
  inputTokens: number
  outputTokens: number
}

export function calculateCostUsd(model: string, usage: Usage): number {
  const pricing = MODEL_PRICING[model]
  if (!pricing) {
    throw new Error(`Pricing not configured for model: ${model}`)
  }
  const cost =
    (usage.inputTokens / 1_000_000) * pricing.inputPerMTok +
    (usage.outputTokens / 1_000_000) * pricing.outputPerMTok
  return Math.round(cost * 1_000_000) / 1_000_000
}

export function formatCostUsd(cost: number): string {
  return `$${cost.toFixed(4)}`
}
