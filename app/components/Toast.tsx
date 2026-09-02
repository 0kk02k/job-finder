'use client'

import {
 createContext,
 useCallback,
 useContext,
 useEffect,
 useRef,
 useState,
 type ReactNode,
} from 'react'

type ToastType = 'success' | 'error'

interface ToastItem {
  id: number
  message: string
  type: ToastType
}

interface ToastContextValue {
  success: (message: string) => void
  error: (message: string) => void
}

const ToastContext = createContext<ToastContextValue | null>(null)

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used within ToastProvider')
  return ctx
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([])
  const idRef = useRef(0)

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  const push = useCallback(
    (message: string, type: ToastType) => {
      const id = ++idRef.current
      setToasts((prev) => [...prev, { id, message, type }])
      setTimeout(() => dismiss(id), 4000)
    },
    [dismiss]
  )

  const success = useCallback((message: string) => push(message, 'success'), [push])
  const error = useCallback((message: string) => push(message, 'error'), [push])

  return (
    <ToastContext.Provider value={{ success, error }}>
      {children}
      {/* Toast container */}
      <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-3 max-w-sm">
        {toasts.map((toast) => (
          <Toast key={toast.id} toast={toast} onClose={() => dismiss(toast.id)} />
        ))}
      </div>
    </ToastContext.Provider>
  )
}

function Toast({ toast, onClose }: { toast: ToastItem; onClose: () => void }) {
  const [exiting, setExiting] = useState(false)

  useEffect(() => {
    // Trigger exit animation slightly before unmount
    const timer = setTimeout(() => setExiting(true), 3700)
    return () => clearTimeout(timer)
  }, [])

  const isError = toast.type === 'error'

  return (
    <div
      role={isError ? 'alert' : 'status'}
      className={`flex items-start gap-3 bg-[var(--color-surface)] rounded-xl p-4 border shadow-lg transition-all duration-300 motion-reduce:transition-none ${
        exiting ? 'opacity-0 translate-x-4' : 'opacity-100'
      }`}
    >
      {/* Status-Punkt statt Farb-Balken: das Signal reicht in die Bedeutung, trägt sie nicht allein */}
      <span
        aria-hidden="true"
        className={`mt-1.5 h-2 w-2 flex-shrink-0 rounded-full ${isError ? 'bg-[var(--color-error)]' : 'bg-[var(--color-success)]'}`}
      />
      <p className="flex-1 text-sm text-[var(--color-foreground)] leading-relaxed">
        {toast.message}
      </p>
      <button
        onClick={onClose}
        className="flex-shrink-0 p-1 -m-1 text-[var(--color-primary-soft)] hover:text-[var(--color-foreground)] transition-colors motion-reduce:transition-none"
        aria-label="Schließen"
      >
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
          <path d="M3 3l8 8M11 3l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      </button>
    </div>
  )
}
