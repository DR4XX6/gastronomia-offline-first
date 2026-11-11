import { useEffect, useState } from 'react'

type WorkerState = 'preparing' | 'ready' | 'unavailable' | 'error'

export default function OfflineStatus() {
  const [online, setOnline] = useState(navigator.onLine)
  const [workerState, setWorkerState] = useState<WorkerState>('preparing')
  const [revision, setRevision] = useState<string | null>(null)

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

    // La existencia de un controlador NO garantiza que el precaché esté completo.
    const refreshController = () => {
      if (!active) return
      const controller = navigator.serviceWorker.controller
      setWorkerState('preparing')
      setRevision(null)
      if (!controller) return

      const channel = new MessageChannel()
      const timer = window.setTimeout(() => {
        channel.port1.close()
        if (active) setWorkerState('error')
      }, 5000)

      channel.port1.onmessage = (event: MessageEvent<{
        type: string
        ready: boolean
        revision?: string
        missing?: string[]
      }>) => {
        window.clearTimeout(timer)
        channel.port1.close()
        if (!active) return
        const message = event.data
        if (message?.type === 'OFFLINE_STATUS' && message.ready === true && typeof message.revision === 'string') {
          setRevision(message.revision ?? null)
          setWorkerState('ready')
        } else {
          console.warn('Recursos offline faltantes:', message?.missing ?? [])
          setWorkerState('error')
        }
      }

      controller.postMessage({ type: 'VERIFY_OFFLINE' }, [channel.port2])
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
        ? 'La caché offline está incompleta o pendiente de actualización. Con conexión activa, cierra la pestaña y vuelve a abrirla.'
        : 'Preparando la caché offline. En la primera instalación, recarga la página una vez con conexión.'

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
      {revision && <p className="mt-1 text-xs text-slate-600">Caché verificada: {revision}</p>}
      <p className="mt-1 text-xs text-slate-600">
        Las recetas y los ingredientes se guardan en SQLite/OPFS del dispositivo, no en la caché.
      </p>
    </aside>
  )
}
