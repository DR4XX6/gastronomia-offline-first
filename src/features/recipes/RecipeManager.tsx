import { useEffect, useState } from 'react'
import type { Recipe } from '../../domain/recipe'
import {
    listRecipes,
    addRecipe,
    updateRecipe,
    deleteRecipe,
} from '../../db/database'
import { RecipeForm } from './RecipeForm'
import { RecipeList } from './RecipeList'
import { RecipeIngredientsPanel } from './RecipeIngredientsPanel'

export function RecipeManager() {
    const [recipes, setRecipes] = useState<Recipe[]>([])
    const [loading, setLoading] = useState(true)
    const [busy, setBusy] = useState(false)
    const [error, setError] = useState<string | null>(null)

    useEffect(() => {
        let active = true
        void listRecipes()
            .then((items) => {
                if (active) setRecipes(items)
            })
            .catch((cause: unknown) => {
                if (active) {
                    setError(cause instanceof Error ? cause.message : String(cause))
                }
            })
            .finally(() => {
                if (active) setLoading(false)
            })
        return () => { active = false }
    }, [])

    async function runOperation(operation: () => Promise<Recipe[]>): Promise<boolean> {
        setError(null)
        setBusy(true)
        try {
            const updated = await operation()
            setRecipes(updated)
            return true
        } catch (cause) {
            setError(cause instanceof Error ? cause.message : String(cause))
            return false
        } finally {
            setBusy(false)
        }
    }

    return (
        <section aria-labelledby="recipe-manager-title" className="rounded-2xl bg-slate-100 p-5 sm:p-6">
            <h2 id="recipe-manager-title" className="mb-5 text-2xl font-bold text-slate-900">
                Gestión de recetas
            </h2>
            <p className="mb-4 text-sm text-slate-600">
                Registra recetas y asocia ingredientes disponibles en el catálogo local.
            </p>

            {error && (
                <p role="alert" className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-red-700">
                    Error de recetas: {error}
                </p>
            )}

            {loading ? (
                <p role="status" className="text-slate-600">Cargando recetas…</p>
            ) : (
                <>
                    <RecipeForm
                        busy={busy}
                        onAdd={(name) => runOperation(() => addRecipe(name))}
                    />
                    <RecipeList
                        recipes={recipes}
                        busy={busy}
                        onUpdate={(id, name) => runOperation(() => updateRecipe(id, name))}
                        onDelete={(id) => runOperation(() => deleteRecipe(id))}
                    />
                    <RecipeIngredientsPanel recipes={recipes} />
                </>
            )}
        </section>
    )
}
