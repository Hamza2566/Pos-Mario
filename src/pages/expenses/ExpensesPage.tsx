import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/store/authStore'
import { PageHeader } from '@/components/shared/PageHeader'
import { EmptyState } from '@/components/shared/EmptyState'
import { LoadingSpinner } from '@/components/shared/LoadingSpinner'
import { formatCurrency, formatDate } from '@/lib/utils'
import { CreditCard, Plus, Loader2 } from 'lucide-react'
import { z } from 'zod'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'

const EXPENSE_CATEGORIES = [
  'Supplies', 'Utilities', 'Rent', 'Salaries', 'Maintenance', 'Marketing', 'Equipment', 'Other',
]

const schema = z.object({
  category: z.string().min(1, 'Category is required'),
  amount: z.string().refine(v => !isNaN(parseFloat(v)) && parseFloat(v) > 0, 'Must be a positive amount'),
  description: z.string().optional(),
  expense_date: z.string().min(1, 'Date is required'),
})
type FormValues = z.infer<typeof schema>

interface Expense {
  id: string
  category: string
  amount: number
  description: string | null
  expense_date: string
  created_at: string
  created_by_profile: { full_name: string } | null
}

export function ExpensesPage() {
  const { business, profile } = useAuthStore()
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [loading, setLoading] = useState(true)
  const [formOpen, setFormOpen] = useState(false)
  const [totalThisMonth, setTotalThisMonth] = useState(0)

  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { expense_date: new Date().toISOString().slice(0, 10) },
  })

  useEffect(() => { if (business) load() }, [business])

  async function load() {
    setLoading(true)
    const { data } = await supabase
      .from('expenses')
      .select('id, category, amount, description, expense_date, created_at, created_by_profile:profiles!created_by(full_name)')
      .eq('business_id', business!.id)
      .order('expense_date', { ascending: false })
      .limit(100)
    const expenseList = (data as unknown as Expense[]) ?? []
    setExpenses(expenseList)

    const now = new Date()
    const monthTotal = expenseList
      .filter(e => {
        const d = new Date(e.expense_date)
        return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth()
      })
      .reduce((sum, e) => sum + Number(e.amount), 0)
    setTotalThisMonth(monthTotal)
    setLoading(false)
  }

  async function onSubmit(values: FormValues) {
    if (!business || !profile) return
    const { error } = await supabase.from('expenses').insert({
      business_id: business.id,
      created_by: profile.id,
      category: values.category,
      amount: parseFloat(values.amount),
      description: values.description || null,
      expense_date: values.expense_date,
    })
    if (!error) {
      reset({ expense_date: new Date().toISOString().slice(0, 10) })
      setFormOpen(false)
      load()
    }
  }

  return (
    <div className="p-6 space-y-6 max-w-4xl mx-auto">
      <PageHeader
        title="Expenses"
        description={`This month: ${formatCurrency(totalThisMonth)}`}
        icon={CreditCard}
        action={
          <button id="expenses-add" onClick={() => { setFormOpen(true); reset({ expense_date: new Date().toISOString().slice(0, 10) }) }}
            className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-colors">
            <Plus className="h-4 w-4" />Add Expense
          </button>
        }
      />

      {loading ? (
        <div className="flex justify-center py-16"><LoadingSpinner size="lg" /></div>
      ) : expenses.length === 0 ? (
        <EmptyState icon={CreditCard} title="No expenses recorded" description="Track your business expenses here." />
      ) : (
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/30 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                <th className="px-4 py-3 text-left">Date</th>
                <th className="px-4 py-3 text-left">Category</th>
                <th className="px-4 py-3 text-left">Description</th>
                <th className="px-4 py-3 text-right">Amount</th>
              </tr>
            </thead>
            <tbody>
              {expenses.map(expense => (
                <tr key={expense.id} className="border-b border-border last:border-0 hover:bg-muted/20 transition-colors">
                  <td className="px-4 py-3 text-muted-foreground">{formatDate(expense.expense_date)}</td>
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-primary/10 text-primary">
                      {expense.category}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{expense.description ?? '—'}</td>
                  <td className="px-4 py-3 text-right font-semibold tabular-nums">{formatCurrency(expense.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Add expense modal */}
      {formOpen && (
        <>
          <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm" onClick={() => setFormOpen(false)} />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <form onSubmit={handleSubmit(onSubmit)} className="w-full max-w-md rounded-2xl bg-card border border-border shadow-2xl p-6 space-y-4">
              <h2 className="text-lg font-bold">Add Expense</h2>
              <div>
                <label htmlFor="exp-category" className="block text-sm font-medium mb-1.5">Category *</label>
                <select id="exp-category" {...register('category')} className="w-full rounded-lg border border-input bg-background px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50">
                  <option value="">Select…</option>
                  {EXPENSE_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
                {errors.category && <p className="mt-1 text-xs text-destructive">{errors.category.message}</p>}
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="exp-amount" className="block text-sm font-medium mb-1.5">Amount (ETB) *</label>
                  <input id="exp-amount" type="number" step="0.01" min="0" {...register('amount')} className="w-full rounded-lg border border-input bg-background px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50" />
                  {errors.amount && <p className="mt-1 text-xs text-destructive">{errors.amount.message}</p>}
                </div>
                <div>
                  <label htmlFor="exp-date" className="block text-sm font-medium mb-1.5">Date *</label>
                  <input id="exp-date" type="date" {...register('expense_date')} className="w-full rounded-lg border border-input bg-background px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50" />
                </div>
              </div>
              <div>
                <label htmlFor="exp-description" className="block text-sm font-medium mb-1.5">Description</label>
                <input id="exp-description" {...register('description')} className="w-full rounded-lg border border-input bg-background px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50" placeholder="Optional notes…" />
              </div>
              <div className="flex gap-3">
                <button type="button" onClick={() => setFormOpen(false)} className="flex-1 rounded-lg border border-border py-2.5 text-sm font-medium hover:bg-muted transition-colors">Cancel</button>
                <button id="exp-save" type="submit" disabled={isSubmitting} className="flex-1 flex items-center justify-center gap-2 rounded-lg bg-primary py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-60 transition-colors">
                  {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  Add Expense
                </button>
              </div>
            </form>
          </div>
        </>
      )}
    </div>
  )
}
