'use strict';

import { createNoImageElement, formatDate, resolveAssetPath, resolveInternalUrl } from './render.js';

/**
 * slider.js - ヒーロースライダーの制御
 */

export function initHeroSlider(rootElement, items, rootPath, options = {}) {
  if (!rootElement) return null;
  const slidesContainer = rootElement.querySelector('[data-slider-slides]');
  const prevButton = rootElement.querySelector('[data-slider-prev]');
  const nextButton = rootElement.querySelector('[data-slider-next]');
  const dotsContainer = rootElement.querySelector('[data-slider-dots]');
  const toggleButton = rootElement.querySelector('[data-slider-toggle]');
  const toggleLabel = toggleButton?.querySelector('[data-toggle-label]');

  if (!items || !items.length) {
    if (slidesContainer) {
      slidesContainer.innerHTML = '<p class="c-section__description">注目データが登録されていません。</p>';
    }
    if (dotsContainer) dotsContainer.innerHTML = '';
    if (toggleButton) toggleButton.disabled = true;
    return null;
  }

  const autoplayInterval = options.interval || 5000;
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  let currentIndex = 0;
  let autoplayId = null;
  let userPaused = prefersReducedMotion.matches;
  let pointerActive = false;
  let pointerStartX = 0;

  slidesContainer.innerHTML = '';
  dotsContainer.innerHTML = '';

  const slides = items.map((item, index) => {
    const slide = document.createElement('article');
    slide.className = 'c-hero__slide';
    slide.tabIndex = -1;
    slide.setAttribute('role', 'group');
    slide.setAttribute('aria-roledescription', 'スライド');
    slide.setAttribute('aria-label', `${index + 1} / ${items.length}`);
    slide.dataset.index = String(index);

    const media = item.image
      ? (() => {
          const wrapper = document.createElement('div');
          wrapper.className = 'c-hero__media';
          const img = document.createElement('img');
          img.src = resolveAssetPath(rootPath, item.image);
          img.alt = item.title;
          wrapper.append(img);
          return wrapper;
        })()
      : createNoImageElement('c-hero__media');

    const content = document.createElement('div');
    content.className = 'c-hero__content';

    const title = document.createElement('h3');
    title.className = 'c-hero__title';
    title.textContent = item.title;

    const meta = document.createElement('p');
    meta.className = 'c-hero__meta';
    meta.textContent = formatDate(item.date);

    const comment = document.createElement('p');
    comment.className = 'c-hero__comment';
    comment.textContent = item.comment || '';

    const link = document.createElement('a');
    link.className = 'c-hero__link';
    link.href = resolveInternalUrl(rootPath, item.url || '#');
    link.textContent = '詳しく見る';
    // Ensure link click is not swallowed by swipe handlers
    link.addEventListener('click', (e) => {
      e.stopPropagation();
      const href = link.getAttribute('href');
      if (!href || href === '#') {
        e.preventDefault();
      }
    });

    content.append(title, meta, comment, link);
    slide.append(media, content);
    // Make the whole slide clickable (except on interactive elements)
    slide.addEventListener('click', (event) => {
      const target = event.target;
      if (target && typeof target.closest === 'function') {
        if (target.closest('a, button, select, input')) return;
      }
      if (link && link.href && link.href !== '#') {
        window.location.href = link.href;
      }
    });
    slidesContainer.append(slide);
    return slide;
  });

  const dots = items.map((item, index) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'c-hero__dot';
    button.setAttribute('role', 'tab');
    button.setAttribute('aria-controls', `hero-slide-${index}`);
    button.setAttribute('aria-label', `${item.title} (${index + 1}/${items.length})`);
    button.addEventListener('click', () => {
      goTo(index, true);
      if (!userPaused) {
        restartAutoplay();
      }
    });
    dotsContainer.append(button);
    return button;
  });

  slides.forEach((slide, index) => {
    slide.id = `hero-slide-${index}`;
  });

  function updateActiveState() {
    slides.forEach((slide, index) => {
      const isActive = index === currentIndex;
      slide.toggleAttribute('data-active', isActive);
      slide.style.transform = `translateX(${(index - currentIndex) * 100}%)`;
      slide.style.transition = pointerActive ? 'none' : 'transform 400ms ease';
    });
    const activeSlide = slides[currentIndex];
    if (activeSlide) {
      slidesContainer.style.height = `${activeSlide.scrollHeight}px`;
    }
    dots.forEach((dot, index) => {
      dot.setAttribute('aria-current', index === currentIndex ? 'true' : 'false');
    });
  }

  function goTo(index, focusSlide = false) {
    if (!items.length) return;
    currentIndex = (index + items.length) % items.length;
    updateActiveState();
    if (focusSlide) {
      slides[currentIndex].focus({ preventScroll: false });
    }
  }

  function next() {
    goTo(currentIndex + 1);
  }

  function prev() {
    goTo(currentIndex - 1);
  }

  function setToggleLabel(paused) {
    if (!toggleLabel) return;
    toggleLabel.textContent = paused ? '再生' : '一時停止';
    toggleButton.setAttribute('aria-label', paused ? '自動再生を開始' : '自動再生を一時停止');
  }

  function stopAutoplay(manual = false) {
    if (autoplayId) {
      clearInterval(autoplayId);
      autoplayId = null;
    }
    if (manual) {
      userPaused = true;
      setToggleLabel(true);
    }
  }

  function startAutoplay() {
    if (prefersReducedMotion.matches || userPaused || items.length <= 1) {
      setToggleLabel(true);
      return;
    }
    stopAutoplay();
    autoplayId = window.setInterval(next, autoplayInterval);
    setToggleLabel(false);
  }

  function restartAutoplay() {
    if (!userPaused) {
      startAutoplay();
    }
  }

  if (prevButton) prevButton.addEventListener('click', () => {
    prev();
    stopAutoplay();
    restartAutoplay();
  });
  if (nextButton) nextButton.addEventListener('click', () => {
    next();
    stopAutoplay();
    restartAutoplay();
  });

  if (toggleButton) {
    toggleButton.addEventListener('click', () => {
      userPaused = !userPaused;
      if (userPaused) {
        stopAutoplay(true);
      } else {
        startAutoplay();
      }
    });
  }

  const pauseInteraction = () => stopAutoplay();
  const resumeInteraction = () => {
    if (!userPaused) {
      startAutoplay();
    }
  };

  rootElement.addEventListener('mouseenter', pauseInteraction);
  rootElement.addEventListener('mouseleave', resumeInteraction);
  rootElement.addEventListener('focusin', pauseInteraction);
  rootElement.addEventListener('focusout', resumeInteraction);

  // Prevent swipe handling when the interaction starts on a link or control
  slidesContainer.addEventListener(
    'pointerdown',
    (event) => {
      const t = event.target;
      if (t && typeof t.closest === 'function' && t.closest('a, button, input, select, textarea')) {
        event.stopImmediatePropagation();
      }
    },
    true // capture phase
  );

  slidesContainer.addEventListener('pointerdown', (event) => {
    pointerActive = true;
    pointerStartX = event.clientX;
    try {
      slidesContainer.setPointerCapture(event.pointerId);
    } catch (error) {
      // 一部ブラウザでサポートされない場合があるため握りつぶす
    }
    stopAutoplay();
  });

  slidesContainer.addEventListener('pointermove', (event) => {
    if (!pointerActive) return;
    const deltaX = event.clientX - pointerStartX;
    slides.forEach((slide, index) => {
      const offset = (index - currentIndex) * 100;
      slide.style.transition = 'none';
      slide.style.transform = `translateX(${offset + (deltaX / Math.max(rootElement.clientWidth, 1)) * 100}%)`;
    });
  });

  const endPointer = (event) => {
    if (!pointerActive) return;
    pointerActive = false;
    try {
      slidesContainer.releasePointerCapture(event.pointerId);
    } catch (error) {
      // ignore
    }
    const deltaX = event.clientX - pointerStartX;
    if (Math.abs(deltaX) > 50) {
      if (deltaX < 0) {
        next();
      } else {
        prev();
      }
    } else {
      goTo(currentIndex);
    }
    restartAutoplay();
  };

  slidesContainer.addEventListener('pointerup', endPointer);
  slidesContainer.addEventListener('pointercancel', endPointer);
  slidesContainer.addEventListener('pointerleave', (event) => {
    if (!pointerActive) return;
    endPointer(event);
  });

  rootElement.addEventListener('keydown', (event) => {
    if (event.key === 'ArrowRight') {
      event.preventDefault();
      next();
      restartAutoplay();
    }
    if (event.key === 'ArrowLeft') {
      event.preventDefault();
      prev();
      restartAutoplay();
    }
  });

  updateActiveState();
  if (!prefersReducedMotion.matches) {
    startAutoplay();
  } else {
    setToggleLabel(true);
  }

  prefersReducedMotion.addEventListener('change', (event) => {
    if (event.matches) {
      stopAutoplay();
    } else if (!userPaused) {
      startAutoplay();
    }
  });

  return {
    next,
    prev,
    goTo,
    stop: () => stopAutoplay(true),
    start: startAutoplay,
    get currentIndex() {
      return currentIndex;
    }
  };
}

