import { useState } from 'react'
import type { FormEvent } from 'react'

type RecipeFormProps = {
    busy: boolean
    onAdd: (name: string) => Promise<boolean>
}

export function RecipeForm({ busy, onAdd }: RecipeFormProps) {
    const [name, setName] = useState('')

    async function handleSubmit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault()
        const cleanName = name.trim()
        if (!cleanName || busy) return

        const saved = await onAdd(cleanName)
        if (saved) setName('')
    }

    return (
        <form onSubmit={handleSubmit} className="rounded-2xl bg-white p-6 shadow-sm">
            <h3 className="mb-4 text-xl font-semibold text-slate-900">
                Registrar receta
            </h3>
            <div className="flex flex-col gap-3 sm:flex-row">
                <label htmlFor="recipe-name" className="sr-only">
                    Nombre de la receta
                </label>
                <input
                    id="recipe-name"
                    type="text"
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    maxLength={120}
                    disabled={busy}
                    placeholder="Ej. Salsa de jitomate"
                    required
                    className="min-w-0 flex-1 rounded-lg border border-slate-300 px-4 py-3 text-slate-900 disabled:opacity-60"
                />
                <button
                    type="submit"
                    disabled={busy || !name.trim()}
                    className="rounded-lg bg-green-700 px-5 py-3 font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
                >
                    {busy ? 'Guardando…' : 'Agregar'}
                </button>
            </div>
        </form>
    )
}
