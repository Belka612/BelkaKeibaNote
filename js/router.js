'use strict';

/**
 * router.js - クエリパラメータ処理とURL生成ヘルパー
 */

export function getQueryParam(key) {
  const params = new URLSearchParams(window.location.search);
  return params.get(key);
}

export function parsePostParam(value) {
  if (!value) return null;
  const [category, slug] = value.split('/');
  if (!category || !slug) return null;
  return { category, slug };
}

export function buildPostUrl(category, slug) {
  return `post.html?p=${encodeURIComponent(category)}/${encodeURIComponent(slug)}`;
}

export function buildContentPath(category, date, slug) {
  const safeCategory = encodeURIComponent(category);
  const safeSlug = encodeURIComponent(slug);
  return `content/${safeCategory}/${date}-${safeSlug}.md`;
}

export function normaliseCategoryName(category) {
  const map = {
    picks: '過去の重要予想と反省',
    horses: '注目馬の見解',
    chatter: '雑談',
    column: 'コラム'
  };
  return map[category] || category;
}

