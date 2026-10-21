/**
 * Utility functions for converting between Markdown storage format
 * and rich-text HTML editable representation.
 */

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/**
 * Normalizes any previously duplicated or corrupted markdown delimiters,
 * such as ****bbbb****, ** **bbbb** **, ____bbbb____, etc.
 */
export function cleanCorruptedDelimiters(text: string): string {
  if (!text) return '';
  return text
    // Quadruple or duplicated bold asterisks
    .replace(/\*{2,}\s*\*{2,}(.*?)\*{2,}\s*\*{2,}/g, '**$1**')
    .replace(/\*{4,}(.*?)\*{4,}/g, '**$1**')
    // Quadruple or duplicated bold underscores
    .replace(/_{2,}\s*_{2,}(.*?)_{2,}\s*_{2,}/g, '__$1__')
    .replace(/_{4,}(.*?)_{4,}/g, '__$1__');
}

/**
 * Converts Markdown string to clean semantic HTML for contenteditable rich text editing.
 */
export function markdownToHtml(rawMarkdown: string): string {
  if (!rawMarkdown) return '<p><br></p>';
  const markdown = cleanCorruptedDelimiters(rawMarkdown);

  const lines = markdown.split('\n');
  const htmlParts: string[] = [];
  let inList = false;
  let listTag: 'ul' | 'ol' = 'ul';

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Heading: # H1, ## H2, ### H3, etc.
    const headingMatch = line.match(/^(#{1,6})\s+(.*)$/);
    if (headingMatch) {
      if (inList) {
        htmlParts.push(`</${listTag}>`);
        inList = false;
      }
      const level = headingMatch[1].length;
      htmlParts.push(`<h${level}>${formatInline(headingMatch[2])}</h${level}>`);
      continue;
    }

    // Bullet list: - item or * item
    const bulletMatch = line.match(/^(\s*)[-*]\s+(.*)$/);
    if (bulletMatch) {
      if (!inList || listTag !== 'ul') {
        if (inList) htmlParts.push(`</${listTag}>`);
        htmlParts.push('<ul>');
        inList = true;
        listTag = 'ul';
      }
      htmlParts.push(`<li>${formatInline(bulletMatch[2])}</li>`);
      continue;
    }

    // Numbered list: 1. item or 1) item
    const numMatch = line.match(/^(\s*)\d+[\.\)]\s+(.*)$/);
    if (numMatch) {
      if (!inList || listTag !== 'ol') {
        if (inList) htmlParts.push(`</${listTag}>`);
        htmlParts.push('<ol>');
        inList = true;
        listTag = 'ol';
      }
      htmlParts.push(`<li>${formatInline(numMatch[2])}</li>`);
      continue;
    }

    // Close any open list
    if (inList) {
      htmlParts.push(`</${listTag}>`);
      inList = false;
    }

    // Empty line creates an empty paragraph with <br>
    if (line.trim() === '') {
      htmlParts.push('<p><br></p>');
    } else {
      htmlParts.push(`<p>${formatInline(line)}</p>`);
    }
  }

  if (inList) {
    htmlParts.push(`</${listTag}>`);
  }

  return htmlParts.join('');
}

