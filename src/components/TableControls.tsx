import React, { useState, useRef, useEffect } from 'react';
import type { Editor } from '@tiptap/react';
import {
  Table2,
  ArrowUp,
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  Trash2,
  Combine,
  Split,
  Heading,
} from 'lucide-react';
import { VARIANTS, COLORS } from '../tables';

export interface TablePickerProps {
  editor?: Editor | null;
  onSelect?: (rows: number, cols: number) => void;
  onDone: () => void;
}

export function TablePicker({ editor, onSelect, onDone }: TablePickerProps) {
  const [hover, setHover] = useState({ r: 0, c: 0 });

  return (
    <div className="tp p-2.5 bg-[var(--bg-elevated)] border border-[var(--border-subtle)] rounded-lg shadow-xl z-50">
      <div className="tp-grid" onMouseLeave={() => setHover({ r: 0, c: 0 })}>
        {Array.from({ length: 64 }, (_, i) => {
          const r = Math.floor(i / 8) + 1;
          const c = (i % 8) + 1;
          const on = r <= hover.r && c <= hover.c;
          return (
            <button
              key={i}
              type="button"
              className={`transition-colors ${on ? 'on bg-blue-500 border-blue-500' : 'hover:border-slate-400'}`}
              onMouseEnter={() => setHover({ r, c })}
              onClick={() => {
                if (onSelect) {
                  onSelect(r, c);
                } else if (editor) {
                  editor.chain().focus().insertTable({ rows: r, cols: c, withHeaderRow: true }).run();
                }
                onDone();
              }}
              title={`${r} × ${c}`}
            />
          );
        })}
      </div>
      <div className="tp-label mt-2 text-center text-xs font-medium text-[var(--text-muted)] select-none">
        {hover.r ? `${hover.r} × ${hover.c}` : 'Insert table'}
      </div>
    </div>
  );
}

export interface TablePickerPopoverProps {
  editor?: Editor | null;
  onInsertTable?: (rows: number, cols: number) => void;
  className?: string;
  iconSize?: number;
}

export function TablePickerPopover({ editor, onInsertTable, className, iconSize = 13 }: TablePickerPopoverProps) {
  const [isOpen, setIsOpen] = useState(false);
  const popoverRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    const handleOutsideClick = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsOpen(false);
    };

    document.addEventListener('mousedown', handleOutsideClick);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  const handleSelect = (r: number, c: number) => {
    if (onInsertTable) {
      onInsertTable(r, c);
    } else if (editor) {
      editor.chain().focus().insertTable({ rows: r, cols: c, withHeaderRow: true }).run();
    }
    setIsOpen(false);
  };

  return (
    <div className={`relative inline-block ${className ?? ''}`} ref={popoverRef}>
      <button
        type="button"
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => setIsOpen((prev) => !prev)}
        title="Insert table"
        className={`p-1 rounded hover:bg-[var(--bg-muted)] transition-colors ${isOpen ? 'bg-[var(--bg-muted)] text-[var(--text-main)]' : ''}`}
      >
        <Table2 size={iconSize} />
      </button>

      {isOpen && (
        <div className="absolute left-0 top-full mt-1.5 z-50">
          <TablePicker
            editor={editor}
            onSelect={handleSelect}
            onDone={() => setIsOpen(false)}
          />
        </div>
      )}
    </div>
  );
}

export interface TableToolbarProps {
  editor: Editor | null;
}

