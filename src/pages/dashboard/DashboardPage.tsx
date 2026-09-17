import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/store/authStore'
import { formatCurrency, formatDate } from '@/lib/utils'
import { PageHeader } from '@/components/shared/PageHeader'
import { LoadingSpinner } from '@/components/shared/LoadingSpinner'
import {
  LayoutDashboard, TrendingUp, ShoppingBag, Users, Package,
  AlertTriangle, ArrowUpRight, ArrowDownRight,
} from 'lucide-react'
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell, Legend,
} from 'recharts'

interface DashboardStats {
  todayRevenue: number
  yesterdayRevenue: number
  todayOrders: number
  yesterdayOrders: number
  avgOrderValue: number
  paymentBreakdown: { method: string; amount: number; count: number }[]
  salesTrend: { date: string; revenue: number; orders: number }[]
  topProducts: { name: string; quantity: number; revenue: number }[]
  employeePerformance: { name: string; orders: number; revenue: number }[]
  lowStock: { name: string; quantity: number; minimum_stock: number; unit: string }[]
}

const METHOD_COLORS: Record<string, string> = {
  CASH: '#10b981',
  TELEBIRR: '#8b5cf6',
  CBE_BIRR: '#3b82f6',
  CARD: '#f59e0b',
  OTHER: '#6b7280',
}

function StatCard({
  title, value, subtitle, icon: Icon, trend, trendLabel,
}: {
  title: string
  value: string
  subtitle?: string
  icon: React.ComponentType<{ className?: string }>
  trend?: number
  trendLabel?: string
}) {
  const isUp = (trend ?? 0) >= 0
  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-medium text-muted-foreground">{title}</p>
          <p className="mt-1 text-2xl font-bold text-foreground">{value}</p>
          {subtitle && <p className="mt-0.5 text-xs text-muted-foreground">{subtitle}</p>}
        </div>
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
          <Icon className="h-5 w-5 text-primary" />
        </div>
      </div>
      {trend !== undefined && (
        <div className={`mt-3 flex items-center gap-1 text-xs font-medium ${isUp ? 'text-emerald-600' : 'text-red-500'}`}>
          {isUp ? <ArrowUpRight className="h-3.5 w-3.5" /> : <ArrowDownRight className="h-3.5 w-3.5" />}
          {Math.abs(trend).toFixed(1)}% {trendLabel}
        </div>
      )}
    </div>
  )
}

