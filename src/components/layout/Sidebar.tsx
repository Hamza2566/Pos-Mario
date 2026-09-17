import { NavLink, useNavigate } from 'react-router-dom'
import { useAuthStore } from '@/store/authStore'
import { supabase } from '@/lib/supabase'
import { cn } from '@/lib/utils'
import {
  Coffee,
  LayoutDashboard,
  ShoppingCart,
  Receipt,
  Package,
  Tag,
  Users,
  Warehouse,
  CreditCard,
  BarChart2,
  Activity,
  Settings,
  LogOut,
} from 'lucide-react'

const NAV_ITEMS_ALL = [
  { to: '/pos',   icon: ShoppingCart, label: 'Point of Sale' },
  { to: '/sales', icon: Receipt,       label: 'Sales History' },
]

const NAV_ITEMS_OWNER = [
  { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/products',  icon: Package,         label: 'Products' },
  { to: '/categories',icon: Tag,             label: 'Categories' },
  { to: '/employees', icon: Users,           label: 'Employees' },
  { to: '/inventory', icon: Warehouse,       label: 'Inventory' },
  { to: '/expenses',  icon: CreditCard,      label: 'Expenses' },
  { to: '/reports',   icon: BarChart2,       label: 'Reports' },
  { to: '/activity',  icon: Activity,        label: 'Activity Log' },
  { to: '/settings',  icon: Settings,        label: 'Settings' },
]

interface SidebarProps {
  onNavClick?: () => void
}

export function Sidebar({ onNavClick }: SidebarProps) {
  const { profile, business, clear } = useAuthStore()
  const navigate = useNavigate()
  const isOwner = profile?.role === 'OWNER'

  async function handleLogout() {
    await supabase.auth.signOut()
    clear()
    navigate('/login')
  }

  const navClass = ({ isActive }: { isActive: boolean }) =>
    cn(
      'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all',
      isActive
        ? 'bg-primary text-primary-foreground shadow-sm'
        : 'text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
    )

  return (
    <aside className="flex h-full w-64 flex-col bg-sidebar border-r border-sidebar-border">
      {/* Brand */}
      <div className="flex items-center gap-3 px-4 py-5 border-b border-sidebar-border">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary shadow-inner">
          <Coffee className="h-5 w-5 text-primary-foreground" />
        </div>
        <div className="min-w-0">
          <p className="truncate text-sm font-bold text-sidebar-foreground">
            {business?.name ?? 'Mario POS'}
          </p>
          <p className="text-xs text-sidebar-foreground/50">Point of Sale</p>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto p-3 space-y-0.5">
        {NAV_ITEMS_ALL.map(({ to, icon: Icon, label }) => (
          <NavLink key={to} to={to} className={navClass} onClick={onNavClick}>
            <Icon className="h-4 w-4 shrink-0" />
            {label}
          </NavLink>
        ))}

        {isOwner && (
          <>
            <div className="pt-3 pb-1 px-3">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-sidebar-foreground/40">
                Management
              </p>
            </div>
            {NAV_ITEMS_OWNER.map(({ to, icon: Icon, label }) => (
              <NavLink key={to} to={to} className={navClass} onClick={onNavClick}>
                <Icon className="h-4 w-4 shrink-0" />
                {label}
              </NavLink>
            ))}
          </>
        )}
      </nav>

      {/* User footer */}
      <div className="border-t border-sidebar-border p-3">
        <div className="mb-2 flex items-center gap-3 rounded-lg px-3 py-2 bg-sidebar-accent/50">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/20 text-primary text-sm font-bold">
            {profile?.full_name?.[0]?.toUpperCase() ?? '?'}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-semibold text-sidebar-foreground">
              {profile?.full_name}
            </p>
            <p className="text-[10px] text-sidebar-foreground/50 capitalize">
              {profile?.role?.toLowerCase()}
            </p>
          </div>
        </div>
        <button
          onClick={handleLogout}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-sidebar-foreground/70 hover:bg-destructive/10 hover:text-destructive transition-colors"
        >
          <LogOut className="h-4 w-4" />
          Log out
        </button>
      </div>
    </aside>
  )
}
