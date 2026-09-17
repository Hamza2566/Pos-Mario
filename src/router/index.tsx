import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import { ProtectedRoute } from './ProtectedRoute'
import { RoleRoute } from './RoleRoute'
import { AppShell } from '@/components/layout/AppShell'
import { LoginPage } from '@/pages/auth/LoginPage'
import { POSPage } from '@/pages/pos/POSPage'
import { DashboardPage } from '@/pages/dashboard/DashboardPage'
import { SalesPage } from '@/pages/sales/SalesPage'
import { ProductsPage } from '@/pages/products/ProductsPage'
import { ProductFormPage } from '@/pages/products/ProductFormPage'
import { CategoriesPage } from '@/pages/categories/CategoriesPage'
import { EmployeesPage } from '@/pages/employees/EmployeesPage'
import { InventoryPage } from '@/pages/inventory/InventoryPage'
import { ExpensesPage } from '@/pages/expenses/ExpensesPage'
import { ReportsPage } from '@/pages/reports/ReportsPage'
import { ActivityPage } from '@/pages/activity/ActivityPage'
import { SettingsPage } from '@/pages/settings/SettingsPage'

function AuthBootstrap() {
  useAuth()
  return null
}

export function AppRouter() {
  return (
    <BrowserRouter>
      <AuthBootstrap />
      <Routes>
        {/* Public */}
        <Route path="/login" element={<LoginPage />} />

        {/* All authenticated users */}
        <Route element={<ProtectedRoute />}>
          <Route element={<AppShell />}>
            {/* Root → redirect to POS */}
            <Route index element={<Navigate to="/pos" replace />} />

            {/* Both roles */}
            <Route path="pos" element={<POSPage />} />
            <Route path="sales" element={<SalesPage />} />

            {/* Owner-only routes */}
            <Route element={<RoleRoute allowedRoles={['OWNER']} />}>
              <Route path="dashboard" element={<DashboardPage />} />
              <Route path="products" element={<ProductsPage />} />
              <Route path="products/new" element={<ProductFormPage />} />
              <Route path="products/:id/edit" element={<ProductFormPage />} />
              <Route path="categories" element={<CategoriesPage />} />
              <Route path="employees" element={<EmployeesPage />} />
              <Route path="inventory" element={<InventoryPage />} />
              <Route path="expenses" element={<ExpensesPage />} />
              <Route path="reports" element={<ReportsPage />} />
              <Route path="activity" element={<ActivityPage />} />
              <Route path="settings" element={<SettingsPage />} />
            </Route>

            {/* 404 fallback */}
            <Route path="*" element={<Navigate to="/pos" replace />} />
          </Route>
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
