import { useEditor, type UseEditorOptions } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { Markdown } from 'tiptap-markdown';
import { CustomTable, CustomHeader, CustomCell, TableRow, migrateNote, VARIANTS, type TableVariant } from '../tables';

export interface UseTipTapEditorOptions {
  content?: string;
  placeholder?: string;
  editable?: boolean;
  autofocus?: boolean | 'start' | 'end' | 'all';
  onUpdate?: (markdown: string) => void;
  editorProps?: UseEditorOptions['editorProps'];
}

export const defaultTableExtensions = [
  StarterKit,
  Markdown.configure({
    html: true,
    transformPastedText: true,
  }),
  CustomTable.configure({
    resizable: true,
  }),
  TableRow,
  CustomHeader,
  CustomCell,
];

export function useTipTapEditor({
  content = '',
  editable = true,
  autofocus = false,
  onUpdate,
  editorProps,
}: UseTipTapEditorOptions = {}) {
  const initialContent = migrateNote(content);

  const editor = useEditor({
    extensions: defaultTableExtensions,
    content: initialContent,
    editable,
    autofocus,
    editorProps: {
      attributes: {
        class: 'tiptap prose prose-neutral max-w-none focus:outline-none min-h-[100px]',
      },
      ...editorProps,
    },
    onUpdate: ({ editor }) => {
      // With tiptap-markdown, getMarkdown() returns current markdown content
      const markdown = (editor.storage as any).markdown?.getMarkdown?.() ?? editor.getHTML();
      onUpdate?.(markdown);
    },
  });

  return {
    editor,
    getMarkdown: () => (editor?.storage as any)?.markdown?.getMarkdown?.() ?? editor?.getHTML() ?? '',
    setMarkdown: (markdown: string) => editor?.commands.setContent(migrateNote(markdown)),
    // Table helper commands
    insertTable: (options: { rows?: number; cols?: number; withHeaderRow?: boolean } = {}) =>
      editor?.chain().focus().insertTable({ rows: options.rows ?? 3, cols: options.cols ?? 3, withHeaderRow: options.withHeaderRow ?? true }).run(),
    addColumnBefore: () => editor?.chain().focus().addColumnBefore().run(),
    addColumnAfter: () => editor?.chain().focus().addColumnAfter().run(),
    deleteColumn: () => editor?.chain().focus().deleteColumn().run(),
    addRowBefore: () => editor?.chain().focus().addRowBefore().run(),
    addRowAfter: () => editor?.chain().focus().addRowAfter().run(),
    deleteRow: () => editor?.chain().focus().deleteRow().run(),
    deleteTable: () => editor?.chain().focus().deleteTable().run(),
    mergeCells: () => editor?.chain().focus().mergeCells().run(),
    splitCell: () => editor?.chain().focus().splitCell().run(),
    setTableVariant: (variant: TableVariant) =>
      (editor?.chain().focus() as any).setTableVariant?.(variant).run(),
    setCellColor: (color: string | null) =>
      editor?.chain().focus().setCellAttribute('backgroundColor', color).run(),
  };
}

export { StarterKit, Markdown, CustomTable, CustomHeader, CustomCell, TableRow, migrateNote, VARIANTS };

