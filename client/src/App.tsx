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
import ProtectedRoute from './components/ProtectedRoute'

function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />

      <Route element={<ProtectedRoute />}>
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
      </Route>
    </Routes>
  )
}

export default App
