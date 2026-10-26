import type { HTMLAttributes } from 'react'

export function Card({ className = '', ...rest }: HTMLAttributes<HTMLElement>) {
  return <section className={`rounded-[14px] border border-line bg-surface ${className}`} {...rest} />
}
