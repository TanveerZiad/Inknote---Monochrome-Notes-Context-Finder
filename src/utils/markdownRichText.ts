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

    // Task / Checklist item: - [ ] item or - [x] item
    const taskMatch = line.match(/^(\s*)[-*+]\s+\[([ xX])\]\s*(.*)$/);
    if (taskMatch) {
      if (!inList || listTag !== 'ul') {
        if (inList) htmlParts.push(`</${listTag}>`);
        htmlParts.push('<ul class="task-list">');
        inList = true;
        listTag = 'ul';
      }
      const isChecked = taskMatch[2].toLowerCase() === 'x';
      const text = taskMatch[3].trim();
      htmlParts.push(
        `<li class="task-item${isChecked ? ' is-completed' : ''}" data-task="true" data-checked="${isChecked}">` +
          `<span contenteditable="false" class="task-checkbox-wrapper">` +
            `<input type="checkbox" ${isChecked ? 'checked' : ''} class="task-checkbox" />` +
          `</span>` +
          `<span class="task-text">${formatInline(text) || '<br>'}</span>` +
        `</li>`
      );
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

    // Table: | col1 | col2 |
    const tableRowMatch = line.trim().match(/^\|(.+)\|$/);
    if (tableRowMatch) {
      if (inList) {
        htmlParts.push(`</${listTag}>`);
        inList = false;
      }
      const rows: string[] = [line];
      while (i + 1 < lines.length && lines[i + 1].trim().match(/^\|(.+)\|$/)) {
        rows.push(lines[++i]);
      }
      if (rows.length >= 2 && rows[1].includes('-')) {
        const parseRow = (r: string) =>
          r.trim().replace(/^\||\|$/g, '').split('|').map((c) => c.trim());
        const headerCells = parseRow(rows[0]);
        let tableHtml = '<div class="table-wrapper"><table class="editor-table"><thead><tr>';
        headerCells.forEach((c) => {
          tableHtml += `<th>${formatInline(c)}</th>`;
        });
        tableHtml += '</tr></thead><tbody>';
        for (let r = 2; r < rows.length; r++) {
          tableHtml += '<tr>';
          const cells = parseRow(rows[r]);
          cells.forEach((c) => {
            tableHtml += `<td>${formatInline(c)}</td>`;
          });
          tableHtml += '</tr>';
        }
        tableHtml += '</tbody></table></div>';
        htmlParts.push(tableHtml);
        continue;
      }
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
      const alignMatch = line.match(/^<p align="(left|center|right|justify)">(.*?)<\/p>$/i);
      if (alignMatch) {
        htmlParts.push(`<p style="text-align: ${alignMatch[1]}">${formatInline(alignMatch[2])}</p>`);
      } else {
        htmlParts.push(`<p>${formatInline(line)}</p>`);
      }
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

  // Underline (<u>text</u> or <ins>text</ins>)
  res = res.replace(/&lt;u&gt;(.*?)&lt;\/u&gt;/gi, '<u>$1</u>');
  res = res.replace(/&lt;ins&gt;(.*?)&lt;\/ins&gt;/gi, '<u>$1</u>');

  // Strikethrough (~~text~~)
  res = res.replace(/~~(.*?)~~/g, '<s>$1</s>');

  // Highlight (==text== or <mark>text</mark>)
  res = res.replace(/==(.*?)==/g, '<mark>$1</mark>');
  res = res.replace(/&lt;mark&gt;(.*?)&lt;\/mark&gt;/gi, '<mark>$1</mark>');

  // Code (`code`)
  res = res.replace(/`([^`]+)`/g, '<code>$1</code>');

  // Images (![alt](url)) - parsed before Links
  res = res.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1" class="editor-inline-image" />');

  // Links ([text](url))
  res = res.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');

  // Autolink bare URLs (not already part of an href or src)
  res = res.replace(/(^|[\s(])(https?:\/\/[^\s)<>"]+)/g, '$1<a href="$2" target="_blank" rel="noopener noreferrer">$2</a>');

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

      const isUnderline =
        tag === 'u' ||
        tag === 'ins' ||
        el.style.textDecoration.includes('underline');

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

      if (isUnderline && !parentTags.includes('u') && !parentTags.includes('ins')) {
        if (!childText.trim()) return childText;
        const leading = childText.match(/^\s*/)?.[0] || '';
        const trailing = childText.match(/\s*$/)?.[0] || '';
        const trimmed = childText.slice(leading.length, childText.length - trailing.length);
        return `${leading}<u>${trimmed}</u>${trailing}`;
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
          const checkbox = el.querySelector('input[type="checkbox"]') as HTMLInputElement | null;
          const isTask = el.getAttribute('data-task') === 'true' || el.classList.contains('task-item') || !!checkbox;

          if (isTask) {
            const isChecked = checkbox ? checkbox.checked : el.getAttribute('data-checked') === 'true';
            const taskTextEl = el.querySelector('.task-text') as HTMLElement | null;
            let text = '';
            if (taskTextEl) {
              text = serializeNode(taskTextEl, currentTags).trim();
            } else {
              const textParts: string[] = [];
              el.childNodes.forEach((child) => {
                if (child.nodeType === Node.ELEMENT_NODE) {
                  const chel = child as HTMLElement;
                  if (chel.tagName.toLowerCase() === 'input' || chel.classList.contains('task-checkbox-wrapper')) {
                    return;
                  }
                }
                textParts.push(serializeNode(child, currentTags));
              });
              text = textParts.join('').trim();
            }
            const cleanText = text.replace(/^[-\*\+]\s*\[[ xX]\]\s*/, '').replace(/^\[[ xX]\]\s*/, '');
            return `- [${isChecked ? 'x' : ' '}] ${cleanText}\n`;
          }

          const trimmed = childText.trim();
          if (trimmed.startsWith('- [ ] ') || trimmed.startsWith('- [x] ') || trimmed.startsWith('- [X] ')) {
            return `${trimmed}\n`;
          }
          if (trimmed.startsWith('[ ] ') || trimmed.startsWith('[x] ') || trimmed.startsWith('[X] ')) {
            return `- ${trimmed}\n`;
          }

          const parentTag = parentTags[parentTags.length - 2] || (el.parentElement?.tagName.toLowerCase());
          if (parentTag === 'ol') {
            let index = 1;
            if (el.parentElement) {
              const liSiblings = Array.from(el.parentElement.children).filter((c) => c.tagName.toLowerCase() === 'li');
              const idx = liSiblings.indexOf(el);
              if (idx !== -1) index = idx + 1;
            }
            return `${index}. ${trimmed}\n`;
          }

          return `- ${trimmed}\n`;
        }
        case 'ul':
        case 'ol': {
          const trimmed = childText.trim();
          return trimmed ? `${trimmed}\n\n` : '';
        }
        case 'table': {
          const rows = Array.from(el.querySelectorAll('tr'));
          if (rows.length === 0) return '';
          const markdownRows: string[] = [];
          rows.forEach((row, rowIndex) => {
            const cells = Array.from(row.querySelectorAll('th, td'));
            const cellTexts = cells.map((cell) => serializeNode(cell, currentTags).trim().replace(/\n/g, ' '));
            markdownRows.push(`| ${cellTexts.join(' | ')} |`);
            if (rowIndex === 0) {
              markdownRows.push(`| ${cells.map(() => '---').join(' | ')} |`);
            }
          });
          return `${markdownRows.join('\n')}\n\n`;
        }
        case 'th':
        case 'td': {
          return childText.trim();
        }
        case 'mark': {
          if (!childText.trim()) return childText;
          const leading = childText.match(/^\s*/)?.[0] || '';
          const trailing = childText.match(/\s*$/)?.[0] || '';
          const trimmed = childText.slice(leading.length, childText.length - trailing.length);
          return `${leading}==${trimmed}==${trailing}`;
        }
        case 'img': {
          const src = el.getAttribute('src') || '';
          const alt = el.getAttribute('alt') || 'image';
          return `![${alt}](${src})\n\n`;
        }
        case 'p':
        case 'div': {
          if (childText === '' || childText === '<br>' || childText === '\n') {
            return '\n';
          }
          const align = el.style.textAlign || el.getAttribute('align');
          if (align && align !== 'left' && align !== 'start') {
            return `<p align="${align}">${childText.trim()}</p>\n\n`;
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
