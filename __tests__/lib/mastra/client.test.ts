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

  it('retries on 500 and succeeds', async () => {
    fetchMock
      .mockResolvedValueOnce({ ok: false, status: 500 })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ runId: 'run-2' }) })
    const out = await startConsultationWorkflow('cid-1')
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(out).toEqual({ runId: 'run-2' })
  })

  it('throws after exhausting retries on 500', async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 500 })
    await expect(startConsultationWorkflow('cid-1')).rejects.toThrow(/500/)
    expect(fetchMock).toHaveBeenCalledTimes(3)
  })

  it('throws immediately on 4xx without retrying', async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 401 })
    await expect(startConsultationWorkflow('cid-1')).rejects.toThrow(/401/)
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })
})
