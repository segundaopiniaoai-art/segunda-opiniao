// "Hoje" uses the São Paulo calendar day (midnight SP).
// "Últimos 7/30 dias" use rolling windows (168h / 720h from now).
// SP offset is computed dynamically via Intl, so this stays correct if Brazil reinstates DST.
export function getDateBoundaries() {
  const now = new Date()

  // Calendar date "today" in São Paulo, formatted as YYYY-MM-DD
  const ymd = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(now)

  // Dynamic SP offset (e.g. "-03:00")
  const offsetParts = new Intl.DateTimeFormat('en', {
    timeZone: 'America/Sao_Paulo',
    timeZoneName: 'longOffset',
    hour: 'numeric',
  }).formatToParts(now)
  const offsetRaw = offsetParts.find((p) => p.type === 'timeZoneName')?.value ?? 'GMT-03:00'
  const offset = offsetRaw.replace('GMT', '') || '-03:00'

  const startOfToday = new Date(`${ymd}T00:00:00${offset}`).toISOString()
  const sevenDaysAgo = new Date(now.getTime() - 7 * 86_400_000).toISOString()
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 86_400_000).toISOString()

  return { startOfToday, sevenDaysAgo, thirtyDaysAgo }
}
