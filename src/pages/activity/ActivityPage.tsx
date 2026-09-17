import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/store/authStore'
import { PageHeader } from '@/components/shared/PageHeader'
import { LoadingSpinner } from '@/components/shared/LoadingSpinner'
import { EmptyState } from '@/components/shared/EmptyState'
import { formatDateTime } from '@/lib/utils'
import { Activity } from 'lucide-react'

interface Log {
  id: string
  action: string
  entity_type: string | null
  metadata: Record<string, unknown>
  created_at: string
  user: { full_name: string } | null
}

const ACTION_LABELS: Record<string, string> = {
  SALE_COMPLETED: 'Sale completed',
  PRODUCT_CREATED: 'Product created',
  PRODUCT_UPDATED: 'Product updated',
  PRICE_CHANGED: 'Price changed',
  EMPLOYEE_DEACTIVATED: 'Employee deactivated',
}

export function ActivityPage() {
  const { business } = useAuthStore()
  const [logs, setLogs] = useState<Log[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!business) return
    supabase
      .from('activity_logs')
      .select('id, action, entity_type, metadata, created_at, user:profiles!user_id(full_name)')
      .eq('business_id', business.id)
      .order('created_at', { ascending: false })
      .limit(200)
      .then(({ data }) => {
        setLogs((data as unknown as Log[]) ?? [])
        setLoading(false)
      })
  }, [business])

  return (
    <div className="p-6 space-y-6 max-w-4xl mx-auto">
      <PageHeader title="Activity Log" description="Immutable audit trail of all business actions" icon={Activity} />

      {loading ? (
        <div className="flex justify-center py-16"><LoadingSpinner size="lg" /></div>
      ) : logs.length === 0 ? (
        <EmptyState icon={Activity} title="No activity yet" description="All significant actions will be logged here." />
      ) : (
        <div className="space-y-2">
          {logs.map(log => (
            <div key={log.id} className="flex items-start gap-4 rounded-xl border border-border bg-card p-4">
              <div className="h-2 w-2 rounded-full bg-primary mt-2 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium">
                  {ACTION_LABELS[log.action] ?? log.action}
                  {typeof log.metadata?.total_amount === 'number' && (
                    <span className="text-muted-foreground font-normal"> — ETB {log.metadata.total_amount.toFixed(2)}</span>
                  )}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {log.user?.full_name ?? 'System'} · {formatDateTime(log.created_at)}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
