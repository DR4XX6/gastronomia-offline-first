import sqlite3InitModule from '@sqlite.org/sqlite-wasm'
import type { Ingredient } from '../domain/ingredient'

type IngredientRequest =
    | {
        type: 'ingredients:list'
        requestId: number
        }
    | {
        type: 'ingredients:add'
        requestId: number
        ingredient: Ingredient
        }
    | {
        type: 'ingredients:update'
        requestId: number
        id: string
        name: string
        }
    | {
        type: 'ingredients:delete'
        requestId: number
        id: string
    }

// Inicialización de SQLite y almacenamiento OPFS
async function initializeDatabase() {
    try {
        const sqlite3 = await sqlite3InitModule()

        // Activar persistencia mediante OPFS
        const pool = await sqlite3.installOpfsSAHPoolVfs({
        name: 'gastronomia-opfs',
        directory: '/gastronomia-app',
        initialCapacity: 6,
        })

        // Abrir o crear la base de datos local
        const db = new pool.OpfsSAHPoolDb('/app.sqlite3')

        // Activar integridad referencial
        db.exec('PRAGMA foreign_keys = ON;')

        // Tabla inicial de prueba
        db.exec(`
        CREATE TABLE IF NOT EXISTS _app_meta (
            key TEXT PRIMARY KEY,
            value TEXT NOT NULL
        );
        `)

        // Registrar la versión inicial del esquema
        db.exec(`
        INSERT OR IGNORE INTO _app_meta (key, value)
        VALUES ('schema_version', '1');
        `)

        
        // MIGRACIÓN 2: Tabla de ingredientes

        const schemaVersion = Number(
            db.selectValue(
                "SELECT value FROM _app_meta WHERE key = 'schema_version'"
            )
        )

            if (!Number.isInteger(schemaVersion) || schemaVersion < 1) {
            throw new Error('Versión de base de datos inválida')
            }

            if (schemaVersion < 2) {
            db.exec(`
                BEGIN TRANSACTION;

                CREATE TABLE IF NOT EXISTS ingredients (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL
                    CHECK (length(trim(name)) > 0)
                );

                UPDATE _app_meta
                SET value = '2'
                WHERE key = 'schema_version';

                COMMIT;
            `)
        }
        
        // Verificar la migración de ingredientes
        const versionActual = db.selectValue(`
            SELECT value FROM _app_meta
            WHERE key = 'schema_version'
            `)

            const tablaIngredientes = db.selectValue(`
            SELECT name FROM sqlite_master
            WHERE type = 'table'
            AND name = 'ingredients'
            `)

            if (
            versionActual !== '2' ||
            tablaIngredientes !== 'ingredients'
            ) {
            throw new Error(
                'No se pudo verificar la migración de ingredientes'
            )
            }

            console.log('✅ Versión del esquema:', versionActual)
            console.log('✅ Tabla SQLite creada:', tablaIngredientes)

    // PRUEBA DE PERSISTENCIA LOCAL OPFS
    const fechaActual = new Date().toISOString()


    // Guardar únicamente si el registro no existe
    db.exec({
        sql: `
            INSERT OR IGNORE INTO _app_meta (key, value)
            VALUES ('opfs_first_write', ?);
        `,
        bind: [fechaActual],
    })

    // Recuperar el valor almacenado
    const fechaGuardada = db.selectValue(
        `SELECT value FROM _app_meta WHERE key = ?`,
        ['opfs_first_write']
    )

    if (typeof fechaGuardada !== 'string') {
        throw new Error('No se pudo verificar el registro OPFS')
    }

    // Recibir solicitudes de ingredientes desde React
    self.onmessage = (event: MessageEvent<IngredientRequest>) => {
    const request = event.data

    try {
    

        // ADD: Agregar un ingrediente existente
    if (request.type === 'ingredients:add') {
    const id = request.ingredient.id.trim()
    const name = request.ingredient.name.trim()

    if (!id || !name) {
        throw new Error(
        'El identificador y el nombre son obligatorios'
        )
    }

    // Insertar y obtener la fila realmente registrada
    const insertedRows = db.selectObjects(
        `
        INSERT INTO ingredients (id, name)
        VALUES (?, ?)
        RETURNING id, name
        `,
        [id, name]
    )

    // Confirmar que SQLite insertó exactamente una fila
    if (
        insertedRows.length !== 1 ||
        insertedRows[0].id !== id
    ) {
        throw new Error(
        'SQLite no confirmó el registro del ingrediente'
        )
    }

    console.log(
        '✅ Ingrediente insertado en SQLite:',
        insertedRows[0]
    )

    console.log(
        '✅ Total de ingredientes almacenados:',
        db.selectValue('SELECT COUNT(*) FROM ingredients')
    )
    }

        // UPDATE: Modificar un ingrediente existente
    if (request.type === 'ingredients:update') {
    const id = request.id.trim()
    const name = request.name.trim()

    if (!id || !name) {
        throw new Error(
        'El identificador y el nombre son obligatorios'
        )
    }

    db.exec({
        sql: `
        UPDATE ingredients
        SET name = ?
        WHERE id = ?
        `,
        bind: [name, id],
    })

    if (db.selectValue('SELECT changes()') !== 1) {
        throw new Error('No se encontró el ingrediente')
    }
    }

        // DELETE: Eliminar un ingrediente existente
    if (request.type === 'ingredients:delete') {
    const id = request.id.trim()

    if (!id) {
        throw new Error('El identificador es obligatorio')
    }

    db.exec({
        sql: `
        DELETE FROM ingredients
        WHERE id = ?
        `,
        bind: [id],
    })

    if (db.selectValue('SELECT changes()') !== 1) {
        throw new Error('No se encontró el ingrediente')
    }
}


    // Consultar los ingredientes almacenados
    const ingredientRows = db.selectObjects(`
        SELECT id, name
        FROM ingredients
        ORDER BY name COLLATE NOCASE, id
        `)

        // Validar y convertir los datos a Ingredient[]
        const ingredients: Ingredient[] = ingredientRows.map((row) => {
        if (
            typeof row.id !== 'string' ||
            typeof row.name !== 'string'
        ) {
            throw new Error(
            'Los datos del ingrediente tienen un formato inválido'
            )
        }

        return {
            id: row.id,
            name: row.name,
        }
        })

        // Verificar que el ingrediente recién creado puede consultarse
        if (request.type === 'ingredients:add') {
        const ingredientExists = ingredients.some(
            (ingredient) => ingredient.id === request.ingredient.id
        )
        if (!ingredientExists) {
            throw new Error(
            'El ingrediente no aparece después de insertarlo en SQLite'
            )
        }
        }

        self.postMessage({
        type: 'ingredients-result',
        requestId: request.requestId,
        ingredients,
        })
    } catch (error) {
        self.postMessage({
        type: 'ingredients-error',
        requestId: request.requestId,
        message:
            error instanceof Error ? error.message : String(error),
        })
    }
}

        // Informar que SQLite está preparado
        self.postMessage({
        type: 'database-ready',
        version: sqlite3.version.libVersion,
        firstWriteAt: fechaGuardada,
        })
    } catch (error) {
        // Informar cualquier error de inicialización
        self.postMessage({
        type: 'database-error',
        message:
            error instanceof Error
            ? error.message
            : String(error),
        })
    }
}

initializeDatabase()
