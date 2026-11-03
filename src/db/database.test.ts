import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// Pruebas de contrato: verifican el intercambio con el Worker simulado.
// No ejecutan SQLite real ni acceden a los datos OPFS del navegador.

type DatabaseApi = typeof import('./database')

type WorkerRequest = {
    type: string
    requestId: number
    [key: string]: unknown
}

class FakeWorker {
    static instances: FakeWorker[] = []

    onmessage: ((event: MessageEvent) => void) | null = null
    onerror: ((event: ErrorEvent) => void) | null = null
    messages: WorkerRequest[] = []

    constructor() {
        FakeWorker.instances.push(this)
        // Equivale a la señal de inicialización enviada por sqlite.worker.ts.
        queueMicrotask(() => {
            this.reply({
                type: 'database-ready',
                version: '3.53.4',
                firstWriteAt: '2026-11-02T12:00:00.000Z',
            })
        })
    }

    postMessage(message: WorkerRequest) {
        this.messages.push(message)
    }

    reply(data: object) {
        this.onmessage?.({ data } as MessageEvent)
    }

    terminate() {}
}

let database: DatabaseApi

beforeEach(async () => {
    // database.ts mantiene el Worker como estado de módulo.
    // El import dinámico crea uno nuevo para cada prueba.
    vi.resetModules()
    FakeWorker.instances = []
    vi.stubGlobal('Worker', FakeWorker)
    database = await import('./database')
})

afterEach(() => {
    vi.unstubAllGlobals()
})

async function sent(type: string) {
    await vi.waitFor(() => {
        expect(FakeWorker.instances).toHaveLength(1)
        expect(FakeWorker.instances[0].messages.some((m) => m.type === type)).toBe(true)
    })

    const worker = FakeWorker.instances[0]
    const message = worker.messages.find((m) => m.type === type)!
    return { worker, message }
}

describe('Inicialización de la base de datos', () => {
    it('reutiliza un único Web Worker entre inicializaciones concurrentes', async () => {
        const [first, second] = await Promise.all([
            database.initializeLocalDatabase(),
            database.initializeLocalDatabase(),
        ])
        expect(first).toBe('3.53.4')
        expect(second).toBe('3.53.4')
        expect(FakeWorker.instances).toHaveLength(1)
    })
})

describe('CRUD de ingredientes: contrato de comunicación', () => {
    it('solicita y recibe el catálogo', async () => {
        const pending = database.listIngredients()
        const { worker, message } = await sent('ingredients:list')
        const ingredients = [{ id: 'ing-1', name: 'Jitomates' }]
        worker.reply({ type: 'ingredients-result', requestId: message.requestId, ingredients })
        await expect(pending).resolves.toEqual(ingredients)
    })

    it('recorta espacios al registrar un ingrediente', async () => {
        const pending = database.addIngredient('  Ajo  ')
        const { worker, message } = await sent('ingredients:add')
        expect(message.ingredient).toEqual({ id: expect.any(String), name: 'Ajo' })
        const ingredients = [message.ingredient]
        worker.reply({ type: 'ingredients-result', requestId: message.requestId, ingredients })
        await expect(pending).resolves.toEqual(ingredients)
    })

    it('rechaza nombres vacíos sin abrir SQLite', async () => {
        await expect(database.addIngredient('  ')).rejects.toThrow(
            'El nombre del ingrediente es obligatorio'
        )
        expect(FakeWorker.instances).toHaveLength(0)
    })

    it('envía la modificación y eliminación con sus identificadores', async () => {
        const update = database.updateIngredient(' ing-1 ', ' Jitomate ')
        const first = await sent('ingredients:update')
        expect(first.message).toMatchObject({ id: 'ing-1', name: 'Jitomate' })
        first.worker.reply({
            type: 'ingredients-result',
            requestId: first.message.requestId,
            ingredients: [{ id: 'ing-1', name: 'Jitomate' }],
        })
        await expect(update).resolves.toHaveLength(1)

        const deletion = database.deleteIngredient(' ing-1 ')
        const second = await sent('ingredients:delete')
        expect(second.message.id).toBe('ing-1')
        second.worker.reply({
            type: 'ingredients-result', requestId: second.message.requestId, ingredients: [],
        })
        await expect(deletion).resolves.toEqual([])
    })
})

