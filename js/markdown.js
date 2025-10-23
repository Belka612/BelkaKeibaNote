'use strict';

/**
 * markdown.js - 最小限のMarkdownレンダラ
 */

function escapeHtml(text) {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function slugify(text) {
  return text
    .normalize('NFKC')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^\p{Letter}\p{Number}\-]/gu, '')
    .slice(0, 64) || 'heading';
}

function withInlineCodePlaceholders(text, formatter) {
  const placeholders = [];
  const replaced = text.replace(/`([^`]+)`/g, (_match, code) => {
    const index = placeholders.length;
    placeholders.push(code);
    return `\uE000${index}\uE000`;
  });

  let formatted = formatter(replaced);

  placeholders.forEach((code, index) => {
    const token = `\uE000${index}\uE000`;
    const escapedCode = escapeHtml(code);
    formatted = formatted.replaceAll(token, `<code>${escapedCode}</code>`);
  });

  return formatted;
}

function applyInlineFormatting(text) {
  return withInlineCodePlaceholders(text, (input) => input
    .replace(/\[(.+?)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/__(.+?)__/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/_(.+?)_/g, '<em>$1</em>')
    .replace(/~~(.+?)~~/g, '<s>$1</s>')
  );
}

function isTableSeparator(line) {
  if (!line) return false;
  const cells = splitTableCells(line);
  if (!cells.length) return false;
  return cells.every((cell) => /^:?-{1,}:?$/.test(cell));
}

function isTableRow(line) {
  if (!line || !line.includes('|')) return false;
  const cells = splitTableCells(line);
  return cells.length > 1;
}

function splitTableCells(line) {
  return line
    .trim()
    .replace(/^\|/, '')
    .replace(/\|$/, '')
    .split('|')
    .map((cell) => cell.trim());
}

function getColumnAlignments(separatorLine, columnCount) {
  const rawAligns = splitTableCells(separatorLine);
  return Array.from({ length: columnCount }).map((_, index) => {
    const cell = rawAligns[index] || '';
    const startsWithColon = cell.startsWith(':');
    const endsWithColon = cell.endsWith(':');
    if (startsWithColon && endsWithColon) return 'center';
    if (endsWithColon) return 'right';
    if (startsWithColon) return 'left';
    return '';
  });
}

function renderTable(headers, alignments, rows) {
  const headerHtml = headers.map((header, index) => {
    const content = applyInlineFormatting(escapeHtml(header));
    const alignAttr = alignments[index] ? ` style="text-align: ${alignments[index]};"` : '';
    return `<th${alignAttr}>${content}</th>`;
  }).join('');

  const bodyHtml = rows.map((row) => {
    const cells = row.map((cell, index) => {
      const content = applyInlineFormatting(escapeHtml(cell));
      const alignAttr = alignments[index] ? ` style="text-align: ${alignments[index]};"` : '';
      return `<td${alignAttr}>${content}</td>`;
    }).join('');
    return `<tr>${cells}</tr>`;
  }).join('');

  return `<div class="c-article__table"><table><thead><tr>${headerHtml}</tr></thead><tbody>${bodyHtml}</tbody></table></div>`;
}

export function parseMarkdown(markdown) {
  const lines = markdown.replace(/\r\n/g, '\n').split('\n');
  let html = '';
  const headings = [];

  let currentList = null;
  let inCodeBlock = false;
  let codeLanguage = '';
  const codeLines = [];

  const closeList = () => {
    if (!currentList) return;
    html += currentList.type === 'ol' ? '</ol>' : '</ul>';
    currentList = null;
  };

  const ensureList = (type, start = 1) => {
    if (currentList && currentList.type === type) {
      if (type === 'ol' && typeof currentList.next !== 'number') {
        currentList.next = start;
      }
      return;
    }
    closeList();
    if (type === 'ol') {
      html += start !== 1 ? `<ol start="${start}">` : '<ol>';
      currentList = { type: 'ol', next: start };
    } else {
      html += '<ul>';
      currentList = { type: 'ul' };
    }
  };

  const flushCodeBlock = () => {
    if (!inCodeBlock) return;
    const code = escapeHtml(codeLines.join('\n'));
    const langAttr = codeLanguage ? ` class="language-${codeLanguage}" data-lang="${codeLanguage}"` : '';
    html += `<pre><code${langAttr}>${code}</code></pre>`;
    inCodeBlock = false;
    codeLanguage = '';
    codeLines.length = 0;
  };

  for (let i = 0; i < lines.length; i += 1) {
    const rawLine = lines[i];
    const line = rawLine.replace(/\r/g, '');
    const trimmed = line.trim();

    if (inCodeBlock) {
      if (/^```/.test(trimmed)) {
        flushCodeBlock();
        continue;
      }
      codeLines.push(rawLine);
      continue;
    }

    if (!trimmed) {
      closeList();
      continue;
    }

    const fenceStart = trimmed.match(/^```(\w+)?\s*$/);
    if (fenceStart) {
      closeList();
      inCodeBlock = true;
      codeLanguage = fenceStart[1] ? fenceStart[1].toLowerCase() : '';
      codeLines.length = 0;
      continue;
    }

    const headingMatch = trimmed.match(/^(#{1,6})\s+(.+)/);
    if (headingMatch) {
      closeList();
      const level = headingMatch[1].length;
      const headingText = headingMatch[2];
      const content = applyInlineFormatting(escapeHtml(headingText));
      const slug = slugify(headingText);
      headings.push({ level, text: headingText, id: slug });
      html += `<h${level} id="${slug}" data-heading-id="${slug}">${content}</h${level}>`;
      continue;
    }

    if (/^([-*_])\1{2,}$/.test(trimmed.replace(/\s+/g, ''))) {
      closeList();
      html += '<hr />';
      continue;
    }

    const nextLine = lines[i + 1] ? lines[i + 1].replace(/\r/g, '') : '';
    if (isTableRow(line) && isTableSeparator(nextLine)) {
      closeList();
      const headers = splitTableCells(line);
      const alignments = getColumnAlignments(nextLine, headers.length);
      const rows = [];
      let j = i + 2;
      for (; j < lines.length; j += 1) {
        const candidateRaw = lines[j];
        const candidate = candidateRaw.replace(/\r/g, '');
        if (!candidate.trim()) {
          break;
        }
        if (!isTableRow(candidate)) {
          break;
        }
        rows.push(splitTableCells(candidate));
      }
      html += renderTable(headers, alignments, rows);
      i = j - 1;
      continue;
    }

    const orderedMatch = trimmed.match(/^(\d+)\.\s+(.+)/);
    if (orderedMatch) {
      const value = parseInt(orderedMatch[1], 10);
      ensureList('ol', Number.isNaN(value) ? 1 : value);
      const content = applyInlineFormatting(escapeHtml(orderedMatch[2]));
      const needsValueAttr = currentList.next !== value;
      html += `<li${needsValueAttr ? ` value="${value}"` : ''}>${content}</li>`;
      currentList.next = value + 1;
      continue;
    }

    const listMatch = trimmed.match(/^[-*+]\s+(.+)/);
    if (listMatch) {
      ensureList('ul');
      const itemContent = applyInlineFormatting(escapeHtml(listMatch[1]));
      html += `<li>${itemContent}</li>`;
      continue;
    }

    const quoteMatch = trimmed.match(/^>\s?(.*)/);
    if (quoteMatch) {
      closeList();
      const quoteContent = applyInlineFormatting(escapeHtml(quoteMatch[1]));
      html += `<blockquote>${quoteContent}</blockquote>`;
      continue;
    }

    closeList();
    const paragraph = applyInlineFormatting(escapeHtml(trimmed));
    html += `<p>${paragraph}</p>`;
  }

  flushCodeBlock();
  closeList();

  return { html, headings };
}
