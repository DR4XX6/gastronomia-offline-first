import { createHash } from 'node:crypto'
import { readdir, readFile, writeFile } from 'node:fs/promises'
import { join, relative, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

// Se ejecuta después de vite build. No toca SQLite ni los datos OPFS.
const distDirectory = fileURLToPath(new URL('../dist/', import.meta.url))
const allowedExtensions = /\.(?:html|js|css|wasm|svg|png|ico|webmanifest|jpg|jpeg|webp|gif|woff2?|ttf)$/i

async function listFiles(directory) {
  const items = await readdir(directory, { withFileTypes: true })
  const nested = await Promise.all(items.map(async (item) => {
    const path = join(directory, item.name)
    if (item.isDirectory()) return listFiles(path)
    return item.isFile() && allowedExtensions.test(item.name) && item.name !== 'service-worker.js'
      ? [path]
      : []
  }))
  return nested.flat()
}

const files = (await listFiles(distDirectory)).sort()
const paths = files.map((file) => relative(distDirectory, file).split(sep).join('/'))

if (!paths.includes('index.html') || !paths.some((path) => path.endsWith('.wasm'))) {
  throw new Error('Faltan index.html o SQLite WASM en dist. No se generó el Service Worker.')
}

const hash = createHash('sha256')
for (let index = 0; index < files.length; index++) {
  hash.update(paths[index])
  hash.update(await readFile(files[index]))
}
const revision = hash.digest('hex').slice(0, 12)
const assets = ['./', ...paths.map((path) => `./${path}`)]
const source = `/* Generado automáticamente para producción. Revisión: ${revision} */
const CACHE_PREFIX = 'gestor-gastronomico-offline-'
const CACHE_NAME = CACHE_PREFIX + '${revision}'
const PRECACHE = ${JSON.stringify(assets, null, 2)}
const PRECACHE_URLS = PRECACHE.map((path) => new URL(path, self.registration.scope).href)

async function findCachedResponse(url) {
  // Leemos la clave exacta guardada por Cache.addAll. De este modo,
  // las cabeceras Vary: Origin no cambian la selección de recursos.
  const cacheNames = await caches.keys()
  const names = [CACHE_NAME, ...cacheNames.filter((name) =>
    name.startsWith(CACHE_PREFIX) && name !== CACHE_NAME
  ).reverse()]

  for (const name of names) {
    const cache = await caches.open(name)
    const entries = await cache.keys()
    const storedRequest = entries.find((entry) => entry.url === url)
    if (!storedRequest) continue

    const response = await cache.match(storedRequest, { ignoreVary: true })
    if (response) return response
  }
  return undefined
}

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME)
    await cache.addAll(PRECACHE_URLS)
    const entries = await cache.keys()
    const missing = PRECACHE_URLS.filter((url) =>
      !entries.some((entry) => entry.url === url)
    )
    if (missing.length) {
      throw new Error('Precaché incompleto: ' + missing.join(', '))
    }
    // Activamos la versión nueva solo después de confirmar el precaché.
    await self.skipWaiting()
  })())
})

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const names = await caches.keys()
    const previous = names.filter((name) =>
      name.startsWith(CACHE_PREFIX) && name !== CACHE_NAME
    )
    // Una caché antigua se conserva por compatibilidad con páginas abiertas.
    await Promise.all(previous.slice(0, -1).map((name) => caches.delete(name)))
    await self.clients.claim()
  })())
})

self.addEventListener('message', (event) => {
  if (event.data?.type !== 'VERIFY_OFFLINE' || !event.ports[0]) return
  event.waitUntil((async () => {
    const missing = []
    for (const url of PRECACHE_URLS) {
      const response = await findCachedResponse(url)
      if (!response || !response.ok) missing.push(url)
    }
    event.ports[0].postMessage({
      type: 'OFFLINE_STATUS',
      revision: '${revision}',
      ready: missing.length === 0,
      missing
    })
  })())
})

self.addEventListener('fetch', (event) => {
  const request = event.request
  const url = new URL(request.url)
  const scope = new URL(self.registration.scope)
  if (request.method !== 'GET' || url.origin !== scope.origin ||
      !url.pathname.startsWith(scope.pathname)) return

  event.respondWith((async () => {
    const resourceUrl = request.mode === 'navigate'
      ? new URL('./index.html', scope).href
      : url.href
    const cached = await findCachedResponse(resourceUrl)
    if (cached) return cached

    // Solo hacemos red cuando el recurso no pertenece al precaché.
    // Si faltara un recurso esencial, emitimos un mensaje de diagnóstico.
    if (PRECACHE_URLS.includes(resourceUrl)) {
      console.error('Recurso precacheado no encontrado:', resourceUrl,
        'revisión:', '${revision}')
    }
    return fetch(request)
  })())
})
`

await writeFile(join(distDirectory, 'service-worker.js'), source, 'utf8')
console.log(`Service Worker generado: ${assets.length} rutas en precaché (rev. ${revision}).`)
