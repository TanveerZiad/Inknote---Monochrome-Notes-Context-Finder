/**
 * Shared text rules for note editing and previewing.
 *
 * The source stays plain Markdown. We only canonicalize line endings so text
 * entered on any platform has one representation, while every intentional
 * blank line remains part of the note.
 */
export const normalizeNoteText = (value: string | undefined): string =>
  (value || '').replace(/\r\n?/g, '\n');

export const isNoteTextEmpty = (value: string | undefined): boolean =>
  normalizeNoteText(value).trim().length === 0;

export const getEditorHeight = (textarea: HTMLTextAreaElement, minimum = 180): number => {
  textarea.style.height = 'auto';
  return Math.max(minimum, textarea.scrollHeight);
};

export const resizeNoteEditor = (textarea: HTMLTextAreaElement, minimum = 180): void => {
  textarea.style.height = `${getEditorHeight(textarea, minimum)}px`;
};

export type FormattingType = 'bold' | 'italic' | 'strikethrough' | 'code' | 'codeblock' | 'quote' | 'link';

export function applyMarkdownFormatting(
  textarea: HTMLTextAreaElement,
  type: FormattingType
): { newContent: string; newSelectionStart: number; newSelectionEnd: number } {
  const value = textarea.value;
  const start = textarea.selectionStart;
  const end = textarea.selectionEnd;
  const selectedText = value.slice(start, end);

  let prefix = '';
  let suffix = '';
  let defaultPlaceholder = '';

  switch (type) {
    case 'bold':
      prefix = '**';
      suffix = '**';
      defaultPlaceholder = 'bold text';
      break;
    case 'italic':
      prefix = '*';
      suffix = '*';
      defaultPlaceholder = 'italic text';
      break;
    case 'strikethrough':
      prefix = '~~';
      suffix = '~~';
      defaultPlaceholder = 'strikethrough text';
      break;
    case 'code':
      prefix = '`';
      suffix = '`';
      defaultPlaceholder = 'code';
      break;
    case 'codeblock':
      prefix = '```\n';
      suffix = '\n```';
      defaultPlaceholder = 'code block';
      break;
    case 'quote':
      prefix = '> ';
      suffix = '';
      defaultPlaceholder = 'quote';
      break;
    case 'link':
      prefix = '[';
      suffix = '](url)';
      defaultPlaceholder = 'link text';
      break;
  }

  // Check if selectedText itself includes formatting delimiters
  if (selectedText) {
    if (type === 'bold') {
      const match = selectedText.match(/^(\*{2,}|_{2,})\s*(.*?)\s*(\*{2,}|_{2,})$/);
      if (match) {
        const unwrapped = match[2];
        const newContent = value.slice(0, start) + unwrapped + value.slice(end);
        return {
          newContent,
          newSelectionStart: start,
          newSelectionEnd: start + unwrapped.length,
        };
      }
    } else if (type === 'italic') {
      const match = selectedText.match(/^(\*|_)\s*(.*?)\s*(\*|_)$/);
      if (match && !match[2].startsWith('*') && !match[2].startsWith('_')) {
        const unwrapped = match[2];
        const newContent = value.slice(0, start) + unwrapped + value.slice(end);
        return {
          newContent,
          newSelectionStart: start,
          newSelectionEnd: start + unwrapped.length,
        };
      }
    } else if (prefix && suffix && selectedText.startsWith(prefix) && selectedText.endsWith(suffix) && selectedText.length >= prefix.length + suffix.length) {
      const unwrapped = selectedText.slice(prefix.length, selectedText.length - suffix.length);
      const newContent = value.slice(0, start) + unwrapped + value.slice(end);
      return {
        newContent,
        newSelectionStart: start,
        newSelectionEnd: start + unwrapped.length,
      };
    }
  }

  // Toggle formatting if already wrapped by delimiters
  if (type === 'bold') {
    const isAsteriskWrapped =
      value.slice(start - 2, start) === '**' && value.slice(end, end + 2) === '**';
    const isUnderscoreWrapped =
      value.slice(start - 2, start) === '__' && value.slice(end, end + 2) === '__';
    if (isAsteriskWrapped || isUnderscoreWrapped) {
      const unformatted = value.slice(0, start - 2) + selectedText + value.slice(end + 2);
      return {
        newContent: unformatted,
        newSelectionStart: start - 2,
        newSelectionEnd: end - 2,
      };
    }
  } else if (type === 'italic') {
    const isAsteriskWrapped =
      value.slice(start - 1, start) === '*' &&
      value.slice(end, end + 1) === '*' &&
      value.slice(start - 2, start) !== '**' &&
      value.slice(end, end + 2) !== '**';
    const isUnderscoreWrapped =
      value.slice(start - 1, start) === '_' &&
      value.slice(end, end + 1) === '_' &&
      value.slice(start - 2, start) !== '__' &&
      value.slice(end, end + 2) !== '__';
    if (isAsteriskWrapped || isUnderscoreWrapped) {
      const unformatted = value.slice(0, start - 1) + selectedText + value.slice(end + 1);
      return {
        newContent: unformatted,
        newSelectionStart: start - 1,
        newSelectionEnd: end - 1,
      };
    }
  } else if (
    selectedText &&
    prefix &&
    suffix &&
    value.slice(start - prefix.length, start) === prefix &&
    value.slice(end, end + suffix.length) === suffix
  ) {
    const unformatted = value.slice(0, start - prefix.length) + selectedText + value.slice(end + suffix.length);
    return {
      newContent: unformatted,
      newSelectionStart: start - prefix.length,
      newSelectionEnd: end - prefix.length,
    };
  }

  const textToWrap = selectedText || defaultPlaceholder;
  const newContent = value.slice(0, start) + prefix + textToWrap + suffix + value.slice(end);

  const newSelectionStart = selectedText ? start : start + prefix.length;
  const newSelectionEnd = selectedText ? end + prefix.length + suffix.length : start + prefix.length + textToWrap.length;

  return { newContent, newSelectionStart, newSelectionEnd };
}

