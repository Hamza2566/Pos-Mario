import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/store/authStore'
import { PageHeader } from '@/components/shared/PageHeader'
import { EmptyState } from '@/components/shared/EmptyState'
import { ConfirmDialog } from '@/components/shared/ConfirmDialog'
import { LoadingSpinner } from '@/components/shared/LoadingSpinner'
import { Tag, Plus, Pencil, Trash2, Loader2 } from 'lucide-react'

interface Category {
  id: string
  name: string
  description: string | null
  color: string | null
  sort_order: number
  active: boolean
}

const CATEGORY_COLORS = [
  '#ef4444', '#f97316', '#eab308', '#22c55e', '#06b6d4',
  '#3b82f6', '#8b5cf6', '#ec4899', '#6b7280',
]

export function CategoriesPage() {
  const { business } = useAuthStore()
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<Category | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Category | null>(null)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [color, setColor] = useState(CATEGORY_COLORS[0])
  const [saving, setSaving] = useState(false)

  useEffect(() => { if (business) load() }, [business])

  async function load() {
    setLoading(true)
    const { data } = await supabase.from('categories')
      .select('*').eq('business_id', business!.id).order('sort_order')
    setCategories(data ?? [])
    setLoading(false)
  }

  function openCreate() {
    setEditing(null)
    setName(''); setDescription(''); setColor(CATEGORY_COLORS[0])
    setFormOpen(true)
  }

  function openEdit(cat: Category) {
    setEditing(cat)
    setName(cat.name); setDescription(cat.description ?? ''); setColor(cat.color ?? CATEGORY_COLORS[0])
    setFormOpen(true)
  }

  async function handleSave() {
    if (!business || !name.trim()) return
    setSaving(true)
    const payload = { business_id: business.id, name: name.trim(), description: description || null, color, active: true }
    if (editing) {
      await supabase.from('categories').update(payload).eq('id', editing.id)
    } else {
      await supabase.from('categories').insert(payload)
    }
    setSaving(false)
    setFormOpen(false)
    load()
  }

  async function handleDelete() {
    if (!deleteTarget) return
    await supabase.from('categories').update({ active: false }).eq('id', deleteTarget.id)
    setDeleteTarget(null)
    load()
  }

  return (
    <div className="p-6 space-y-6 max-w-4xl mx-auto">
      <PageHeader
        title="Categories"
        description="Organize your products into categories"
        icon={Tag}
        action={
          <button id="categories-add" onClick={openCreate} className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-colors">
            <Plus className="h-4 w-4" />Add Category
          </button>
        }
      />

      {loading ? (
        <div className="flex justify-center py-16"><LoadingSpinner size="lg" /></div>
      ) : categories.filter(c => c.active).length === 0 ? (
        <EmptyState icon={Tag} title="No categories yet" description="Create categories to organize your products." />
      ) : (
        <div className="grid gap-3">
          {categories.filter(c => c.active).map(cat => (
            <div key={cat.id} className="flex items-center gap-4 rounded-xl border border-border bg-card p-4">
              <div className="h-10 w-10 rounded-lg shrink-0" style={{ backgroundColor: cat.color ?? '#6b7280' }} />
              <div className="flex-1 min-w-0">
                <p className="font-semibold">{cat.name}</p>
                {cat.description && <p className="text-xs text-muted-foreground">{cat.description}</p>}
              </div>
              <div className="flex gap-1">
                <button id={`cat-edit-${cat.id}`} onClick={() => openEdit(cat)} className="h-8 w-8 flex items-center justify-center rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors">
                  <Pencil className="h-3.5 w-3.5" />
                </button>
                <button id={`cat-delete-${cat.id}`} onClick={() => setDeleteTarget(cat)} className="h-8 w-8 flex items-center justify-center rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors">
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Form modal */}
      {formOpen && (
        <>
          <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm" onClick={() => setFormOpen(false)} />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="w-full max-w-md rounded-2xl bg-card border border-border shadow-2xl p-6 space-y-4">
              <h2 className="text-lg font-bold">{editing ? 'Edit Category' : 'Add Category'}</h2>
              <div>
                <label htmlFor="cat-name" className="block text-sm font-medium mb-1.5">Name *</label>
                <input id="cat-name" value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Hot Drinks" className="w-full rounded-lg border border-input bg-background px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50" />
              </div>
              <div>
                <label htmlFor="cat-description" className="block text-sm font-medium mb-1.5">Description</label>
                <input id="cat-description" value={description} onChange={e => setDescription(e.target.value)} placeholder="Optional" className="w-full rounded-lg border border-input bg-background px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Color</label>
                <div className="flex gap-2 flex-wrap">
                  {CATEGORY_COLORS.map(c => (
                    <button key={c} id={`cat-color-${c.replace('#', '')}`} type="button" onClick={() => setColor(c)}
                      className={`h-8 w-8 rounded-full transition-transform ${color === c ? 'ring-2 ring-offset-2 ring-primary scale-110' : ''}`}
                      style={{ backgroundColor: c }} />
                  ))}
                </div>
              </div>
              <div className="flex gap-3 pt-2">
                <button onClick={() => setFormOpen(false)} className="flex-1 rounded-lg border border-border py-2.5 text-sm font-medium hover:bg-muted transition-colors">Cancel</button>
                <button id="cat-save" onClick={handleSave} disabled={saving || !name.trim()} className="flex-1 flex items-center justify-center gap-2 rounded-lg bg-primary py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-60 transition-colors">
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  {editing ? 'Update' : 'Create'}
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={o => !o && setDeleteTarget(null)}
        title="Deactivate Category"
        description={`"${deleteTarget?.name}" will be hidden. Existing products keep their category reference.`}
        confirmLabel="Deactivate"
        variant="destructive"
        onConfirm={handleDelete}
      />
    </div>
  )
}
