import { useCallback, useEffect, useState } from 'react'

type ToastType = 'success' | 'error' | 'info'

interface Toast {
  id: number
  message: string
  type: ToastType
}

type Listener = (toasts: Toast[]) => void

/**
 * Singleton toast state manager.
 * Keeps toast state outside React so showToast() can be called imperatively
 * from any hook or component without a provider.
 */
let nextId = 0
let toasts: Toast[] = []
const listeners = new Set<Listener>()

function subscribe(listener: Listener) {
  listeners.add(listener)
  return () => { listeners.delete(listener) }
}

function getSnapshot(): Toast[] {
  return toasts
}

function setState(next: Toast[]) {
  toasts = next
  listeners.forEach((l) => l(toasts))
}

function addToast(message: string, type: ToastType) {
  const id = nextId++
  setState([...toasts, { id, message, type }])
  setTimeout(() => {
    setState(toasts.filter((t) => t.id !== id))
  }, 2500)
}

/**
 * Hook that exposes showToast() and the current toast list.
 * showToast has a stable identity (useCallback with empty deps).
 */
export function useToast() {
  const [, setTick] = useState(0)

  useEffect(() => {
    // Force re-render when the shared toast list changes
    return subscribe(() => setTick((n) => n + 1))
  }, [])

  const showToast = useCallback((message: string, type: ToastType = 'success') => {
    addToast(message, type)
  }, [])

  return { showToast, toasts, getSnapshot }
}

/**
 * Standalone function for calling outside of React hooks.
 * Returns the current toast snapshot so callers that only need
 * the function (not the list) can import { showToast } directly.
 */
export function showToast(message: string, type: ToastType = 'success') {
  addToast(message, type)
}
