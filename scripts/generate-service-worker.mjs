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
const source = `/* Generado automáticamente: npm run build. No modificar manualmente. */
const CACHE_PREFIX = 'gestor-gastronomico-offline-'
const CACHE_NAME = CACHE_PREFIX + '${revision}'
const PRECACHE = ${JSON.stringify(assets, null, 2)}

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME)
    const urls = PRECACHE.map((path) => new URL(path, self.registration.scope).href)
    await cache.addAll(urls)
    const missing = (await Promise.all(urls.map(async (url) => (await cache.match(url)) ? null : url)))
      .filter(Boolean)
    if (missing.length) {
      throw new Error('Precaché incompleto: ' + missing.join(', '))
    }
    // No forzamos el reemplazo de una versión que sigue abierta.
    // Así la página anterior conserva sus scripts y estilos hasta cerrarse.
  })())
})

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys()
    const older = keys.filter((key) => key.startsWith(CACHE_PREFIX) && key !== CACHE_NAME)
    // Se conserva la última caché anterior para páginas que todavía utilicen
    // archivos con hashes de la versión previa.
    await Promise.all(older.slice(0, -1).map((key) => caches.delete(key)))
  })())
})

self.addEventListener('message', (event) => {
  if (event.data?.type !== 'VERIFY_OFFLINE' || !event.ports[0]) return
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME)
    const missing = []
    for (const path of PRECACHE) {
      const url = new URL(path, self.registration.scope).href
      if (!(await cache.match(url))) missing.push(path)
    }
    event.ports[0].postMessage({ type: 'OFFLINE_STATUS', ready: missing.length === 0, missing })
  })())
})

self.addEventListener('fetch', (event) => {
  const request = event.request
  const url = new URL(request.url)
  const scope = new URL(self.registration.scope)
  if (request.method !== 'GET' || url.origin !== scope.origin || !url.pathname.startsWith(scope.pathname)) return

  event.respondWith((async () => {
    const cache = await caches.open(CACHE_NAME)
    if (request.mode === 'navigate') {
      const index = await cache.match(new URL('./index.html', scope).href)
      if (index) return index
    }
    // Buscar en todas las versiones conservadas. Una página abierta podría
    // solicitar el JS/CSS de la compilación anterior.
    // Los recursos precacheados y los módulos ES pueden tener cabeceras
    // distintas (p. ej. Origin), y Vary puede impedir una coincidencia
    // aunque la URL esté correctamente guardada.
    const response = await caches.match(url.href, { ignoreVary: true })
    if (response) return response
    return fetch(request)
  })())
})
`

await writeFile(join(distDirectory, 'service-worker.js'), source, 'utf8')
console.log(`Service Worker generado: ${assets.length} rutas en precaché (rev. ${revision}).`)
