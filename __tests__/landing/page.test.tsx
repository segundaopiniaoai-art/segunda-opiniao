/**
 * @jest-environment jsdom
 */
import { render, screen, within } from '@testing-library/react'
import LandingPage from '@/app/(public)/page'

describe('Landing page', () => {
  beforeEach(() => {
    render(<LandingPage />)
  })

  it('renders an h1 with non-empty text', () => {
    const h1 = screen.getByRole('heading', { level: 1 })
    expect(h1).toBeInTheDocument()
    expect(h1.textContent?.trim().length ?? 0).toBeGreaterThan(0)
  })

  it('mounts all six landing sections', () => {
    for (const id of [
      'hero',
      'how-it-works',
      'benefits',
      'reliability',
      'faq',
      'final-cta',
    ]) {
      expect(screen.getByTestId(id)).toBeInTheDocument()
    }
  })

  it('hero has a primary CTA to /register', () => {
    const hero = screen.getByTestId('hero')
    const cta = within(hero).getByRole('link', { name: /comece agora/i })
    expect(cta).toHaveAttribute('href', '/register')
  })

  it('hero has a secondary CTA anchored to #como-funciona', () => {
    const hero = screen.getByTestId('hero')
    const link = within(hero).getByRole('link', { name: /como funciona/i })
    expect(link).toHaveAttribute('href', '#como-funciona')
  })

  it('renders multiple Comece agora CTAs that all point to /register', () => {
    const allCtas = screen.getAllByRole('link', { name: /comece agora/i })
    expect(allCtas.length).toBeGreaterThanOrEqual(2)
    for (const cta of allCtas) {
      expect(cta).toHaveAttribute('href', '/register')
    }
  })
})
