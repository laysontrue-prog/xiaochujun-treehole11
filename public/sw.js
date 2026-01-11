const CACHE_NAME = 'shudon-cache-v1';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/topic.html',
  '/style.css',
  '/image-viewer.js',
  '/manifest.json',
  '/icons/icon-192x192.png',
  '/icons/icon-512x512.png'
];

// 拦截图片请求的正则
const IMAGE_REGEX = /\.(jpg|jpeg|png|gif|webp)$/i;
const IMGBB_REGEX = /imgbb\.com|ibb\.co/;

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      // 尝试缓存静态资源，如果失败也不阻塞安装
      return cache.addAll(STATIC_ASSETS).catch(err => {
        console.warn('部分静态资源缓存失败:', err);
      });
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // 1. 处理图片请求 (Stale-while-revalidate 策略)
  if (IMAGE_REGEX.test(url.pathname) || IMGBB_REGEX.test(url.hostname)) {
    event.respondWith(
      caches.open(CACHE_NAME).then((cache) => {
        return cache.match(event.request).then((cachedResponse) => {
          const fetchPromise = fetch(event.request).then((networkResponse) => {
            // 只有成功响应才更新缓存
            if (networkResponse.ok) {
              cache.put(event.request, networkResponse.clone());
            }
            return networkResponse;
          }).catch(() => {
             // 网络失败时，如果有缓存则返回缓存，否则返回失败
             return cachedResponse;
          });

          // 如果有缓存，优先返回缓存，后台更新
          return cachedResponse || fetchPromise;
        });
      })
    );
    return;
  }

  // 2. 处理静态资源 (Cache First 策略)
  if (STATIC_ASSETS.includes(url.pathname)) {
    event.respondWith(
      caches.match(event.request).then((response) => {
        return response || fetch(event.request).then((networkResponse) => {
           return caches.open(CACHE_NAME).then((cache) => {
             cache.put(event.request, networkResponse.clone());
             return networkResponse;
           });
        });
      })
    );
    return;
  }

  // 3. 其他请求 (Network First / 默认)
  // 对于 API 请求，通常不缓存或由浏览器默认处理
});
