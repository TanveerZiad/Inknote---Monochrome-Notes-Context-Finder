import { Table } from '@tiptap/extension-table'
import TableRow from '@tiptap/extension-table-row'
import TableHeader from '@tiptap/extension-table-header'
import TableCell from '@tiptap/extension-table-cell'
import { marked } from 'marked'
// TipTap v3: import { Table, TableRow, TableHeader, TableCell } from '@tiptap/extension-table'

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    customTable: {
      setTableVariant: (variant: string) => ReturnType
    }
  }
}

export const VARIANTS = ['grid', 'striped', 'minimal', 'borderless', 'compact', 'card'] as const
export type TableVariant = (typeof VARIANTS)[number]

export const COLORS = ['#3b2f2f', '#2f3b2f', '#2f2f3b', '#3b3b2f', '#3b2f3b', null] as const

export const looksLikeTable = (s: string) => /^\s*\|.+\|\s*\n\s*\|[\s:|-]+\|/m.test(s)

export function migrateNote(plainText: string): string {
  if (!plainText) return plainText
  if (!looksLikeTable(plainText)) return plainText
  const parsed = marked.parse(plainText, { gfm: true })
  return typeof parsed === 'string' ? parsed : plainText
}

const bgAttr = {
  backgroundColor: {
    default: null,
    parseHTML: (el: HTMLElement) => el.getAttribute('data-bg'),
    renderHTML: (a: any) =>
      a.backgroundColor
        ? { 'data-bg': a.backgroundColor, style: `background-color:${a.backgroundColor}` }
        : {},
  },
}

export const CustomTable = Table.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      variant: {
        default: 'grid',
        parseHTML: (el: HTMLElement) => el.getAttribute('data-variant') || 'grid',
        renderHTML: (a: any) => ({ 'data-variant': a.variant, class: `nt nt-${a.variant}` }),
      },
    }
  },
  addCommands() {
    return {
      ...this.parent?.(),
      setTableVariant:
        (variant: string) =>
        ({ commands }: any) =>
          commands.updateAttributes('table', { variant }),
    } as any
  },
})

export const CustomHeader = TableHeader.extend({
  addAttributes() {
    return { ...this.parent?.(), ...bgAttr }
  },
})

export const CustomCell = TableCell.extend({
  addAttributes() {
    return { ...this.parent?.(), ...bgAttr }
  },
})

export { TableRow } // Table extensions with variants and cell colors
