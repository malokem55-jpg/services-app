interface TabBarProps<T extends string> {
  tabs: readonly { id: T; label: string }[]
  active: T
  onChange: (id: T) => void
  ariaLabel: string
}

/**
 * شريط تبويبات موحّد: على الموبايل يمتد بعرض الصفحة بأهداف لمس كبيرة،
 * وعلى الدسكتوب يتقلص ليلتف حول المحتوى بمقاس مدمج.
 */
export default function TabBar<T extends string>({ tabs, active, onChange, ariaLabel }: TabBarProps<T>) {
  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className="flex gap-1 bg-white rounded-2xl border border-gray-100 shadow-sm p-1.5
                 md:w-fit md:rounded-xl md:p-1"
    >
      {tabs.map(({ id, label }) => (
        <button
          key={id}
          role="tab"
          aria-selected={active === id}
          onClick={() => onChange(id)}
          className={`flex-1 rounded-xl px-2 py-2.5 text-sm font-semibold transition-colors min-h-11
                      md:flex-none md:min-h-0 md:rounded-lg md:px-4 md:py-1.5 md:text-[13px] ${
            active === id
              ? 'bg-sky-500 text-white shadow-sm shadow-sky-500/20'
              : 'text-gray-500 hover:text-sky-700 hover:bg-sky-50'
          }`}
        >
          {label}
        </button>
      ))}
    </div>
  )
}