export function TableToolbar({ editor }: TableToolbarProps) {
  if (!editor || !editor.isActive('table')) return null;
  const c = () => editor.chain().focus() as any;
  const currentVariant = editor.getAttributes('table').variant || 'grid';

  return (
    <div className="table-toolbar bg-[var(--bg-elevated)]/95 backdrop-blur-sm border border-[var(--border-subtle)] rounded-lg shadow-md p-1.5 mb-2 flex items-center overflow-x-auto no-scrollbar gap-1 text-xs select-none max-w-full">
      {/* Row Operations */}
      <div className="flex items-center gap-0.5 bg-[var(--bg-card)] rounded p-0.5 border border-[var(--border-subtle)]">
        <button
          type="button"
          onClick={() => c().addRowBefore().run()}
          title="Insert row above"
          className="flex items-center gap-0.5 px-1.5 py-1 rounded hover:bg-[var(--bg-muted)] transition-colors text-[11px]"
        >
          <ArrowUp size={11} /> Row
        </button>
        <button
          type="button"
          onClick={() => c().addRowAfter().run()}
          title="Insert row below"
          className="flex items-center gap-0.5 px-1.5 py-1 rounded hover:bg-[var(--bg-muted)] transition-colors text-[11px]"
        >
          <ArrowDown size={11} /> Row
        </button>
        <button
          type="button"
          onClick={() => c().deleteRow().run()}
          title="Delete current row"
          className="p-1 rounded text-red-400 hover:bg-red-500/10 transition-colors"
        >
          <Trash2 size={11} />
        </button>
      </div>

      <span className="w-px h-4 bg-[var(--border-subtle)] mx-0.5" />

      {/* Column Operations */}
      <div className="flex items-center gap-0.5 bg-[var(--bg-card)] rounded p-0.5 border border-[var(--border-subtle)]">
        <button
          type="button"
          onClick={() => c().addColumnBefore().run()}
          title="Insert column left"
          className="flex items-center gap-0.5 px-1.5 py-1 rounded hover:bg-[var(--bg-muted)] transition-colors text-[11px]"
        >
          <ArrowLeft size={11} /> Col
        </button>
        <button
          type="button"
          onClick={() => c().addColumnAfter().run()}
          title="Insert column right"
          className="flex items-center gap-0.5 px-1.5 py-1 rounded hover:bg-[var(--bg-muted)] transition-colors text-[11px]"
        >
          <ArrowRight size={11} /> Col
        </button>
        <button
          type="button"
          onClick={() => c().deleteColumn().run()}
          title="Delete current column"
          className="p-1 rounded text-red-400 hover:bg-red-500/10 transition-colors"
        >
          <Trash2 size={11} />
        </button>
      </div>

      <span className="w-px h-4 bg-[var(--border-subtle)] mx-0.5" />

      {/* Cell structure */}
      <div className="flex items-center gap-0.5">
        <button
          type="button"
          onClick={() => c().mergeCells().run()}
          title="Merge selected cells"
          className="p-1.5 rounded hover:bg-[var(--bg-muted)] transition-colors"
        >
          <Combine size={12} />
        </button>
        <button
          type="button"
          onClick={() => c().splitCell().run()}
          title="Split merged cell"
          className="p-1.5 rounded hover:bg-[var(--bg-muted)] transition-colors"
        >
          <Split size={12} />
        </button>
        <button
          type="button"
          onClick={() => c().toggleHeaderRow().run()}
          title="Toggle header row"
          className="p-1.5 rounded hover:bg-[var(--bg-muted)] transition-colors"
        >
          <Heading size={12} />
        </button>
      </div>

      <span className="w-px h-4 bg-[var(--border-subtle)] mx-0.5" />

      {/* Variant Selector */}
      <select
        value={currentVariant}
        onChange={(e) => c().setTableVariant(e.target.value).run()}
        className="bg-[var(--bg-card)] border border-[var(--border-subtle)] rounded px-1.5 py-1 text-[11px] text-[var(--text-main)] outline-none"
        title="Table variant style"
      >
        {VARIANTS.map((v) => (
          <option key={v} value={v}>
            {v}
          </option>
        ))}
      </select>

      <span className="w-px h-4 bg-[var(--border-subtle)] mx-0.5" />

      {/* Cell Color Swatches */}
      <div className="flex items-center gap-1 px-1">
        {COLORS.map((col, i) => (
          <button
            key={i}
            type="button"
            className="w-3.5 h-3.5 rounded-full border border-slate-600/60 hover:scale-125 transition-transform cursor-pointer"
            style={{ background: col ?? 'transparent' }}
            title={col ? `Color: ${col}` : 'Default transparent'}
            onClick={() => c().setCellAttribute('backgroundColor', col).run()}
          />
        ))}
      </div>

      <span className="w-px h-4 bg-[var(--border-subtle)] mx-0.5" />

      {/* Delete Table */}
      <button
        type="button"
        className="flex items-center gap-1 px-2 py-1 rounded text-red-400 hover:bg-red-500/15 transition-colors font-medium text-[11px] whitespace-nowrap"
        onClick={() => c().deleteTable().run()}
        title="Delete entire table"
      >
        <Trash2 size={11} /> Table
      </button>
    </div>
  );
}
