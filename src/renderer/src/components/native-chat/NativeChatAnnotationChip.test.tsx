// @vitest-environment happy-dom

import '@testing-library/jest-dom/vitest'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { NativeChatAnnotationChip } from './NativeChatAnnotationChip'
import type { NativeChatAnnotation } from './native-chat-annotation-queue'

vi.mock('@/i18n/i18n', () => ({
  translate: (_key: string, fallback: string) => fallback
}))

afterEach(() => cleanup())

const annotation: NativeChatAnnotation = {
  id: 'annotation-1',
  quotedText: 'the response text',
  note: 'is this right?'
}

describe('NativeChatAnnotationChip', () => {
  it('renders the quoted text and note', () => {
    render(<NativeChatAnnotationChip annotation={annotation} onRemove={vi.fn()} />)

    expect(screen.getByText('the response text')).toBeInTheDocument()
    expect(screen.getByText('is this right?')).toBeInTheDocument()
  })

  it('calls onRemove with the annotation id when the remove control is clicked', () => {
    const onRemove = vi.fn()
    render(<NativeChatAnnotationChip annotation={annotation} onRemove={onRemove} />)

    fireEvent.click(screen.getByRole('button', { name: 'Remove annotation' }))

    expect(onRemove).toHaveBeenCalledWith('annotation-1')
  })
})
