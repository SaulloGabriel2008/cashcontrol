const CACHE_NAME = 'cash-control-v2';
const STATIC_CACHE = 'cash-control-static-v2';
const IMMUTABLE_CACHE = 'cash-control-immutable-v2';

// URLs que podem ser cacheadas (imutáveis / versionadas)
const immutableUrls = [
  'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js'
];

const staticUrls = [
  '/',
  '/index.html',
  '/manifest.json'
];

// Limites de cache
const CACHE_MAX_ENTRIES = 50;
const CACHE_MAX_AGE_MS = 24 * 60 * 60 * 1000; // 24h

// Whitelisted API endpoints que podem ser cacheados (sem auth)
const cacheableApiEndpoints = ['/api/config'];

// Install event
self.addEventListener('install', event => {
  event.waitUntil(
    Promise.all([
      caches.open(IMMUTABLE_CACHE)
        .then(cache => cache.addAll(immutableUrls).catch(() => null)),
      caches.open(STATIC_CACHE)
        .then(cache => cache.addAll(staticUrls).catch(() => null))
    ])
  );
  self.skipWaiting();
});

// Activate event — remover caches antigos e limpar entries expiradas
self.addEventListener('activate', event => {
  event.waitUntil(
    Promise.all([
      // Remover caches antigos
      caches.keys().then(cacheNames => {
        return Promise.all(
          cacheNames.map(cacheName => {
            if (![CACHE_NAME, STATIC_CACHE, IMMUTABLE_CACHE].includes(cacheName)) {
              console.log('Cache antigo removido:', cacheName);
              return caches.delete(cacheName);
            }
          })
        );
      }),
      // Limpar entries expiradas do cache dinâmico
      caches.open(CACHE_NAME).then(cache => {
        cache.keys().then(requests => {
          requests.forEach(request => {
            cache.match(request).then(response => {
              if (response && response.headers) {
                const dateHeader = response.headers.get('date');
                if (dateHeader) {
                  const cacheTime = new Date(dateHeader).getTime();
                  if (Date.now() - cacheTime > CACHE_MAX_AGE_MS) {
                    cache.delete(request);
                  }
                }
              }
            });
          });
        });
      })
    ])
  );
  self.clients.claim();
});

// Utility: verificar se request tem auth
function hasAuthHeader(request) {
  return request.headers.has('Authorization') || 
         request.headers.has('authorization');
}

// Utility: adicionar ao cache com limite
async function addToCache(cacheName, request, response) {
  const cache = await caches.open(cacheName);
  const keys = await cache.keys();
  
  // Evitar crescimento indefinido
  if (keys.length >= CACHE_MAX_ENTRIES) {
    await cache.delete(keys[0]);
  }
  
  const responseToCache = response.clone();
  await cache.put(request, responseToCache);
}

// Fetch event — política rigorosa de cache
self.addEventListener('fetch', event => {
  const url = event.request.url;
  const method = event.request.method;

  // 1. NUNCA cachear requisições com Authorization header ou POST/PUT/DELETE
  if (hasAuthHeader(event.request) || (method !== 'GET' && method !== 'HEAD')) {
    event.respondWith(
      fetch(event.request)
        .catch(() => {
          // Sem fallback para requisições sensíveis
          return new Response(
            JSON.stringify({ error: 'Offline - operação requer conectividade' }),
            { status: 503, headers: { 'Content-Type': 'application/json' } }
          );
        })
    );
    return;
  }

  // 2. Resources imutáveis (CDN versionado) — cache-first
  if (immutableUrls.some(u => url.includes(u))) {
    event.respondWith(
      caches.match(event.request)
        .then(response => response || fetch(event.request)
          .then(response => {
            if (response && response.status === 200) {
              addToCache(IMMUTABLE_CACHE, event.request, response);
            }
            return response;
          })
        )
        .catch(() => new Response('Offline', { status: 503 }))
    );
    return;
  }

  // 3. Static assets (HTML, manifest) — cache-first com fallback
  if (url === self.location.origin + '/' || 
      url.endsWith('/index.html') || 
      url.endsWith('/manifest.json')) {
    event.respondWith(
      caches.match(event.request)
        .then(response => response || fetch(event.request)
          .then(response => {
            if (response && response.status === 200) {
              addToCache(STATIC_CACHE, event.request, response);
            }
            return response;
          })
        )
        .catch(() => {
          // Fallback offline melhorado
          return new Response(
            '<!DOCTYPE html><html><head><title>Offline</title></head><body style="font-family:sans-serif;padding:20px"><h1>Sem Conexão</h1><p>Cash Control está offline. Reconnect para continuar.</p></body></html>',
            { 
              status: 503, 
              headers: { 'Content-Type': 'text/html;charset=UTF-8' } 
            }
          );
        })
    );
    return;
  }

  // 4. Whitelisted API endpoints sem auth — network-first com timeout
  if (cacheableApiEndpoints.some(ep => url.includes(ep))) {
    event.respondWith(
      Promise.race([
        fetch(event.request).then(response => {
          if (response && response.status === 200) {
            addToCache(CACHE_NAME, event.request, response);
          }
          return response;
        }),
        new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 5000))
      ])
        .catch(() => caches.match(event.request))
    );
    return;
  }

  // 5. Todos os outros recursos (fonts, estilos, scripts não versionados)
  // Network-first com fallback ao cache
  event.respondWith(
    fetch(event.request)
      .then(response => {
        if (!response || response.status !== 200 || response.type === 'error') {
          return response;
        }
        // Não cachear cross-origin sem CORS
        if (response.type === 'cors' && !response.ok) {
          return response;
        }
        if (response.type === 'basic' || response.type === 'cors') {
          addToCache(CACHE_NAME, event.request, response);
        }
        return response;
      })
      .catch(() => caches.match(event.request) || new Response('Offline', { status: 503 }))
  );
});
