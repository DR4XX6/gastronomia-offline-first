interface ModuleCardProps {
    title: string
    description: string
    }

    function ModuleCard({ title, description }: ModuleCardProps) {
    return (
        <article className="rounded-xl bg-white p-6 shadow-sm">
        <h2 className="text-xl font-semibold text-slate-900">
            {title}
        </h2>

        <p className="mt-2 text-sm leading-6 text-slate-600">
            {description}
        </p>
        </article>
    )
}

export default ModuleCard