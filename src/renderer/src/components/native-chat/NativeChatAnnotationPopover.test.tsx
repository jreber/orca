/**
 * @vitest-environment happy-dom
 */
import type { ReactNode } from 'react'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { NativeChatAnnotationPopover } from './NativeChatAnnotationPopover'

vi.mock('@/components/ui/popover', () => ({
  Popover: ({ children, open }: { children?: ReactNode; open: boolean }) =>
    open ? children : null,
  PopoverAnchor: ({ children }: { children?: ReactNode }) => children ?? null,
  PopoverContent: ({ children }: { children?: ReactNode }) => <div>{children}</div>
}))

vi.mock('@/i18n/i18n', () => ({ translate: (_key: string, fallback: string) => fallback }))

afterEach(() => {
  cleanup()
})

describe('NativeChatAnnotationPopover', () => {
  it('calls the caller-supplied onSave with the selection and typed note on Enter', () => {
    const onSave = vi.fn()
    const onOpenChange = vi.fn()
    render(
      <NativeChatAnnotationPopover
        state={{ open: true, point: { x: 0, y: 0 }, selectedText: 'quoted text' }}
        onOpenChange={onOpenChange}
        onSave={onSave}
      />
    )

    const input = screen.getByPlaceholderText('Add a note…')
    fireEvent.change(input, { target: { value: 'my note' } })
    fireEvent.keyDown(input, { key: 'Enter' })

    expect(onSave).toHaveBeenCalledWith('quoted text', 'my note')
    expect(onOpenChange).toHaveBeenCalledWith(false)
  })

  it('cancels on Escape without calling onSave', () => {
    const onSave = vi.fn()
    const onOpenChange = vi.fn()
    render(
      <NativeChatAnnotationPopover
        state={{ open: true, point: { x: 0, y: 0 }, selectedText: 'quoted text' }}
        onOpenChange={onOpenChange}
        onSave={onSave}
      />
    )

    fireEvent.keyDown(screen.getByPlaceholderText('Add a note…'), { key: 'Escape' })

    expect(onSave).not.toHaveBeenCalled()
    expect(onOpenChange).toHaveBeenCalledWith(false)
  })
})
