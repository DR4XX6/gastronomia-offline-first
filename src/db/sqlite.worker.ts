import sqlite3InitModule from '@sqlite.org/sqlite-wasm'
import type { Ingredient } from '../domain/ingredient'
import type { Recipe } from '../domain/recipe'
import type { RecipeIngredient } from '../domain/recipeIngredient'

type IngredientRequest =
    | { type: 'ingredients:list'; requestId: number }
    | { type: 'ingredients:add'; requestId: number; ingredient: Ingredient }
    | { type: 'ingredients:update'; requestId: number; id: string; name: string }
    | { type: 'ingredients:delete'; requestId: number; id: string }

type RecipeRequest =
    | { type: 'recipes:list'; requestId: number }
    | { type: 'recipes:add'; requestId: number; recipe: Recipe }
    | { type: 'recipes:update'; requestId: number; id: string; name: string }
    | { type: 'recipes:delete'; requestId: number; id: string }

type RecipeIngredientRequest =
    | { type: 'recipe-ingredients:list'; requestId: number; recipeId: string }
    | { type: 'recipe-ingredients:add'; requestId: number; recipeIngredient: RecipeIngredient }
    | { type: 'recipe-ingredients:delete'; requestId: number; id: string; recipeId: string }

type DatabaseRequest = IngredientRequest | RecipeRequest | RecipeIngredientRequest

function isRecipeIngredientRequest(
    request: DatabaseRequest
): request is RecipeIngredientRequest {
    return request.type.startsWith('recipe-ingredients:')
}

function isRecipeRequest(request: DatabaseRequest): request is RecipeRequest {
    return request.type.startsWith('recipes:')
}

