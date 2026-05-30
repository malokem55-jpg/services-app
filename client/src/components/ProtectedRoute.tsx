import { Navigate, Outlet } from 'react-router-dom'
import { usePushNotifications } from '../hooks/usePushNotifications'

export default function ProtectedRoute() {
  const token = localStorage.getItem('token')
  usePushNotifications()
  if (!token) {
    return <Navigate to="/login" replace />
  }
  return <Outlet />
}
