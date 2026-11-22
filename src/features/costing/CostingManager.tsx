import { useEffect, useState, type FormEvent } from 'react'
import { listIngredients, listRecipes, listRecipeIngredients, listCostingSettings, sendCostingRequest } from '../../db/database'
import type { Ingredient } from '../../domain/ingredient'
import type { Recipe } from '../../domain/recipe'
import type { RecipeIngredient } from '../../domain/recipeIngredient'
import {
  buildRecipeCostPreview,
  type CostingSnapshot,
  type IngredientPrice,
  type RecipeLineQuantity,
} from '../../domain/costingSettings'
import { formatMXN, type MeasurementUnit } from '../../domain/costing'

const units: MeasurementUnit[] = ['g', 'kg', 'ml', 'l', 'pieza']
const empty: CostingSnapshot = { ingredientPrices: [], recipeServings: [], recipeLines: [] }
const inputStyle = 'min-w-0 w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900'
const labelStyle = 'block text-xs font-semibold text-slate-700'

function errorText(error: unknown) {
  return error instanceof Error ? error.message : String(error)
}

function UnitSelect({ value, onChange, id }: {
  value: MeasurementUnit
  onChange: (unit: MeasurementUnit) => void
  id: string
}) {
  return (
    <select id={id} value={value} onChange={event => onChange(event.target.value as MeasurementUnit)} className={inputStyle}>
      {units.map(unit => <option key={unit} value={unit}>{unit}</option>)}
    </select>
  )
}

function PriceForm({ ingredient, initial, onSave, busy }: {
  ingredient: Ingredient
  initial?: IngredientPrice
  onSave: (value: IngredientPrice) => Promise<boolean>
  busy: boolean
}) {
  const [quantity, setQuantity] = useState(String(initial?.purchaseQuantity ?? ''))
  const [unit, setUnit] = useState<MeasurementUnit>(initial?.purchaseUnit ?? 'kg')
  const [price, setPrice] = useState(String(initial?.purchasePrice ?? ''))
  const [waste, setWaste] = useState(String(initial?.wastePercent ?? '0'))
  const [editing, setEditing] = useState(false)
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (await onSave({
      ingredientId: ingredient.id,
      purchaseQuantity: Number(quantity),
      purchaseUnit: unit,
      purchasePrice: Number(price),
      wastePercent: Number(waste),
    })) setEditing(false)
  }
  return (
    <li className="rounded-lg border border-slate-200 p-3">
      <div className="flex items-center justify-between gap-3">
        <span className="font-medium text-slate-900">{ingredient.name}</span>
        <button type="button" onClick={() => setEditing(!editing)} disabled={busy}
          className="rounded-lg bg-blue-50 px-3 py-2 text-sm text-blue-700">
          {editing ? 'Cerrar' : initial ? 'Modificar precio' : 'Configurar precio'}
        </button>
      </div>
      {initial && !editing && <p className="mt-1 text-sm text-slate-600">
        {formatMXN(initial.purchasePrice)} / {initial.purchaseQuantity} {initial.purchaseUnit} · Merma: {initial.wastePercent}%
      </p>}
      {!initial && !editing && <p className="mt-1 text-sm text-amber-700">Pendiente de precio de compra</p>}
      {editing && (
        <form onSubmit={event => void save(event)} className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-5">
          <label className={labelStyle}>Cantidad de compra
            <input className={inputStyle} type="number" step="any" min="0.000001" required
              value={quantity} onChange={e => setQuantity(e.target.value)}/>
          </label>
          <label className={labelStyle}>Unidad de compra
            <UnitSelect id={'price-unit-'+ingredient.id} value={unit} onChange={setUnit}/>
          </label>
          <label className={labelStyle}>Precio de compra (MXN)
            <input className={inputStyle} type="number" step="any" min="0" required
              value={price} onChange={e => setPrice(e.target.value)}/>
          </label>
          <label className={labelStyle}>Merma predeterminada (%)
            <input className={inputStyle} type="number" step="any" min="0" max="99.999" required
              value={waste} onChange={e => setWaste(e.target.value)}/>
          </label>
          <button className="self-end rounded-lg bg-green-700 px-4 py-2 text-white disabled:opacity-50"
            disabled={busy || !quantity || !price || !waste}>Guardar</button>
        </form>
      )}
    </li>
  )
}

