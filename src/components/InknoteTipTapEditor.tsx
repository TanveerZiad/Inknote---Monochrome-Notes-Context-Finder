import React from 'react';
import { EditorContent } from '@tiptap/react';
import { useTipTapEditor, type UseTipTapEditorOptions } from '../hooks/useTipTapEditor';
import { TableToolbar, TablePickerPopover } from './TableControls';

export interface InknoteTipTapEditorProps extends UseTipTapEditorOptions {
  className?: string;
}

export function InknoteTipTapEditor({
  content = '',
  editable = true,
  autofocus = false,
  onUpdate,
  className = '',
}: InknoteTipTapEditorProps) {
  const { editor } = useTipTapEditor({
    content,
    editable,
    autofocus,
    onUpdate,
  });

  if (!editor) return null;

  return (
    <div className={`inknote-tiptap-container flex flex-col ${className}`}>
      {/* Table Popover trigger option or embedded toolbar */}
      <div className="flex items-center gap-1 mb-1">
        <TablePickerPopover editor={editor} />
      </div>

      {/* Contextual Table Toolbar (renders only when cursor is inside a table) */}
      <TableToolbar editor={editor} />

      {/* Editor Surface */}
      <EditorContent editor={editor} />
    </div>
  );
}