export function DashboardPage() {
  const { business } = useAuthStore()
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!business) return
    loadStats()
    // Refresh every 60 seconds
    const interval = setInterval(loadStats, 60_000)
    return () => clearInterval(interval)
  }, [business])

  async function loadStats() {
    if (!business) return
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const yesterday = new Date(today)
    yesterday.setDate(yesterday.getDate() - 1)
    const thirtyDaysAgo = new Date(today)
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

    const [salesRes, paymentsRes, itemsRes, empRes, invRes] = await Promise.all([
      supabase
        .from('sales')
        .select('id, total_amount, created_at, employee_id, sale_status')
        .eq('business_id', business.id)
        .eq('sale_status', 'COMPLETED')
        .gte('created_at', thirtyDaysAgo.toISOString()),
      supabase
        .from('payments')
        .select('payment_method, amount, created_at')
        .eq('business_id', business.id)
        .gte('created_at', thirtyDaysAgo.toISOString()),
      supabase
        .from('sale_items')
        .select('product_name_snapshot, quantity, subtotal, sale:sales!inner(business_id, created_at, sale_status)')
        .eq('sale.business_id', business.id)
        .eq('sale.sale_status', 'COMPLETED')
        .gte('sale.created_at', thirtyDaysAgo.toISOString()),
      supabase
        .from('profiles')
        .select('id, full_name')
        .eq('business_id', business.id)
        .eq('active', true),
      supabase
        .from('inventory_items')
        .select('name, quantity, minimum_stock, unit')
        .eq('business_id', business.id)
        .eq('active', true),
    ])

    const sales = salesRes.data ?? []
    const payments = paymentsRes.data ?? []
    const saleItems = itemsRes.data ?? []
    const employees = empRes.data ?? []
    const inventory = invRes.data ?? []

    const todaySales = sales.filter(s => new Date(s.created_at) >= today)
    const yesterdaySales = sales.filter(s => {
      const d = new Date(s.created_at)
      return d >= yesterday && d < today
    })

    const todayRevenue = todaySales.reduce((sum, s) => sum + Number(s.total_amount), 0)
    const yesterdayRevenue = yesterdaySales.reduce((sum, s) => sum + Number(s.total_amount), 0)
    // Payment breakdown (last 30 days)
    const pmMap: Record<string, { amount: number; count: number }> = {}
    payments.forEach(p => {
      if (!pmMap[p.payment_method]) pmMap[p.payment_method] = { amount: 0, count: 0 }
      pmMap[p.payment_method].amount += Number(p.amount)
      pmMap[p.payment_method].count += 1
    })
    const paymentBreakdown = Object.entries(pmMap).map(([method, d]) => ({ method, ...d }))

    // Sales trend (last 14 days)
    const trendMap: Record<string, { revenue: number; orders: number }> = {}
    for (let i = 13; i >= 0; i--) {
      const d = new Date(today)
      d.setDate(d.getDate() - i)
      trendMap[formatDate(d.toISOString())] = { revenue: 0, orders: 0 }
    }
    sales.filter(s => new Date(s.created_at) >= new Date(today.getTime() - 14 * 86400_000))
      .forEach(s => {
        const key = formatDate(s.created_at)
        if (trendMap[key]) {
          trendMap[key].revenue += Number(s.total_amount)
          trendMap[key].orders += 1
        }
      })
    const salesTrend = Object.entries(trendMap).map(([date, d]) => ({ date, ...d }))

    // Top products
    const prodMap: Record<string, { quantity: number; revenue: number }> = {}
    saleItems.forEach((item: { product_name_snapshot: string; quantity: number; subtotal: number }) => {
      if (!prodMap[item.product_name_snapshot]) prodMap[item.product_name_snapshot] = { quantity: 0, revenue: 0 }
      prodMap[item.product_name_snapshot].quantity += item.quantity
      prodMap[item.product_name_snapshot].revenue += Number(item.subtotal)
    })
    const topProducts = Object.entries(prodMap)
      .map(([name, d]) => ({ name, ...d }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 8)

    // Employee performance
    const empMap: Record<string, { orders: number; revenue: number; name: string }> = {}
    employees.forEach(e => { empMap[e.id] = { orders: 0, revenue: 0, name: e.full_name } })
    todaySales.forEach(s => {
      if (empMap[s.employee_id]) {
        empMap[s.employee_id].orders += 1
        empMap[s.employee_id].revenue += Number(s.total_amount)
      }
    })
    const employeePerformance = Object.values(empMap)
      .sort((a, b) => b.revenue - a.revenue)

    // Low stock
    const lowStock = inventory.filter(
      i => Number(i.quantity) <= Number(i.minimum_stock) && Number(i.minimum_stock) > 0,
    )

    const avgOrderValue = todaySales.length > 0 ? todayRevenue / todaySales.length : 0

    setStats({
      todayRevenue, yesterdayRevenue, todayOrders: todaySales.length,
      yesterdayOrders: yesterdaySales.length, avgOrderValue,
      paymentBreakdown, salesTrend, topProducts, employeePerformance, lowStock,
    })
    setLoading(false)
  }

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <LoadingSpinner size="lg" label="Loading dashboard…" />
      </div>
    )
  }

  if (!stats) return null

  const revTrend = stats.yesterdayRevenue > 0
    ? ((stats.todayRevenue - stats.yesterdayRevenue) / stats.yesterdayRevenue) * 100
    : 0
  const orderTrend = stats.yesterdayOrders > 0
    ? ((stats.todayOrders - stats.yesterdayOrders) / stats.yesterdayOrders) * 100
    : 0

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <PageHeader
        title="Dashboard"
        description="Today's performance overview"
        icon={LayoutDashboard}
      />

      {/* Low stock alert */}
      {stats.lowStock.length > 0 && (
        <div className="flex items-start gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 p-4">
          <AlertTriangle className="h-5 w-5 text-amber-500 mt-0.5 shrink-0" />
          <div>
            <p className="text-sm font-semibold text-amber-700">Low Stock Alert</p>
            <p className="text-xs text-amber-600 mt-0.5">
              {stats.lowStock.map(i => `${i.name} (${i.quantity} ${i.unit} remaining)`).join(' · ')}
            </p>
          </div>
        </div>
      )}

      {/* Stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Today's Revenue"
          value={formatCurrency(stats.todayRevenue)}
          subtitle="vs. yesterday"
          icon={TrendingUp}
          trend={revTrend}
          trendLabel="from yesterday"
        />
        <StatCard
          title="Today's Orders"
          value={stats.todayOrders.toString()}
          subtitle={`Yesterday: ${stats.yesterdayOrders}`}
          icon={ShoppingBag}
          trend={orderTrend}
          trendLabel="from yesterday"
        />
        <StatCard
          title="Avg. Order Value"
          value={formatCurrency(stats.avgOrderValue)}
          subtitle="Today"
          icon={Package}
        />
        <StatCard
          title="Active Employees"
          value={stats.employeePerformance.filter(e => e.orders > 0).length.toString()}
          subtitle="Working today"
          icon={Users}
        />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Sales trend chart */}
        <div className="lg:col-span-2 rounded-xl border border-border bg-card p-5">
          <h3 className="text-sm font-semibold text-foreground mb-4">Revenue (Last 14 Days)</h3>
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={stats.salesTrend} margin={{ top: 5, right: 5, bottom: 5, left: 0 }}>
              <defs>
                <linearGradient id="revenueGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="date" tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
              <YAxis tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" tickFormatter={v => formatCurrency(v)} />
              <Tooltip
                contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px', fontSize: '12px' }}
                formatter={(v: number) => [formatCurrency(v), 'Revenue']}
              />
              <Area type="monotone" dataKey="revenue" stroke="hsl(var(--primary))" strokeWidth={2} fill="url(#revenueGrad)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Payment breakdown */}
        <div className="rounded-xl border border-border bg-card p-5">
          <h3 className="text-sm font-semibold text-foreground mb-4">Payment Methods (30 days)</h3>
          {stats.paymentBreakdown.length === 0 ? (
            <div className="flex items-center justify-center h-48 text-muted-foreground text-sm">No data</div>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie
                  data={stats.paymentBreakdown}
                  dataKey="amount"
                  nameKey="method"
                  cx="50%"
                  cy="45%"
                  outerRadius={75}
                  strokeWidth={0}
                >
                  {stats.paymentBreakdown.map(entry => (
                    <Cell key={entry.method} fill={METHOD_COLORS[entry.method] ?? '#6b7280'} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px', fontSize: '12px' }}
                  formatter={(v: number) => [formatCurrency(v), 'Revenue']}
                />
                <Legend iconSize={8} formatter={v => v.replace('_', ' ')} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Tables */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top products */}
        <div className="rounded-xl border border-border bg-card p-5">
          <h3 className="text-sm font-semibold text-foreground mb-4">Top Products (30 days)</h3>
          {stats.topProducts.length === 0 ? (
            <p className="text-sm text-muted-foreground">No sales yet.</p>
          ) : (
            <div className="space-y-2">
              {stats.topProducts.map((p, i) => (
                <div key={p.name} className="flex items-center gap-3">
                  <span className="w-5 text-xs font-bold text-muted-foreground">{i + 1}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{p.name}</p>
                    <p className="text-xs text-muted-foreground">{p.quantity} sold</p>
                  </div>
                  <p className="text-sm font-semibold tabular-nums">{formatCurrency(p.revenue)}</p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Employee performance */}
        <div className="rounded-xl border border-border bg-card p-5">
          <h3 className="text-sm font-semibold text-foreground mb-4">Team Performance (Today)</h3>
          {stats.employeePerformance.length === 0 ? (
            <p className="text-sm text-muted-foreground">No employees found.</p>
          ) : (
            <div className="space-y-2">
              {stats.employeePerformance.map(emp => (
                <div key={emp.name} className="flex items-center gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary text-sm font-bold shrink-0">
                    {emp.name[0]}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{emp.name}</p>
                    <p className="text-xs text-muted-foreground">{emp.orders} orders</p>
                  </div>
                  <p className="text-sm font-semibold tabular-nums">{formatCurrency(emp.revenue)}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
