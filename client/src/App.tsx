import { Routes, Route } from 'react-router-dom'
import LoginPage from './pages/LoginPage'
import HomePage from './pages/HomePage'
import ClientsPage from './pages/ClientsPage'
import UnderProcedureClientsPage from './pages/UnderProcedureClientsPage'
import ClientDetailPage from './pages/ClientDetailPage'
import ServicesPage from './pages/ServicesPage'
import OrganizationsPage from './pages/OrganizationsPage'
import ProfilePage from './pages/ProfilePage'
import SettingsPage from './pages/SettingsPage'
import DeletedClientDuesPage from './pages/DeletedClientDuesPage'
import IqamaAlertsClientsPage from './pages/IqamaAlertsClientsPage'
import DataImportPage from './pages/DataImportPage'
import MobileHomePage from './pages/MobileHomePage'
import MobileMuqeemPage from './pages/MobileMuqeemPage'
import MobilePaymentsPage from './pages/MobilePaymentsPage'
import MobileIqamaPage from './pages/MobileIqamaPage'
import MobileSettingsPage from './pages/MobileSettingsPage'
import ProtectedRoute from './components/ProtectedRoute'
import CustomModeGate from './components/CustomModeGate'

function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />

      <Route element={<ProtectedRoute />}>
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

          {/* النسخة المخصصة للموبايل */}
          <Route path="/m" element={<MobileHomePage />} />
          <Route path="/m/muqeem" element={<MobileMuqeemPage />} />
          <Route path="/m/payments" element={<MobilePaymentsPage />} />
          <Route path="/m/iqama" element={<MobileIqamaPage />} />
          <Route path="/m/settings" element={<MobileSettingsPage />} />
        </Route>
      </Route>
    </Routes>
  )
}

export default App
