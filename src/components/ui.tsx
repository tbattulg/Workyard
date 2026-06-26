import type { ButtonHTMLAttributes, HTMLAttributes, ReactNode } from 'react'
import { cn } from '../lib/cn'

export function Button({
  className,
  type = 'button',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type={type}
      className={cn(
        'inline-flex min-h-11 items-center justify-center rounded-lg bg-amber-400 px-5 py-2.5 text-sm font-bold text-slate-950 shadow-sm transition hover:bg-amber-300 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-400 disabled:cursor-not-allowed disabled:opacity-50',
        className,
      )}
      {...props}
    />
  )
}

export function SecondaryButton({
  className,
  type = 'button',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type={type}
      className={cn(
        'inline-flex min-h-11 items-center justify-center rounded-lg border border-slate-300 bg-white px-5 py-2.5 text-sm font-semibold text-slate-800 transition hover:border-slate-400 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-700',
        className,
      )}
      {...props}
    />
  )
}

export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn('rounded-2xl border border-slate-200 bg-white shadow-sm', className)}
      {...props}
    />
  )
}

export function Badge({
  children,
  tone = 'neutral',
}: {
  children: ReactNode
  tone?: 'neutral' | 'success' | 'warning'
}) {
  const tones = {
    neutral: 'bg-slate-100 text-slate-700',
    success: 'bg-emerald-100 text-emerald-800',
    warning: 'bg-amber-100 text-amber-900',
  }
  return (
    <span className={cn('rounded-full px-2.5 py-1 text-xs font-bold', tones[tone])}>
      {children}
    </span>
  )
}

export function Field({
  label,
  id,
  hint,
  children,
}: {
  label: string
  id: string
  hint?: string
  children: ReactNode
}) {
  return (
    <div className="grid gap-1.5">
      <label htmlFor={id} className="text-sm font-semibold text-slate-800">
        {label}
      </label>
      {children}
      {hint ? <p className="text-xs text-slate-500">{hint}</p> : null}
    </div>
  )
}
