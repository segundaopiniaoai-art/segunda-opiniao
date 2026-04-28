export async function startConsultationWorkflow(consultationId: string) {
  const url = process.env.MASTRA_URL
  const apiKey = process.env.MASTRA_API_KEY
  if (!url || !apiKey) {
    throw new Error('MASTRA_URL or MASTRA_API_KEY not configured')
  }

  const maxRetries = 2
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
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
    if (res.ok) return res.json() as Promise<{ runId: string }>
    if (attempt < maxRetries && res.status >= 500) {
      await new Promise((r) => setTimeout(r, 1000 * (attempt + 1)))
      continue
    }
    throw new Error(`Mastra start failed: ${res.status}`)
  }
  throw new Error('Mastra start failed: max retries exceeded')
}
