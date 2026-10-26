import type { ButtonHTMLAttributes } from 'react'

export function Button({ className = '', ...rest }: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      className={`inline-flex min-h-10 cursor-pointer items-center justify-center gap-2 rounded-[10px] border border-transparent bg-accent px-3.5 font-semibold text-accent-contrast transition hover:brightness-110 ${className}`}
      {...rest}
    />
  )
}

export function IconButton({ className = '', ...rest }: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      className={`grid size-10 cursor-pointer place-items-center rounded-[10px] text-body hover:bg-hover hover:text-strong ${className}`}
      {...rest}
    />
  )
}
