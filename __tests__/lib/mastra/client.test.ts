import { startConsultationWorkflow } from '@/lib/mastra/client'

const fetchMock = jest.fn()
global.fetch = fetchMock as unknown as typeof fetch

beforeEach(() => {
  jest.clearAllMocks()
  process.env.MASTRA_URL = 'https://mastra.test'
  process.env.MASTRA_API_KEY = 'test-key'
})

describe('startConsultationWorkflow', () => {
  it('posts consultationId with bearer auth', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ runId: 'run-1' }),
    })
    const out = await startConsultationWorkflow('cid-1')
    expect(fetchMock).toHaveBeenCalledWith(
      'https://mastra.test/api/workflows/consultationWorkflow/start-async',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          Authorization: 'Bearer test-key',
          'Content-Type': 'application/json',
        }),
        body: JSON.stringify({ inputData: { consultationId: 'cid-1' } }),
      })
    )
    expect(out).toEqual({ runId: 'run-1' })
  })

  it('throws when response not ok', async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 500 })
    await expect(startConsultationWorkflow('cid-1')).rejects.toThrow(/500/)
  })
})