function formatInline(text: string): string {
  let res = escapeHtml(text);

  // Bold & Italic (***text*** or ___text___)
  res = res.replace(/(\*\*\*|___)(.*?)\1/g, '<strong><em>$2</em></strong>');

  // Bold (**text** or __text__)
  res = res.replace(/(\*\*|__)(.*?)\1/g, '<strong>$2</strong>');

  // Italic (*text* or _text_)
  res = res.replace(/(\*)(.*?)\1/g, '<em>$2</em>');
  res = res.replace(/(^|\s|\W)_(.*?)_($|\s|\W)/g, '$1<em>$2</em>$3');

  // Strikethrough (~~text~~)
  res = res.replace(/~~(.*?)~~/g, '<s>$1</s>');

  // Code (`code`)
  res = res.replace(/`([^`]+)`/g, '<code>$1</code>');

  // Links ([text](url))
  res = res.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');

  return res;
}

/**
 * Converts a contenteditable DOM element back into standard Markdown string.
 */
export function htmlToMarkdown(root: HTMLElement): string {
  const serializeNode = (node: Node, parentTags: string[] = []): string => {
    if (node.nodeType === Node.TEXT_NODE) {
      return node.nodeValue || '';
    }

    if (node.nodeType === Node.ELEMENT_NODE) {
      const el = node as HTMLElement;
      const tag = el.tagName.toLowerCase();
      const currentTags = [...parentTags, tag];

      // Recursively serialize children
      const childText = Array.from(el.childNodes)
        .map((child) => serializeNode(child, currentTags))
        .join('');

      // Check inline styles (some browsers output span with font-weight/font-style)
      const isBold =
        tag === 'strong' ||
        tag === 'b' ||
        el.style.fontWeight === 'bold' ||
        parseInt(el.style.fontWeight || '0', 10) >= 600;

      const isItalic =
        tag === 'em' ||
        tag === 'i' ||
        el.style.fontStyle === 'italic';

      const isStrike =
        tag === 's' ||
        tag === 'del' ||
        tag === 'strike' ||
        el.style.textDecoration.includes('line-through');

      if (isBold && !parentTags.includes('strong') && !parentTags.includes('b')) {
        if (!childText.trim()) return childText;
        const leading = childText.match(/^\s*/)?.[0] || '';
        const trailing = childText.match(/\s*$/)?.[0] || '';
        const trimmed = childText.slice(leading.length, childText.length - trailing.length);
        return `${leading}**${trimmed}**${trailing}`;
      }

      if (isItalic && !parentTags.includes('em') && !parentTags.includes('i')) {
        if (!childText.trim()) return childText;
        const leading = childText.match(/^\s*/)?.[0] || '';
        const trailing = childText.match(/\s*$/)?.[0] || '';
        const trimmed = childText.slice(leading.length, childText.length - trailing.length);
        return `${leading}*${trimmed}*${trailing}`;
      }

      if (isStrike && !parentTags.includes('s') && !parentTags.includes('del') && !parentTags.includes('strike')) {
        if (!childText.trim()) return childText;
        const leading = childText.match(/^\s*/)?.[0] || '';
        const trailing = childText.match(/\s*$/)?.[0] || '';
        const trimmed = childText.slice(leading.length, childText.length - trailing.length);
        return `${leading}~~${trimmed}~~${trailing}`;
      }

      switch (tag) {
        case 'code': {
          if (parentTags.includes('code') || parentTags.includes('pre')) {
            return childText;
          }
          return `\`${childText}\``;
        }
        case 'a': {
          const href = el.getAttribute('href') || '';
          return `[${childText}](${href})`;
        }
        case 'h1': {
          return `# ${childText.trim()}\n\n`;
        }
        case 'h2': {
          return `## ${childText.trim()}\n\n`;
        }
        case 'h3': {
          return `### ${childText.trim()}\n\n`;
        }
        case 'h4': {
          return `#### ${childText.trim()}\n\n`;
        }
        case 'h5': {
          return `##### ${childText.trim()}\n\n`;
        }
        case 'h6': {
          return `###### ${childText.trim()}\n\n`;
        }
        case 'li': {
          const trimmed = childText.trim();
          if (trimmed.startsWith('- [ ] ') || trimmed.startsWith('- [x] ') || trimmed.startsWith('- [X] ')) {
            return `${trimmed}\n`;
          }
          if (trimmed.startsWith('[ ] ') || trimmed.startsWith('[x] ') || trimmed.startsWith('[X] ')) {
            return `- ${trimmed}\n`;
          }
          return `- ${trimmed}\n`;
        }
        case 'ul':
        case 'ol': {
          return `${childText.trim()}\n\n`;
        }
        case 'p':
        case 'div': {
          if (childText === '' || childText === '<br>' || childText === '\n') {
            return '\n';
          }
          return `${childText}\n`;
        }
        case 'br': {
          return '\n';
        }
        default:
          return childText;
      }
    }
    return '';
  };

  const raw = Array.from(root.childNodes)
    .map((node) => serializeNode(node))
    .join('');

  return raw.replace(/\n{3,}/g, '\n\n').trim();
}
