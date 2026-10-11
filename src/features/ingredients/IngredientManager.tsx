import { useState } from 'react'
import type { Ingredient } from '../../domain/ingredient'
import { mockIngredients } from '../../data/mockIngredients'
import IngredientForm from './IngredientForm'
import IngredientList from './IngredientList'

function IngredientManager() {
    const [ingredients, setIngredients] =
        useState<Ingredient[]>(mockIngredients)

    function handleAddIngredient(name: string) {
        const newIngredient: Ingredient = {
        id: crypto.randomUUID(),
        name,
        }

        setIngredients((currentIngredients) => [
        ...currentIngredients,
        newIngredient,
        ])
    }

    return (
        <>
        <IngredientForm onAddIngredient={handleAddIngredient} />

        <IngredientList ingredients={ingredients} />
        </>
    )
}

export default IngredientManager