'use strict';

import { fetchJson, fetchMd } from './fetchers.js';
import { parseMarkdown } from './markdown.js';
import { initHeroSlider } from './slider.js';
import {
  formatDate,
  renderArticleNavigation,
  renderArticleTags,
  renderCardGrid,
  renderCategoryLinks,
  renderFeaturedGrid,
  renderTagFilters,
  renderToc,
  resolveInternalUrl,
  updateEmptyState
} from './render.js';
import { buildContentPath, getQueryParam, normaliseCategoryName, parsePostParam } from './router.js';

function resolveDataPath(rootPath, fileName) {
  return resolveInternalUrl(rootPath, `data/${fileName}`);
}

async function injectPartial(targetId, rootPath, fileName) {
  const host = document.getElementById(targetId);
  if (!host) return;
  try {
    const response = await fetch(resolveInternalUrl(rootPath, `partials/${fileName}`));
    if (!response.ok) throw new Error(response.statusText);
    const html = await response.text();
    host.innerHTML = html;
  } catch (error) {
    console.error(`Failed to load partial: ${fileName}`, error);
  }
}

function setupNavigationLinks(rootPath) {
  const navLinks = document.querySelectorAll('[data-nav-link]');
  navLinks.forEach((link) => {
    const key = link.getAttribute('data-nav-link');
    if (!key) return;
    const path = key === 'home' ? 'index.html' : `pages/${key}.html`;
    link.href = resolveInternalUrl(rootPath, path);
  });
}

function highlightNavigation(key) {
  document.querySelectorAll('[data-nav-link]').forEach((link) => {
    if (link.getAttribute('data-nav-link') === key) {
      link.setAttribute('aria-current', 'page');
    } else {
      link.removeAttribute('aria-current');
    }
  });
}

function setFooterYear() {
  const yearPlaceholder = document.querySelector('[data-current-year]');
  if (yearPlaceholder) {
    yearPlaceholder.textContent = new Date().getFullYear();
  }
}

function setMetaDescription(description) {
  if (!description) return;
  const meta = document.querySelector('meta[name="description"]');
  if (meta) {
    meta.setAttribute('content', description);
  }
}

function summariseText(text, length = 120) {
  if (!text) return '';
  if (text.length <= length) return text;
  return `${text.slice(0, length)}…`;
}

async function initHome(rootPath) {
  try {
    const heroSection = document.querySelector('.c-hero');
    const featuredGrid = document.querySelector('[data-featured-grid]');
    const categoryContainer = document.querySelector('[data-category-links]');
    const featured = await fetchJson(resolveDataPath(rootPath, 'featured.json'));

    renderFeaturedGrid(featuredGrid, featured, rootPath);
    renderCategoryLinks(categoryContainer, rootPath);
    initHeroSlider(heroSection, featured, rootPath, { interval: 5000 });

    // Always keep a consistent site title on home
    document.title = "Belka's Keiba Note";
    if (featured && featured.length) {
      setMetaDescription(summariseText(featured[0].comment || featured[0].title));
    }
    highlightNavigation('home');
  } catch (error) {
    console.error('Failed to initialise home page', error);
  }
}

function sortByDate(items, order) {
  const copy = [...items];
  copy.sort((a, b) => {
    const diff = (a.date || '').localeCompare(b.date || '');
    return order === 'oldest' ? diff : -diff;
  });
  return copy;
}

