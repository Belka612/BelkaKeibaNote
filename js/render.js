'use strict';

import { renderInlineMarkdown } from './markdown.js';
import { buildPostUrl } from './router.js';

/**
 * render.js - カードやUIコンポーネントの描画
 */

function joinPath(rootPath, relativePath) {
  const root = rootPath.endsWith('/') ? rootPath.slice(0, -1) : rootPath;
  const relative = relativePath.replace(/^\.\//, '').replace(/^\//, '');
  if (root === '.' || root === '') {
    return `./${relative}`;
  }
  if (root === '..') {
    return `../${relative}`;
  }
  return `${root}/${relative}`;
}

function isExternal(url) {
  return /^https?:\/\//i.test(url);
}

export function resolveAssetPath(rootPath, asset) {
  if (!asset) return '';
  if (isExternal(asset)) return asset;
  return joinPath(rootPath, asset);
}

export function resolveInternalUrl(rootPath, url) {
  if (!url) return '#';
  if (isExternal(url)) return url;
  return joinPath(rootPath, url);
}

export function formatDate(dateString) {
  if (!dateString) return '';
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) {
    return dateString;
  }
  return new Intl.DateTimeFormat('ja-JP', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    weekday: 'short'
  }).format(date);
}

export function createNoImageElement(className = '') {
  const placeholder = document.createElement('div');
  placeholder.className = `c-no-image ${className}`.trim();
  placeholder.textContent = 'NO IMAGE';
  return placeholder;
}

export function renderFeaturedGrid(container, items, rootPath) {
  container.innerHTML = '';
  items.forEach((item) => {
    const link = document.createElement('a');
    link.className = 'c-featured-card';
    link.href = resolveInternalUrl(rootPath, item.url || '#');
    link.setAttribute('data-featured-item', item.title);

    const title = document.createElement('h3');
    title.className = 'c-featured-card__title';
    title.textContent = item.title;

    const date = document.createElement('p');
    date.className = 'c-featured-card__date';
    date.textContent = formatDate(item.date);

    const comment = document.createElement('p');
    comment.className = 'c-featured-card__comment';
    comment.innerHTML = renderInlineMarkdown(item.comment || '');

    link.append(title, date, comment);
    container.append(link);
  });
}

export function renderCategoryLinks(container, rootPath) {
  const categories = [
    {
      key: 'picks',
      title: '過去の重要予想と反省',
      description: '重賞や大勝負の振り返りノート。予想の改善点を記録。'
    },
    {
      key: 'horses',
      title: '注目馬の見解',
      description: '血統や調教のメモ。次走で狙いたい馬を整理。'
    },
    {
      key: 'chatter',
      title: '雑談',
      description: 'ニュース雑感や気軽なメモ。肩の力を抜いた更新。'
    },
    {
      key: 'column',
      title: 'コラム',
      description: '理論・データ分析をまとめた読み応えのある記事。'
    }
  ];
  container.innerHTML = '';
  categories.forEach((category) => {
    const card = document.createElement('article');
    card.className = 'c-card';

    const link = document.createElement('a');
    link.href = joinPath(rootPath, `pages/${category.key}.html`);
    link.className = 'c-card__link';
    link.setAttribute('data-category-link', category.key);

    const media = createNoImageElement('c-card__media');
    const body = document.createElement('div');
    body.className = 'c-card__body';

    const title = document.createElement('h3');
    title.className = 'c-card__title';
    title.textContent = category.title;

    const summary = document.createElement('p');
    summary.className = 'c-card__summary';
    summary.textContent = category.description;

    body.append(title, summary);
    link.append(media, body);
    card.append(link);
    container.append(card);
  });
}

