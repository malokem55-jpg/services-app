import { lazy, Suspense } from 'react'
import { Routes, Route } from 'react-router-dom'
import LoginPage from './pages/LoginPage'
import MobileHomePage from './pages/MobileHomePage'
import MobileMuqeemPage from './pages/MobileMuqeemPage'
import MobilePaymentsPage from './pages/MobilePaymentsPage'
import MobileIqamaPage from './pages/MobileIqamaPage'
import MobileSettingsPage from './pages/MobileSettingsPage'
import ProtectedRoute from './components/ProtectedRoute'
import CustomModeGate from './components/CustomModeGate'
import MobileAccessGate from './components/MobileAccessGate'
import PageLoader from './components/PageLoader'
import OfflineBanner from './components/OfflineBanner'

// صفحات الموقع الكامل تُحمَّل عند الطلب حتى تبقى حزمة النسخة المخصصة صغيرة
const HomePage = lazy(() => import('./pages/HomePage'))
const ClientsPage = lazy(() => import('./pages/ClientsPage'))
const UnderProcedureClientsPage = lazy(() => import('./pages/UnderProcedureClientsPage'))
const ClientDetailPage = lazy(() => import('./pages/ClientDetailPage'))
const ServicesPage = lazy(() => import('./pages/ServicesPage'))
const OrganizationsPage = lazy(() => import('./pages/OrganizationsPage'))
const ProfilePage = lazy(() => import('./pages/ProfilePage'))
const SettingsPage = lazy(() => import('./pages/SettingsPage'))
const DeletedClientDuesPage = lazy(() => import('./pages/DeletedClientDuesPage'))
const IqamaAlertsClientsPage = lazy(() => import('./pages/IqamaAlertsClientsPage'))
const DataImportPage = lazy(() => import('./pages/DataImportPage'))
const CredentialsImportPage = lazy(() => import('./pages/CredentialsImportPage'))
const MobileAccessPage = lazy(() => import('./pages/MobileAccessPage'))

function App() {
  return (
    <Routes>
      {/* بوابة الوصول من الهاتف: عند إيقاف «تشغيل المشروع على الهاتف» يُحجب كل الموقع
          على الجوال — قبل شاشة الدخول — ويبقى يعمل على الكمبيوتر فقط */}
      <Route element={<MobileAccessGate />}>
        <Route path="/login" element={<LoginPage />} />

        <Route element={<ProtectedRoute />}>
          {/* صفحة مخفية للتحكم بفتح الموقع على الهاتف — خارج بوابة النسخة المخصصة لتبقى متاحة دائمًا */}
          <Route path="/mobile-access" element={<MobileAccessPage />} />

          {/* بوابة النسخة المخصصة: تحصر الـ PWA المثبت على الموبايل في شاشات /m عند تفعيلها */}
          <Route element={<CustomModeGate />}>
            <Route path="/" element={<HomePage />} />
            <Route path="/clients" element={<ClientsPage />} />
            <Route path="/under-procedure-clients" element={<UnderProcedureClientsPage />} />
            <Route path="/clients/:id" element={<ClientDetailPage />} />
            <Route path="/services" element={<ServicesPage />} />
            <Route path="/organizations" element={<OrganizationsPage />} />
            <Route path="/profile" element={<ProfilePage />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="/deleted-client-dues" element={<DeletedClientDuesPage />} />
            <Route path="/iqama-alerts-clients" element={<IqamaAlertsClientsPage />} />
            {/* صفحة مخفية: استيراد بيانات النظام القديم — وصول بالرابط فقط، بلا روابط في القوائم */}
            <Route path="/data-import" element={<DataImportPage />} />
            {/* صفحة مخفية: استيراد بيانات دخول المؤسسات من ملف إكسل — وصول بالرابط فقط */}
            <Route path="/credentials-import" element={<CredentialsImportPage />} />

            {/* النسخة المخصصة للموبايل */}
            <Route path="/m" element={<MobileHomePage />} />
            <Route path="/m/muqeem" element={<MobileMuqeemPage />} />
            <Route path="/m/payments" element={<MobilePaymentsPage />} />
            <Route path="/m/iqama" element={<MobileIqamaPage />} />
            <Route path="/m/settings" element={<MobileSettingsPage />} />
          </Route>
        </Route>
      </Route>
    </Routes>
  )
}

export default function AppWithSuspense() {
  return (
    <>
      <OfflineBanner />
      <Suspense fallback={<PageLoader />}>
        <App />
      </Suspense>
    </>
  )
}
