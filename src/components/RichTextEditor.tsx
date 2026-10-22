import React, {
  useEffect,
  useImperativeHandle,
  useRef,
  forwardRef,
  useCallback,
} from 'react';
import { useEditor, EditorContent, type Editor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { Underline } from '@tiptap/extension-underline';
import { Link } from '@tiptap/extension-link';
import { TaskList } from '@tiptap/extension-task-list';
import { TaskItem } from '@tiptap/extension-task-item';
import { Image } from '@tiptap/extension-image';
import { Markdown } from 'tiptap-markdown';
import { CustomTable, CustomHeader, CustomCell, TableRow, migrateNote } from '../tables';
import { TableToolbar } from './TableControls';

export type RichTextFormat =
  | 'bold'
  | 'italic'
  | 'underline'
  | 'strikethrough'
  | 'heading'
  | 'h1'
  | 'h2'
  | 'h3'
  | 'paragraph'
  | 'bullet'
  | 'number'
  | 'checklist'
  | 'link'
  | 'image'
  | 'highlight'
  | 'table'
  | 'clearFormatting'
  | 'undo'
  | 'redo'
  | 'alignLeft'
  | 'alignCenter'
  | 'alignRight'
  | 'alignJustify'
  | 'print';

export interface RichTextEditorHandle {
  applyFormat: (format: RichTextFormat) => void;
  focus: () => void;
  insertText: (text: string) => void;
  insertImage: (url: string, alt?: string) => void;
  insertTable?: (rows?: number, cols?: number) => void;
  getElement: () => HTMLDivElement | null;
  getEditor?: () => Editor | null;
}

interface RichTextEditorProps {
  content: string;
  noteId: string;
  placeholder?: string;
  onChange: (newMarkdown: string) => void;
  onFocus?: () => void;
  onMentionQuery?: (query: string | null) => void;
}

export const RichTextEditor = forwardRef<RichTextEditorHandle, RichTextEditorProps>(
  ({ content, noteId, placeholder = 'Start writing...', onChange, onFocus, onMentionQuery }, ref) => {
    const containerRef = useRef<HTMLDivElement | null>(null);
    const lastContentRef = useRef<string>(content);
    const isInternalUpdateRef = useRef<boolean>(false);

    const checkMention = useCallback(
      (ed: Editor) => {
        if (!onMentionQuery) return;
        try {
          const { from } = ed.state.selection;
          const textBefore = ed.state.doc.textBetween(Math.max(0, from - 20), from, '\n');
          const match = textBefore.match(/@([^@\n]*)$/);
          onMentionQuery(match ? match[1] : null);
        } catch {
          onMentionQuery(null);
        }
      },
      [onMentionQuery]
    );

    const editor = useEditor({
      extensions: [
        StarterKit.configure({
          heading: {
            levels: [1, 2, 3],
          },
        }),
        Underline,
        Link.configure({
          openOnClick: false,
          HTMLAttributes: {
            class: 'editor-link text-blue-500 underline',
          },
        }),
        TaskList,
        TaskItem.configure({
          nested: true,
        }),
        Markdown.configure({
          html: true,
          transformPastedText: true,
        }),
        Image.configure({
          allowBase64: true,
          inline: false,
          HTMLAttributes: {
            class: 'editor-inline-image max-w-full rounded-lg my-2 border border-[var(--border-subtle)]',
          },
        }),
        CustomTable.configure({
          resizable: true,
        }),
        TableRow,
        CustomHeader,
        CustomCell,
      ],
      content: migrateNote(content),
      editorProps: {
        attributes: {
          class: 'card-textarea card-rich-editor no-scrollbar focus:outline-none min-h-[80px]',
          'data-placeholder': placeholder,
        },
      },
      onUpdate: ({ editor: ed }) => {
        isInternalUpdateRef.current = true;
        const markdown = (ed.storage as any).markdown?.getMarkdown?.() ?? ed.getHTML();
        lastContentRef.current = markdown;
        onChange(markdown);
        checkMention(ed);
      },
      onSelectionUpdate: ({ editor: ed }) => {
        checkMention(ed);
      },
      onFocus: () => {
        onFocus?.();
      },
    });

    // Sync external changes (e.g. note switch, undo/redo from parent, unlocked secret note)
    useEffect(() => {
      if (!editor) return;
      if (isInternalUpdateRef.current && content === lastContentRef.current) {
        isInternalUpdateRef.current = false;
        return;
      }
      isInternalUpdateRef.current = false;
      if (content !== lastContentRef.current) {
        lastContentRef.current = content;
        editor.commands.setContent(migrateNote(content));
      }
    }, [content, noteId, editor]);

    const applyFormat = useCallback(
      (format: RichTextFormat) => {
        if (!editor) return;
        const chain = editor.chain().focus();

        switch (format) {
          case 'bold':
            chain.toggleBold().run();
            break;
          case 'italic':
            chain.toggleItalic().run();
            break;
          case 'underline':
            chain.toggleUnderline().run();
            break;
          case 'strikethrough':
            chain.toggleStrike().run();
            break;
          case 'heading':
          case 'h1':
            chain.toggleHeading({ level: 1 }).run();
            break;
          case 'h2':
            chain.toggleHeading({ level: 2 }).run();
            break;
          case 'h3':
            chain.toggleHeading({ level: 3 }).run();
            break;
          case 'paragraph':
            chain.setParagraph().run();
            break;
          case 'bullet':
            chain.toggleBulletList().run();
            break;
          case 'number':
            chain.toggleOrderedList().run();
            break;
          case 'checklist':
            chain.toggleTaskList().run();
            break;
          case 'link': {
            const previousUrl = editor.getAttributes('link').href;
            const url = window.prompt('Paste a link URL:', previousUrl || '');
            if (url === null) return;
            if (url === '') {
              chain.unsetLink().run();
            } else {
              chain.setLink({ href: url }).run();
            }
            break;
          }
          case 'table':
            chain.insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run();
            break;
          case 'clearFormatting':
            chain.unsetAllMarks().clearNodes().run();
            break;
          case 'undo':
            chain.undo().run();
            break;
          case 'redo':
            chain.redo().run();
            break;
          case 'image': {
            const url = window.prompt('Paste image URL:');
            if (url) {
              chain.setImage({ src: url }).run();
            }
            break;
          }
          case 'highlight':
            chain.setCellAttribute?.('backgroundColor', '#fef08a').run();
            break;
          case 'print':
            window.print();
            break;
          default:
            break;
        }
      },
      [editor]
    );

    useImperativeHandle(
      ref,
      () => ({
        applyFormat,
        focus: () => editor?.commands.focus(),
        insertText: (text: string) => {
          editor?.commands.insertContent(text);
        },
        insertImage: (url: string, alt = 'image') => {
          editor?.chain().focus().setImage({ src: url, alt }).run();
        },
        insertTable: (rows = 3, cols = 3) => {
          editor?.chain().focus().insertTable({ rows, cols, withHeaderRow: true }).run();
        },
        getElement: () => containerRef.current,
        getEditor: () => editor,
      }),
      [applyFormat, editor]
    );

    return (
      <div ref={containerRef} className="rich-editor-container relative w-full">
        {/* Contextual Table Toolbar appears automatically when cursor is in a table */}
        <TableToolbar editor={editor} />

        {/* TipTap editor surface */}
        <EditorContent editor={editor} />
      </div>
    );
  }
);

RichTextEditor.displayName = 'RichTextEditor';