function LineForm({ link, name, initial, onSave, busy }: {
  link: RecipeIngredient
  name: string
  initial?: RecipeLineQuantity
  onSave: (value: RecipeLineQuantity) => Promise<boolean>
  busy: boolean
}) {
  const [quantity, setQuantity] = useState(String(initial?.netQuantity ?? ''))
  const [unit, setUnit] = useState<MeasurementUnit>(initial?.recipeUnit ?? 'g')
  const [waste, setWaste] = useState(initial?.wastePercent === null || initial?.wastePercent === undefined ? '' : String(initial.wastePercent))
  const [editing, setEditing] = useState(false)
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (await onSave({
      associationId: link.id,
      netQuantity: Number(quantity),
      recipeUnit: unit,
      wastePercent: waste.trim() === '' ? null : Number(waste),
    })) setEditing(false)
  }
  return (
    <li className="rounded-lg border border-slate-200 p-3">
      <div className="flex items-center justify-between gap-3">
        <span className="font-medium text-slate-900">{name}</span>
        <button type="button" disabled={busy} onClick={() => setEditing(!editing)}
          className="rounded-lg bg-blue-50 px-3 py-2 text-sm text-blue-700">
          {editing ? 'Cerrar' : initial ? 'Modificar cantidad' : 'Definir cantidad'}
        </button>
      </div>
      {initial && !editing && <p className="mt-1 text-sm text-slate-600">
        Neto: {initial.netQuantity} {initial.recipeUnit} · Merma: {initial.wastePercent === null ? 'valor del catálogo' : initial.wastePercent+'%'}
      </p>}
      {!initial && !editing && <p className="mt-1 text-sm text-amber-700">Cantidad pendiente</p>}
      {editing && (
        <form onSubmit={event => void save(event)} className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <label className={labelStyle}>Cantidad neta (receta base)
            <input className={inputStyle} type="number" step="any" min="0.000001" required
              value={quantity} onChange={e => setQuantity(e.target.value)}/>
          </label>
          <label className={labelStyle}>Unidad
            <UnitSelect id={'line-unit-'+link.id} value={unit} onChange={setUnit}/>
          </label>
          <label className={labelStyle}>Merma de esta receta (%) opcional
            <input className={inputStyle} type="number" step="any" min="0" max="99.999"
              value={waste} placeholder="Usar catálogo" onChange={e => setWaste(e.target.value)}/>
          </label>
          <button className="self-end rounded-lg bg-green-700 px-4 py-2 text-white disabled:opacity-50"
            disabled={busy || !quantity}>Guardar</button>
        </form>
      )}
    </li>
  )
}

