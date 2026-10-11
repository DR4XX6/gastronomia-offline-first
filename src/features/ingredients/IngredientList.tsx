import type { Ingredient } from '../../domain/ingredient'

interface IngredientListProps {
    ingredients: Ingredient[]
    }

    function IngredientList({ ingredients }: IngredientListProps) {
    return (
        <section className="mt-10">
        <h2 className="text-xl font-semibold text-slate-900">
            Ingredientes registrados
        </h2>

        <ul className="mt-4 space-y-2">
            {ingredients.map((ingredient) => (
            <li
                key={ingredient.id}
                className="rounded-lg bg-white px-4 py-3 shadow-sm"
            >
                {ingredient.name}
            </li>
            ))}
        </ul>
        </section>
    )
}

export default IngredientList