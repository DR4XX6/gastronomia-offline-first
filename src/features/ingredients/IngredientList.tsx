
import { useState } from 'react'
import type { Ingredient } from '../../domain/ingredient'

interface IngredientListProps {
    ingredients: Ingredient[]
    onUpdate: (id: string, name: string) => Promise<boolean>
    onDelete: (id: string) => Promise<boolean>
    busy: boolean
    }

function IngredientList({
    ingredients,
    onUpdate,
    onDelete,
    busy,
    }: IngredientListProps) {
    const [editingId, setEditingId] = useState<string | null>(null)
    const [editedName, setEditedName] = useState('')
    const [validationError, setValidationError] = useState('')

function startEditing(ingredient: Ingredient) {
        setEditingId(ingredient.id)
        setEditedName(ingredient.name)
        setValidationError('')
    }

function cancelEditing() {
        setEditingId(null)
        setEditedName('')
        setValidationError('')
    }

    async function saveEditing() {
        if (!editingId || busy) return

        const cleanName = editedName.trim()

        if (!cleanName) {
        setValidationError('El nombre es obligatorio')
        return
        }

        const success = await onUpdate(editingId, cleanName)

        if (success) {
        cancelEditing()
        }
    }

    async function handleDelete(ingredient: Ingredient) {
        if (busy) return

        const confirmed = window.confirm(
        `¿Deseas eliminar "${ingredient.name}"? Esta acción no se puede deshacer.`
        )

        if (!confirmed) return

        await onDelete(ingredient.id)
    }

    return (
        <section className="mt-10">
        <h2 className="text-xl font-semibold text-slate-900">
            Ingredientes registrados
        </h2>

        {ingredients.length === 0 ? (
            <p className="mt-4 text-sm text-slate-500">
            Todavía no hay ingredientes registrados.
            </p>
        ) : (
            <ul className="mt-4 space-y-2">
            {ingredients.map((ingredient) => (
                <li
                key={ingredient.id}
                className="rounded-lg bg-white px-4 py-3 shadow-sm"
                >
                {editingId === ingredient.id ? (
                    <form
                    onSubmit={(event) => {
                        event.preventDefault()
                        void saveEditing()
                    }}
                    className="space-y-2"
                    >
                    <label
                        htmlFor={`edit-${ingredient.id}`}
                        className="block text-sm font-medium"
                    >
                        Editar ingrediente
                    </label>

                    <input
                        id={`edit-${ingredient.id}`}
                        type="text"
                        value={editedName}
                        disabled={busy}
                        onChange={(event) => {
                        setEditedName(event.target.value)
                        setValidationError('')
                        }}
                        className="w-full rounded-lg border border-slate-300 px-3 py-2"
                    />

                    {validationError && (
                        <p role="alert" className="text-sm text-red-600">
                        {validationError}
                        </p>
                    )}

                    <div className="flex gap-2">
                        <button
                        type="submit"
                        disabled={busy}
                        className="rounded-lg bg-green-700 px-3 py-2 text-sm text-white disabled:opacity-50"
                        >
                        Guardar
                        </button>

                        <button
                        type="button"
                        disabled={busy}
                        onClick={cancelEditing}
                        className="rounded-lg bg-slate-200 px-3 py-2 text-sm text-slate-800 disabled:opacity-50"
                        >
                        Cancelar
                        </button>
                    </div>
                    </form>
                ) : (
                    <div className="flex flex-wrap items-center justify-between gap-3">
                    <span className="text-slate-900">
                        {ingredient.name}
                    </span>

                    <div className="flex gap-2">
                        <button
                        type="button"
                        disabled={busy}
                        onClick={() => startEditing(ingredient)}
                        className="rounded-lg bg-blue-50 px-3 py-2 text-sm text-blue-700 disabled:opacity-50"
                        >
                        Editar
                        </button>

                        <button
                        type="button"
                        disabled={busy}
                        onClick={() => void handleDelete(ingredient)}
                        className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 disabled:opacity-50"
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

export default IngredientList
