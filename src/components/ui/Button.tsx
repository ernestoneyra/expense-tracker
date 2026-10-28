import type { ButtonHTMLAttributes, Ref } from 'react'

// 2.5.5: everything you can press is at least 44 × 44 CSS pixels (min-h-11 / size-11).

export function Button({ className = '', ...rest }: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      className={`inline-flex min-h-11 min-w-11 cursor-pointer items-center justify-center gap-2 rounded-[10px] border border-transparent bg-accent px-3.5 font-semibold text-accent-contrast transition hover:brightness-110 disabled:cursor-default disabled:opacity-70 ${className}`}
      {...rest}
    />
  )
}

/** A button with an outline instead of a fill, for the actions that are not the main one. */
export function SecondaryButton({ className = '', ...rest }: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      className={`inline-flex min-h-11 min-w-11 cursor-pointer items-center justify-center gap-2 rounded-[10px] border border-field px-3.5 font-semibold text-body hover:bg-hover hover:text-strong disabled:cursor-default disabled:opacity-70 ${className}`}
      {...rest}
    />
  )
}

/** For actions that delete things. Colour is not the only cue: the label says what it does. */
export function DangerButton({ className = '', ...rest }: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      className={`inline-flex min-h-11 min-w-11 cursor-pointer items-center justify-center gap-2 rounded-[10px] border border-danger px-3.5 font-semibold text-danger hover:bg-danger hover:text-danger-contrast disabled:cursor-default disabled:opacity-70 ${className}`}
      {...rest}
    />
  )
}

export function IconButton({ className = '', ...rest }: ButtonHTMLAttributes<HTMLButtonElement> & { ref?: Ref<HTMLButtonElement> }) {
  return (
    <button
      type="button"
      className={`grid size-11 cursor-pointer place-items-center rounded-[10px] text-body hover:bg-hover hover:text-strong ${className}`}
      {...rest}
    />
  )
}

/** A button that reads as text, for a small action inside a card ("Edit budget", "Cancel"). */
export function LinkButton({ className = '', ...rest }: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      className={`inline-flex min-h-11 min-w-11 cursor-pointer items-center justify-center rounded-[10px] px-2 text-sm font-semibold text-accent-text underline underline-offset-2 hover:bg-hover ${className}`}
      {...rest}
    />
  )
}

/**
 * One of several choices (a range, a sort order, a method). The chosen one has a border and bold
 * text as well as a tint, so it does not rely on colour alone (1.4.1).
 */
export function ChipButton({
  pressed,
  className = '',
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { pressed: boolean }) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      className={`min-h-11 min-w-11 cursor-pointer rounded-[10px] px-3 text-sm ${
        pressed
          ? 'bg-accent-soft font-bold text-accent-text ring-2 ring-accent ring-inset'
          : 'font-medium text-body hover:bg-hover hover:text-strong'
      } ${className}`}
      {...rest}
    />
  )
}
