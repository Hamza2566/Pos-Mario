import { useState } from 'react'
import { Outlet } from 'react-router-dom'
import { Sidebar } from './Sidebar'
import { SyncStatusBadge } from './SyncStatusBadge'
import { Menu, X } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * Main application shell.
 * - Persistent sidebar on desktop
 * - Slide-in drawer sidebar on mobile
 * - Sync status badge always visible in header
 */
export function AppShell() {
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false)

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Desktop sidebar — always visible */}
      <div className="hidden md:flex">
        <Sidebar />
      </div>

      {/* Mobile sidebar overlay */}
      {mobileSidebarOpen && (
        <div
          className="fixed inset-0 z-40 md:hidden"
          onClick={() => setMobileSidebarOpen(false)}
        >
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
        </div>
      )}

      {/* Mobile sidebar drawer */}
      <div className={cn(
        'fixed inset-y-0 left-0 z-50 flex md:hidden transition-transform duration-300',
        mobileSidebarOpen ? 'translate-x-0' : '-translate-x-full',
      )}>
        <Sidebar onNavClick={() => setMobileSidebarOpen(false)} />
      </div>

      {/* Main content area */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Top bar */}
        <header className="flex h-14 items-center justify-between border-b border-border bg-background/80 backdrop-blur-sm px-4 md:px-6">
          {/* Mobile hamburger */}
          <button
            className="flex md:hidden items-center justify-center h-8 w-8 rounded-md hover:bg-accent transition-colors"
            onClick={() => setMobileSidebarOpen(o => !o)}
            aria-label="Toggle sidebar"
          >
            {mobileSidebarOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
          <div className="hidden md:block" />

          {/* Right side */}
          <div className="flex items-center gap-3">
            <SyncStatusBadge />
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
