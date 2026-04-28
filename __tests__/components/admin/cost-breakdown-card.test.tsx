/**
 * @jest-environment jsdom
 */
import { render, screen } from '@testing-library/react'
import { CostBreakdownCard } from '@/components/admin/cost-breakdown-card'

describe('CostBreakdownCard', () => {
  it('renders specialist rows with count and formatted cost', () => {
    render(
      <CostBreakdownCard
        label="Por especialista"
        items={[
          { id: 'a', name: 'Cardiologista', icon: 'heart-pulse', count: 12, costUsd: 1.2345 },
          { id: 'b', name: 'Oncologista',   icon: 'ribbon',      count: 5,  costUsd: 0.5 },
        ]}
      />,
    )

    expect(screen.getByText('Por especialista')).toBeInTheDocument()
    expect(screen.getByText('Cardiologista')).toBeInTheDocument()
    expect(screen.getByText('Oncologista')).toBeInTheDocument()
    expect(screen.getByText(/12 consultas/)).toBeInTheDocument()
    expect(screen.getByText('$1.2345')).toBeInTheDocument()
    expect(screen.getByText(/5 consultas/)).toBeInTheDocument()
    expect(screen.getByText('$0.5000')).toBeInTheDocument()
  })

  it('renders empty state when items is empty', () => {
    render(<CostBreakdownCard label="Por especialista" items={[]} />)

    expect(screen.getByText('Sem dados')).toBeInTheDocument()
  })
})
