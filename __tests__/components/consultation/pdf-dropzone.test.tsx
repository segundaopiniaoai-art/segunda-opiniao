/**
 * @jest-environment jsdom
 */
import { render, screen, fireEvent } from '@testing-library/react'
import { PdfDropzone } from '@/components/consultation/pdf-dropzone'

describe('PdfDropzone', () => {
  const mockOnChange = jest.fn()

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('renders the dropzone with instructions', () => {
    render(<PdfDropzone files={[]} onChange={mockOnChange} />)
    expect(screen.getByText(/arraste seus arquivos PDF/i)).toBeInTheDocument()
  })

  it('shows file list when files are added', () => {
    const files = [new File(['content'], 'exam1.pdf', { type: 'application/pdf' })]
    render(<PdfDropzone files={files} onChange={mockOnChange} />)
    expect(screen.getByText('exam1.pdf')).toBeInTheDocument()
  })

  it('calls onChange when remove button is clicked', () => {
    const files = [
      new File(['content'], 'exam1.pdf', { type: 'application/pdf' }),
      new File(['content'], 'exam2.pdf', { type: 'application/pdf' }),
    ]
    render(<PdfDropzone files={files} onChange={mockOnChange} />)
    const removeButtons = screen.getAllByRole('button', { name: /remover/i })
    fireEvent.click(removeButtons[0])
    expect(mockOnChange).toHaveBeenCalledWith([files[1]])
  })

  it('shows error when non-PDF file is added', () => {
    render(<PdfDropzone files={[]} onChange={mockOnChange} />)
    const input = screen.getByTestId('file-input')
    const invalidFile = new File(['content'], 'photo.png', { type: 'image/png' })
    fireEvent.change(input, { target: { files: [invalidFile] } })
    expect(screen.getByText(/apenas arquivos PDF/i)).toBeInTheDocument()
    expect(mockOnChange).not.toHaveBeenCalled()
  })

  it('shows error when more than 5 files total', () => {
    const existingFiles = Array.from({ length: 5 }, (_, i) =>
      new File(['content'], `exam${i}.pdf`, { type: 'application/pdf' })
    )
    render(<PdfDropzone files={existingFiles} onChange={mockOnChange} />)
    const input = screen.getByTestId('file-input')
    const newFile = new File(['content'], 'extra.pdf', { type: 'application/pdf' })
    fireEvent.change(input, { target: { files: [newFile] } })
    expect(screen.getByText(/máximo de 5 arquivos/i)).toBeInTheDocument()
    expect(mockOnChange).not.toHaveBeenCalled()
  })
})
