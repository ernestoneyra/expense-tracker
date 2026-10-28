/** The Expenser mark: a wallet with a card tucked in, plus the wordmark with an accented "x". */
export function Logo() {
  return (
    <>
      <svg
        className="size-9 shrink-0"
        viewBox="0 0 32 32"
        fill="none"
        aria-hidden="true"
        focusable="false"
      >
        <rect x="6" y="3.5" width="17" height="10" rx="2.5" className="fill-accent" opacity="0.45" transform="rotate(-8 14.5 8.5)" />
        <rect x="2" y="8" width="27" height="20" rx="6" className="fill-accent" />
        <rect x="18" y="14.5" width="12" height="8.5" rx="4.25" className="fill-accent-contrast" />
        <circle cx="23.5" cy="18.75" r="1.7" className="fill-accent" />
      </svg>
      <span className="text-[1.375rem] font-extrabold tracking-tighter">
        E<span className="text-accent-text">x</span>penser
      </span>
    </>
  )
}
