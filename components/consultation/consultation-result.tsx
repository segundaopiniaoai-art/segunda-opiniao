import type { ConsultationResult as Result } from '@/lib/schemas/consultation-result'
import { AnimatedSection } from './animated-section'

const severityStyle: Record<Result['findings'][number]['severity'], string> = {
  info: 'bg-muted/50 text-muted-foreground',
  attention: 'bg-yellow-100 text-yellow-800',
  urgent: 'bg-destructive/10 text-destructive',
}

const severityLabel: Record<Result['findings'][number]['severity'], string> = {
  info: 'Informativo',
  attention: 'Atencao',
  urgent: 'Urgente',
}

const confidenceStyle: Record<Result['confidence'], string> = {
  low: 'bg-muted/50 text-muted-foreground',
  medium: 'bg-primary/10 text-primary',
  high: 'bg-success/10 text-success',
}

const confidenceLabel: Record<Result['confidence'], string> = {
  low: 'Baixa',
  medium: 'Media',
  high: 'Alta',
}

export function ConsultationResult({ result }: { result: Result }) {
  let sectionIndex = 0

  return (
    <div className="space-y-6">
      <AnimatedSection index={sectionIndex++} className="animate-fade-in-up rounded-lg border border-border bg-surface p-4">
        <h2 className="text-sm font-medium text-muted-foreground mb-2">Resumo</h2>
        <p className="whitespace-pre-wrap text-sm">{result.summary}</p>
      </AnimatedSection>

      {result.findings.length > 0 && (
        <AnimatedSection index={sectionIndex++} className="animate-fade-in-up rounded-lg border border-border bg-surface p-4">
          <h2 className="text-sm font-medium text-muted-foreground mb-3">Achados</h2>
          <ul className="space-y-3">
            {result.findings.map((f, i) => (
              <li key={i} className="rounded-lg border border-border p-3">
                <div className="flex items-start justify-between gap-3">
                  <p className="text-sm font-medium">{f.title}</p>
                  <span
                    className={`text-xs font-medium px-2 py-0.5 rounded-full flex-shrink-0 ${severityStyle[f.severity]}`}
                  >
                    {severityLabel[f.severity]}
                  </span>
                </div>
                <p className="text-sm text-muted-foreground mt-1 whitespace-pre-wrap">{f.detail}</p>
              </li>
            ))}
          </ul>
        </AnimatedSection>
      )}

      <AnimatedSection index={sectionIndex++} className="animate-fade-in-up rounded-lg border border-border bg-surface p-4">
        <h2 className="text-sm font-medium text-muted-foreground mb-2">Analise</h2>
        <p className="whitespace-pre-wrap text-sm">{result.assessment}</p>
      </AnimatedSection>

      {result.recommendations.length > 0 && (
        <AnimatedSection index={sectionIndex++} className="animate-fade-in-up rounded-lg border border-border bg-surface p-4">
          <h2 className="text-sm font-medium text-muted-foreground mb-3">Recomendacoes</h2>
          <ul className="list-disc list-inside space-y-1 text-sm">
            {result.recommendations.map((r, i) => <li key={i}>{r}</li>)}
          </ul>
        </AnimatedSection>
      )}

      {result.questionsForDoctor.length > 0 && (
        <AnimatedSection index={sectionIndex++} className="animate-fade-in-up rounded-lg border border-border bg-surface p-4">
          <h2 className="text-sm font-medium text-muted-foreground mb-3">Perguntas para o medico</h2>
          <ul className="list-disc list-inside space-y-1 text-sm">
            {result.questionsForDoctor.map((q, i) => <li key={i}>{q}</li>)}
          </ul>
        </AnimatedSection>
      )}

      {result.redFlags.length > 0 && (
        <AnimatedSection index={sectionIndex++} className="animate-fade-in-up rounded-lg border border-destructive/20 bg-destructive/5 p-4">
          <h2 className="text-sm font-medium text-destructive mb-3">Sinais de alerta</h2>
          <ul className="list-disc list-inside space-y-1 text-sm text-destructive">
            {result.redFlags.map((r, i) => <li key={i}>{r}</li>)}
          </ul>
        </AnimatedSection>
      )}

      <AnimatedSection index={sectionIndex++} className="animate-fade-in-up flex items-center gap-2">
        <span className="text-sm text-muted-foreground">Confianca da analise:</span>
        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${confidenceStyle[result.confidence]}`}>
          {confidenceLabel[result.confidence]}
        </span>
      </AnimatedSection>

      <AnimatedSection index={sectionIndex++} className="animate-fade-in-up">
        <p className="text-xs text-muted-foreground">{result.disclaimer}</p>
      </AnimatedSection>
    </div>
  )
}
