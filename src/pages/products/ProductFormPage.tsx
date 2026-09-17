import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/store/authStore'
import { PageHeader } from '@/components/shared/PageHeader'
import { LoadingSpinner } from '@/components/shared/LoadingSpinner'
import { Package, ArrowLeft, Loader2, Upload } from 'lucide-react'

const schema = z.object({
  name: z.string().min(1, 'Product name is required'),
  price: z.string().refine(v => !isNaN(parseFloat(v)) && parseFloat(v) >= 0, 'Must be a valid price'),
  cost_price: z.string().refine(v => !isNaN(parseFloat(v)) && parseFloat(v) >= 0, 'Must be a valid cost'),
  category_id: z.string().optional(),
  description: z.string().optional(),
  track_inventory: z.boolean(),
})
type FormValues = z.infer<typeof schema>

export function ProductFormPage() {
  const navigate = useNavigate()
  const { id } = useParams<{ id: string }>()
  const isEdit = !!id
  const { business } = useAuthStore()
  const [categories, setCategories] = useState<{ id: string; name: string }[]>([])
  const [loading, setLoading] = useState(isEdit)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)

  const { register, handleSubmit, reset, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { name: '', price: '', cost_price: '0', track_inventory: false },
  })

  useEffect(() => {
    if (!business) return
    supabase.from('categories').select('id, name').eq('business_id', business.id).eq('active', true)
      .then(({ data }) => setCategories(data ?? []))

    if (isEdit) {
      supabase.from('products').select('*').eq('id', id).single()
        .then(({ data }) => {
          if (data) {
            reset({
              name: data.name,
              price: String(data.price),
              cost_price: String(data.cost_price),
              category_id: data.category_id ?? '',
              description: data.description ?? '',
              track_inventory: data.track_inventory,
            })
            setImagePreview(data.image_url)
          }
          setLoading(false)
        })
    }
  }, [business, id])

  async function onSubmit(values: FormValues) {
    if (!business) return
    setSaving(true)
    setError(null)

    try {
      let image_url: string | null = imagePreview

      // Upload image if selected
      if (imageFile) {
        const ext = imageFile.name.split('.').pop()
        const path = `${business.id}/products/${Date.now()}.${ext}`
        const { error: uploadErr } = await supabase.storage.from('product-images').upload(path, imageFile)
        if (uploadErr) throw uploadErr
        const { data: urlData } = supabase.storage.from('product-images').getPublicUrl(path)
        image_url = urlData.publicUrl
      }

      const payload = {
        business_id: business.id,
        name: values.name,
        price: parseFloat(values.price),
        cost_price: parseFloat(values.cost_price),
        category_id: values.category_id || null,
        description: values.description || null,
        track_inventory: values.track_inventory,
        image_url,
      }

      if (isEdit) {
        const { error: err } = await supabase.from('products').update(payload).eq('id', id)
        if (err) throw err
      } else {
        const { error: err } = await supabase.from('products').insert(payload)
        if (err) throw err
      }

      navigate('/products')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save product.')
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <div className="flex h-full items-center justify-center"><LoadingSpinner size="lg" /></div>

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-6">
      <PageHeader
        title={isEdit ? 'Edit Product' : 'Add Product'}
        description={isEdit ? 'Update product details' : 'Create a new product for the POS'}
        icon={Package}
      />

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
        {/* Image upload */}
        <div>
          <label className="block text-sm font-medium text-foreground mb-2">Product Image</label>
          <div className="flex items-center gap-4">
            <div className="h-20 w-20 rounded-xl border border-border bg-muted overflow-hidden flex items-center justify-center">
              {imagePreview ? (
                <img src={imagePreview} alt="Preview" className="h-full w-full object-cover" />
              ) : (
                <Package className="h-8 w-8 text-muted-foreground/40" />
              )}
            </div>
            <label htmlFor="product-image" className="flex items-center gap-2 cursor-pointer rounded-lg border border-border px-4 py-2 text-sm font-medium hover:bg-muted transition-colors">
              <Upload className="h-4 w-4" />
              Upload Image
              <input
                id="product-image"
                type="file"
                accept="image/*"
                className="hidden"
                onChange={e => {
                  const file = e.target.files?.[0]
                  if (file) {
                    setImageFile(file)
                    setImagePreview(URL.createObjectURL(file))
                  }
                }}
              />
            </label>
          </div>
        </div>

        {/* Name */}
        <div>
          <label htmlFor="product-name" className="block text-sm font-medium text-foreground mb-1.5">Product Name *</label>
          <input id="product-name" {...register('name')} className="w-full rounded-lg border border-input bg-background px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all" placeholder="e.g. Cappuccino" />
          {errors.name && <p className="mt-1 text-xs text-destructive">{errors.name.message}</p>}
        </div>

        {/* Price + Cost */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label htmlFor="product-price" className="block text-sm font-medium text-foreground mb-1.5">Selling Price (ETB) *</label>
            <input id="product-price" type="number" step="0.01" min="0" {...register('price')} className="w-full rounded-lg border border-input bg-background px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all" placeholder="0.00" />
            {errors.price && <p className="mt-1 text-xs text-destructive">{errors.price.message}</p>}
          </div>
          <div>
            <label htmlFor="product-cost" className="block text-sm font-medium text-foreground mb-1.5">Cost Price (ETB)</label>
            <input id="product-cost" type="number" step="0.01" min="0" {...register('cost_price')} className="w-full rounded-lg border border-input bg-background px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all" placeholder="0.00" />
          </div>
        </div>

        {/* Category */}
        <div>
          <label htmlFor="product-category" className="block text-sm font-medium text-foreground mb-1.5">Category</label>
          <select id="product-category" {...register('category_id')} className="w-full rounded-lg border border-input bg-background px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all">
            <option value="">No category</option>
            {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>

        {/* Description */}
        <div>
          <label htmlFor="product-description" className="block text-sm font-medium text-foreground mb-1.5">Description</label>
          <textarea id="product-description" {...register('description')} rows={3} className="w-full rounded-lg border border-input bg-background px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all resize-none" placeholder="Optional description…" />
        </div>

        {/* Track inventory */}
        <div className="flex items-center gap-3 rounded-lg border border-border p-4">
          <input id="product-track-inventory" type="checkbox" {...register('track_inventory')} className="h-4 w-4 rounded border-border text-primary focus:ring-primary/50" />
          <div>
            <label htmlFor="product-track-inventory" className="text-sm font-medium">Track Inventory</label>
            <p className="text-xs text-muted-foreground">Automatically deduct stock when this product is sold.</p>
          </div>
        </div>

        {error && <p className="text-sm text-destructive bg-destructive/10 rounded-lg px-4 py-2 border border-destructive/20">{error}</p>}

        <div className="flex gap-3">
          <button type="button" onClick={() => navigate('/products')} className="flex items-center gap-2 rounded-lg border border-border px-4 py-2.5 text-sm font-medium hover:bg-muted transition-colors">
            <ArrowLeft className="h-4 w-4" />
            Back
          </button>
          <button id="product-save" type="submit" disabled={saving} className="flex-1 flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-60 disabled:cursor-not-allowed transition-colors">
            {saving ? <><Loader2 className="h-4 w-4 animate-spin" />Saving…</> : isEdit ? 'Update Product' : 'Add Product'}
          </button>
        </div>
      </form>
    </div>
  )
}
