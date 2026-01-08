const CACHE_NAME = 'treehole-cache-v1';
const ASSETS_TO_CACHE = [
  '/',
  '/index.html',
  '/topic.html',
  '/tools.html',
  '/capsule.html',
  '/profile.html',
  '/login.html',
  '/style.css',
  '/logo.png',
  'https://img.icons8.com/color/48/null/leaf.png',
  'https://img.icons8.com/color/48/null/speech-bubble.png',
  'https://img.icons8.com/color/48/null/wrench.png',
  'https://img.icons8.com/color/48/null/hourglass.png',
  'https://img.icons8.com/color/48/null/user.png'
];

// 安装事件：缓存静态资源
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('Service Worker: Caching files');
      return cache.addAll(ASSETS_TO_CACHE);
    })
  );
});

// 激活事件：清理旧缓存
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cache) => {
          if (cache !== CACHE_NAME) {
            console.log('Service Worker: Clearing Old Cache');
            return caches.delete(cache);
          }
        })
      );
    })
  );
});

// Fetch事件：网络优先，失败则使用缓存 (Network First, then Cache)
// 对于API请求，我们不做SW缓存，由后端apicache处理或直接网络请求
self.addEventListener('fetch', (event) => {
  // 排除API请求和Socket.io请求
  if (event.request.url.includes('/api/') || event.request.url.includes('socket.io')) {
    return;
  }

  event.respondWith(
    fetch(event.request)
      .then((res) => {
        // 克隆响应，一份给浏览器，一份存入缓存
        const resClone = res.clone();
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(event.request, resClone);
        });
        return res;
      })
      .catch(() => caches.match(event.request).then((res) => res))
  );
});