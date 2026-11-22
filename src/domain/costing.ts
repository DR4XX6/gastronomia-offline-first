/**
 * Motor de costeo preliminar. No sustituye la validación de fórmulas
 * y unidades por docentes de la Licenciatura en Gastronomía.
 * Funciona sin red, DOM, servidor ni acceso a la base de datos.
 */
export type MeasurementUnit = 'g' | 'kg' | 'ml' | 'l' | 'pieza'

export interface IngredientCostInput {
  ingredientId: string
  name: string
  /** Cantidad aprovechable de la receta para las porciones base. */
  netQuantity: number
  recipeUnit: MeasurementUnit
  /** Porcentaje de merma: 0 <= valor < 100. */
  wastePercent: number
  /** Precio pagado por purchaseQuantity de purchaseUnit. */
  purchasePrice: number
  purchaseQuantity: number
  purchaseUnit: MeasurementUnit
}

export interface IngredientCostResult extends IngredientCostInput {
  scaledNetQuantity: number
  /** Cantidad de compra necesaria expresada en recipeUnit. */
  grossQuantity: number
  ingredientCost: number
}

export interface RecipeCostResult {
  baseServings: number
  desiredServings: number
  scaleFactor: number
  ingredients: IngredientCostResult[]
  totalCost: number
  costPerServing: number
}

type UnitDimension = 'mass' | 'volume' | 'count'
const UNITS: Record<MeasurementUnit, { dimension: UnitDimension; factor: number }> = {
  g: { dimension: 'mass', factor: 1 },
  kg: { dimension: 'mass', factor: 1000 },
  ml: { dimension: 'volume', factor: 1 },
  l: { dimension: 'volume', factor: 1000 },
  pieza: { dimension: 'count', factor: 1 },
}

function positiveFinite(value: number, label: string): void {
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error(`${label} debe ser un número mayor que cero`)
  }
}

function nonNegativeFinite(value: number, label: string): void {
  if (!Number.isFinite(value) || value < 0) {
    throw new Error(`${label} no puede ser negativo ni inválido`)
  }
}

/**
 * Regla preliminar:
 * compra bruta = cantidad neta / (1 - merma/100);
 * costo = compra bruta x precio por unidad compatible de compra.
 * No redondea las líneas para evitar acumulación de errores.
 */
export function calculateRecipeCost(
  ingredients: readonly IngredientCostInput[],
  baseServings: number,
  desiredServings: number = baseServings
): RecipeCostResult {
  positiveFinite(baseServings, 'Porciones base')
  positiveFinite(desiredServings, 'Porciones deseadas')
  if (!Number.isInteger(baseServings) || !Number.isInteger(desiredServings)) {
    throw new Error('Las porciones deben ser números enteros')
  }

  const scaleFactor = desiredServings / baseServings
  const lines = ingredients.map((item): IngredientCostResult => {
    positiveFinite(item.netQuantity, `Cantidad de ${item.name}`)
    positiveFinite(item.purchaseQuantity, `Cantidad de compra de ${item.name}`)
    nonNegativeFinite(item.purchasePrice, `Precio de ${item.name}`)
    nonNegativeFinite(item.wastePercent, `Merma de ${item.name}`)
    if (item.wastePercent >= 100) {
      throw new Error(`La merma de ${item.name} debe ser menor que 100%`)
    }
    const recipe = UNITS[item.recipeUnit]
    const purchase = UNITS[item.purchaseUnit]
    if (!recipe || !purchase || recipe.dimension !== purchase.dimension) {
      throw new Error(`Las unidades de ${item.name} no son compatibles`)
    }

    const scaledNetQuantity = item.netQuantity * scaleFactor
    const grossQuantity = scaledNetQuantity / (1 - item.wastePercent / 100)
    const grossBaseUnits = grossQuantity * recipe.factor
    const purchasedBaseUnits = item.purchaseQuantity * purchase.factor
    const ingredientCost = grossBaseUnits * (item.purchasePrice / purchasedBaseUnits)

    if (![scaledNetQuantity, grossQuantity, ingredientCost].every(Number.isFinite)) {
      throw new Error(`El cálculo de ${item.name} excede el rango permitido`)
    }

    return { ...item, scaledNetQuantity, grossQuantity, ingredientCost }
  })

  const totalCost = lines.reduce((sum, item) => sum + item.ingredientCost, 0)
  if (!Number.isFinite(totalCost)) throw new Error('El costo total excede el rango permitido')

  return {
    baseServings,
    desiredServings,
    scaleFactor,
    ingredients: lines,
    totalCost,
    costPerServing: totalCost / desiredServings,
  }
}

/** Formato monetario únicamente para visualización; no altera el cálculo. */
export function formatMXN(amount: number): string {
  if (!Number.isFinite(amount)) throw new Error('Importe no válido')
  return new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: 'MXN',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount)
}
