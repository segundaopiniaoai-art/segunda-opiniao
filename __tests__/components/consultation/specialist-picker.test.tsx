import { render, screen, fireEvent } from '@testing-library/react'
import { SpecialistPicker } from '@/components/consultation/specialist-picker'

const specialists = [
  { id: '1', name: 'Cardiologista', description: 'Coração', icon: 'heart-pulse' },
  { id: '2', name: 'Neurologista', description: 'Cérebro', icon: 'brain' },
]

describe('SpecialistPicker', () => {
  const mockOnSelect = jest.fn()

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('renders all specialists as cards', () => {
    render(
      <SpecialistPicker
        specialists={specialists}
        selectedId={null}
        onSelect={mockOnSelect}
      />
    )
    expect(screen.getByText('Cardiologista')).toBeInTheDocument()
    expect(screen.getByText('Neurologista')).toBeInTheDocument()
  })

  it('calls onSelect when a card is clicked', () => {
    render(
      <SpecialistPicker
        specialists={specialists}
        selectedId={null}
        onSelect={mockOnSelect}
      />
    )
    fireEvent.click(screen.getByText('Cardiologista'))
    expect(mockOnSelect).toHaveBeenCalledWith('1')
  })

  it('highlights the selected card', () => {
    render(
      <SpecialistPicker
        specialists={specialists}
        selectedId="1"
        onSelect={mockOnSelect}
      />
    )
    const card = screen.getByText('Cardiologista').closest('button')
    expect(card?.className).toContain('border-primary')
  })
})
