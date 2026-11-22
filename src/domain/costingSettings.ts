import { calculateRecipeCost, type IngredientCostInput, type MeasurementUnit, type RecipeCostResult } from './costing'
import type { Ingredient } from './ingredient'
import type { Recipe } from './recipe'
import type { RecipeIngredient } from './recipeIngredient'

/** Tarifas comerciales del ingrediente. Un registro ausente significa "sin precio". */
export interface IngredientPrice {
  ingredientId: string
  purchaseQuantity: number
  purchaseUnit: MeasurementUnit
  purchasePrice: number
  wastePercent: number
}

/** Porciones base de la receta; no se asumen valores para recetas antiguas. */
export interface RecipeServings {
  recipeId: string
  servings: number
}

/** Cantidad neta usada por receta. Merma nula = usar la merma del ingrediente. */
export interface RecipeLineQuantity {
  associationId: string
  netQuantity: number
  recipeUnit: MeasurementUnit
  wastePercent: number | null
}

export interface CostingSnapshot {
  ingredientPrices: IngredientPrice[]
  recipeServings: RecipeServings[]
  recipeLines: RecipeLineQuantity[]
}

export type CostingCommand =
  | { type: 'costing:list' }
  | { type: 'costing:ingredient'; data: IngredientPrice }
  | { type: 'costing:recipe'; data: RecipeServings }
  | { type: 'costing:line'; data: RecipeLineQuantity }

export type RecipeCostPreview =
  | { ready: false; missing: string[] }
  | { ready: true; result: RecipeCostResult }

export function buildRecipeCostPreview(
  recipe: Recipe,
  links: readonly RecipeIngredient[],
  ingredients: readonly Ingredient[],
  settings: CostingSnapshot,
  desiredServings?: number
): RecipeCostPreview {
  const missing: string[] = []
  const base = settings.recipeServings.find(x => x.recipeId === recipe.id)?.servings
  if (base === undefined) missing.push('Configura las porciones base de la receta.')
  if (!links.length) missing.push('Agrega al menos un ingrediente a la receta.')

  const inputs: IngredientCostInput[] = []
  for (const link of links) {
    const ingredient = ingredients.find(x => x.id === link.ingredientId)
    const name = ingredient?.name ?? 'Ingrediente no encontrado'
    const price = settings.ingredientPrices.find(x => x.ingredientId === link.ingredientId)
    const line = settings.recipeLines.find(x => x.associationId === link.id)

    if (!ingredient) {
      missing.push('Una asociación hace referencia a un ingrediente inexistente.')
      continue
    }
    if (!price) missing.push(`Falta precio de compra para «${name}».`)
    if (!line) missing.push(`Falta cantidad neta de «${name}» en esta receta.`)
    if (price && line) {
      inputs.push({
        ingredientId: ingredient.id,
        name,
        netQuantity: line.netQuantity,
        recipeUnit: line.recipeUnit,
        wastePercent: line.wastePercent ?? price.wastePercent,
        purchasePrice: price.purchasePrice,
        purchaseQuantity: price.purchaseQuantity,
        purchaseUnit: price.purchaseUnit,
      })
    }
  }
  if (missing.length || base === undefined) return { ready: false, missing }
  try {
    return { ready: true, result: calculateRecipeCost(inputs, base, desiredServings ?? base) }
  } catch (error) {
    return { ready: false, missing: [error instanceof Error ? error.message : String(error)] }
  }
}