export function renderCardGrid(container, items, category, rootPath) {
  container.innerHTML = '';
  items.forEach((item) => {
    const card = document.createElement('article');
    card.className = 'c-card';

    const link = document.createElement('a');
    link.href = resolveInternalUrl(rootPath, buildPostUrl(category, item.slug));
    link.className = 'c-card__link';
    link.setAttribute('aria-label', `${item.title} の詳細を開く`);

    let media;
    if (item.image) {
      const wrapper = document.createElement('div');
      wrapper.className = 'c-card__media';
      const img = document.createElement('img');
      img.loading = 'lazy';
      img.alt = item.title;
      img.src = resolveAssetPath(rootPath, item.image);
      wrapper.append(img);
      media = wrapper;
    } else {
      media = createNoImageElement('c-card__media');
    }

    const body = document.createElement('div');
    body.className = 'c-card__body';

    const title = document.createElement('h3');
    title.className = 'c-card__title';
    title.textContent = item.title;

    const meta = document.createElement('p');
    meta.className = 'c-card__meta';
    meta.textContent = formatDate(item.date);

    const summary = document.createElement('p');
    summary.className = 'c-card__summary';
    summary.innerHTML = renderInlineMarkdown(item.summary || '');

    const tags = document.createElement('div');
    tags.className = 'c-card__tags';
    (item.tags || []).forEach((tag) => {
      const chip = document.createElement('span');
      chip.className = 'c-chip';
      chip.textContent = tag;
      chip.setAttribute('data-tag-value', tag);
      tags.append(chip);
    });

    body.append(title, meta, summary, tags);
    link.append(media, body);
    card.append(link);
    container.append(card);
  });
}

export function renderTagFilters(container, tags, activeTags, onToggle) {
  container.innerHTML = '';
  if (!tags.length) {
    container.hidden = true;
    return;
  }
  container.hidden = false;
  tags.forEach((tag) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `c-chip${activeTags.has(tag) ? ' is-active' : ''}`;
    button.textContent = tag;
    button.setAttribute('data-filter-tag', tag);
    button.addEventListener('click', () => onToggle(tag));
    container.append(button);
  });
}

export function updateEmptyState(element, hasItems) {
  if (!element) return;
  element.hidden = hasItems;
}

export function renderArticleTags(container, tags) {
  container.innerHTML = '';
  if (!tags || !tags.length) {
    container.hidden = true;
    return;
  }
  container.hidden = false;
  tags.forEach((tag) => {
    const chip = document.createElement('span');
    chip.className = 'c-chip';
    chip.textContent = tag;
    container.append(chip);
  });
}

export function renderArticleNavigation(container, prevItem, nextItem, category, rootPath) {
  container.innerHTML = '';
  if (!prevItem && !nextItem) {
    container.hidden = true;
    return;
  }
  container.hidden = false;
  if (prevItem) {
    const link = document.createElement('a');
    link.href = resolveInternalUrl(rootPath, buildPostUrl(category, prevItem.slug));
    link.innerHTML = `<span class="c-article__nav-label">前の記事</span><span>${prevItem.title}</span>`;
    container.append(link);
  }
  if (nextItem) {
    const link = document.createElement('a');
    link.href = resolveInternalUrl(rootPath, buildPostUrl(category, nextItem.slug));
    link.innerHTML = `<span class="c-article__nav-label">次の記事</span><span>${nextItem.title}</span>`;
    container.append(link);
  }
}

export function renderToc(container, headings) {
  const tocWrapper = container.closest('[data-article-toc]');
  if (!headings.length) {
    if (tocWrapper) {
      tocWrapper.setAttribute('hidden', '');
    }
    container.innerHTML = '';
    return;
  }
  if (tocWrapper) {
    tocWrapper.removeAttribute('hidden');
  }
  container.innerHTML = '';
  headings.forEach((heading) => {
    const item = document.createElement('li');
    const link = document.createElement('a');
    link.href = `#${heading.id}`;
    link.textContent = heading.text;
    link.setAttribute('data-heading-level', heading.level);
    item.append(link);
    container.append(item);
  });
}

