
import sqlite3InitModule from '@sqlite.org/sqlite-wasm'

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
