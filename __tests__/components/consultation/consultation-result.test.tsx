/**
 * @jest-environment jsdom
 */
import { render, screen } from '@testing-library/react'
import { ConsultationResult } from '@/components/consultation/consultation-result'
import type { ConsultationResult as Result } from '@/mastra/schemas/consultation-result'

function baseResult(overrides: Partial<Result> = {}): Result {
  return {
    summary: 'Resumo padrão',
    findings: [],
    assessment: 'Análise padrão',
    recommendations: [],
    questionsForDoctor: [],
    redFlags: [],
    confidence: 'medium',
    disclaimer: 'Aviso legal padrão',
    ...overrides,
  }
}

describe('ConsultationResult', () => {
  it('renders summary, assessment, and disclaimer always', () => {
    render(<ConsultationResult result={baseResult()} />)

    expect(screen.getByText('Resumo padrão')).toBeInTheDocument()
    expect(screen.getByText('Análise padrão')).toBeInTheDocument()
    expect(screen.getByText('Aviso legal padrão')).toBeInTheDocument()
  })

  it('renders findings section heading and content when findings array is non-empty', () => {
    const result = baseResult({
      findings: [{ title: 'Título do achado', detail: 'Detalhe do achado', severity: 'info' }],
    })
    render(<ConsultationResult result={result} />)

    expect(screen.getByText('Achados')).toBeInTheDocument()
    expect(screen.getByText('Título do achado')).toBeInTheDocument()
    expect(screen.getByText('Detalhe do achado')).toBeInTheDocument()
  })

  it('hides findings section when findings array is empty', () => {
    render(<ConsultationResult result={baseResult({ findings: [] })} />)

    expect(screen.queryByText('Achados')).not.toBeInTheDocument()
  })

  it('renders urgent severity badge with correct style and label', () => {
    const result = baseResult({
      findings: [{ title: 'Achado urgente', detail: 'Detalhe', severity: 'urgent' }],
    })
    render(<ConsultationResult result={result} />)

    const badge = screen.getByText('Urgente')
    expect(badge.className).toContain('bg-red-100')
    expect(badge).toBeInTheDocument()
  })

  it('renders attention severity badge with correct style and label', () => {
    const result = baseResult({
      findings: [{ title: 'Achado atenção', detail: 'Detalhe', severity: 'attention' }],
    })
    render(<ConsultationResult result={result} />)

    const badge = screen.getByText('Atenção')
    expect(badge.className).toContain('bg-yellow-100')
    expect(badge).toBeInTheDocument()
  })

  it('renders info severity badge with correct style and label', () => {
    const result = baseResult({
      findings: [{ title: 'Achado informativo', detail: 'Detalhe', severity: 'info' }],
    })
    render(<ConsultationResult result={result} />)

    const badge = screen.getByText('Informativo')
    expect(badge.className).toContain('bg-gray-100')
    expect(badge).toBeInTheDocument()
  })

  it('hides recommendations section when array is empty', () => {
    render(<ConsultationResult result={baseResult({ recommendations: [] })} />)

    expect(screen.queryByText('Recomendações')).not.toBeInTheDocument()
  })

  it('hides questionsForDoctor section when array is empty', () => {
    render(<ConsultationResult result={baseResult({ questionsForDoctor: [] })} />)

    expect(screen.queryByText('Perguntas para o médico')).not.toBeInTheDocument()
  })

  it('hides redFlags section when array is empty', () => {
    render(<ConsultationResult result={baseResult({ redFlags: [] })} />)

    expect(screen.queryByText('Sinais de alerta')).not.toBeInTheDocument()
  })

  it('renders redFlags section with items when array is non-empty', () => {
    const result = baseResult({ redFlags: ['Sinal de alerta crítico'] })
    render(<ConsultationResult result={result} />)

    expect(screen.getByText('Sinais de alerta')).toBeInTheDocument()
    expect(screen.getByText('Sinal de alerta crítico')).toBeInTheDocument()
  })

  it('renders confidence badge with label "Baixa" and gray style for low confidence', () => {
    render(<ConsultationResult result={baseResult({ confidence: 'low' })} />)

    const badge = screen.getByText('Baixa')
    expect(badge.className).toContain('bg-gray-100')
    expect(badge).toBeInTheDocument()
  })

  it('renders confidence badge with label "Média" and blue style for medium confidence', () => {
    render(<ConsultationResult result={baseResult({ confidence: 'medium' })} />)

    const badge = screen.getByText('Média')
    expect(badge.className).toContain('bg-blue-100')
    expect(badge).toBeInTheDocument()
  })

  it('renders confidence badge with label "Alta" and green style for high confidence', () => {
    render(<ConsultationResult result={baseResult({ confidence: 'high' })} />)

    const badge = screen.getByText('Alta')
    expect(badge.className).toContain('bg-green-100')
    expect(badge).toBeInTheDocument()
  })
})
