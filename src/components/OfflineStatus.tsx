import { useEffect, useState } from 'react'

type WorkerState = 'preparing' | 'ready' | 'unavailable' | 'error'

export default function OfflineStatus() {
  const [online, setOnline] = useState(navigator.onLine)
  const [workerState, setWorkerState] = useState<WorkerState>('preparing')

  useEffect(() => {
    let active = true
    const refreshNetwork = () => {
      if (active) setOnline(navigator.onLine)
    }

    window.addEventListener('online', refreshNetwork)
    window.addEventListener('offline', refreshNetwork)

    if (!import.meta.env.PROD || !('serviceWorker' in navigator)) {
      setWorkerState('unavailable')
      return () => {
        active = false
        window.removeEventListener('online', refreshNetwork)
        window.removeEventListener('offline', refreshNetwork)
      }
    }

    const refreshController = () => {
      if (active) {
        setWorkerState(navigator.serviceWorker.controller ? 'ready' : 'preparing')
      }
    }
    navigator.serviceWorker.addEventListener('controllerchange', refreshController)
    refreshController()

    void navigator.serviceWorker
      .register(`${import.meta.env.BASE_URL}service-worker.js`, {
        scope: import.meta.env.BASE_URL,
      })
      .then(() => navigator.serviceWorker.ready)
      .then(refreshController)
      .catch((error: unknown) => {
        console.error('No se pudo preparar la aplicación para uso sin red:', error)
        if (active) setWorkerState('error')
      })

    return () => {
      active = false
      window.removeEventListener('online', refreshNetwork)
      window.removeEventListener('offline', refreshNetwork)
      navigator.serviceWorker.removeEventListener('controllerchange', refreshController)
    }
  }, [])

  const ready = workerState === 'ready'
  const message = ready
    ? 'Archivos de la aplicación disponibles localmente para volver a abrirla sin red.'
    : workerState === 'unavailable'
      ? 'Para activar la PWA, compila y ejecuta la versión de producción en localhost o HTTPS.'
      : workerState === 'error'
        ? 'No se pudo instalar la caché offline en este navegador.'
        : 'Preparando los archivos necesarios para abrir la aplicación sin red.'

  return (
    <aside
      role="status"
      aria-live="polite"
      className="mt-6 rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-slate-800"
    >
      <p className="font-semibold text-green-900">
        {online ? 'Red detectada' : 'Sin conexión a la red'}
        {' · '}
        {ready ? 'PWA lista para uso sin internet' : 'Preparación offline pendiente'}
      </p>
      <p className="mt-1">{message}</p>
      <p className="mt-1 text-xs text-slate-600">
        Las recetas y los ingredientes se guardan en SQLite/OPFS del dispositivo, no en la caché.
      </p>
    </aside>
  )
}
