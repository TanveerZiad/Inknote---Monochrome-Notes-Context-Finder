import React, {
  useEffect,
  useImperativeHandle,
  useRef,
  forwardRef,
  useCallback,
} from 'react';
import { markdownToHtml, htmlToMarkdown } from '../utils/markdownRichText';

export interface RichTextEditorHandle {
  applyFormat: (format: 'bold' | 'italic' | 'strikethrough' | 'heading' | 'bullet' | 'checklist' | 'link' | 'table') => void;
  focus: () => void;
  insertText: (text: string) => void;
  getElement: () => HTMLDivElement | null;
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
    const editorRef = useRef<HTMLDivElement | null>(null);
    const lastMarkdownRef = useRef<string>(content);
    const isInternalUpdateRef = useRef<boolean>(false);

    // Synchronize external markdown changes (e.g. note selection change or undo/redo)
    useEffect(() => {
      if (editorRef.current) {
        if (!isInternalUpdateRef.current || content !== lastMarkdownRef.current) {
          editorRef.current.innerHTML = markdownToHtml(content);
          lastMarkdownRef.current = content;
        }
      }
      isInternalUpdateRef.current = false;
    }, [content, noteId]);

    const checkMention = useCallback(() => {
      if (!onMentionQuery) return;
      const selection = window.getSelection();
      if (!selection || selection.rangeCount === 0 || !editorRef.current) {
        onMentionQuery(null);
        return;
      }
      const range = selection.getRangeAt(0);
      if (!editorRef.current.contains(range.endContainer)) {
        onMentionQuery(null);
        return;
      }
      const preCaretRange = range.cloneRange();
      preCaretRange.selectNodeContents(editorRef.current);
      preCaretRange.setEnd(range.endContainer, range.endOffset);
      const textBefore = preCaretRange.toString();
      const match = textBefore.match(/@([^@\n]*)$/);
      onMentionQuery(match ? match[1] : null);
    }, [onMentionQuery]);

    const handleInput = useCallback(() => {
      if (!editorRef.current) return;
      isInternalUpdateRef.current = true;
      const markdown = htmlToMarkdown(editorRef.current);
      lastMarkdownRef.current = markdown;
      onChange(markdown);
      checkMention();
    }, [onChange, checkMention]);

    const applyFormat = useCallback(
      (format: 'bold' | 'italic' | 'strikethrough' | 'heading' | 'bullet' | 'checklist' | 'link' | 'table') => {
        if (!editorRef.current) return;
        editorRef.current.focus();

        switch (format) {
          case 'bold':
            document.execCommand('bold', false);
            break;
          case 'italic':
            document.execCommand('italic', false);
            break;
          case 'strikethrough':
            document.execCommand('strikeThrough', false);
            break;
          case 'heading': {
            const isH1 = document.queryCommandValue('formatBlock') === 'h1';
            document.execCommand('formatBlock', false, isH1 ? '<p>' : '<h1>');
            break;
          }
          case 'bullet':
            document.execCommand('insertUnorderedList', false);
            break;
          case 'checklist': {
            // Insert checklist marker at current selection
            document.execCommand('insertText', false, '- [ ] ');
            break;
          }
          case 'link': {
            const url = window.prompt('Paste a link URL');
            if (url) {
              document.execCommand('createLink', false, url);
            }
            break;
          }
          case 'table': {
            const tableMarkdown = '\n| Column 1 | Column 2 |\n| --- | --- |\n| value 1 | value 2 |\n';
            document.execCommand('insertText', false, tableMarkdown);
            break;
          }
        }
        handleInput();
      },
      [handleInput]
    );

    useImperativeHandle(
      ref,
      () => ({
        applyFormat,
        focus: () => editorRef.current?.focus(),
        insertText: (text: string) => {
          if (!editorRef.current) return;
          editorRef.current.focus();
          document.execCommand('insertText', false, text);
          handleInput();
        },
        getElement: () => editorRef.current,
      }),
      [applyFormat, handleInput]
    );

    const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
      const isMod = e.ctrlKey || e.metaKey;
      const key = e.key.toLowerCase();

      // Bold keyboard shortcut (Ctrl+B / Cmd+B)
      if (isMod && key === 'b') {
        e.preventDefault();
        applyFormat('bold');
        return;
      }

      // Italic keyboard shortcut (Ctrl+I / Cmd+I)
      if (isMod && key === 'i') {
        e.preventDefault();
        applyFormat('italic');
        return;
      }

      // Strikethrough keyboard shortcut (Ctrl+Shift+X / Cmd+Shift+X)
      if (isMod && e.shiftKey && key === 'x') {
        e.preventDefault();
        applyFormat('strikethrough');
        return;
      }
    };

    return (
      <div
        ref={editorRef}
        contentEditable
        suppressContentEditableWarning
        className="card-textarea card-rich-editor no-scrollbar"
        data-placeholder={placeholder}
        onInput={handleInput}
        onFocus={onFocus}
        onKeyUp={checkMention}
        onMouseUp={checkMention}
        onKeyDown={handleKeyDown}
        role="textbox"
        aria-multiline="true"
        aria-label="Note content"
        tabIndex={0}
      />
    );
  }
);

RichTextEditor.displayName = 'RichTextEditor';