describe('CRUD de recetas: contrato de comunicación', () => {
    it('solicita el listado de recetas', async () => {
        const pending = database.listRecipes()
        const { worker, message } = await sent('recipes:list')
        const recipes = [{ id: 'rec-1', name: 'Salsa de jitomate' }]
        worker.reply({ type: 'recipes-result', requestId: message.requestId, recipes })
        await expect(pending).resolves.toEqual(recipes)
    })

    it('registra una receta con nombre normalizado y UUID', async () => {
        const pending = database.addRecipe('  Salsa de jitomate  ')
        const { worker, message } = await sent('recipes:add')
        expect(message.recipe).toEqual({
            id: expect.any(String), name: 'Salsa de jitomate',
        })
        const recipes = [message.recipe]
        worker.reply({ type: 'recipes-result', requestId: message.requestId, recipes })
        await expect(pending).resolves.toEqual(recipes)
    })

    it('permite actualizar y eliminar recetas', async () => {
        const pendingUpdate = database.updateRecipe(' rec-1 ', ' Salsa roja ')
        const first = await sent('recipes:update')
        expect(first.message).toMatchObject({ id: 'rec-1', name: 'Salsa roja' })
        first.worker.reply({
            type: 'recipes-result', requestId: first.message.requestId,
            recipes: [{ id: 'rec-1', name: 'Salsa roja' }],
        })
        await expect(pendingUpdate).resolves.toHaveLength(1)

        const pendingDelete = database.deleteRecipe(' rec-1 ')
        const second = await sent('recipes:delete')
        expect(second.message.id).toBe('rec-1')
        second.worker.reply({ type: 'recipes-result', requestId: second.message.requestId, recipes: [] })
        await expect(pendingDelete).resolves.toEqual([])
    })

    it('rechaza nombres e identificadores vacíos', async () => {
        await expect(database.addRecipe(' ')).rejects.toThrow('obligatorio')
        await expect(database.updateRecipe('', 'Salsa')).rejects.toThrow('obligatorios')
        await expect(database.deleteRecipe(' ')).rejects.toThrow('obligatorio')
        expect(FakeWorker.instances).toHaveLength(0)
    })
})

describe('Asociación receta–ingrediente', () => {
    it('consulta únicamente las asociaciones de la receta solicitada', async () => {
        const pending = database.listRecipeIngredients(' rec-1 ')
        const { worker, message } = await sent('recipe-ingredients:list')
        expect(message.recipeId).toBe('rec-1')
        const recipeIngredients = [
            { id: 'rel-1', recipeId: 'rec-1', ingredientId: 'ing-1' },
        ]
        worker.reply({
            type: 'recipe-ingredients-result',
            requestId: message.requestId,
            recipeIngredients,
        })
        await expect(pending).resolves.toEqual(recipeIngredients)
    })

    it('envía asociación con los tres identificadores', async () => {
        const pending = database.addRecipeIngredient(' rec-1 ', ' ing-1 ')
        const { worker, message } = await sent('recipe-ingredients:add')
        expect(message.recipeIngredient).toEqual({
            id: expect.any(String), recipeId: 'rec-1', ingredientId: 'ing-1',
        })
        const recipeIngredients = [message.recipeIngredient]
        worker.reply({
            type: 'recipe-ingredients-result',
            requestId: message.requestId,
            recipeIngredients,
        })
        await expect(pending).resolves.toEqual(recipeIngredients)
    })

    it('quita la asociación sin enviar ninguna orden de borrar ingrediente', async () => {
        const pending = database.deleteRecipeIngredient('rec-1', 'rel-1')
        const { worker, message } = await sent('recipe-ingredients:delete')
        expect(message).toMatchObject({ id: 'rel-1', recipeId: 'rec-1' })
        expect(worker.messages.some((m) => m.type === 'ingredients:delete')).toBe(false)
        worker.reply({
            type: 'recipe-ingredients-result',
            requestId: message.requestId,
            recipeIngredients: [],
        })
        await expect(pending).resolves.toEqual([])
    })

    it('rechaza identificadores vacíos', async () => {
        await expect(database.listRecipeIngredients(' ')).rejects.toThrow('obligatoria')
        await expect(database.addRecipeIngredient('', 'ing-1')).rejects.toThrow('obligatorios')
        await expect(database.addRecipeIngredient('rec-1', '')).rejects.toThrow('obligatorios')
        await expect(database.deleteRecipeIngredient('rec-1', ' ')).rejects.toThrow('obligatorias')
        expect(FakeWorker.instances).toHaveLength(0)
    })

    it('propaga al llamador el error de una asociación duplicada', async () => {
        // Simulación del error del Worker; no es prueba de la restricción SQL real.
        const pending = database.addRecipeIngredient('rec-1', 'ing-1')
        const { worker, message } = await sent('recipe-ingredients:add')
        worker.reply({
            type: 'recipe-ingredients-error',
            requestId: message.requestId,
            message: 'El ingrediente ya está asociado a esta receta',
        })
        await expect(pending).rejects.toThrow('ya está asociado')
    })
})

describe('Comunicación concurrente con el Worker', () => {
    it('devuelve respuestas al solicitante correcto aunque lleguen desordenadas', async () => {
        const ingredientsPending = database.listIngredients()
        const recipesPending = database.listRecipes()
        const first = await sent('ingredients:list')
        const second = await sent('recipes:list')
        expect(first.message.requestId).not.toBe(second.message.requestId)

        second.worker.reply({
            type: 'recipes-result',
            requestId: second.message.requestId,
            recipes: [{ id: 'rec-1', name: 'Salsa' }],
        })
        first.worker.reply({
            type: 'ingredients-result',
            requestId: first.message.requestId,
            ingredients: [{ id: 'ing-1', name: 'Sal' }],
        })

        await expect(recipesPending).resolves.toEqual([{ id: 'rec-1', name: 'Salsa' }])
        await expect(ingredientsPending).resolves.toEqual([{ id: 'ing-1', name: 'Sal' }])
        expect(FakeWorker.instances).toHaveLength(1)
    })
})
