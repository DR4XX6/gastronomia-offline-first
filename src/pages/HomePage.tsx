import ModuleCard from '../components/ModuleCard'
import IngredientManager from '../features/ingredients/IngredientManager'
import { RecipeManager } from '../features/recipes/RecipeManager'

function HomePage() {
    return (
        <main className="min-h-screen bg-slate-100 px-6 py-10">
            <div className="mx-auto max-w-5xl">

                {/* Encabezado principal */}
                <header>
                    <p className="text-sm font-medium text-green-700">
                        Aplicación Offline-First
                    </p>

                    <h1 className="mt-2 text-3xl font-bold text-slate-900">
                        Gestor Gastronómico
                    </h1>

                    <p className="mt-4 max-w-2xl text-slate-600">
                        Sistema para la gestión de fichas técnicas, recetas,
                        ingredientes y costos.
                    </p>
                </header>

                {/* Tarjetas informativas */}
                <section className="mt-10 grid gap-6 md:grid-cols-3">
                    <ModuleCard
                        title="Ingredientes"
                        description="Registro y consulta del catálogo de ingredientes y precios."
                    />

                    <ModuleCard
                        title="Recetas"
                        description="Creación y administración de recetas y sus ingredientes."
                    />

                    <ModuleCard
                        title="Fichas técnicas"
                        description="Consulta y preparación de fichas técnicas gastronómicas."
                    />
                </section>

                {/* Módulo de ingredientes */}
                <IngredientManager />

                {/* Módulo de recetas */}
                <div className="mt-8">
                    <RecipeManager />
                </div>

            </div>
        </main>
    )
}

export default HomePage
