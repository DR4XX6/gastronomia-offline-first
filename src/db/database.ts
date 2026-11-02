type DatabaseMessage =
    | {
        type: 'database-ready'
        version: string
        firstWriteAt: string
        }
    | {
        type: 'database-error'
        message: string
        }

    let databasePromise: Promise<string> | null = null

    export function initializeLocalDatabase(): Promise<string> {
    if (databasePromise) {
        return databasePromise
    }

    databasePromise = new Promise<string>((resolve, reject) => {
        const worker = new Worker(
        new URL('./sqlite.worker.ts', import.meta.url),
        { type: 'module' }
        )

        worker.onmessage = (event: MessageEvent<DatabaseMessage>) => {
        const message = event.data

        
        if (message.type === 'database-ready') {
        console.log('SQLite preparado:', message.version)
        console.log(
            'Primer registro persistente:',
            message.firstWriteAt
        )
        resolve(message.version)
        }

        if (message.type === 'database-error') {
            worker.terminate()
            databasePromise = null
            reject(new Error(message.message))
        }
        }

        worker.onerror = (event) => {
        worker.terminate()
        databasePromise = null
        reject(new Error(event.message || 'Error del Web Worker'))
        }
    })

    return databasePromise
}
