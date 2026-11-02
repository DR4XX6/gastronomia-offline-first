
import type { Ingredient } from '../domain/ingredient'

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
    | {
        type: 'ingredients-result'
        requestId: number
        ingredients: Ingredient[]
        }
    | {
        type: 'ingredients-error'
        requestId: number
        message: string
        }

type IngredientCommand =
    | { type: 'ingredients:list' }
    | {
        type: 'ingredients:add'
        ingredient: Ingredient
        }
    | {
        type: 'ingredients:update'
        id: string
        name: string
        }
    | {
        type: 'ingredients:delete'
        id: string
        }

    let worker: Worker | null = null
    let databasePromise: Promise<string> | null = null
    let nextRequestId = 0

    const pendingRequests = new Map<
    number,
    {
        resolve: (ingredients: Ingredient[]) => void
        reject: (error: Error) => void
    }
    >()

    function handleWorkerFailure(error: Error) {
    for (const request of pendingRequests.values()) {
        request.reject(error)
    }

    pendingRequests.clear()
    worker?.terminate()
    worker = null
    databasePromise = null
    }

    export function initializeLocalDatabase(): Promise<string> {
    if (databasePromise) {
        return databasePromise
    }

    databasePromise = new Promise<string>((resolve, reject) => {
        try {
        const currentWorker = new Worker(
            new URL('./sqlite.worker.ts', import.meta.url),
            { type: 'module' }
        )

        worker = currentWorker

        currentWorker.onmessage = (
            event: MessageEvent<DatabaseMessage>
        ) => {
            const message = event.data

            if (message.type === 'database-ready') {
            console.log('SQLite preparado:', message.version)
            console.log(
                'Primer registro persistente:',
                message.firstWriteAt
            )
            resolve(message.version)
            return
            }

            if (message.type === 'database-error') {
            const error = new Error(message.message)
            reject(error)
            handleWorkerFailure(error)
            return
            }

            const request = pendingRequests.get(message.requestId)

            if (!request) return

            pendingRequests.delete(message.requestId)

            if (message.type === 'ingredients-result') {
            request.resolve(message.ingredients)
            } else {
            request.reject(new Error(message.message))
            }
        }

        currentWorker.onerror = (event) => {
            const error = new Error(
            event.message || 'Error del Web Worker'
            )
            reject(error)
            handleWorkerFailure(error)
        }
        } catch (error) {
        databasePromise = null
        reject(error)
        }
    })

    return databasePromise
    }

    async function sendIngredientRequest(
    command: IngredientCommand
    ): Promise<Ingredient[]> {
    await initializeLocalDatabase()

    return new Promise<Ingredient[]>((resolve, reject) => {
        if (!worker) {
        reject(new Error('SQLite no está disponible'))
        return
        }

        const requestId = ++nextRequestId

        pendingRequests.set(requestId, { resolve, reject })

        try {
        worker.postMessage({ ...command, requestId })
        } catch (error) {
        pendingRequests.delete(requestId)
        reject(
            error instanceof Error ? error : new Error(String(error))
        )
        }
    })
    }

    export function listIngredients(): Promise<Ingredient[]> {
    return sendIngredientRequest({
        type: 'ingredients:list',
    })
    }

    export function addIngredient(
    name: string
    ): Promise<Ingredient[]> {
    const cleanName = name.trim()

    if (!cleanName) {
        return Promise.reject(
        new Error('El nombre del ingrediente es obligatorio')
        )
    }

    return sendIngredientRequest({
        type: 'ingredients:add',
        ingredient: {
        id: crypto.randomUUID(),
        name: cleanName,
        },
    })
}

export function updateIngredient(
    id: string,
    name: string
    ): Promise<Ingredient[]> {
    const cleanId = id.trim()
    const cleanName = name.trim()

    if (!cleanId || !cleanName) {
        return Promise.reject(
        new Error('El identificador y el nombre son obligatorios')
        )
    }

    return sendIngredientRequest({
        type: 'ingredients:update',
        id: cleanId,
        name: cleanName,
    })
    }

    export function deleteIngredient(
    id: string
    ): Promise<Ingredient[]> {
    const cleanId = id.trim()

    if (!cleanId) {
        return Promise.reject(
        new Error('El identificador es obligatorio')
        )
    }

    return sendIngredientRequest({
        type: 'ingredients:delete',
        id: cleanId,
    })
}
