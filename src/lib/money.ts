import { fractionDigitsFor, type Currency } from '../i18n/config.ts'

/** Today's date as YYYY-MM-DD in local time, for date inputs. */
export const today = () => new Date().toLocaleDateString('en-CA')

/** An amount typed in a form → integer cents. Storage is always value × 100, whatever the currency. */
export const toCents = (amount: string) => Math.round(Number(amount) * 100)

/** Cents → the text to put back into an amount input, without trailing zeros. */
export const fromCents = (cents: number, currency: Currency) =>
  String(Number((cents / 100).toFixed(fractionDigitsFor(currency))))
