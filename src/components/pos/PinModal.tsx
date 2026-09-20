import { useEffect, useState } from 'react'
import { Delete, Loader2, X } from 'lucide-react'

interface PinModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: (pin: string) => Promise<void> | void
  title?: string
  subtitle?: string
  confirmLabel?: string
}

export function PinModal({
  open,
  onOpenChange,
  onConfirm,
  title = 'Enter employee PIN',
  subtitle = 'The employee who enters their PIN will be recorded on this order.',
  confirmLabel = 'Confirm',
}: PinModalProps) {
  const [pin, setPin] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (open) {
      setPin('')
      setError(null)
      setLoading(false)
    }
  }, [open])

  if (!open) return null

  function press(digit: string) {
    if (loading) return
    setError(null)
    setPin(prev => (prev.length >= 4 ? prev : prev + digit))
  }

  function backspace() {
    if (loading) return
    setError(null)
    setPin(prev => prev.slice(0, -1))
  }

  async function submit() {
    if (pin.length !== 4 || loading) return
    setLoading(true)
    setError(null)
    try {
      await onConfirm(pin)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Invalid PIN')
      setPin('')
    } finally {
      setLoading(false)
    }
  }

  const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', 'back']

  return (
    <>
      <div
        className="fixed inset-0 z-[60] bg-black/50 backdrop-blur-sm"
        onClick={() => !loading && onOpenChange(false)}
      />
      <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
        <div className="relative w-full max-w-sm rounded-2xl bg-card border border-border shadow-2xl overflow-hidden">
          <div className="flex items-center justify-between px-6 py-4 border-b border-border">
            <div>
              <h2 className="text-lg font-bold">{title}</h2>
              <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>
            </div>
            <button
              id="pin-close"
              onClick={() => !loading && onOpenChange(false)}
              className="h-8 w-8 flex items-center justify-center rounded-lg hover:bg-muted transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="p-6 space-y-5">
            <div className="flex justify-center gap-3">
              {[0, 1, 2, 3].map(i => (
                <div
                  key={i}
                  className={`h-3.5 w-3.5 rounded-full border-2 transition-colors ${
                    pin.length > i
                      ? 'bg-primary border-primary'
                      : 'border-muted-foreground/40'
                  }`}
                />
              ))}
            </div>

            {error && (
              <p className="text-sm text-center text-destructive bg-destructive/10 rounded-lg px-4 py-2 border border-destructive/20">
                {error}
              </p>
            )}

            <div className="grid grid-cols-3 gap-2">
              {keys.map((key, idx) => {
                if (key === '') return <div key={idx} />
                if (key === 'back') {
                  return (
                    <button
                      key={key}
                      id="pin-backspace"
                      type="button"
                      onClick={backspace}
                      disabled={loading}
                      className="h-14 rounded-xl border border-border bg-muted/40 hover:bg-muted flex items-center justify-center transition-colors disabled:opacity-50"
                    >
                      <Delete className="h-5 w-5" />
                    </button>
                  )
                }
                return (
                  <button
                    key={key}
                    id={`pin-digit-${key}`}
                    type="button"
                    onClick={() => press(key)}
                    disabled={loading}
                    className="h-14 rounded-xl border border-border bg-background hover:bg-muted text-xl font-semibold transition-colors disabled:opacity-50"
                  >
                    {key}
                  </button>
                )
              })}
            </div>

            <button
              id="pin-confirm"
              type="button"
              onClick={submit}
              disabled={pin.length !== 4 || loading}
              className="w-full flex items-center justify-center gap-2 rounded-xl bg-primary py-3.5 text-base font-bold text-primary-foreground shadow-sm hover:bg-primary/90 disabled:opacity-60 disabled:cursor-not-allowed transition-all"
            >
              {loading ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin" />
                  Checking…
                </>
              ) : (
                confirmLabel
              )}
            </button>
          </div>
        </div>
      </div>
    </>
  )
}
