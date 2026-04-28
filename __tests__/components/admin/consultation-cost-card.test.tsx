/**
 * @jest-environment jsdom
 */
import { render, screen } from '@testing-library/react'
import { ConsultationCostCard } from '@/components/admin/consultation-cost-card'

describe('ConsultationCostCard', () => {
  it('renders formatted cost and tokens when costUsd is provided', () => {
    render(
      <ConsultationCostCard
        costUsd={0.0432}
        inputTokens={12_430}
        outputTokens={1_892}
      />,
    )

    expect(screen.getByText('Custo da consulta')).toBeInTheDocument()
    expect(screen.getByText('$0.0432')).toBeInTheDocument()
    expect(screen.getByText(/12\.430/)).toBeInTheDocument()
    expect(screen.getByText(/1\.892/)).toBeInTheDocument()
    expect(screen.getByText(/input/)).toBeInTheDocument()
    expect(screen.getByText(/output/)).toBeInTheDocument()
  })

  it('renders "Custo não medido" when costUsd is null', () => {
    render(<ConsultationCostCard costUsd={null} inputTokens={null} outputTokens={null} />)

    expect(screen.getByText('Custo da consulta')).toBeInTheDocument()
    expect(screen.getByText('Custo não medido')).toBeInTheDocument()
    expect(screen.queryByText(/\$/)).not.toBeInTheDocument()
  })
})
