import { Navigate, Outlet } from 'react-router-dom'
import { useAuthStore } from '@/store/authStore'

interface RoleRouteProps {
  allowedRoles: ('OWNER' | 'EMPLOYEE')[]
  redirectTo?: string
}

/**
 * Redirects users without the required role to /pos.
 * Must be used inside a ProtectedRoute (profile is guaranteed to exist).
 */
export function RoleRoute({ allowedRoles, redirectTo = '/pos' }: RoleRouteProps) {
  const { profile } = useAuthStore()

  if (!profile || !allowedRoles.includes(profile.role as 'OWNER' | 'EMPLOYEE')) {
    return <Navigate to={redirectTo} replace />
  }

  return <Outlet />
}
