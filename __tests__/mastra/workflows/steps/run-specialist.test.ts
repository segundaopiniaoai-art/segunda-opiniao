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
  })

  it('builds messages with one file part per PDF plus a final text part', async () => {
    mockGenerate.mockResolvedValue({ object: minimalResult })

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
    mockGenerate.mockResolvedValue({ object: minimalResult })
    const input = { ...baseInput, patientContext: 'tenho falta de ar' }

    await execute(input)

    const [messages] = mockGenerate.mock.calls[0]
    const textPart = messages[0].content[messages[0].content.length - 1]
    expect(textPart.text).toBe(
      'Contexto do paciente:\ntenho falta de ar\n\nAnalise os exames acima e gere uma segunda opinião.'
    )
  })

  it('uses the default text part when patientContext is null', async () => {
    mockGenerate.mockResolvedValue({ object: minimalResult })

    await execute(baseInput)

    const [messages] = mockGenerate.mock.calls[0]
    const textPart = messages[0].content[messages[0].content.length - 1]
    expect(textPart.text).toBe('Analise os exames acima e gere uma segunda opinião.')
  })

  it('calls agent.generate with output: consultationResultSchema and returns wrapped result', async () => {
    mockGenerate.mockResolvedValue({ object: minimalResult })

    const result = await execute(baseInput)

    const [, options] = mockGenerate.mock.calls[0]
    expect(options).toEqual({ structuredOutput: { schema: consultationResultSchema } })
    expect(result).toEqual({ consultationId: 'consultation-1', result: minimalResult })
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
