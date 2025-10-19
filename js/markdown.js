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
    .trim()
    .toLowerCase()
    .replace(/[\s]+/g, '-')
    .replace(/[^a-z0-9\-ぁ-んァ-ヶ一-龠]/g, '')
    .slice(0, 64) || 'heading';
}

function applyInlineFormatting(text) {
  let formatted = text;
  formatted = formatted.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  formatted = formatted.replace(/__(.+?)__/g, '<strong>$1</strong>');
  formatted = formatted.replace(/\*(.+?)\*/g, '<em>$1</em>');
  formatted = formatted.replace(/_(.+?)_/g, '<em>$1</em>');
  formatted = formatted.replace(/\[(.+?)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');
  return formatted;
}

export function parseMarkdown(markdown) {
  const lines = markdown.replace(/\r\n/g, '\n').split('\n');
  let html = '';
  let inList = false;
  const headings = [];

  const closeList = () => {
    if (inList) {
      html += '</ul>';
      inList = false;
    }
  };

  for (const rawLine of lines) {
    const line = rawLine.trimEnd();
    if (!line.trim()) {
      closeList();
      html += '';
      continue;
    }

    const headingMatch = line.match(/^(#{1,6})\s+(.+)/);
    if (headingMatch) {
      closeList();
      const level = headingMatch[1].length;
      const content = applyInlineFormatting(escapeHtml(headingMatch[2]));
      const slug = slugify(headingMatch[2]);
      headings.push({ level, text: headingMatch[2], id: slug });
      html += `<h${level} id="${slug}" data-heading-id="${slug}">${content}</h${level}>`;
      continue;
    }

    const listMatch = line.match(/^[-*]\s+(.+)/);
    if (listMatch) {
      if (!inList) {
        html += '<ul>';
        inList = true;
      }
      const itemContent = applyInlineFormatting(escapeHtml(listMatch[1]));
      html += `<li>${itemContent}</li>`;
      continue;
    }

    const quoteMatch = line.match(/^>\s?(.*)/);
    if (quoteMatch) {
      closeList();
      const quoteContent = applyInlineFormatting(escapeHtml(quoteMatch[1]));
      html += `<blockquote>${quoteContent}</blockquote>`;
      continue;
    }

    closeList();
    const paragraph = applyInlineFormatting(escapeHtml(line));
    html += `<p>${paragraph}</p>`;
  }

  closeList();

  return { html, headings };
}

