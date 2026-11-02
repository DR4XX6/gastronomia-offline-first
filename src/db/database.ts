import type { Ingredient } from '../domain/ingredient'
import type { Recipe } from '../domain/recipe'

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
    | {
            type: 'recipes-result'
            requestId: number
            recipes: Recipe[]
        }
    | {
            type: 'recipes-error'
            requestId: number
            message: string
        }

type IngredientCommand =
    | { type: 'ingredients:list' }
    | { type: 'ingredients:add'; ingredient: Ingredient }
    | { type: 'ingredients:update'; id: string; name: string }
    | { type: 'ingredients:delete'; id: string }

type RecipeCommand =
    | { type: 'recipes:list' }
    | { type: 'recipes:add'; recipe: Recipe }
    | { type: 'recipes:update'; id: string; name: string }
    | { type: 'recipes:delete'; id: string }

type PendingRequest =
    | {
            kind: 'ingredients'
            resolve: (ingredients: Ingredient[]) => void
            reject: (error: Error) => void
        }
    | {
            kind: 'recipes'
            resolve: (recipes: Recipe[]) => void
            reject: (error: Error) => void
        }

let worker: Worker | null = null
let databasePromise: Promise<string> | null = null
let nextRequestId = 0

const pendingRequests = new Map<number, PendingRequest>()

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

                if (request.kind === 'ingredients') {
                    if (message.type === 'ingredients-result') {
                        request.resolve(message.ingredients)
                    } else if (message.type === 'ingredients-error') {
                        request.reject(new Error(message.message))
                    } else {
                        request.reject(
                            new Error('Respuesta inesperada para ingredientes')
                        )
                    }
                } else {
                    if (message.type === 'recipes-result') {
                        request.resolve(message.recipes)
                    } else if (message.type === 'recipes-error') {
                        request.reject(new Error(message.message))
                    } else {
                        request.reject(
                            new Error('Respuesta inesperada para recetas')
                        )
                    }
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
        pendingRequests.set(requestId, {
            kind: 'ingredients',
            resolve,
            reject,
        })

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

async function sendRecipeRequest(
    command: RecipeCommand
): Promise<Recipe[]> {
    await initializeLocalDatabase()

    return new Promise<Recipe[]>((resolve, reject) => {
        if (!worker) {
            reject(new Error('SQLite no está disponible'))
            return
        }

        const requestId = ++nextRequestId
        pendingRequests.set(requestId, {
            kind: 'recipes',
            resolve,
            reject,
        })

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

// Operaciones existentes de ingredientes
export function listIngredients(): Promise<Ingredient[]> {
    return sendIngredientRequest({ type: 'ingredients:list' })
}

export function addIngredient(name: string): Promise<Ingredient[]> {
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

export function deleteIngredient(id: string): Promise<Ingredient[]> {
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

// Nuevas operaciones de recetas
export function listRecipes(): Promise<Recipe[]> {
    return sendRecipeRequest({ type: 'recipes:list' })
}

export function addRecipe(name: string): Promise<Recipe[]> {
    const cleanName = name.trim()

    if (!cleanName) {
        return Promise.reject(
            new Error('El nombre de la receta es obligatorio')
        )
    }

    return sendRecipeRequest({
        type: 'recipes:add',
        recipe: {
            id: crypto.randomUUID(),
            name: cleanName,
        },
    })
}

export function updateRecipe(
    id: string,
    name: string
): Promise<Recipe[]> {
    const cleanId = id.trim()
    const cleanName = name.trim()

    if (!cleanId || !cleanName) {
        return Promise.reject(
            new Error('El identificador y el nombre son obligatorios')
        )
    }

    return sendRecipeRequest({
        type: 'recipes:update',
        id: cleanId,
        name: cleanName,
    })
}

export function deleteRecipe(id: string): Promise<Recipe[]> {
    const cleanId = id.trim()

    if (!cleanId) {
        return Promise.reject(
            new Error('El identificador es obligatorio')
        )
    }

    return sendRecipeRequest({
        type: 'recipes:delete',
        id: cleanId,
    })
}
