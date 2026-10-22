import React, {
  useEffect,
  useImperativeHandle,
  useRef,
  forwardRef,
  useCallback,
} from 'react';
import { markdownToHtml, htmlToMarkdown } from '../utils/markdownRichText';

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
      (format: RichTextFormat) => {
        if (!editorRef.current) return;
        editorRef.current.focus();

        switch (format) {
          case 'bold':
            document.execCommand('bold', false);
            break;
          case 'italic':
            document.execCommand('italic', false);
            break;
          case 'underline':
            document.execCommand('underline', false);
            break;
          case 'strikethrough':
            document.execCommand('strikeThrough', false);
            break;
          case 'heading':
          case 'h1': {
            const isH1 = document.queryCommandValue('formatBlock') === 'h1';
            document.execCommand('formatBlock', false, isH1 ? '<p>' : '<h1>');
            break;
          }
          case 'h2': {
            const isH2 = document.queryCommandValue('formatBlock') === 'h2';
            document.execCommand('formatBlock', false, isH2 ? '<p>' : '<h2>');
            break;
          }
          case 'h3': {
            const isH3 = document.queryCommandValue('formatBlock') === 'h3';
            document.execCommand('formatBlock', false, isH3 ? '<p>' : '<h3>');
            break;
          }
          case 'paragraph': {
            document.execCommand('formatBlock', false, '<p>');
            break;
          }
          case 'bullet':
            document.execCommand('insertUnorderedList', false);
            break;
          case 'number':
            document.execCommand('insertOrderedList', false);
            break;
          case 'checklist': {
            const selection = window.getSelection();
            if (selection && selection.rangeCount > 0 && editorRef.current) {
              let node: Node | null = selection.anchorNode;
              let liNode: HTMLElement | null = null;
              while (node && node !== editorRef.current) {
                if (node.nodeType === Node.ELEMENT_NODE && (node as HTMLElement).tagName.toLowerCase() === 'li') {
                  liNode = node as HTMLElement;
                  break;
                }
                node = node.parentNode;
              }

              if (liNode) {
                if (liNode.classList.contains('task-item')) {
                  liNode.classList.remove('task-item', 'is-completed');
                  liNode.removeAttribute('data-task');
                  liNode.removeAttribute('data-checked');
                  const cbWrapper = liNode.querySelector('.task-checkbox-wrapper') || liNode.querySelector('input[type="checkbox"]');
                  if (cbWrapper) cbWrapper.remove();
                } else {
                  liNode.classList.add('task-item');
                  liNode.setAttribute('data-task', 'true');
                  liNode.setAttribute('data-checked', 'false');
                  if (!liNode.querySelector('.task-checkbox-wrapper')) {
                    const wrapper = document.createElement('span');
                    wrapper.contentEditable = 'false';
                    wrapper.className = 'task-checkbox-wrapper';
                    const cb = document.createElement('input');
                    cb.type = 'checkbox';
                    cb.className = 'task-checkbox';
                    wrapper.appendChild(cb);
                    liNode.prepend(wrapper);
                  }
                }
              } else {
                document.execCommand('insertUnorderedList', false);
                const selAfter = window.getSelection();
                let currNode = selAfter?.anchorNode;
                while (currNode && currNode !== editorRef.current) {
                  if (currNode.nodeType === Node.ELEMENT_NODE && (currNode as HTMLElement).tagName.toLowerCase() === 'li') {
                    const li = currNode as HTMLElement;
                    li.classList.add('task-item');
                    li.setAttribute('data-task', 'true');
                    li.setAttribute('data-checked', 'false');
                    if (!li.querySelector('.task-checkbox-wrapper')) {
                      const wrapper = document.createElement('span');
                      wrapper.contentEditable = 'false';
                      wrapper.className = 'task-checkbox-wrapper';
                      const cb = document.createElement('input');
                      cb.type = 'checkbox';
                      cb.className = 'task-checkbox';
                      wrapper.appendChild(cb);
                      li.prepend(wrapper);
                    }
                    break;
                  }
                  currNode = currNode.parentNode;
                }
              }
            } else {
              document.execCommand('insertText', false, '- [ ] ');
            }
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
          case 'undo':
            document.execCommand('undo', false);
            break;
          case 'redo':
            document.execCommand('redo', false);
            break;
          case 'alignLeft':
            document.execCommand('justifyLeft', false);
            break;
          case 'alignCenter':
            document.execCommand('justifyCenter', false);
            break;
          case 'alignRight':
            document.execCommand('justifyRight', false);
            break;
          case 'alignJustify':
            document.execCommand('justifyFull', false);
            break;
          case 'image': {
            const url = window.prompt('Paste image URL:');
            if (url) {
              document.execCommand('insertImage', false, url);
            }
            break;
          }
          case 'highlight': {
            const sel = window.getSelection();
            if (sel && sel.rangeCount > 0 && !sel.isCollapsed && editorRef.current) {
              const range = sel.getRangeAt(0);
              const mark = document.createElement('mark');
              mark.appendChild(range.extractContents());
              range.insertNode(mark);
            } else {
              document.execCommand('hiliteColor', false, '#fef08a');
            }
            break;
          }
          case 'print':
            window.print();
            break;
          case 'clearFormatting': {
            // Remove text formatting marks (bold, italic, underline, strikethrough, etc.)
            document.execCommand('removeFormat', false);
            // Toggle off unordered list if active
            if (document.queryCommandState('insertUnorderedList')) {
              document.execCommand('insertUnorderedList', false);
            }
            // Toggle off ordered list if active
            if (document.queryCommandState('insertOrderedList')) {
              document.execCommand('insertOrderedList', false);
            }
            // Reset block structure to standard paragraph
            document.execCommand('formatBlock', false, '<p>');

            // Clean up task items if selection is inside one
            const sel = window.getSelection();
            if (sel && sel.rangeCount > 0 && editorRef.current) {
              let node: Node | null = sel.anchorNode;
              while (node && node !== editorRef.current) {
                if (node.nodeType === Node.ELEMENT_NODE) {
                  const el = node as HTMLElement;
                  if (el.classList.contains('task-item')) {
                    el.classList.remove('task-item', 'is-completed');
                    el.removeAttribute('data-task');
                    el.removeAttribute('data-checked');
                    const cb = el.querySelector('input[type="checkbox"]');
                    if (cb) cb.remove();
                  }
                }
                node = node.parentNode;
              }
            }
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
        insertImage: (url: string, alt = 'image') => {
          if (!editorRef.current) return;
          editorRef.current.focus();
          document.execCommand('insertHTML', false, `<img src="${url}" alt="${alt}" class="editor-inline-image" />`);
          handleInput();
        },
        getElement: () => editorRef.current,
      }),
      [applyFormat, handleInput]
    );

    const handleClick = useCallback(
      (e: React.MouseEvent<HTMLDivElement>) => {
        const target = e.target as HTMLElement;
        if (target && target.tagName.toLowerCase() === 'input' && target.getAttribute('type') === 'checkbox') {
          const input = target as HTMLInputElement;
          const li = input.closest('li');
          if (li) {
            li.setAttribute('data-checked', input.checked ? 'true' : 'false');
            if (input.checked) {
              li.classList.add('is-completed');
            } else {
              li.classList.remove('is-completed');
            }
          }
          handleInput();
          return;
        }

        // Open link on Ctrl+Click / Cmd+Click
        if (e.ctrlKey || e.metaKey) {
          const link = target.closest('a');
          if (link && link.href) {
            window.open(link.href, '_blank', 'noopener,noreferrer');
          }
        }
      },
      [handleInput]
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

      // Underline keyboard shortcut (Ctrl+U / Cmd+U)
      if (isMod && key === 'u') {
        e.preventDefault();
        applyFormat('underline');
        return;
      }

      // Strikethrough keyboard shortcut (Ctrl+Shift+X / Cmd+Shift+X)
      if (isMod && e.shiftKey && key === 'x') {
        e.preventDefault();
        applyFormat('strikethrough');
        return;
      }

      // Highlight keyboard shortcut (Ctrl+Shift+H / Cmd+Shift+H)
      if (isMod && e.shiftKey && key === 'h') {
        e.preventDefault();
        applyFormat('highlight');
        return;
      }

      // Tab and Shift+Tab for Indenting / Outdenting (Lists, Tasks, Code)
      if (e.key === 'Tab') {
        e.preventDefault();
        if (e.shiftKey) {
          document.execCommand('outdent', false);
        } else {
          document.execCommand('indent', false);
        }
        handleInput();
        return;
      }

      // Clear formatting keyboard shortcut (Ctrl+\ / Cmd+\)
      if (isMod && key === '\\') {
        e.preventDefault();
        applyFormat('clearFormatting');
        return;
      }

      // Handle Enter inside Task List items
      if (e.key === 'Enter' && !e.shiftKey) {
        const selection = window.getSelection();
        if (selection && selection.rangeCount > 0 && editorRef.current) {
          let node: Node | null = selection.anchorNode;
          let taskLi: HTMLElement | null = null;
          while (node && node !== editorRef.current) {
            if (node.nodeType === Node.ELEMENT_NODE && (node as HTMLElement).classList.contains('task-item')) {
              taskLi = node as HTMLElement;
              break;
            }
            node = node.parentNode;
          }

          if (taskLi) {
            const taskTextEl = taskLi.querySelector('.task-text') as HTMLElement | null;
            const textContent = (taskTextEl ? taskTextEl.innerText : taskLi.innerText).trim();

            if (textContent === '') {
              // Empty task line: convert to paragraph and exit task list
              e.preventDefault();
              const p = document.createElement('p');
              p.innerHTML = '<br>';
              const ul = taskLi.closest('ul');
              if (ul && ul.children.length === 1) {
                ul.replaceWith(p);
              } else {
                taskLi.remove();
                if (ul) ul.after(p);
              }
              const range = document.createRange();
              range.setStart(p, 0);
              range.collapse(true);
              selection.removeAllRanges();
              selection.addRange(range);
              handleInput();
              return;
            } else {
              // Add new task item below
              e.preventDefault();
              const newLi = document.createElement('li');
              newLi.className = 'task-item';
              newLi.setAttribute('data-task', 'true');
              newLi.setAttribute('data-checked', 'false');
              newLi.innerHTML =
                '<span contenteditable="false" class="task-checkbox-wrapper">' +
                '<input type="checkbox" class="task-checkbox" />' +
                '</span>' +
                '<span class="task-text"><br></span>';
              taskLi.after(newLi);

              const span = newLi.querySelector('.task-text');
              if (span) {
                const range = document.createRange();
                range.setStart(span, 0);
                range.collapse(true);
                selection.removeAllRanges();
                selection.addRange(range);
              }
              handleInput();
              return;
            }
          }
        }
      }

      // Handle Backspace on Empty Task Item
      if (e.key === 'Backspace') {
        const selection = window.getSelection();
        if (selection && selection.rangeCount > 0 && editorRef.current) {
          let node: Node | null = selection.anchorNode;
          let taskLi: HTMLElement | null = null;
          while (node && node !== editorRef.current) {
            if (node.nodeType === Node.ELEMENT_NODE && (node as HTMLElement).classList.contains('task-item')) {
              taskLi = node as HTMLElement;
              break;
            }
            node = node.parentNode;
          }

          if (taskLi) {
            const taskTextEl = taskLi.querySelector('.task-text') as HTMLElement | null;
            const textContent = (taskTextEl ? taskTextEl.innerText : taskLi.innerText).trim();
            if (textContent === '') {
              e.preventDefault();
              const p = document.createElement('p');
              p.innerHTML = '<br>';
              const ul = taskLi.closest('ul');
              if (ul && ul.children.length === 1) {
                ul.replaceWith(p);
              } else {
                taskLi.remove();
                if (ul) ul.after(p);
              }
              const range = document.createRange();
              range.setStart(p, 0);
              range.collapse(true);
              selection.removeAllRanges();
              selection.addRange(range);
              handleInput();
              return;
            }
          }
        }
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
        onClick={handleClick}
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
