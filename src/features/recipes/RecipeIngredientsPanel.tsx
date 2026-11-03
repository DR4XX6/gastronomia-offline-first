import { useEffect, useState } from 'react'
import type { Ingredient } from '../../domain/ingredient'
import type { Recipe } from '../../domain/recipe'
import type { RecipeIngredient } from '../../domain/recipeIngredient'
import {
    addRecipeIngredient,
    deleteRecipeIngredient,
    listIngredients,
    listRecipeIngredients,
} from '../../db/database'

type RecipeIngredientsPanelProps = {
    recipes: Recipe[]
}

function errorMessage(error: unknown): string {
    return error instanceof Error ? error.message : String(error)
}

export function RecipeIngredientsPanel({ recipes }: RecipeIngredientsPanelProps) {
    const [recipeId, setRecipeId] = useState(recipes[0]?.id ?? '')
    const [ingredients, setIngredients] = useState<Ingredient[]>([])
    const [links, setLinks] = useState<RecipeIngredient[]>([])
    const [candidateId, setCandidateId] = useState('')
    const [loading, setLoading] = useState(false)
    const [busy, setBusy] = useState(false)
    const [error, setError] = useState<string | null>(null)

    // Mantener una receta válida al agregar o eliminar recetas en el CRUD.
    useEffect(() => {
        if (!recipes.some((recipe) => recipe.id === recipeId)) {
            setRecipeId(recipes[0]?.id ?? '')
        }
    }, [recipes, recipeId])

    // Cargar los ingredientes y las asociaciones de la receta seleccionada.
    // El indicador "active" evita mostrar resultados de selecciones antiguas.
    useEffect(() => {
        let active = true
        if (!recipeId || !recipes.some((recipe) => recipe.id === recipeId)) {
            setLinks([])
            setLoading(false)
            return () => { active = false }
        }

        setLoading(true)
        setError(null)
        setLinks([])
        setCandidateId('')

        void Promise.all([
            listIngredients(),
            listRecipeIngredients(recipeId),
        ])
            .then(([catalog, associations]) => {
                if (!active) return
                setIngredients(catalog)
                setLinks(associations)
            })
            .catch((cause: unknown) => {
                if (active) setError(errorMessage(cause))
            })
            .finally(() => {
                if (active) setLoading(false)
            })

        return () => { active = false }
    }, [recipeId, recipes])

    const selectedRecipe = recipes.find((recipe) => recipe.id === recipeId)
    const assignedIds = new Set(links.map((link) => link.ingredientId))
    const availableIngredients = ingredients.filter(
        (ingredient) => !assignedIds.has(ingredient.id)
    )
    const canInteract = !!selectedRecipe && !loading && !busy

    async function refreshCatalog() {
        if (!canInteract) return
        setBusy(true)
        setError(null)
        try {
            const [catalog, associations] = await Promise.all([
                listIngredients(),
                listRecipeIngredients(recipeId),
            ])
            setIngredients(catalog)
            setLinks(associations)
            setCandidateId('')
        } catch (cause) {
            setError(errorMessage(cause))
        } finally {
            setBusy(false)
        }
    }

    async function addAssociation() {
        if (!canInteract || !candidateId || !availableIngredients.some(
            (ingredient) => ingredient.id === candidateId
        )) return

        setBusy(true)
        setError(null)
        try {
            const updated = await addRecipeIngredient(recipeId, candidateId)
            setLinks(updated)
            setCandidateId('')
        } catch (cause) {
            setError(errorMessage(cause))
        } finally {
            setBusy(false)
        }
    }

    async function removeAssociation(link: RecipeIngredient) {
        if (!canInteract) return
        const ingredient = ingredients.find((item) => item.id === link.ingredientId)
        const name = ingredient?.name ?? 'este ingrediente'
        if (!window.confirm(
            `¿Quitar «${name}» de esta receta? No se eliminará del catálogo.`
        )) return

        setBusy(true)
        setError(null)
        try {
            const updated = await deleteRecipeIngredient(recipeId, link.id)
            setLinks(updated)
        } catch (cause) {
            setError(errorMessage(cause))
        } finally {
            setBusy(false)
        }
    }

    return (
        <section
            aria-labelledby="recipe-ingredients-title"
            className="mt-8 rounded-2xl bg-white p-5 shadow-sm sm:p-6"
        >
            <h3 id="recipe-ingredients-title" className="text-xl font-semibold text-slate-900">
                Ingredientes de una receta
            </h3>
            <p className="mt-2 text-sm text-slate-600">
                Asocia ingredientes existentes. Las cantidades y unidades se agregarán
                en una etapa posterior, después de su validación académica.
            </p>

            {recipes.length === 0 ? (
                <p className="mt-5 text-slate-600">
                    Primero registra una receta para poder asignarle ingredientes.
                </p>
            ) : (
                <>
                    <div className="mt-5">
                        <label htmlFor="recipe-ingredients-recipe" className="block text-sm font-medium text-slate-800">
                            Receta
                        </label>
                        <select
                            id="recipe-ingredients-recipe"
                            value={selectedRecipe?.id ?? ''}
                            onChange={(event) => {
                                setRecipeId(event.target.value)
                                setCandidateId('')
                                setLinks([])
                            }}
                            disabled={loading || busy}
                            className="mt-2 w-full rounded-lg border border-slate-300 bg-white px-3 py-3 text-slate-900 disabled:opacity-60"
                        >
                            {recipes.map((recipe) => (
                                <option key={recipe.id} value={recipe.id}>{recipe.name}</option>
                            ))}
                        </select>
                    </div>

                    {error && (
                        <p role="alert" className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-red-700">
                            Error de asociación: {error}
                        </p>
                    )}

                    {loading ? (
                        <p role="status" className="mt-4 text-slate-600">Cargando ingredientes…</p>
                    ) : (
                        <>
                            <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-end">
                                <div className="min-w-0 flex-1">
                                    <label htmlFor="recipe-ingredients-candidate" className="block text-sm font-medium text-slate-800">
                                        Ingrediente disponible
                                    </label>
                                    <select
                                        id="recipe-ingredients-candidate"
                                        value={candidateId}
                                        onChange={(event) => setCandidateId(event.target.value)}
                                        disabled={!canInteract || availableIngredients.length === 0}
                                        className="mt-2 w-full rounded-lg border border-slate-300 bg-white px-3 py-3 text-slate-900 disabled:opacity-60"
                                    >
                                        <option value="">Selecciona un ingrediente</option>
                                        {availableIngredients.map((ingredient) => (
                                            <option key={ingredient.id} value={ingredient.id}>
                                                {ingredient.name}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => void addAssociation()}
                                    disabled={!canInteract || !candidateId}
                                    className="rounded-lg bg-green-700 px-5 py-3 font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
                                >
                                    Asociar
                                </button>
                                <button
                                    type="button"
                                    onClick={() => void refreshCatalog()}
                                    disabled={!canInteract}
                                    className="rounded-lg bg-slate-100 px-4 py-3 text-slate-800 disabled:opacity-50"
                                >
                                    Actualizar catálogo
                                </button>
                            </div>

                            {availableIngredients.length === 0 && (
                                <p className="mt-2 text-sm text-slate-600">
                                    No hay ingredientes disponibles para agregar a esta receta.
                                </p>
                            )}

                            <h4 className="mt-6 font-semibold text-slate-900">
                                Ingredientes asociados ({links.length})
                            </h4>
                            {links.length === 0 ? (
                                <p className="mt-3 text-slate-600">
                                    Esta receta todavía no tiene ingredientes asociados.
                                </p>
                            ) : (
                                <ul className="mt-3 space-y-2">
                                    {links.map((link) => {
                                        const ingredient = ingredients.find(
                                            (item) => item.id === link.ingredientId
                                        )
                                        return (
                                            <li
                                                key={link.id}
                                                className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-200 p-3"
                                            >
                                                <span className="break-words text-slate-900">
                                                    {ingredient?.name ?? `Ingrediente ${link.ingredientId}`}
                                                </span>
                                                <button
                                                    type="button"
                                                    disabled={!canInteract}
                                                    onClick={() => void removeAssociation(link)}
                                                    className="rounded-lg bg-red-50 px-3 py-2 text-red-700 disabled:opacity-50"
                                                >
                                                    Quitar de receta
                                                </button>
                                            </li>
                                        )
                                    })}
                                </ul>
                            )}
                            <p className="mt-4 text-xs text-slate-500">
                                Si registras ingredientes en el módulo superior, pulsa
                                «Actualizar catálogo» para verlos aquí.
                            </p>
                        </>
                    )}
                </>
            )}
        </section>
    )
}
