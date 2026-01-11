class ImageViewer {
  constructor() {
    this.images = [];
    this.currentIndex = 0;
    this.scale = 1;
    this.isDragging = false;
    this.startPoint = { x: 0, y: 0 };
    this.currentTranslate = { x: 0, y: 0 };
    this.prevTranslate = { x: 0, y: 0 };
    this.loadTimeoutMs = 8000;
    this.maxRetries = 3;
    this.activeLoadToken = 0;
    
    // Pinch zoom variables
    this.initialDistance = 0;
    this.initialScale = 1;

    this.initHTML();
    this.bindEvents();
  }

  initHTML() {
    if (document.querySelector('.image-viewer-overlay')) return;

    const overlay = document.createElement('div');
    overlay.className = 'image-viewer-overlay';
    overlay.innerHTML = `
      <div class="image-viewer-loader"></div>
      <div class="image-viewer-status"></div>
      <div class="image-viewer-container">
        <img class="image-viewer-img" src="" alt="preview">
      </div>
      <div class="image-viewer-count"></div>
      <button class="image-viewer-retry" type="button">重试</button>
    `;
    document.body.appendChild(overlay);

    this.overlay = overlay;
    this.img = overlay.querySelector('.image-viewer-img');
    this.container = overlay.querySelector('.image-viewer-container');
    this.loader = overlay.querySelector('.image-viewer-loader');
    this.count = overlay.querySelector('.image-viewer-count');
    this.status = overlay.querySelector('.image-viewer-status');
    this.retryBtn = overlay.querySelector('.image-viewer-retry');

    this.img.decoding = 'async';
    this.img.loading = 'eager';
  }

  bindEvents() {
    // Close on click outside. Using event delegation on the overlay.
    this.overlay.addEventListener('click', (e) => {
      // If the click is on the image itself, do nothing.
      if (e.target.classList.contains('image-viewer-img')) {
        return;
      }
      // Otherwise, close the viewer. This handles clicks on the overlay/background.
      this.close();
    });

    // Close on ESC
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.overlay.classList.contains('active')) {
        this.close();
      }
    });

    // Touch events for swipe and zoom
    this.container.addEventListener('touchstart', this.handleTouchStart.bind(this), { passive: false });
    this.container.addEventListener('touchmove', this.handleTouchMove.bind(this), { passive: false });
    this.container.addEventListener('touchend', this.handleTouchEnd.bind(this));
    
    // Mouse events for desktop dragging (if zoomed)
    this.container.addEventListener('mousedown', this.handleTouchStart.bind(this));
    this.container.addEventListener('mousemove', this.handleTouchMove.bind(this));
    this.container.addEventListener('mouseup', this.handleTouchEnd.bind(this));
    this.container.addEventListener('mouseleave', () => {
      if (this.isDragging) this.handleTouchEnd();
    });

    // Desktop zoom (wheel)
    this.container.addEventListener('wheel', (e) => {
      if (!this.overlay.classList.contains('active')) return;
      e.preventDefault();
      const delta = e.deltaY * -0.01;
      const newScale = Math.min(Math.max(1, this.scale + delta), 4);
      this.setScale(newScale);
    }, { passive: false });

    this.retryBtn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.loadImage(this.currentIndex);
    });
  }

  open(currentSrc, imageList = []) {
    this.images = imageList.length ? imageList : [currentSrc];
    this.currentIndex = this.images.indexOf(currentSrc);
    if (this.currentIndex === -1) this.currentIndex = 0;

    this.overlay.classList.add('active');
    document.body.style.overflow = 'hidden'; // Prevent background scrolling
    
    this.resetImageState();
    this.loadImage(this.currentIndex);
  }

  close() {
    // Add a class to trigger the fade-out animation
    this.overlay.classList.add('closing');
    document.body.style.overflow = ''; // Restore scroll
    this.activeLoadToken++; 

    // After the animation (300ms), remove the classes and reset state
    setTimeout(() => {
      this.overlay.classList.remove('active');
      this.overlay.classList.remove('closing');
      this.resetImageState();
      this.img.src = ''; // Clear image to prevent residual display
    }, 300);
  }

  resetImageState() {
    this.scale = 1;
    this.currentTranslate = { x: 0, y: 0 };
    this.prevTranslate = { x: 0, y: 0 };
    this.updateTransform();
  }

  loadImage(index) {
    if (index < 0 || index >= this.images.length) return;

    this.currentIndex = index;
    this.loader.style.display = 'block';
    this.retryBtn.style.display = 'none';
    this.status.textContent = '正在加载...';
    this.img.style.opacity = '0.6';

    const src = this.images[index];
    const loadToken = ++this.activeLoadToken;
    const startMs = performance.now();

    this.loadImageWithRetry(src, { timeoutMs: this.loadTimeoutMs, retries: this.maxRetries })
      .then((result) => {
        if (this.activeLoadToken !== loadToken) return;
        this.img.src = result.loadedSrc;
        this.img.style.opacity = '1';
        this.loader.style.display = 'none';
        this.status.textContent = '';
        this.updateCount();

        this.reportPerf({
          type: 'preview',
          url: src,
          durationMs: performance.now() - startMs,
          success: true,
          attempts: result.attempts
        });

        this.preload(index - 1);
        this.preload(index + 1);
      })
      .catch((err) => {
        if (this.activeLoadToken !== loadToken) return;
        this.loader.style.display = 'none';
        this.img.style.opacity = '1';
        this.status.textContent = err && err.message ? err.message : '加载失败';
        this.retryBtn.style.display = 'block';
        this.reportPerf({
          type: 'preview',
          url: src,
          durationMs: performance.now() - startMs,
          success: false,
          attempts: this.maxRetries
        });
      });
  }

  preload(index) {
    if (index >= 0 && index < this.images.length) {
      const src = this.images[index];
      if (typeof src === 'string' && src.startsWith('data:')) return;
      const img = new Image();
      img.decoding = 'async';
      img.loading = 'eager';
      img.src = src;
    }
  }

  updateCount() {
    if (this.images.length > 1) {
      this.count.textContent = `${this.currentIndex + 1} / ${this.images.length}`;
      this.count.style.display = 'block';
    } else {
      this.count.style.display = 'none';
    }
  }

  handleTouchStart(e) {
    // Check for multi-touch (pinch)
    if (e.touches && e.touches.length === 2) {
      this.isDragging = false;
      this.initialDistance = Math.hypot(
        e.touches[0].pageX - e.touches[1].pageX,
        e.touches[0].pageY - e.touches[1].pageY
      );
      this.initialScale = this.scale;
      return;
    }

    this.isDragging = true;
    const point = e.touches ? e.touches[0] : e;
    this.startPoint = { x: point.clientX, y: point.clientY };
    
    // Stop transition during drag
    this.img.style.transition = 'none';
  }

  handleTouchMove(e) {
    if (e.cancelable) e.preventDefault(); // Prevent scrolling

    // Pinch zoom logic
    if (e.touches && e.touches.length === 2) {
      const currentDistance = Math.hypot(
        e.touches[0].pageX - e.touches[1].pageX,
        e.touches[0].pageY - e.touches[1].pageY
      );
      const delta = currentDistance / this.initialDistance;
      this.setScale(this.initialScale * delta);
      return;
    }

    if (!this.isDragging) return;

    const point = e.touches ? e.touches[0] : e;
    const diffX = point.clientX - this.startPoint.x;
    const diffY = point.clientY - this.startPoint.y;

    if (this.scale > 1) {
      // Pan logic when zoomed
      this.currentTranslate.x = this.prevTranslate.x + diffX;
      this.currentTranslate.y = this.prevTranslate.y + diffY;
      this.updateTransform();
    } else {
      // Swipe logic when not zoomed (only horizontal)
      // Add resistance
      this.currentTranslate.x = diffX * 0.5; 
      this.updateTransform();
    }
  }

  handleTouchEnd(e) {
    this.isDragging = false;
    this.img.style.transition = 'transform 0.3s ease';

    if (this.scale > 1) {
      // Save current position for next drag
      this.prevTranslate = { ...this.currentTranslate };
      // Optional: Add bounds checking here to prevent panning too far
      return;
    }

    // Swipe threshold for changing image
    const threshold = 50;
    const moved = this.currentTranslate.x;

    if (Math.abs(moved) > threshold) {
      if (moved > 0 && this.currentIndex > 0) {
        this.currentIndex--;
        // Swipe animation handled by resetting state in loadImage
      } else if (moved < 0 && this.currentIndex < this.images.length - 1) {
        this.currentIndex++;
      }
    }

    this.resetImageState();
    this.loadImage(this.currentIndex);
  }

  setScale(newScale) {
    this.scale = Math.min(Math.max(1, newScale), 4);
    this.updateTransform();
  }

  updateTransform() {
    this.img.style.transform = `translate(${this.currentTranslate.x}px, ${this.currentTranslate.y}px) scale(${this.scale})`;
  }

  async loadImageWithRetry(src, { timeoutMs, retries }) {
    const isDataUrl = typeof src === 'string' && src.startsWith('data:');
    let lastError = null;

    for (let attempt = 1; attempt <= retries; attempt++) {
      const attemptSrc = (!isDataUrl && attempt > 1)
        ? this.appendRetryQuery(src, attempt)
        : src;

      this.img.src = attemptSrc;
      this.status.textContent = attempt === 1 ? '正在加载...' : `正在重试... (${attempt}/${retries})`;

      try {
        await this.waitForDecode(this.img, timeoutMs);
        return { loadedSrc: attemptSrc, attempts: attempt };
      } catch (e) {
        lastError = e;
      }
    }

    throw lastError || new Error('加载失败');
  }

  waitForDecode(imgEl, timeoutMs) {
    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => reject(new Error('加载超时')), timeoutMs);
      const cleanup = () => {
        clearTimeout(timeoutId);
        imgEl.removeEventListener('load', onLoad);
        imgEl.removeEventListener('error', onError);
      };
      const onLoad = () => {
        cleanup();
        resolve();
      };
      const onError = () => {
        cleanup();
        reject(new Error('图片加载失败'));
      };

      if (imgEl.complete && imgEl.naturalWidth > 0) {
        cleanup();
        resolve();
        return;
      }

      if (typeof imgEl.decode === 'function') {
        imgEl.decode().then(() => {
          cleanup();
          resolve();
        }).catch(() => {
          imgEl.addEventListener('load', onLoad, { once: true });
          imgEl.addEventListener('error', onError, { once: true });
        });
      } else {
        imgEl.addEventListener('load', onLoad, { once: true });
        imgEl.addEventListener('error', onError, { once: true });
      }
    });
  }

  appendRetryQuery(src, attempt) {
    const hasQuery = src.includes('?');
    const sep = hasQuery ? '&' : '?';
    return `${src}${sep}__retry=${attempt}&__t=${Date.now()}`;
  }

  reportPerf(payload) {
    try {
      const data = {
        ...payload,
        ts: Date.now(),
        page: location && location.pathname ? location.pathname : ''
      };
      window.__imagePerf = window.__imagePerf || { events: [] };
      window.__imagePerf.events.push(data);
      if (window.__imagePerf.events.length > 200) {
        window.__imagePerf.events.splice(0, window.__imagePerf.events.length - 200);
      }

      const body = JSON.stringify(data);
      if (navigator.sendBeacon) {
        navigator.sendBeacon('/api/metrics/image', new Blob([body], { type: 'application/json' }));
      } else {
        fetch('/api/metrics/image', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body,
          keepalive: true
        }).catch(() => {});
      }
    } catch (e) {}
  }
}

