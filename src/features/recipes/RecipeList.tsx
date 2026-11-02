import { useState } from 'react'
import type { FormEvent } from 'react'
import type { Recipe } from '../../domain/recipe'

type RecipeListProps = {
    recipes: Recipe[]
    busy: boolean
    onUpdate: (id: string, name: string) => Promise<boolean>
    onDelete: (id: string) => Promise<boolean>
}

export function RecipeList({
    recipes,
    busy,
    onUpdate,
    onDelete,
}: RecipeListProps) {
    const [editingId, setEditingId] = useState<string | null>(null)
    const [editingName, setEditingName] = useState('')

    async function saveEdit(event: FormEvent<HTMLFormElement>, id: string) {
        event.preventDefault()
        const name = editingName.trim()
        if (!name || busy) return

        const saved = await onUpdate(id, name)
        if (saved) {
            setEditingId(null)
            setEditingName('')
        }
    }

    async function removeRecipe(recipe: Recipe) {
        if (busy) return
        if (!window.confirm(`¿Eliminar la receta «${recipe.name}»?`)) return
        const deleted = await onDelete(recipe.id)
        if (deleted && editingId === recipe.id) {
            setEditingId(null)
            setEditingName('')
        }
    }

    return (
        <section aria-labelledby="recipe-list-title" className="mt-6">
            <h3 id="recipe-list-title" className="mb-4 text-xl font-semibold text-slate-900">
                Recetas registradas
            </h3>

            {recipes.length === 0 ? (
                <p className="text-slate-600">Todavía no hay recetas registradas.</p>
            ) : (
                <ul className="space-y-3">
                    {recipes.map((recipe) => (
                        <li key={recipe.id} className="rounded-xl bg-white p-4 shadow-sm">
                            {editingId === recipe.id ? (
                                <form
                                    onSubmit={(event) => void saveEdit(event, recipe.id)}
                                    className="flex flex-col gap-3 sm:flex-row"
                                >
                                    <label htmlFor={`edit-recipe-${recipe.id}`} className="sr-only">
                                        Nuevo nombre de la receta
                                    </label>
                                    <input
                                        id={`edit-recipe-${recipe.id}`}
                                        value={editingName}
                                        onChange={(event) => setEditingName(event.target.value)}
                                        maxLength={120}
                                        disabled={busy}
                                        required
                                        className="min-w-0 flex-1 rounded-lg border border-slate-300 px-3 py-2 text-slate-900"
                                    />
                                    <button
                                        type="submit"
                                        disabled={busy || !editingName.trim()}
                                        className="rounded-lg bg-green-700 px-3 py-2 text-white disabled:opacity-50"
                                    >
                                        Guardar
                                    </button>
                                    <button
                                        type="button"
                                        disabled={busy}
                                        onClick={() => setEditingId(null)}
                                        className="rounded-lg bg-slate-100 px-3 py-2 text-slate-700 disabled:opacity-50"
                                    >
                                        Cancelar
                                    </button>
                                </form>
                            ) : (
                                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                                    <span className="break-words text-slate-900">{recipe.name}</span>
                                    <div className="flex gap-2">
                                        <button
                                            type="button"
                                            disabled={busy}
                                            onClick={() => {
                                                setEditingId(recipe.id)
                                                setEditingName(recipe.name)
                                            }}
                                            className="rounded-lg bg-blue-50 px-3 py-2 text-blue-700 disabled:opacity-50"
                                        >
                                            Editar
                                        </button>
                                        <button
                                            type="button"
                                            disabled={busy}
                                            onClick={() => void removeRecipe(recipe)}
                                            className="rounded-lg bg-red-50 px-3 py-2 text-red-700 disabled:opacity-50"
                                        >
                                            Eliminar
                                        </button>
                                    </div>
                                </div>
                            )}
                        </li>
                    ))}
                </ul>
            )}
        </section>
    )
}