// Inicialización de SQLite y almacenamiento persistente OPFS.
async function initializeDatabase() {
    try {
        const sqlite3 = await sqlite3InitModule()

        // Conservar estos valores: identifican los datos locales existentes.
        const pool = await sqlite3.installOpfsSAHPoolVfs({
            name: 'gastronomia-opfs',
            directory: '/gastronomia-app',
            initialCapacity: 6,
        })
        const db = new pool.OpfsSAHPoolDb('/app.sqlite3')

        db.exec('PRAGMA foreign_keys = ON;')

        db.exec(`
            CREATE TABLE IF NOT EXISTS _app_meta (
                key TEXT PRIMARY KEY,
                value TEXT NOT NULL
            );
        `)
        db.exec(`
            INSERT OR IGNORE INTO _app_meta (key, value)
            VALUES ('schema_version', '1');
        `)

        const schemaVersion = Number(
            db.selectValue("SELECT value FROM _app_meta WHERE key = 'schema_version'")
        )

        if (!Number.isInteger(schemaVersion) || schemaVersion < 1) {
            throw new Error('Versión de base de datos inválida')
        }

        // MIGRACIÓN 2: catálogo existente de ingredientes.
        if (schemaVersion < 2) {
            db.exec(`
                BEGIN TRANSACTION;

                CREATE TABLE IF NOT EXISTS ingredients (
                    id TEXT PRIMARY KEY,
                    name TEXT NOT NULL CHECK (length(trim(name)) > 0)
                );

                UPDATE _app_meta
                SET value = '2'
                WHERE key = 'schema_version';

                COMMIT;
            `)
        }

        // MIGRACIÓN 3: recetas y relaciones con ingredientes.
        if (schemaVersion < 3) {
            db.exec('BEGIN TRANSACTION;')
            try {
                db.exec(`
                    CREATE TABLE IF NOT EXISTS recipes (
                        id TEXT PRIMARY KEY,
                        name TEXT NOT NULL CHECK (length(trim(name)) > 0)
                    );

                    CREATE TABLE IF NOT EXISTS recipe_ingredients (
                        id TEXT PRIMARY KEY,
                        recipe_id TEXT NOT NULL,
                        ingredient_id TEXT NOT NULL,
                        FOREIGN KEY (recipe_id) REFERENCES recipes(id)
                            ON DELETE CASCADE,
                        FOREIGN KEY (ingredient_id) REFERENCES ingredients(id)
                            ON DELETE RESTRICT
                    );

                    CREATE INDEX IF NOT EXISTS idx_recipe_ingredients_recipe_id
                        ON recipe_ingredients(recipe_id);
                    CREATE INDEX IF NOT EXISTS idx_recipe_ingredients_ingredient_id
                        ON recipe_ingredients(ingredient_id);

                    UPDATE _app_meta
                    SET value = '3'
                    WHERE key = 'schema_version';
                `)
                db.exec('COMMIT;')
            } catch (error) {
                db.exec('ROLLBACK;')
                throw error
            }
        }

        // La migración 3 ya está aplicada en los navegadores comprobados.
        const versionActual = db.selectValue(`
            SELECT value FROM _app_meta WHERE key = 'schema_version'
        `)
        if (versionActual !== '3') {
            throw new Error('La base de datos no alcanzó la versión 3')
        }

        const tablasEsperadas = ['ingredients', 'recipes', 'recipe_ingredients']
        for (const tabla of tablasEsperadas) {
            const tablaEncontrada = db.selectValue(
                `SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?`,
                [tabla]
            )
            if (tablaEncontrada !== tabla) {
                throw new Error(`No se encontró la tabla ${tabla}`)
            }
            console.log('✅ Tabla SQLite verificada:', tabla)
        }
        console.log('✅ Versión del esquema:', versionActual)

        // Conservamos la marca inicial para comprobar persistencia entre sesiones.
        const fechaActual = new Date().toISOString()
        db.exec({
            sql: `INSERT OR IGNORE INTO _app_meta (key, value)
                    VALUES ('opfs_first_write', ?);`,
            bind: [fechaActual],
        })
        const fechaGuardada = db.selectValue(
            'SELECT value FROM _app_meta WHERE key = ?',
            ['opfs_first_write']
        )
        if (typeof fechaGuardada !== 'string') {
            throw new Error('No se pudo verificar el registro OPFS')
        }

        self.onmessage = (event: MessageEvent<DatabaseRequest>) => {
            const request = event.data
            try {
                // Vinculación entre recetas e ingredientes (sin cambiar el esquema 3).
                if (isRecipeIngredientRequest(request)) {
                    const recipeId = (
                        request.type === 'recipe-ingredients:add'
                            ? request.recipeIngredient.recipeId
                            : request.recipeId
                    ).trim()

                    if (!recipeId) {
                        throw new Error('La receta es obligatoria')
                    }

                    const recipeExists = db.selectValue(
                        'SELECT 1 FROM recipes WHERE id = ?',
                        [recipeId]
                    )
                    if (recipeExists !== 1) {
                        throw new Error('No se encontró la receta')
                    }

                    if (request.type === 'recipe-ingredients:add') {
                        const id = request.recipeIngredient.id.trim()
                        const ingredientId = request.recipeIngredient.ingredientId.trim()
                        if (!id || !ingredientId) {
                            throw new Error('Los identificadores son obligatorios')
                        }

                        const ingredientExists = db.selectValue(
                            'SELECT 1 FROM ingredients WHERE id = ?',
                            [ingredientId]
                        )
                        if (ingredientExists !== 1) {
                            throw new Error('No se encontró el ingrediente')
                        }

                        const associationExists = db.selectValue(
                            `SELECT 1 FROM recipe_ingredients
                            WHERE recipe_id = ? AND ingredient_id = ? LIMIT 1`,
                            [recipeId, ingredientId]
                        )
                        if (associationExists === 1) {
                            throw new Error('El ingrediente ya pertenece a esta receta')
                        }

                        const insertedRows = db.selectObjects(
                            `INSERT INTO recipe_ingredients (id, recipe_id, ingredient_id)
                            VALUES (?, ?, ?)
                            RETURNING id, recipe_id, ingredient_id`,
                            [id, recipeId, ingredientId]
                        )
                        if (insertedRows.length !== 1 || insertedRows[0].id !== id) {
                            throw new Error('SQLite no confirmó la asociación')
                        }
                    }

                    if (request.type === 'recipe-ingredients:delete') {
                        const id = request.id.trim()
                        if (!id) {
                            throw new Error('La asociación es obligatoria')
                        }
                        db.exec({
                            sql: `DELETE FROM recipe_ingredients
                                    WHERE id = ? AND recipe_id = ?`,
                            bind: [id, recipeId],
                        })
                        if (db.selectValue('SELECT changes()') !== 1) {
                            throw new Error('No se encontró la asociación')
                        }
                    }

                    const rows = db.selectObjects(
                        `SELECT id, recipe_id, ingredient_id
                        FROM recipe_ingredients
                        WHERE recipe_id = ?
                        ORDER BY ingredient_id, id`,
                        [recipeId]
                    )
                    const recipeIngredients: RecipeIngredient[] = rows.map((row) => {
                        if (
                            typeof row.id !== 'string' ||
                            typeof row.recipe_id !== 'string' ||
                            typeof row.ingredient_id !== 'string'
                        ) {
                            throw new Error('La asociación contiene datos inválidos')
                        }
                        return {
                            id: row.id,
                            recipeId: row.recipe_id,
                            ingredientId: row.ingredient_id,
                        }
                    })
                    self.postMessage({
                        type: 'recipe-ingredients-result',
                        requestId: request.requestId,
                        recipeIngredients,
                    })
                    return
                }

                // CRUD de recetas. Cada operación devuelve el listado vigente.
                if (isRecipeRequest(request)) {
                    if (request.type === 'recipes:add') {
                        const id = request.recipe.id.trim()
                        const name = request.recipe.name.trim()
                        if (!id || !name) {
                            throw new Error('El identificador y el nombre son obligatorios')
                        }

                        const insertedRows = db.selectObjects(
                            `INSERT INTO recipes (id, name)
                            VALUES (?, ?)
                            RETURNING id, name`,
                            [id, name]
                        )
                        if (insertedRows.length !== 1 || insertedRows[0].id !== id) {
                            throw new Error('SQLite no confirmó el registro de la receta')
                        }
                    }

                    if (request.type === 'recipes:update') {
                        const id = request.id.trim()
                        const name = request.name.trim()
                        if (!id || !name) {
                            throw new Error('El identificador y el nombre son obligatorios')
                        }
                        db.exec({
                            sql: 'UPDATE recipes SET name = ? WHERE id = ?',
                            bind: [name, id],
                        })
                        if (db.selectValue('SELECT changes()') !== 1) {
                            throw new Error('No se encontró la receta')
                        }
                    }

                    if (request.type === 'recipes:delete') {
                        const id = request.id.trim()
                        if (!id) {
                            throw new Error('El identificador es obligatorio')
                        }
                        db.exec({
                            sql: 'DELETE FROM recipes WHERE id = ?',
                            bind: [id],
                        })
                        if (db.selectValue('SELECT changes()') !== 1) {
                            throw new Error('No se encontró la receta')
                        }
                    }

                    const recipeRows = db.selectObjects(`
                        SELECT id, name FROM recipes
                        ORDER BY name COLLATE NOCASE, id
                    `)
                    const recipes: Recipe[] = recipeRows.map((row) => {
                        if (typeof row.id !== 'string' || typeof row.name !== 'string') {
                            throw new Error('Los datos de la receta tienen un formato inválido')
                        }
                        return { id: row.id, name: row.name }
                    })

                    if (
                        request.type === 'recipes:add' &&
                        !recipes.some((recipe) => recipe.id === request.recipe.id)
                    ) {
                        throw new Error('La receta no aparece después de insertarla en SQLite')
                    }

                    self.postMessage({
                        type: 'recipes-result',
                        requestId: request.requestId,
                        recipes,
                    })
                    return
                }

                // CRUD de ingredientes: comportamiento existente preservado.
                if (request.type === 'ingredients:add') {
                    const id = request.ingredient.id.trim()
                    const name = request.ingredient.name.trim()
                    if (!id || !name) {
                        throw new Error('El identificador y el nombre son obligatorios')
                    }
                    const insertedRows = db.selectObjects(
                        `INSERT INTO ingredients (id, name)
                        VALUES (?, ?)
                        RETURNING id, name`,
                        [id, name]
                    )
                    if (insertedRows.length !== 1 || insertedRows[0].id !== id) {
                        throw new Error('SQLite no confirmó el registro del ingrediente')
                    }
                    console.log('✅ Ingrediente insertado en SQLite:', insertedRows[0])
                    console.log(
                        '✅ Total de ingredientes almacenados:',
                        db.selectValue('SELECT COUNT(*) FROM ingredients')
                    )
                }

                if (request.type === 'ingredients:update') {
                    const id = request.id.trim()
                    const name = request.name.trim()
                    if (!id || !name) {
                        throw new Error('El identificador y el nombre son obligatorios')
                    }
                    db.exec({
                        sql: 'UPDATE ingredients SET name = ? WHERE id = ?',
                        bind: [name, id],
                    })
                    if (db.selectValue('SELECT changes()') !== 1) {
                        throw new Error('No se encontró el ingrediente')
                    }
                }

                if (request.type === 'ingredients:delete') {
                    const id = request.id.trim()
                    if (!id) {
                        throw new Error('El identificador es obligatorio')
                    }
                    db.exec({
                        sql: 'DELETE FROM ingredients WHERE id = ?',
                        bind: [id],
                    })
                    if (db.selectValue('SELECT changes()') !== 1) {
                        throw new Error('No se encontró el ingrediente')
                    }
                }

                const ingredientRows = db.selectObjects(`
                    SELECT id, name FROM ingredients
                    ORDER BY name COLLATE NOCASE, id
                `)
                const ingredients: Ingredient[] = ingredientRows.map((row) => {
                    if (typeof row.id !== 'string' || typeof row.name !== 'string') {
                        throw new Error('Los datos del ingrediente tienen un formato inválido')
                    }
                    return { id: row.id, name: row.name }
                })

                if (
                    request.type === 'ingredients:add' &&
                    !ingredients.some((ingredient) => ingredient.id === request.ingredient.id)
                ) {
                    throw new Error('El ingrediente no aparece después de insertarlo en SQLite')
                }

                self.postMessage({
                    type: 'ingredients-result',
                    requestId: request.requestId,
                    ingredients,
                })
            } catch (error) {
                self.postMessage({
                    type: isRecipeIngredientRequest(request)
                        ? 'recipe-ingredients-error'
                        : isRecipeRequest(request)
                            ? 'recipes-error'
                            : 'ingredients-error',
                    requestId: request.requestId,
                    message: error instanceof Error ? error.message : String(error),
                })
            }
        }

        self.postMessage({
            type: 'database-ready',
            version: sqlite3.version.libVersion,
            firstWriteAt: fechaGuardada,
        })
    } catch (error) {
        self.postMessage({
            type: 'database-error',
            message: error instanceof Error ? error.message : String(error),
        })
    }
}

initializeDatabase()
