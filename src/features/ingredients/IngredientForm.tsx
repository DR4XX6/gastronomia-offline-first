import { useState } from 'react'

interface IngredientFormProps {
    onAddIngredient: (name: string) => void
    }

    function IngredientForm({ onAddIngredient }: IngredientFormProps) {
    const [name, setName] = useState('')

    function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
        event.preventDefault()

        const trimmedName = name.trim()

        if (!trimmedName) {
        return
        }

        onAddIngredient(trimmedName)
        setName('')
    }

    return (
        <form
        onSubmit={handleSubmit}
        className="mt-10 rounded-xl bg-white p-6 shadow-sm"
        >
        <h2 className="text-xl font-semibold text-slate-900">
            Registrar ingrediente
        </h2>

        <div className="mt-4 flex flex-col gap-3 sm:flex-row">
            <input
            type="text"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Ej. Zanahoria"
            className="flex-1 rounded-lg border border-slate-300 px-4 py-2 outline-none focus:border-green-600"
            />

            <button
            type="submit"
            className="rounded-lg bg-green-700 px-5 py-2 font-medium text-white hover:bg-green-800"
            >
            Agregar
            </button>
        </div>
        </form>
    )
}

export default IngredientForm