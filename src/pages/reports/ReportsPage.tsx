import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/store/authStore'
import { PageHeader } from '@/components/shared/PageHeader'
import { LoadingSpinner } from '@/components/shared/LoadingSpinner'
import { formatCurrency, formatDate, PAYMENT_METHOD_LABELS } from '@/lib/utils'
import { downloadCsv } from '@/lib/csv'
import { BarChart2, Download } from 'lucide-react'
import {
  Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts'

type RangeKey = 'today' | 'week' | 'month' | 'custom'

interface SaleRow {
  id: string
  sale_number: string | null
  total_amount: number
  sale_status: string
  created_at: string
  employee_id: string
}

interface PaymentRow {
  payment_method: string
  amount: number
}

interface ItemRow {
  product_name_snapshot: string
  quantity: number
  subtotal: number
}

interface ExpenseRow {
  category: string
  amount: number
}

function rangeStart(key: RangeKey, customFrom: string): Date {
  const now = new Date()
  if (key === 'today') {
    now.setHours(0, 0, 0, 0)
    return now
  }
  if (key === 'week') {
    now.setDate(now.getDate() - 7)
    return now
  }
  if (key === 'month') {
    now.setMonth(now.getMonth() - 1)
    return now
  }
  return customFrom ? new Date(`${customFrom}T00:00:00`) : new Date(0)
}

export function ReportsPage() {
  const { business } = useAuthStore()
  const [range, setRange] = useState<RangeKey>('month')
  const [customFrom, setCustomFrom] = useState(() => {
    const d = new Date()
    d.setMonth(d.getMonth() - 1)
    return d.toISOString().slice(0, 10)
  })
  const [customTo, setCustomTo] = useState(() => new Date().toISOString().slice(0, 10))
  const [loading, setLoading] = useState(true)
  const [sales, setSales] = useState<SaleRow[]>([])
  const [payments, setPayments] = useState<PaymentRow[]>([])
  const [items, setItems] = useState<ItemRow[]>([])
  const [expenses, setExpenses] = useState<ExpenseRow[]>([])
  const [employees, setEmployees] = useState<{ id: string; full_name: string }[]>([])

  const since = rangeStart(range, customFrom)
  const until = range === 'custom' && customTo
    ? new Date(`${customTo}T23:59:59`)
    : new Date()

  useEffect(() => {
    if (!business) return
    load()
  }, [business, range, customFrom, customTo])

  async function load() {
    if (!business) return
    setLoading(true)
    const fromIso = since.toISOString()
    const toIso = until.toISOString()

    const [salesRes, payRes, itemsRes, expRes, empRes] = await Promise.all([
      supabase
        .from('sales')
        .select('id, sale_number, total_amount, sale_status, created_at, employee_id')
        .eq('business_id', business.id)
        .gte('created_at', fromIso)
        .lte('created_at', toIso),
      supabase
        .from('payments')
        .select('payment_method, amount, created_at')
        .eq('business_id', business.id)
        .gte('created_at', fromIso)
        .lte('created_at', toIso),
      supabase
        .from('sale_items')
        .select('product_name_snapshot, quantity, subtotal, sale:sales!inner(business_id, created_at, sale_status)')
        .eq('sale.business_id', business.id)
        .eq('sale.sale_status', 'COMPLETED')
        .gte('sale.created_at', fromIso)
        .lte('sale.created_at', toIso),
      supabase
        .from('expenses')
        .select('category, amount, expense_date')
        .eq('business_id', business.id)
        .gte('expense_date', fromIso.slice(0, 10))
        .lte('expense_date', toIso.slice(0, 10)),
      supabase
        .from('profiles')
        .select('id, full_name')
        .eq('business_id', business.id),
    ])

    setSales(salesRes.data ?? [])
    setPayments(payRes.data ?? [])
    setItems((itemsRes.data as unknown as ItemRow[]) ?? [])
    setExpenses(expRes.data ?? [])
    setEmployees(empRes.data ?? [])
    setLoading(false)
  }

  const completed = sales.filter(s => s.sale_status === 'COMPLETED')
  const voided = sales.filter(s => s.sale_status === 'VOIDED')
  const revenue = completed.reduce((sum, s) => sum + Number(s.total_amount), 0)
  const expenseTotal = expenses.reduce((sum, e) => sum + Number(e.amount), 0)
  const profit = revenue - expenseTotal

  const paymentBreakdown = useMemo(() => {
    const map: Record<string, number> = {}
    payments.forEach(p => {
      map[p.payment_method] = (map[p.payment_method] ?? 0) + Number(p.amount)
    })
    return Object.entries(map).map(([method, amount]) => ({
      method: PAYMENT_METHOD_LABELS[method] ?? method,
      amount,
    }))
  }, [payments])

  const productBreakdown = useMemo(() => {
    const map: Record<string, { quantity: number; revenue: number }> = {}
    items.forEach(item => {
      if (!map[item.product_name_snapshot]) map[item.product_name_snapshot] = { quantity: 0, revenue: 0 }
      map[item.product_name_snapshot].quantity += item.quantity
      map[item.product_name_snapshot].revenue += Number(item.subtotal)
    })
    return Object.entries(map)
      .map(([name, d]) => ({ name, ...d }))
      .sort((a, b) => b.revenue - a.revenue)
  }, [items])

  const employeeBreakdown = useMemo(() => {
    const map: Record<string, { name: string; orders: number; revenue: number }> = {}
    employees.forEach(e => { map[e.id] = { name: e.full_name, orders: 0, revenue: 0 } })
    completed.forEach(s => {
      if (!map[s.employee_id]) map[s.employee_id] = { name: 'Unknown', orders: 0, revenue: 0 }
      map[s.employee_id].orders += 1
      map[s.employee_id].revenue += Number(s.total_amount)
    })
    return Object.values(map).sort((a, b) => b.revenue - a.revenue)
  }, [employees, completed])

  const expenseBreakdown = useMemo(() => {
    const map: Record<string, number> = {}
    expenses.forEach(e => {
      map[e.category] = (map[e.category] ?? 0) + Number(e.amount)
    })
    return Object.entries(map).map(([category, amount]) => ({ category, amount }))
  }, [expenses])

  function exportSales() {
    downloadCsv(
      `sales-${formatDate(since.toISOString())}.csv`,
      ['Sale #', 'Status', 'Employee', 'Total', 'Date'],
      completed.concat(voided).map(s => [
        s.sale_number ?? s.id,
        s.sale_status,
        employees.find(e => e.id === s.employee_id)?.full_name ?? '',
        Number(s.total_amount).toFixed(2),
        s.created_at,
      ]),
    )
  }

  const tabs: { id: RangeKey; label: string }[] = [
    { id: 'today', label: 'Today' },
    { id: 'week', label: '7 days' },
    { id: 'month', label: '30 days' },
    { id: 'custom', label: 'Custom' },
  ]

  return (
    <div className="p-6 space-y-6 max-w-6xl mx-auto">
      <PageHeader
        title="Reports"
        description="Sales, payments, products, team, and profit for the selected period"
        icon={BarChart2}
        action={
          <button
            id="reports-export"
            onClick={exportSales}
            className="flex items-center gap-2 rounded-lg border border-border px-4 py-2 text-sm font-medium hover:bg-muted transition-colors"
          >
            <Download className="h-4 w-4" />
            Export CSV
          </button>
        }
      />

      <div className="flex flex-wrap items-center gap-2">
        {tabs.map(tab => (
          <button
            key={tab.id}
            id={`reports-range-${tab.id}`}
            onClick={() => setRange(tab.id)}
            className={`rounded-full px-4 py-1.5 text-sm font-medium transition-all ${
              range === tab.id ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-muted/80'
            }`}
          >
            {tab.label}
          </button>
        ))}
        {range === 'custom' && (
          <div className="flex items-center gap-2 ml-2">
            <input id="reports-from" type="date" value={customFrom} onChange={e => setCustomFrom(e.target.value)}
              className="rounded-lg border border-input bg-background px-3 py-1.5 text-sm" />
            <span className="text-muted-foreground text-sm">to</span>
            <input id="reports-to" type="date" value={customTo} onChange={e => setCustomTo(e.target.value)}
              className="rounded-lg border border-input bg-background px-3 py-1.5 text-sm" />
          </div>
        )}
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><LoadingSpinner size="lg" /></div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <SummaryCard title="Completed sales" value={String(completed.length)} />
            <SummaryCard title="Revenue" value={formatCurrency(revenue)} />
            <SummaryCard title="Expenses" value={formatCurrency(expenseTotal)} />
            <SummaryCard title="Net (rev − exp)" value={formatCurrency(profit)} />
          </div>
          {voided.length > 0 && (
            <p className="text-xs text-muted-foreground">{voided.length} voided sale{voided.length === 1 ? '' : 's'} excluded from revenue.</p>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <section className="rounded-xl border border-border bg-card p-5">
              <h3 className="text-sm font-semibold mb-4">Payments</h3>
              {paymentBreakdown.length === 0 ? (
                <p className="text-sm text-muted-foreground">No payments in this period.</p>
              ) : (
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={paymentBreakdown}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="method" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} tickFormatter={v => formatCurrency(v)} />
                    <Tooltip formatter={(v: number) => [formatCurrency(v), 'Amount']} />
                    <Bar dataKey="amount" fill="hsl(var(--primary))" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </section>

            <section className="rounded-xl border border-border bg-card p-5">
              <h3 className="text-sm font-semibold mb-4">Expenses by category</h3>
              {expenseBreakdown.length === 0 ? (
                <p className="text-sm text-muted-foreground">No expenses in this period.</p>
              ) : (
                <div className="space-y-2">
                  {expenseBreakdown.map(row => (
                    <div key={row.category} className="flex justify-between text-sm">
                      <span>{row.category}</span>
                      <span className="font-semibold tabular-nums">{formatCurrency(row.amount)}</span>
                    </div>
                  ))}
                </div>
              )}
            </section>

            <section className="rounded-xl border border-border bg-card p-5">
              <h3 className="text-sm font-semibold mb-4">Products</h3>
              {productBreakdown.length === 0 ? (
                <p className="text-sm text-muted-foreground">No product sales in this period.</p>
              ) : (
                <div className="space-y-2 max-h-72 overflow-y-auto">
                  {productBreakdown.map(row => (
                    <div key={row.name} className="flex justify-between gap-3 text-sm">
                      <div className="min-w-0">
                        <p className="font-medium truncate">{row.name}</p>
                        <p className="text-xs text-muted-foreground">{row.quantity} sold</p>
                      </div>
                      <p className="font-semibold tabular-nums">{formatCurrency(row.revenue)}</p>
                    </div>
                  ))}
                </div>
              )}
            </section>

            <section className="rounded-xl border border-border bg-card p-5">
              <h3 className="text-sm font-semibold mb-4">Team</h3>
              {employeeBreakdown.length === 0 ? (
                <p className="text-sm text-muted-foreground">No team data.</p>
              ) : (
                <div className="space-y-2">
                  {employeeBreakdown.map(row => (
                    <div key={row.name} className="flex justify-between gap-3 text-sm">
                      <div>
                        <p className="font-medium">{row.name}</p>
                        <p className="text-xs text-muted-foreground">{row.orders} orders</p>
                      </div>
                      <p className="font-semibold tabular-nums">{formatCurrency(row.revenue)}</p>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>
        </>
      )}
    </div>
  )
}

function SummaryCard({ title, value }: { title: string; value: string }) {
  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <p className="text-sm text-muted-foreground">{title}</p>
      <p className="mt-1 text-2xl font-bold">{value}</p>
    </div>
  )
}