export function handleSmartEnterList(textarea: HTMLTextAreaElement): {
  handled: boolean;
  newContent: string;
  newCursorPos: number;
} | null {
  const value = textarea.value;
  const start = textarea.selectionStart;
  const end = textarea.selectionEnd;

  // Only handle single cursor without multi-character selection range
  if (start !== end) return null;

  const textBeforeCursor = value.slice(0, start);
  const textAfterCursor = value.slice(start);

  const linesBefore = textBeforeCursor.split('\n');
  const currentLine = linesBefore[linesBefore.length - 1];

  // 1. Check for Numbered List e.g. "1. ", "  2. ", "1) ", "  12) "
  const numberMatch = currentLine.match(/^(\s*)(\d+)([\.\)])(\s+)(.*)$/);
  if (numberMatch) {
    const indent = numberMatch[1];
    const num = parseInt(numberMatch[2], 10);
    const delim = numberMatch[3];
    const itemContent = numberMatch[5];

    // Empty list item: clear prefix line and terminate numbered list
    if (itemContent.trim() === '') {
      const lineStartIndex = start - currentLine.length;
      const newContent = value.slice(0, lineStartIndex) + textAfterCursor;
      return {
        handled: true,
        newContent,
        newCursorPos: lineStartIndex,
      };
    }

    // Continue numbered list with incremented number
    const nextNum = num + 1;
    const prefix = `\n${indent}${nextNum}${delim} `;
    const newContent = textBeforeCursor + prefix + textAfterCursor;
    return {
      handled: true,
      newContent,
      newCursorPos: start + prefix.length,
    };
  }

  // 2. Check for Checklist e.g. "- [ ] ", "- [x] ", "* [ ] "
  const checkMatch = currentLine.match(/^(\s*)([-*+]\s+\[[ xX]\])(\s+)(.*)$/);
  if (checkMatch) {
    const indent = checkMatch[1];
    const itemContent = checkMatch[4];

    if (itemContent.trim() === '') {
      const lineStartIndex = start - currentLine.length;
      const newContent = value.slice(0, lineStartIndex) + textAfterCursor;
      return {
        handled: true,
        newContent,
        newCursorPos: lineStartIndex,
      };
    }

    const prefix = `\n${indent}- [ ] `;
    const newContent = textBeforeCursor + prefix + textAfterCursor;
    return {
      handled: true,
      newContent,
      newCursorPos: start + prefix.length,
    };
  }

  // 3. Check for Bullet List e.g. "- ", "* ", "+ "
  const bulletMatch = currentLine.match(/^(\s*)([-*+])(\s+)(.*)$/);
  if (bulletMatch) {
    const indent = bulletMatch[1];
    const bulletChar = bulletMatch[2];
    const itemContent = bulletMatch[4];

    if (itemContent.trim() === '') {
      const lineStartIndex = start - currentLine.length;
      const newContent = value.slice(0, lineStartIndex) + textAfterCursor;
      return {
        handled: true,
        newContent,
        newCursorPos: lineStartIndex,
      };
    }

    const prefix = `\n${indent}${bulletChar} `;
    const newContent = textBeforeCursor + prefix + textAfterCursor;
    return {
      handled: true,
      newContent,
      newCursorPos: start + prefix.length,
    };
  }

  return null;
}

