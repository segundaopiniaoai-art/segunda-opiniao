import type { ConsultationResult as Result } from '@/lib/schemas/consultation-result'

const severityStyle: Record<Result['findings'][number]['severity'], string> = {
  info: 'bg-gray-100 text-gray-700',
  attention: 'bg-yellow-100 text-yellow-800',
  urgent: 'bg-red-100 text-red-800',
}

const severityLabel: Record<Result['findings'][number]['severity'], string> = {
  info: 'Informativo',
  attention: 'Atenção',
  urgent: 'Urgente',
}

const confidenceStyle: Record<Result['confidence'], string> = {
  low: 'bg-gray-100 text-gray-700',
  medium: 'bg-blue-100 text-blue-800',
  high: 'bg-green-100 text-green-800',
}

const confidenceLabel: Record<Result['confidence'], string> = {
  low: 'Baixa',
  medium: 'Média',
  high: 'Alta',
}

export function ConsultationResult({ result }: { result: Result }) {
  return (
    <div className="space-y-6">
      <section className="rounded-xl border p-4">
        <h2 className="text-sm font-medium text-gray-500 mb-2">Resumo</h2>
        <p className="whitespace-pre-wrap text-sm">{result.summary}</p>
      </section>

      {result.findings.length > 0 && (
        <section className="rounded-xl border p-4">
          <h2 className="text-sm font-medium text-gray-500 mb-3">Achados</h2>
          <ul className="space-y-3">
            {result.findings.map((f, i) => (
              <li key={i} className="rounded-lg border p-3">
                <div className="flex items-start justify-between gap-3">
                  <p className="text-sm font-medium">{f.title}</p>
                  <span
                    className={`text-xs font-medium px-2 py-0.5 rounded-full flex-shrink-0 ${severityStyle[f.severity]}`}
                  >
                    {severityLabel[f.severity]}
                  </span>
                </div>
                <p className="text-sm text-gray-600 mt-1 whitespace-pre-wrap">{f.detail}</p>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="rounded-xl border p-4">
        <h2 className="text-sm font-medium text-gray-500 mb-2">Análise</h2>
        <p className="whitespace-pre-wrap text-sm">{result.assessment}</p>
      </section>

      {result.recommendations.length > 0 && (
        <section className="rounded-xl border p-4">
          <h2 className="text-sm font-medium text-gray-500 mb-3">Recomendações</h2>
          <ul className="list-disc list-inside space-y-1 text-sm">
            {result.recommendations.map((r, i) => <li key={i}>{r}</li>)}
          </ul>
        </section>
      )}

      {result.questionsForDoctor.length > 0 && (
        <section className="rounded-xl border p-4">
          <h2 className="text-sm font-medium text-gray-500 mb-3">Perguntas para o médico</h2>
          <ul className="list-disc list-inside space-y-1 text-sm">
            {result.questionsForDoctor.map((q, i) => <li key={i}>{q}</li>)}
          </ul>
        </section>
      )}

      {result.redFlags.length > 0 && (
        <section className="rounded-xl border border-red-200 bg-red-50 p-4">
          <h2 className="text-sm font-medium text-red-800 mb-3">Sinais de alerta</h2>
          <ul className="list-disc list-inside space-y-1 text-sm text-red-900">
            {result.redFlags.map((r, i) => <li key={i}>{r}</li>)}
          </ul>
        </section>
      )}

      <section className="flex items-center gap-2">
        <span className="text-sm text-gray-500">Confiança da análise:</span>
        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${confidenceStyle[result.confidence]}`}>
          {confidenceLabel[result.confidence]}
        </span>
      </section>

      <p className="text-xs text-gray-500">{result.disclaimer}</p>
    </div>
  )
}
