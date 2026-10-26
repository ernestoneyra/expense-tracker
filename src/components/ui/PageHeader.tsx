export function PageHeader({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <header className="flex flex-col gap-1">
      <h1 className="text-2xl leading-tight font-semibold tracking-tight text-strong nav:text-[28px]">
        {title}
      </h1>
      <p className="text-muted">{subtitle}</p>
    </header>
  )
}
