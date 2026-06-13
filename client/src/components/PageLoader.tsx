// شاشة انتظار قصيرة تظهر أثناء تحميل صفحات الموقع الكامل عند الطلب
function PageLoader() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50/80">
      <span className="w-8 h-8 rounded-full border-4 border-sky-500 border-t-transparent animate-spin" />
    </div>
  )
}

export default PageLoader
