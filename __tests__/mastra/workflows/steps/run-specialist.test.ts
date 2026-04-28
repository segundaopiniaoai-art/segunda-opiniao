import { runSpecialist } from '@/mastra/workflows/steps/run-specialist'
import { consultationResultSchema } from '@/mastra/schemas/consultation-result'

// Mock the agents registry
const mockGenerate = jest.fn()
jest.mock('@/mastra/agents', () => ({
  agentsByKey: {
    cardiology: { generate: (...args: unknown[]) => mockGenerate(...args) },
  },
}))

// Mock the failure helper
const mockMarkFailed = jest.fn()
jest.mock('@/mastra/lib/mark-failed', () => ({
  markConsultationFailed: (...args: unknown[]) => mockMarkFailed(...args),
}))

// Mock supabaseAdmin for prompt version lookup
const STUB_PROMPT_VERSION_ID = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee'
const mockSingle = jest.fn()
jest.mock('@/mastra/lib/supabase-admin', () => ({
  supabaseAdmin: {
    from: jest.fn().mockReturnValue({
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: (...args: unknown[]) => mockSingle(...args),
    }),
  },
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

const baseInput = {
  consultationId: 'consultation-1',
  agentKey: 'cardiology',
  patientContext: null,
  files: [
    { file_name: 'exam1.pdf', pdfBytes: new Uint8Array([1, 2, 3]) },
    { file_name: 'exam2.pdf', pdfBytes: new Uint8Array([4, 5, 6]) },
  ],
}

// The step's execute only uses inputData; cast to satisfy the broader ExecuteFunctionParams type.
const execute = (input: Record<string, unknown>) =>
  runSpecialist.execute({ inputData: input } as Parameters<typeof runSpecialist.execute>[0])

describe('runSpecialist step', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockSingle.mockResolvedValue({
      data: { current_prompt_version_id: STUB_PROMPT_VERSION_ID },
      error: null,
    })
  })

  it('builds messages with one file part per PDF plus a final text part', async () => {
    mockGenerate.mockResolvedValue({ object: minimalResult, usage: { inputTokens: 100, outputTokens: 50 } })

    await execute(baseInput)

    expect(mockGenerate).toHaveBeenCalledTimes(1)
    const [messages] = mockGenerate.mock.calls[0]
    expect(messages).toHaveLength(1)
    const content = messages[0].content
    expect(content).toHaveLength(3)
    expect(content[0]).toEqual({
      type: 'file',
      mimeType: 'application/pdf',
      data: new Uint8Array([1, 2, 3]),
    })
    expect(content[1]).toEqual({
      type: 'file',
      mimeType: 'application/pdf',
      data: new Uint8Array([4, 5, 6]),
    })
    expect(content[2].type).toBe('text')
  })

  it('uses patient context in the text part when patientContext is non-null', async () => {
    mockGenerate.mockResolvedValue({ object: minimalResult, usage: { inputTokens: 100, outputTokens: 50 } })
    const input = { ...baseInput, patientContext: 'tenho falta de ar' }

    await execute(input)

    const [messages] = mockGenerate.mock.calls[0]
    const textPart = messages[0].content[messages[0].content.length - 1]
    expect(textPart.text).toBe(
      'Contexto do paciente:\ntenho falta de ar\n\nAnalise os exames acima e gere uma segunda opinião.'
    )
  })

  it('uses the default text part when patientContext is null', async () => {
    mockGenerate.mockResolvedValue({ object: minimalResult, usage: { inputTokens: 100, outputTokens: 50 } })

    await execute(baseInput)

    const [messages] = mockGenerate.mock.calls[0]
    const textPart = messages[0].content[messages[0].content.length - 1]
    expect(textPart.text).toBe('Analise os exames acima e gere uma segunda opinião.')
  })

  it('calls agent.generate with structuredOutput and returns wrapped result with usage and cost', async () => {
    mockGenerate.mockResolvedValue({
      object: minimalResult,
      usage: { inputTokens: 12_430, outputTokens: 1_892 },
    })

    const result = await execute(baseInput)

    const [, options] = mockGenerate.mock.calls[0]
    expect(options).toEqual({ structuredOutput: { schema: consultationResultSchema } })
    expect(result).toEqual({
      consultationId: 'consultation-1',
      result: minimalResult,
      usage: { inputTokens: 12_430, outputTokens: 1_892 },
      // 12430 * 3 / 1e6 + 1892 * 15 / 1e6 = 0.03729 + 0.02838 = 0.06567
      costUsd: 0.06567,
      promptVersionId: STUB_PROMPT_VERSION_ID,
    })
  })

  it('falls back to promptTokens/completionTokens when only legacy field names are present', async () => {
    mockGenerate.mockResolvedValue({
      object: minimalResult,
      usage: { promptTokens: 1000, completionTokens: 500 },
    })

    const result = await execute(baseInput)

    expect(result.usage).toEqual({ inputTokens: 1000, outputTokens: 500 })
    // 1000 * 3 / 1e6 + 500 * 15 / 1e6 = 0.003 + 0.0075 = 0.0105
    expect(result.costUsd).toBe(0.0105)
  })

  it('defaults usage to zero when SDK returns no usage object', async () => {
    mockGenerate.mockResolvedValue({ object: minimalResult })

    const result = await execute(baseInput)

    expect(result.usage).toEqual({ inputTokens: 0, outputTokens: 0 })
    expect(result.costUsd).toBe(0)
  })

  it('throws and marks failed when agentKey is unknown', async () => {
    const input = { ...baseInput, agentKey: 'unknown' }

    await expect(execute(input)).rejects.toThrow(
      'Agent não encontrado: unknown'
    )
    expect(mockMarkFailed).toHaveBeenCalledWith(
      'consultation-1',
      'Não conseguimos analisar seus exames. Tente novamente.'
    )
  })

  it('throws and marks failed when agent.generate rejects', async () => {
    mockGenerate.mockRejectedValue(new Error('boom'))

    await expect(execute(baseInput)).rejects.toThrow('boom')
    expect(mockMarkFailed).toHaveBeenCalledWith(
      'consultation-1',
      'Não conseguimos analisar seus exames. Tente novamente.'
    )
  })
})
