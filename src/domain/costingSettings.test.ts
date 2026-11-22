import { describe, expect, it } from 'vitest'
import { buildRecipeCostPreview, type CostingSnapshot } from './costingSettings'
import type { RecipeIngredient } from './recipeIngredient'

const recipe = { id: 'r1', name: 'Salsa de jitomate' }
const ingredients = [{ id: 'i1', name: 'Jitomate' }]
const links: RecipeIngredient[] = [{ id: 'a1', recipeId: 'r1', ingredientId: 'i1' }]
const complete: CostingSnapshot = {
  ingredientPrices: [{
    ingredientId: 'i1', purchaseQuantity: 1, purchaseUnit: 'kg',
    purchasePrice: 40, wastePercent: 20,
  }],
  recipeServings: [{ recipeId: 'r1', servings: 4 }],
  recipeLines: [{
    associationId: 'a1', netQuantity: 500, recipeUnit: 'g', wastePercent: null,
  }],
}

describe('integración del costeo con los datos de una receta', () => {
  it('no inventa precios, cantidades ni porciones para recetas anteriores', () => {
    const result = buildRecipeCostPreview(recipe, links, ingredients, {
      ingredientPrices: [], recipeServings: [], recipeLines: [],
    })
    expect(result.ready).toBe(false)
    if (!result.ready) expect(result.missing.length).toBe(3)
  })

  it('calcula el costo para configuración completa', () => {
    const result = buildRecipeCostPreview(recipe, links, ingredients, complete)
    expect(result.ready).toBe(true)
    if (result.ready) {
      expect(result.result.totalCost).toBeCloseTo(25)
      expect(result.result.costPerServing).toBeCloseTo(6.25)
    }
  })

  it('aplica merma específica de receta cuando está configurada', () => {
    const settings: CostingSnapshot = {
      ...complete,
      recipeLines: [{ ...complete.recipeLines[0], wastePercent: 0 }],
    }
    const result = buildRecipeCostPreview(recipe, links, ingredients, settings)
    expect(result.ready).toBe(true)
    if (result.ready) expect(result.result.totalCost).toBeCloseTo(20)
  })

  it('escala las porciones deseadas', () => {
    const result = buildRecipeCostPreview(recipe, links, ingredients, complete, 8)
    expect(result.ready).toBe(true)
    if (result.ready) expect(result.result.totalCost).toBeCloseTo(50)
  })

  it('rechaza precios con unidad incompatible sin presentar un total falso', () => {
    const settings: CostingSnapshot = {
      ...complete,
      ingredientPrices: [{ ...complete.ingredientPrices[0], purchaseUnit: 'l' }],
    }
    const result = buildRecipeCostPreview(recipe, links, ingredients, settings)
    expect(result.ready).toBe(false)
  })
})
