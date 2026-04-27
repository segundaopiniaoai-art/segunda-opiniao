import { render, screen, fireEvent } from '@testing-library/react'
import { PatientContextInput } from '@/components/consultation/patient-context-input'

describe('PatientContextInput', () => {
  const mockOnChange = jest.fn()

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('renders the textarea with the label and placeholder', () => {
    render(<PatientContextInput value="" onChange={mockOnChange} />)

    const label = screen.getByText('Conte sobre sua dúvida ou sintomas (opcional)')
    expect(label).toBeInTheDocument()

    const textarea = screen.getByPlaceholderText(
      'Ex.: tenho sentido falta de ar e meu médico pediu esses exames…'
    )
    expect(textarea).toBeInTheDocument()
  })

  it('calls onChange when user types', () => {
    const { rerender } = render(<PatientContextInput value="" onChange={mockOnChange} />)

    const textarea = screen.getByPlaceholderText(
      'Ex.: tenho sentido falta de ar e meu médico pediu esses exames…'
    )

    fireEvent.change(textarea, { target: { value: 'oi' } })

    expect(mockOnChange).toHaveBeenCalledWith('oi')
  })

  it('shows the counter N / 2000', () => {
    render(<PatientContextInput value="hello" onChange={mockOnChange} />)

    const counter = screen.getByText(/^\d+\s*\/\s*2000$/)
    expect(counter.textContent).toMatch(/^5\s*\/\s*2000$/)
  })

  it('counter is gray when remaining >= 100', () => {
    render(<PatientContextInput value={'a'.repeat(1900)} onChange={mockOnChange} />)

    const counter = screen.getByText(/^\d+\s*\/\s*2000$/)
    expect(counter.className).toContain('text-gray-400')
    expect(counter.className).not.toContain('text-orange-600')
  })

  it('counter is orange when remaining < 100', () => {
    render(<PatientContextInput value={'a'.repeat(1901)} onChange={mockOnChange} />)

    const counter = screen.getByText(/^\d+\s*\/\s*2000$/)
    expect(counter.className).toContain('text-orange-600')
  })

  it('maxLength={2000} is set on the textarea', () => {
    render(<PatientContextInput value="" onChange={mockOnChange} />)

    const textarea = screen.getByRole('textbox')
    expect(textarea).toHaveAttribute('maxLength', '2000')
  })
})