export default function CostingManager() {
  const [ingredients, setIngredients] = useState<Ingredient[]>([])
  const [recipes, setRecipes] = useState<Recipe[]>([])
  const [links, setLinks] = useState<RecipeIngredient[]>([])
  const [settings, setSettings] = useState<CostingSnapshot>(empty)
  const [selectedRecipe, setSelectedRecipe] = useState('')
  const [servings, setServings] = useState('')
  const [desired, setDesired] = useState('')
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    void Promise.all([listIngredients(), listRecipes(), listCostingSettings()])
      .then(([catalog, allRecipes, snapshot]) => {
        if (!active) return
        setIngredients(catalog)
        setRecipes(allRecipes)
        setSettings(snapshot)
        setSelectedRecipe(allRecipes[0]?.id ?? '')
      })
      .catch(cause => { if (active) setError(errorText(cause)) })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [])

  useEffect(() => {
    let active = true
    if (!selectedRecipe) {
      setLinks([])
      return
    }
    void listRecipeIngredients(selectedRecipe)
      .then(items => { if (active) setLinks(items) })
      .catch(cause => { if (active) setError(errorText(cause)) })
    return () => { active = false }
  }, [selectedRecipe])

  const current = recipes.find(recipe => recipe.id === selectedRecipe)
  const savedServings = settings.recipeServings.find(x => x.recipeId === selectedRecipe)?.servings
  const desiredCount = desired.trim() === '' ? undefined : Number(desired)
  const preview = current
    ? buildRecipeCostPreview(current, links, ingredients, settings, desiredCount)
    : null

  async function save(command: Parameters<typeof sendCostingRequest>[0]): Promise<boolean> {
    if (busy) return false
    setBusy(true)
    setError(null)
    try {
      const updated = await sendCostingRequest(command)
      setSettings(updated)
      return true
    } catch (cause) {
      setError(errorText(cause))
      return false
    } finally {
      setBusy(false)
    }
  }

  async function saveServings(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!selectedRecipe || !servings) return
    if (await save({ type: 'costing:recipe', data: {
      recipeId: selectedRecipe, servings: Number(servings),
    } })) setServings('')
  }

  async function reload() {
    if (busy) return
    setBusy(true)
    setError(null)
    try {
      const [catalog, allRecipes, snapshot, associations] = await Promise.all([
        listIngredients(), listRecipes(), listCostingSettings(),
        selectedRecipe ? listRecipeIngredients(selectedRecipe) : Promise.resolve([]),
      ])
      setIngredients(catalog)
      setRecipes(allRecipes)
      setSettings(snapshot)
      setLinks(associations)
      if (!allRecipes.some(r => r.id === selectedRecipe)) setSelectedRecipe(allRecipes[0]?.id ?? '')
    } catch (cause) { setError(errorText(cause)) }
    finally { setBusy(false) }
  }

  return (
    <section aria-labelledby="costing-title" className="mt-8 rounded-2xl bg-white p-5 shadow-sm sm:p-6">
      <h2 id="costing-title" className="text-2xl font-bold text-slate-900">Costeo gastronómico</h2>
      <p className="mt-2 text-sm text-slate-600">
        Fórmulas preliminares sujetas a validación académica. Los datos se guardan en SQLite/OPFS
        y pueden consultarse sin Internet.
      </p>
      <button onClick={() => void reload()} disabled={busy} type="button"
        className="mt-3 rounded-lg bg-slate-100 px-4 py-2 text-sm text-slate-700">Actualizar catálogos</button>
      {error && <p role="alert" className="mt-3 rounded-lg bg-red-50 p-3 text-red-700">{error}</p>}
      {loading ? <p className="mt-4">Cargando datos de costeo…</p> : (
        <>
          <h3 className="mt-7 text-lg font-semibold text-slate-900">1. Precios y mermas por ingrediente</h3>
          <p className="mb-3 text-sm text-slate-600">Precio de la presentación comercial y su cantidad de compra.</p>
          {ingredients.length ? <ul className="space-y-2">
            {ingredients.map(ingredient => <PriceForm key={ingredient.id} ingredient={ingredient}
              initial={settings.ingredientPrices.find(x => x.ingredientId === ingredient.id)}
              busy={busy} onSave={data => save({ type: 'costing:ingredient', data })}/>)}
          </ul> : <p className="text-slate-600">Agrega ingredientes en el catálogo superior.</p>}

          <h3 className="mt-8 text-lg font-semibold text-slate-900">2. Cantidades y porciones de receta</h3>
          <label className={labelStyle} htmlFor="cost-recipe">Receta</label>
          <select id="cost-recipe" className={inputStyle} value={selectedRecipe}
            onChange={event => { setSelectedRecipe(event.target.value); setLinks([]); setDesired('') }}>
            {recipes.length === 0 && <option value="">Sin recetas</option>}
            {recipes.map(recipe => <option key={recipe.id} value={recipe.id}>{recipe.name}</option>)}
          </select>
          {current && (
            <>
              <form onSubmit={event => void saveServings(event)} className="mt-3 flex flex-wrap items-end gap-3">
                <label className={labelStyle}>Porciones base {savedServings === undefined ? '(pendiente)' : '(guardadas: '+savedServings+')'}
                  <input className={inputStyle} type="number" min="1" step="1" required value={servings}
                    onChange={event => setServings(event.target.value)} placeholder="Ej. 4"/>
                </label>
                <button type="submit" disabled={busy || !servings} className="rounded-lg bg-green-700 px-4 py-2 text-white">
                  Guardar porciones
                </button>
              </form>
              <ul className="mt-4 space-y-2">
                {links.map(link => <LineForm key={link.id} link={link}
                  name={ingredients.find(x => x.id === link.ingredientId)?.name ?? 'Ingrediente'}
                  initial={settings.recipeLines.find(x => x.associationId === link.id)}
                  busy={busy} onSave={data => save({ type: 'costing:line', data })}/>)}
              </ul>
            </>
          )}

          <h3 className="mt-8 text-lg font-semibold text-slate-900">3. Resultado del costeo</h3>
          <label className={labelStyle}>Porciones deseadas (opcional)
            <input type="number" className={inputStyle} min="1" step="1" value={desired}
              onChange={event => setDesired(event.target.value)} placeholder="Usar porciones base"/>
          </label>
          {!preview ? <p className="mt-3 text-slate-600">Selecciona una receta para calcular.</p>
            : !preview.ready ? <div className="mt-3 rounded-lg bg-amber-50 p-3 text-amber-900">
              <p className="font-semibold">Costeo pendiente de completar</p>
              <ul className="mt-2 list-disc pl-5">
                {preview.missing.map((missing, index) => <li key={index}>{missing}</li>)}
              </ul>
            </div> : <div className="mt-4 rounded-lg bg-green-50 p-4">
              <p className="font-semibold text-green-950">
                Costo total: {formatMXN(preview.result.totalCost)}
              </p>
              <p className="font-semibold text-green-950">
                Costo por porción: {formatMXN(preview.result.costPerServing)}
              </p>
              <p className="mt-2 text-sm text-slate-700">
                {preview.result.desiredServings} porciones · Factor: {preview.result.scaleFactor.toFixed(3)}
              </p>
              <ul className="mt-3 space-y-1 text-sm text-slate-800">
                {preview.result.ingredients.map(line => <li key={line.ingredientId}>
                  {line.name}: {line.grossQuantity.toFixed(3)} {line.recipeUnit} de compra · {formatMXN(line.ingredientCost)}
                </li>)}
              </ul>
              <p className="mt-3 text-xs text-slate-600">
                Costo estimado sin gastos indirectos ni redondeo comercial de paquetes.
              </p>
            </div>}
        </>
      )}
    </section>
  )
}
