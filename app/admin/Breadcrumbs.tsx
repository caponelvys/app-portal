export default function Breadcrumbs({ items }: { items: { label: string; href?: string }[] }) {
  return (
    <nav className="flex items-center gap-2 text-sm text-gray-400 mb-6">
      {items.map((item, i) => (
        <span key={i} className="flex items-center gap-2">
          {i > 0 && <span className="text-gray-600">/</span>}
          {item.href
            ? <a href={item.href} className="hover:text-gray-200 transition-colors">{item.label}</a>
            : <span className="text-white font-semibold">{item.label}</span>
          }
        </span>
      ))}
    </nav>
  )
}