async function initCategoryPage(category, rootPath) {
  try {
    const grid = document.querySelector('[data-card-grid]');
    const emptyMessage = document.querySelector('[data-empty-message]');
    const sortSelect = document.querySelector('[data-sort]');
    const tagContainer = document.querySelector('[data-tag-filter]');
    const resetButton = document.querySelector('[data-tag-reset]');

    const data = await fetchJson(resolveDataPath(rootPath, `${category}.json`));
    let currentSort = 'newest';
    const activeTags = new Set();

    const allTags = Array.from(new Set(data.flatMap((item) => item.tags || []))).sort((a, b) => a.localeCompare(b, 'ja'));
    renderTagFilters(tagContainer, allTags, activeTags, (tag) => {
      if (activeTags.has(tag)) {
        activeTags.delete(tag);
      } else {
        activeTags.add(tag);
      }
      updateList();
    });

    if (resetButton) {
      resetButton.addEventListener('click', () => {
        activeTags.clear();
        updateList();
      });
    }

    if (sortSelect) {
      sortSelect.addEventListener('change', () => {
        currentSort = sortSelect.value;
        updateList();
      });
    }

    function applyFilters(items) {
      let result = sortByDate(items, currentSort);
      if (activeTags.size) {
        result = result.filter((item) => {
          const tags = item.tags || [];
          return tags.some((tag) => activeTags.has(tag));
        });
      }
      return result;
    }

    function updateList() {
      const filtered = applyFilters(data);
      renderCardGrid(grid, filtered, category, rootPath);
      updateEmptyState(emptyMessage, filtered.length > 0);
      renderTagFilters(tagContainer, allTags, activeTags, (tag) => {
        if (activeTags.has(tag)) {
          activeTags.delete(tag);
        } else {
          activeTags.add(tag);
        }
        updateList();
      });
    }

    updateList();

    if (data.length) {
      document.title = `${normaliseCategoryName(category)} | Belka's Keiba Note`;
      setMetaDescription(summariseText(data[0].summary || `${normaliseCategoryName(category)}の最新記事一覧`));
    }

    highlightNavigation(category);
  } catch (error) {
    console.error('Failed to initialise category page', error);
    const emptyMessage = document.querySelector('[data-empty-message]');
    if (emptyMessage) {
      emptyMessage.textContent = 'データの読み込みに失敗しました。JSONファイルを確認してください。';
      emptyMessage.hidden = false;
    }
  }
}

async function initPostPage(rootPath) {
  const postParam = parsePostParam(getQueryParam('p'));
  const article = document.querySelector('[data-article]');
  const errorMessage = document.querySelector('[data-article-error]');
  if (!postParam) {
    if (errorMessage) {
      errorMessage.hidden = false;
      errorMessage.textContent = 'URLパラメータが不正です。';
    }
    if (article) article.hidden = true;
    return;
  }

  try {
    const data = await fetchJson(resolveDataPath(rootPath, `${postParam.category}.json`));
    const sorted = sortByDate(data, 'newest');
    const entry = sorted.find((item) => item.slug === postParam.slug);
    if (!entry) {
      throw new Error('記事が見つかりません');
    }

    const contentPath = resolveInternalUrl(rootPath, buildContentPath(postParam.category, entry.date, entry.slug));
    const markdown = await fetchMd(contentPath);
    const { html, headings } = parseMarkdown(markdown);

    const body = document.querySelector('[data-article-body]');
    const title = document.querySelector('[data-article-title]');
    const date = document.querySelector('[data-article-date]');
    const tags = document.querySelector('[data-article-tags]');
    const tocList = document.querySelector('[data-article-toc-list]');
    const nav = document.querySelector('[data-article-nav]');

    if (body) {
      body.innerHTML = html;
    }
    if (title) {
      title.textContent = entry.title;
    }
    if (date) {
      date.textContent = formatDate(entry.date);
    }
    renderArticleTags(tags, entry.tags || []);
    renderToc(tocList, headings);

    const index = sorted.findIndex((item) => item.slug === entry.slug);
    const prevItem = index > 0 ? sorted[index - 1] : null;
    const nextItem = index < sorted.length - 1 ? sorted[index + 1] : null;
    renderArticleNavigation(nav, prevItem, nextItem, postParam.category, rootPath);

    document.title = `${entry.title} | Belka's Keiba Note`;
    setMetaDescription(summariseText(entry.summary || markdown.replace(/\n+/g, ' ')));

    highlightNavigation(postParam.category);
  } catch (error) {
    console.error('Failed to initialise post page', error);
    if (errorMessage) {
      errorMessage.hidden = false;
    }
    if (article) article.hidden = true;
  }
}

async function bootstrap() {
  const body = document.body;
  const rootPath = body.dataset.rootPath || '.';
  const pageType = body.dataset.page;

  await Promise.all([
    injectPartial('header-placeholder', rootPath, 'header.html'),
    injectPartial('footer-placeholder', rootPath, 'footer.html')
  ]);

  setupNavigationLinks(rootPath);
  setFooterYear();

  switch (pageType) {
    case 'home':
      await initHome(rootPath);
      break;
    case 'category':
      await initCategoryPage(body.dataset.category, rootPath);
      break;
    case 'post':
      await initPostPage(rootPath);
      break;
    default:
      break;
  }

  body.classList.remove('is-loading');
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', bootstrap);
} else {
  bootstrap();
}

