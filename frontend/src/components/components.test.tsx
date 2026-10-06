import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import type { Photo } from '../lib/types'
import { I18nProvider } from '../i18n'
import { CompareSlider } from './Compare'
import { OutcomeBadge } from './domain'

const photo = (id: number, taken_on: string): Photo => ({
  id, taken_on, url: `/p/${id}`, thumb_url: `/t/${id}`, description: '', plant_id: 1, width: 10, height: 10,
  is_example: false, created_at: taken_on,
})

describe('CompareSlider', () => {
  it('is a keyboard-operable slider', () => {
    render(
      <I18nProvider>
        <CompareSlider before={photo(1, '2026-01-01')} after={photo(2, '2026-02-01')} />
      </I18nProvider>,
    )
    const slider = screen.getByRole('slider')
    expect(slider).toHaveAttribute('aria-valuenow', '50')
    fireEvent.keyDown(slider, { key: 'ArrowRight' })
    expect(slider).toHaveAttribute('aria-valuenow', '55')
    fireEvent.keyDown(slider, { key: 'Home' })
    expect(slider).toHaveAttribute('aria-valuenow', '0')
    expect(screen.getByAltText(/Earlier photo/)).toBeInTheDocument()
    expect(screen.getByAltText(/Later photo/)).toBeInTheDocument()
  })
})

describe('OutcomeBadge', () => {
  it('uses cautious wording for every outcome', () => {
    const { rerender } = render(<OutcomeBadge outcome="possible_issue" />)
    expect(screen.getByText('Possible leaf issue')).toBeInTheDocument()
    rerender(<OutcomeBadge outcome="unsupported_species" />)
    expect(screen.getByText('Not supported yet')).toBeInTheDocument()
    rerender(<OutcomeBadge outcome="model_unavailable" />)
    expect(screen.getByText('Analysis unavailable')).toBeInTheDocument()
  })
})
