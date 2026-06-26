import { useCallback, useEffect, useState } from 'react'

type ToastType = 'success' | 'error' | 'info'

interface Toast {
  id: number
  message: string
  type: ToastType
}

type Listener = (toasts: Toast[]) => void

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

export function useToast() {
  const [, setTick] = useState(0)

  useEffect(() => {

    return subscribe(() => setTick((n) => n + 1))
  }, [])

  const showToast = useCallback((message: string, type: ToastType = 'success') => {
    addToast(message, type)
  }, [])

  return { showToast, toasts, getSnapshot }
}

export function showToast(message: string, type: ToastType = 'success') {
  addToast(message, type)
}