import { describe, expect, it } from 'vitest'
import {
  calculateRecipeCost,
  formatMXN,
  type IngredientCostInput,
} from './costing'

const tomato: IngredientCostInput = {
  ingredientId: 'tomate',
  name: 'Jitomate',
  netQuantity: 500,
  recipeUnit: 'g',
  wastePercent: 20,
  purchasePrice: 40,
  purchaseQuantity: 1,
  purchaseUnit: 'kg',
}

describe('motor preliminar de costeos gastronómicos', () => {
  it('convierte gramos a kilogramos y considera merma', () => {
    const result = calculateRecipeCost([tomato], 4)
    expect(result.ingredients[0].scaledNetQuantity).toBe(500)
    expect(result.ingredients[0].grossQuantity).toBe(625)
    expect(result.totalCost).toBeCloseTo(25, 8)
    expect(result.costPerServing).toBeCloseTo(6.25, 8)
  })

  it('escala la receta sin redondear los insumos', () => {
    const result = calculateRecipeCost([tomato], 4, 10)
    expect(result.scaleFactor).toBe(2.5)
    expect(result.ingredients[0].scaledNetQuantity).toBe(1250)
    expect(result.ingredients[0].grossQuantity).toBe(1562.5)
    expect(result.totalCost).toBeCloseTo(62.5, 8)
    expect(result.costPerServing).toBeCloseTo(6.25, 8)
  })

  it('suma varias líneas y permite costo cero', () => {
    const result = calculateRecipeCost([tomato, {
      ingredientId: 'sal',
      name: 'Sal',
      netQuantity: 2,
      recipeUnit: 'g',
      wastePercent: 0,
      purchasePrice: 0,
      purchaseQuantity: 1,
      purchaseUnit: 'kg',
    }], 4)
    expect(result.ingredients).toHaveLength(2)
    expect(result.totalCost).toBe(25)
  })

  it('convierte mililitros a litros y admite piezas', () => {
    const result = calculateRecipeCost([
      {
        ingredientId: 'agua',
        name: 'Agua',
        netQuantity: 250,
        recipeUnit: 'ml',
        wastePercent: 0,
        purchasePrice: 12,
        purchaseQuantity: 1,
        purchaseUnit: 'l',
      },
      {
        ingredientId: 'huevo',
        name: 'Huevo',
        netQuantity: 2,
        recipeUnit: 'pieza',
        wastePercent: 0,
        purchasePrice: 45,
        purchaseQuantity: 12,
        purchaseUnit: 'pieza',
      },
    ], 2)
    expect(result.totalCost).toBeCloseTo(10.5, 8)
  })

  it('rechaza unidades incompatibles', () => {
    expect(() => calculateRecipeCost([{ ...tomato, purchaseUnit: 'l' }], 4))
      .toThrow(/no son compatibles/)
  })

  it('rechaza cantidades, porciones y precios incorrectos', () => {
    expect(() => calculateRecipeCost([tomato], 0)).toThrow()
    expect(() => calculateRecipeCost([tomato], 2.5)).toThrow(/enteros/)
    expect(() => calculateRecipeCost([{ ...tomato, netQuantity: 0 }], 4)).toThrow()
    expect(() => calculateRecipeCost([{ ...tomato, purchasePrice: -1 }], 4)).toThrow()
    expect(() => calculateRecipeCost([{ ...tomato, purchaseQuantity: 0 }], 4)).toThrow()
    expect(() => calculateRecipeCost([{ ...tomato, wastePercent: 100 }], 4)).toThrow()
    expect(() => calculateRecipeCost([{ ...tomato, wastePercent: NaN }], 4)).toThrow()
  })

  it('devuelve cero para una receta sin ingredientes', () => {
    const result = calculateRecipeCost([], 4)
    expect(result.totalCost).toBe(0)
    expect(result.costPerServing).toBe(0)
  })

  it('formatea moneda al presentar sin redondear internamente', () => {
    expect(formatMXN(62.5)).toContain('62.50')
    expect(() => formatMXN(Infinity)).toThrow()
  })
})
