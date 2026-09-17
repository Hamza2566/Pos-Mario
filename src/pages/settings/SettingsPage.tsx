import { useState, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/store/authStore'
import { PageHeader } from '@/components/shared/PageHeader'
import { LoadingSpinner } from '@/components/shared/LoadingSpinner'
import { Settings, Loader2, CheckCircle2 } from 'lucide-react'

const schema = z.object({
  name: z.string().min(1, 'Business name is required'),
  phone: z.string().optional(),
  email: z.string().email('Invalid email').optional().or(z.literal('')),
  address: z.string().optional(),
  currency: z.string().min(1),
  timezone: z.string().min(1),
})
type FormValues = z.infer<typeof schema>

export function SettingsPage() {
  const { business, setBusiness } = useAuthStore()
  const [saved, setSaved] = useState(false)

  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<FormValues>({
    resolver: zodResolver(schema),
  })

  useEffect(() => {
    if (business) {
      reset({
        name: business.name,
        phone: business.phone ?? '',
        email: business.email ?? '',
        address: business.address ?? '',
        currency: business.currency ?? 'ETB',
        timezone: business.timezone ?? 'Africa/Addis_Ababa',
      })
    }
  }, [business])

  async function onSubmit(values: FormValues) {
    if (!business) return
    const { data, error } = await supabase
      .from('businesses')
      .update({
        name: values.name,
        phone: values.phone || null,
        email: values.email || null,
        address: values.address || null,
        currency: values.currency,
        timezone: values.timezone,
        updated_at: new Date().toISOString(),
      })
      .eq('id', business.id)
      .select()
      .single()

    if (!error && data) {
      setBusiness(data)
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    }
  }

  if (!business) return <div className="flex h-full items-center justify-center"><LoadingSpinner size="lg" /></div>

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-6">
      <PageHeader title="Business Settings" description="Update your coffee shop information" icon={Settings} />

      <form onSubmit={handleSubmit(onSubmit)} className="rounded-xl border border-border bg-card p-6 space-y-5">
        <div>
          <label htmlFor="settings-name" className="block text-sm font-medium mb-1.5">Business Name *</label>
          <input id="settings-name" {...register('name')} className="w-full rounded-lg border border-input bg-background px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50" />
          {errors.name && <p className="mt-1 text-xs text-destructive">{errors.name.message}</p>}
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label htmlFor="settings-phone" className="block text-sm font-medium mb-1.5">Phone</label>
            <input id="settings-phone" {...register('phone')} className="w-full rounded-lg border border-input bg-background px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50" placeholder="+251…" />
          </div>
          <div>
            <label htmlFor="settings-email" className="block text-sm font-medium mb-1.5">Email</label>
            <input id="settings-email" type="email" {...register('email')} className="w-full rounded-lg border border-input bg-background px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50" />
            {errors.email && <p className="mt-1 text-xs text-destructive">{errors.email.message}</p>}
          </div>
        </div>

        <div>
          <label htmlFor="settings-address" className="block text-sm font-medium mb-1.5">Address</label>
          <textarea id="settings-address" rows={2} {...register('address')} className="w-full rounded-lg border border-input bg-background px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 resize-none" />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label htmlFor="settings-currency" className="block text-sm font-medium mb-1.5">Currency</label>
            <select id="settings-currency" {...register('currency')} className="w-full rounded-lg border border-input bg-background px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50">
              <option value="ETB">ETB — Ethiopian Birr</option>
              <option value="USD">USD — US Dollar</option>
              <option value="EUR">EUR — Euro</option>
            </select>
          </div>
          <div>
            <label htmlFor="settings-timezone" className="block text-sm font-medium mb-1.5">Timezone</label>
            <select id="settings-timezone" {...register('timezone')} className="w-full rounded-lg border border-input bg-background px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50">
              <option value="Africa/Addis_Ababa">Africa/Addis_Ababa</option>
              <option value="Africa/Nairobi">Africa/Nairobi</option>
              <option value="UTC">UTC</option>
            </select>
          </div>
        </div>

        <div className="flex items-center justify-between pt-2">
          {saved && (
            <div className="flex items-center gap-2 text-sm text-emerald-600">
              <CheckCircle2 className="h-4 w-4" />
              Settings saved!
            </div>
          )}
          <div className="ml-auto">
            <button
              id="settings-save"
              type="submit"
              disabled={isSubmitting}
              className="flex items-center gap-2 rounded-lg bg-primary px-6 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-60 transition-colors"
            >
              {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Save Changes
            </button>
          </div>
        </div>
      </form>
    </div>
  )
}
