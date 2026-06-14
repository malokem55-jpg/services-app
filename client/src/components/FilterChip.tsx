// زر فلتر صغير يعرض الاسم والعدد، ويتلوّن عند تفعيله بلون حالته.
// مشترك بين شاشات التنبيهات في النسخة المخصصة للموبايل.
export default function FilterChip({
  label, count, active, activeCls, onClick,
}: {
  label: string
  count: number
  active: boolean
  activeCls: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex-1 flex items-center justify-center gap-1.5 rounded-xl px-2 py-2 text-xs font-semibold
                  transition-colors min-h-10 ${
        active ? activeCls : 'bg-white text-gray-600 border border-gray-200 active:bg-gray-50'
      }`}
    >
      <span>{label}</span>
      <span className={`inline-flex items-center justify-center min-w-5 h-5 px-1 rounded-full text-[11px] ${
        active ? 'bg-white/25' : 'bg-gray-100 text-gray-600'
      }`}>
        {count}
      </span>
    </button>
  )
}