// Global instance
window.imageViewer = new ImageViewer();

(() => {
  const PLACEHOLDER_SRC = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="120" height="120" viewBox="0 0 120 120">
      <defs>
        <linearGradient id="g" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stop-color="#edf2f7"/>
          <stop offset="0.5" stop-color="#e2e8f0"/>
          <stop offset="1" stop-color="#edf2f7"/>
        </linearGradient>
      </defs>
      <rect width="120" height="120" fill="url(#g)"/>
    </svg>`
  );

  const ERROR_SRC = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="120" height="120" viewBox="0 0 120 120">
      <rect width="120" height="120" fill="#1a202c"/>
      <path d="M20 20 L100 100 M100 20 L20 100" stroke="#e53e3e" stroke-width="8" stroke-linecap="round"/>
    </svg>`
  );

  const isDataUrl = (s) => typeof s === 'string' && s.startsWith('data:');
  const canRetryUrl = (s) => typeof s === 'string' && !isDataUrl(s);
  const appendRetryQuery = (src, attempt) => {
    const hasQuery = src.includes('?');
    const sep = hasQuery ? '&' : '?';
    return `${src}${sep}__retry=${attempt}&__t=${Date.now()}`;
  };

  const tryReport = (payload) => {
    try {
      const data = {
        ...payload,
        ts: Date.now(),
        page: location && location.pathname ? location.pathname : ''
      };
      window.__imagePerf = window.__imagePerf || { events: [] };
      window.__imagePerf.events.push(data);
      if (window.__imagePerf.events.length > 200) {
        window.__imagePerf.events.splice(0, window.__imagePerf.events.length - 200);
      }
      const body = JSON.stringify(data);
      if (navigator.sendBeacon) {
        navigator.sendBeacon('/api/metrics/image', new Blob([body], { type: 'application/json' }));
      } else {
        fetch('/api/metrics/image', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body,
          keepalive: true
        }).catch(() => {});
      }
    } catch (e) {}
  };

  const startLoad = (img) => {
    const src = img.dataset.src;
    if (!src) return;

    img.dataset.loadingStarted = '1';
    img.dataset.loadStartMs = String(performance.now());
    img.classList.add('lazy-img');
    img.classList.remove('lazy-img-loaded');
    img.decoding = img.decoding || 'async';
    img.loading = img.loading || 'lazy';
    img.fetchPriority = img.fetchPriority || 'low';

    const maxRetries = 3;
    const timeoutMs = 8000;
    const attempt = Number(img.dataset.retryCount || '0') + 1;
    img.dataset.retryCount = String(attempt);

    if (canRetryUrl(src) && attempt > 1) {
      img.src = appendRetryQuery(src, attempt);
    } else {
      img.src = src;
    }

    const timeoutId = setTimeout(() => {
      if (img.dataset.loadingFinished === '1') return;
      if (Number(img.dataset.retryCount || '0') < maxRetries) {
        startLoad(img);
      } else {
        img.dataset.loadingFinished = '1';
        img.src = ERROR_SRC;
        img.classList.add('lazy-img-error');
        tryReport({
          type: 'inline',
          url: src,
          durationMs: performance.now() - Number(img.dataset.loadStartMs || performance.now()),
          success: false,
          attempts: Number(img.dataset.retryCount || '0')
        });
      }
    }, timeoutMs);

    img.dataset.timeoutId = String(timeoutId);
  };

  const markLoaded = (img) => {
    img.dataset.loadingFinished = '1';
    if (img.dataset.timeoutId) {
      clearTimeout(Number(img.dataset.timeoutId));
      delete img.dataset.timeoutId;
    }
    img.classList.add('lazy-img-loaded');
    const src = img.dataset.src || img.currentSrc || img.src;
    const startMs = Number(img.dataset.loadStartMs || performance.now());
    tryReport({
      type: 'inline',
      url: src,
      durationMs: performance.now() - startMs,
      success: true,
      attempts: Number(img.dataset.retryCount || '1')
    });
  };

  const markError = (img) => {
    if (img.dataset.timeoutId) {
      clearTimeout(Number(img.dataset.timeoutId));
      delete img.dataset.timeoutId;
    }
    const src = img.dataset.src;
    if (!src) {
      img.src = ERROR_SRC;
      img.classList.add('lazy-img-error');
      return;
    }
    const attempts = Number(img.dataset.retryCount || '0');
    if (canRetryUrl(src) && attempts < 3) {
      startLoad(img);
      return;
    }
    img.dataset.loadingFinished = '1';
    img.src = ERROR_SRC;
    img.classList.add('lazy-img-error');
    tryReport({
      type: 'inline',
      url: src,
      durationMs: performance.now() - Number(img.dataset.loadStartMs || performance.now()),
      success: false,
      attempts
    });
  };

  const getRealSrc = (imgEl) => imgEl.dataset.fullsrc || imgEl.dataset.src || imgEl.currentSrc || imgEl.src;

  const observer = ('IntersectionObserver' in window)
    ? new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        const img = entry.target;
        observer.unobserve(img);
        if (img.dataset.loadingStarted === '1') return;
        startLoad(img);
      });
    }, { rootMargin: '200px 0px', threshold: 0.01 })
    : null;

  const observeImage = (img) => {
    if (!(img instanceof HTMLImageElement)) return;
    if (!img.dataset || !img.dataset.src) return;
    if (!img.src || img.src === '') img.src = PLACEHOLDER_SRC;
    img.classList.add('lazy-img');
    if (observer) {
      observer.observe(img);
    } else {
      startLoad(img);
    }
  };

  const scan = (root) => {
    const imgs = Array.from((root || document).querySelectorAll('img[data-src]'));
    imgs.forEach(observeImage);
  };

  document.addEventListener('load', (e) => {
    const t = e.target;
    if (t && t.tagName === 'IMG' && t.classList.contains('lazy-img')) {
      markLoaded(t);
    }
  }, true);

  document.addEventListener('error', (e) => {
    const t = e.target;
    if (t && t.tagName === 'IMG' && (t.classList.contains('lazy-img') || t.dataset && t.dataset.src)) {
      markError(t);
    }
  }, true);

  scan(document);

  const mo = new MutationObserver((mutations) => {
    for (const m of mutations) {
      for (const node of m.addedNodes) {
        if (!(node instanceof Element)) continue;
        if (node.tagName === 'IMG') observeImage(node);
        scan(node);
      }
    }
  });
  mo.observe(document.documentElement, { childList: true, subtree: true });

  document.addEventListener('click', (e) => {
    const target = e.target;
    if (!(target instanceof Element)) return;
    if (target.classList.contains('post-image') || target.classList.contains('preview-image')) {
      e.preventDefault();
      e.stopPropagation();
      const src = getRealSrc(target);
      const container = target.closest('.post-images') || target.closest('.post-card') || document.body;
      const images = Array.from(container.querySelectorAll('img.post-image, img.preview-image')).map(getRealSrc);
      window.imageViewer.open(src, images);
    }
  }, true);
})();
