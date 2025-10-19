'use strict';

/**
 * fetchers.js - JSON と Markdown の取得ヘルパー
 */

const jsonCache = new Map();
const mdCache = new Map();

async function fetchText(path) {
  const response = await fetch(path, { cache: 'no-cache' });
  if (!response.ok) {
    throw new Error(`Failed to fetch: ${path} (${response.status})`);
  }
  return response.text();
}

export async function fetchJson(path) {
  if (jsonCache.has(path)) {
    return jsonCache.get(path);
  }
  const text = await fetchText(path);
  try {
    const data = JSON.parse(text);
    jsonCache.set(path, data);
    return data;
  } catch (error) {
    console.error(`JSON parse error at ${path}`, error);
    throw error;
  }
}

export async function fetchMd(path) {
  if (mdCache.has(path)) {
    return mdCache.get(path);
  }
  const text = await fetchText(path);
  mdCache.set(path, text);
  return text;
}

export function clearCaches() {
  jsonCache.clear();
  mdCache.clear();
}

