export async function startConsultationWorkflow(consultationId: string) {
  const url = process.env.MASTRA_URL
  const apiKey = process.env.MASTRA_API_KEY
  if (!url || !apiKey) {
    throw new Error('MASTRA_URL or MASTRA_API_KEY not configured')
  }
  const res = await fetch(
    `${url}/api/workflows/consultationWorkflow/start-async`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({ inputData: { consultationId } }),
    }
  )
  if (!res.ok) throw new Error(`Mastra start failed: ${res.status}`)
  return res.json() as Promise<{ runId: string }>
}
