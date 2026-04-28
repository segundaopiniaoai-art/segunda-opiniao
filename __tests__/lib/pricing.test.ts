import { calculateCostUsd, formatCostUsd, MODEL_PRICING } from '@/lib/pricing'

describe('MODEL_PRICING', () => {
  it('contains claude-sonnet-4-6 with non-zero rates', () => {
    expect(MODEL_PRICING['claude-sonnet-4-6']).toEqual({
      inputPerMTok: 3.0,
      outputPerMTok: 15.0,
    })
  })
})

describe('calculateCostUsd', () => {
  it('costs 18 USD for 1M input + 1M output on sonnet-4-6', () => {
    const cost = calculateCostUsd('claude-sonnet-4-6', {
      inputTokens: 1_000_000,
      outputTokens: 1_000_000,
    })
    expect(cost).toBe(18)
  })

  it('returns 0 when both token counts are 0', () => {
    expect(calculateCostUsd('claude-sonnet-4-6', { inputTokens: 0, outputTokens: 0 })).toBe(0)
  })

  it('rounds to 6 decimals', () => {
    // 1 input + 1 output = 3/1e6 + 15/1e6 = 0.000018 — exactly representable
    const cost = calculateCostUsd('claude-sonnet-4-6', { inputTokens: 1, outputTokens: 1 })
    expect(cost).toBe(0.000018)
  })

  it('throws on unknown model', () => {
    expect(() =>
      calculateCostUsd('unknown-model-x', { inputTokens: 1, outputTokens: 1 }),
    ).toThrow('Pricing not configured for model: unknown-model-x')
  })
})

describe('formatCostUsd', () => {
  it('formats with $ prefix and 4 decimals', () => {
    expect(formatCostUsd(0.0123456)).toBe('$0.0123')
  })

  it('formats zero as $0.0000', () => {
    expect(formatCostUsd(0)).toBe('$0.0000')
  })
})
