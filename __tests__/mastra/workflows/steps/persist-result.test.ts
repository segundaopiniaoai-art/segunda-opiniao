import { persistResult } from '@/mastra/workflows/steps/persist-result'

const mockUpdate = jest.fn()
const mockEq = jest.fn()
const mockFrom = jest.fn()

jest.mock('@/mastra/lib/supabase-admin', () => ({
  supabaseAdmin: {
    from: (...args: unknown[]) => mockFrom(...args),
  },
}))

const mockMarkFailed = jest.fn()
jest.mock('@/mastra/lib/mark-failed', () => ({
  markConsultationFailed: (...args: unknown[]) => mockMarkFailed(...args),
}))

const minimalResult = {
  summary: 'ok',
  findings: [],
  assessment: 'ok',
  recommendations: [],
  questionsForDoctor: [],
  redFlags: [],
  confidence: 'medium' as const,
  disclaimer: 'aviso',
}

const STUB_PROMPT_VERSION_ID = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee'

const baseInput = {
  consultationId: 'consultation-42',
  result: minimalResult,
  usage: { inputTokens: 12_430, outputTokens: 1_892 },
  costUsd: 0.06567,
  promptVersionId: STUB_PROMPT_VERSION_ID,
}

const execute = (input: Record<string, unknown>) =>
  persistResult.execute({ inputData: input } as Parameters<typeof persistResult.execute>[0])

describe('persistResult step', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockEq.mockResolvedValue({ error: null })
    mockUpdate.mockReturnValue({ eq: mockEq })
    mockFrom.mockReturnValue({ update: mockUpdate })
  })

  it('writes result, status, tokens, and cost in a single update', async () => {
    const out = await execute(baseInput)

    expect(mockFrom).toHaveBeenCalledWith('consultations')
    expect(mockUpdate).toHaveBeenCalledWith({
      status: 'completed',
      result: minimalResult,
      input_tokens: 12_430,
      output_tokens: 1_892,
      cost_usd: 0.06567,
      prompt_version_id: STUB_PROMPT_VERSION_ID,
    })
    expect(mockEq).toHaveBeenCalledWith('id', 'consultation-42')
    expect(out).toEqual({ status: 'completed' })
  })

  it('marks failed and rethrows when supabase returns an error', async () => {
    mockEq.mockResolvedValue({ error: new Error('db down') })

    await expect(execute(baseInput)).rejects.toThrow('db down')
    expect(mockMarkFailed).toHaveBeenCalledTimes(1)
    expect(mockMarkFailed).toHaveBeenCalledWith(
      'consultation-42',
      'Falha ao salvar o resultado.',
    )
  })
})
