/**
 * @jest-environment jsdom
 */
import { render, screen } from '@testing-library/react'
import PrivacyPage from '@/app/(public)/privacidade/page'

describe('Privacy stub page', () => {
  beforeEach(() => {
    render(<PrivacyPage />)
  })

  it('has an h1 with non-empty text', () => {
    const h1 = screen.getByRole('heading', { level: 1 })
    expect(h1.textContent?.trim().length ?? 0).toBeGreaterThan(0)
  })

  it('shows the preliminary-version banner', () => {
    expect(screen.getByText(/versão preliminar/i)).toBeInTheDocument()
  })
})
