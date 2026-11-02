import { useEffect, useState } from 'react'
import type { Ingredient } from '../../domain/ingredient'
import {
    listIngredients,
    addIngredient,
    updateIngredient,
    deleteIngredient,
    } from '../../db/database'
    import IngredientForm from './IngredientForm'
    import IngredientList from './IngredientList'

    function IngredientManager() {
    const [ingredients, setIngredients] = useState<Ingredient[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [isLoaded, setIsLoaded] = useState(false)
    const [isSaving, setIsSaving] = useState(false)
    const [error, setError] = useState<string | null>(null)

    // Recuperar ingredientes desde SQLite
    useEffect(() => {
        let active = true

        listIngredients()
        .then((storedIngredients) => {
            if (!active) return

            setIngredients(storedIngredients)
            setIsLoaded(true)
        })
        .catch((err: unknown) => {
            if (!active) return

            setError(
            err instanceof Error
                ? err.message
                : 'No se pudieron cargar los ingredientes'
            )
        })
        .finally(() => {
            if (active) setIsLoading(false)
        })

        return () => {
        active = false
        }
    }, [])

    // Ejecutar operaciones SQLite
    async function performChange(
    operation: () => Promise<Ingredient[]>
    ): Promise<boolean> {
    if (!isLoaded || isSaving) return false

    setIsSaving(true)
    setError(null)

    try {
        const updatedIngredients = await operation()

        console.log(
        'Ingredientes recuperados:',
        updatedIngredients
        )

        setIngredients(updatedIngredients)
        return true
    } catch (err) {
        console.error('Error de operación SQLite:', err)

        setError(
        err instanceof Error
            ? err.message
            : 'No se pudo completar la operación'
        )

        return false
    } finally {
        // Debe ejecutarse tanto en éxito como en error
        setIsSaving(false)
    }
    }


    
    function handleAddIngredient(name: string) {
    console.log('1. Formulario envió:', name)

    void performChange(() => addIngredient(name))
        .then((success) => {
        console.log('2. Resultado del guardado:', success)
        })
    }

    function handleUpdateIngredient(
        id: string,
        name: string
    ): Promise<boolean> {
        return performChange(() => updateIngredient(id, name))
    }

    function handleDeleteIngredient(
        id: string
    ): Promise<boolean> {
        return performChange(() => deleteIngredient(id))
    }

    return (
        <>
        <fieldset
            disabled={!isLoaded || isSaving}
            className="min-w-0 border-0 p-0"
        >
            <IngredientForm
            onAddIngredient={handleAddIngredient}
            />
        </fieldset>

        {isLoading && (
            <p className="mt-3 text-sm text-slate-500">
            Cargando ingredientes desde SQLite...
            </p>
        )}

        {isSaving && (
            <p className="mt-3 text-sm text-slate-500">
            Guardando cambios...
            </p>
        )}

        {error && (
            <p role="alert" className="mt-3 text-sm text-red-600">
            Error: {error}
            </p>
        )}

        {isLoaded && (
            <IngredientList
            ingredients={ingredients}
            onUpdate={handleUpdateIngredient}
            onDelete={handleDeleteIngredient}
            busy={isSaving}
            />
        )}
        </>
    )
}

export default IngredientManager
