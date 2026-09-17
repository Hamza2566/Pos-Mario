import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/store/authStore'
import { PageHeader } from '@/components/shared/PageHeader'
import { EmptyState } from '@/components/shared/EmptyState'
import { ConfirmDialog } from '@/components/shared/ConfirmDialog'
import { LoadingSpinner } from '@/components/shared/LoadingSpinner'
import { Users, Plus, ToggleLeft, ToggleRight, Loader2 } from 'lucide-react'
import { logActivity } from '@/lib/activity'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'

const schema = z.object({
  full_name: z.string().min(2, 'Name must be at least 2 characters'),
  email: z.string().email('Invalid email'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  phone: z.string().optional(),
})
type FormValues = z.infer<typeof schema>

interface Employee {
  id: string
  full_name: string
  phone: string | null
  active: boolean
  auth_user_id: string
  email?: string
}

export function EmployeesPage() {
  const { business } = useAuthStore()
  const [employees, setEmployees] = useState<Employee[]>([])
  const [loading, setLoading] = useState(true)
  const [formOpen, setFormOpen] = useState(false)
  const [toggleTarget, setToggleTarget] = useState<Employee | null>(null)
  const [serverError, setServerError] = useState<string | null>(null)

  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<FormValues>({
    resolver: zodResolver(schema),
  })

  useEffect(() => { if (business) load() }, [business])

  async function load() {
    setLoading(true)
    const { data } = await supabase
      .from('profiles')
      .select('id, full_name, phone, active, auth_user_id')
      .eq('business_id', business!.id)
      .eq('role', 'EMPLOYEE')
      .order('full_name')
    setEmployees(data ?? [])
    setLoading(false)
  }

  async function onSubmit(values: FormValues) {
    if (!business) return
    setServerError(null)
    try {
      const { data: { session: ownerSession } } = await supabase.auth.getSession()

      const { data: signUpData, error: signUpErr } = await supabase.auth.signUp({
        email: values.email,
        password: values.password,
        options: {
          data: {
            business_id: business.id,
            full_name: values.full_name,
            role: 'EMPLOYEE',
            phone: values.phone || '',
          },
        },
      })

      if (signUpErr) throw signUpErr

      if (ownerSession) {
        await supabase.auth.setSession(ownerSession)
      }

      const userId = signUpData.user?.id
      if (userId) {
        await supabase.from('profiles').upsert({
          auth_user_id: userId,
          business_id: business.id,
          full_name: values.full_name,
          phone: values.phone || null,
          role: 'EMPLOYEE',
          active: true,
        }, { onConflict: 'auth_user_id' })
      }

      reset()
      setFormOpen(false)
      load()
    } catch (err) {
      setServerError(err instanceof Error ? err.message : 'Failed to create employee.')
    }
  }

  async function handleToggle() {
    if (!toggleTarget) return
    await supabase.from('profiles').update({ active: !toggleTarget.active }).eq('id', toggleTarget.id)
    await logActivity(
      toggleTarget.active ? 'EMPLOYEE_DEACTIVATED' : 'EMPLOYEE_ACTIVATED',
      'profile',
      toggleTarget.id,
      { full_name: toggleTarget.full_name },
    )
    setToggleTarget(null)
    load()
  }

  return (
    <div className="p-6 space-y-6 max-w-4xl mx-auto">
      <PageHeader
        title="Employees"
        description="Manage your team members"
        icon={Users}
        action={
          <button id="employees-add" onClick={() => { setFormOpen(true); setServerError(null); reset() }} className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-colors">
            <Plus className="h-4 w-4" />Add Employee
          </button>
        }
      />

      {loading ? (
        <div className="flex justify-center py-16"><LoadingSpinner size="lg" /></div>
      ) : employees.length === 0 ? (
        <EmptyState icon={Users} title="No employees yet" description="Add employees to let them access the POS." />
      ) : (
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/30 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                <th className="px-4 py-3 text-left">Name</th>
                <th className="px-4 py-3 text-left">Phone</th>
                <th className="px-4 py-3 text-center">Status</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {employees.map(emp => (
                <tr key={emp.id} className="border-b border-border last:border-0 hover:bg-muted/20 transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="h-8 w-8 rounded-full bg-primary/10 text-primary text-sm font-bold flex items-center justify-center">
                        {emp.full_name[0]}
                      </div>
                      <span className="font-medium">{emp.full_name}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{emp.phone ?? '—'}</td>
                  <td className="px-4 py-3 text-center">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${
                      emp.active ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20' : 'bg-slate-500/10 text-slate-500 border-slate-500/20'
                    }`}>{emp.active ? 'Active' : 'Inactive'}</span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button id={`emp-toggle-${emp.id}`} onClick={() => setToggleTarget(emp)} className="h-8 w-8 inline-flex items-center justify-center rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors">
                      {emp.active ? <ToggleRight className="h-4 w-4" /> : <ToggleLeft className="h-4 w-4" />}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Add employee modal */}
      {formOpen && (
        <>
          <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm" onClick={() => setFormOpen(false)} />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <form onSubmit={handleSubmit(onSubmit)} className="w-full max-w-md rounded-2xl bg-card border border-border shadow-2xl p-6 space-y-4">
              <h2 className="text-lg font-bold">Add Employee</h2>
              {serverError && <p className="text-sm text-destructive bg-destructive/10 rounded-lg px-4 py-2">{serverError}</p>}
              <div>
                <label htmlFor="emp-name" className="block text-sm font-medium mb-1.5">Full Name *</label>
                <input id="emp-name" {...register('full_name')} className="w-full rounded-lg border border-input bg-background px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50" />
                {errors.full_name && <p className="mt-1 text-xs text-destructive">{errors.full_name.message}</p>}
              </div>
              <div>
                <label htmlFor="emp-email" className="block text-sm font-medium mb-1.5">Email *</label>
                <input id="emp-email" type="email" {...register('email')} className="w-full rounded-lg border border-input bg-background px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50" />
                {errors.email && <p className="mt-1 text-xs text-destructive">{errors.email.message}</p>}
              </div>
              <div>
                <label htmlFor="emp-password" className="block text-sm font-medium mb-1.5">Password *</label>
                <input id="emp-password" type="password" {...register('password')} className="w-full rounded-lg border border-input bg-background px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50" />
                {errors.password && <p className="mt-1 text-xs text-destructive">{errors.password.message}</p>}
              </div>
              <div>
                <label htmlFor="emp-phone" className="block text-sm font-medium mb-1.5">Phone</label>
                <input id="emp-phone" {...register('phone')} className="w-full rounded-lg border border-input bg-background px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50" placeholder="+251…" />
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setFormOpen(false)} className="flex-1 rounded-lg border border-border py-2.5 text-sm font-medium hover:bg-muted transition-colors">Cancel</button>
                <button id="emp-save" type="submit" disabled={isSubmitting} className="flex-1 flex items-center justify-center gap-2 rounded-lg bg-primary py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-60 transition-colors">
                  {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  Add Employee
                </button>
              </div>
            </form>
          </div>
        </>
      )}

      <ConfirmDialog
        open={!!toggleTarget}
        onOpenChange={o => !o && setToggleTarget(null)}
        title={toggleTarget?.active ? 'Deactivate Employee' : 'Activate Employee'}
        description={`${toggleTarget?.full_name} will ${toggleTarget?.active ? 'lose' : 'regain'} access to the POS.`}
        confirmLabel={toggleTarget?.active ? 'Deactivate' : 'Activate'}
        variant={toggleTarget?.active ? 'destructive' : 'default'}
        onConfirm={handleToggle}
      />
    </div>
  )
}
