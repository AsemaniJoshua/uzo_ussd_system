import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatCurrency(amount: any): string {
  const val = Number(amount)
  if (isNaN(val)) return 'GHS 0.00'
  return `GHS ${val.toFixed(2)}`
}

export function formatPhoneNumber(phone: any): string {
  if (phone === null || phone === undefined) return 'N/A'
  const phoneStr = String(phone).trim()
  if (!phoneStr) return 'N/A'
  if (phoneStr.startsWith('0')) {
    return phoneStr
  }
  if (phoneStr.startsWith('233')) {
    return '0' + phoneStr.substring(3)
  }
  return phoneStr
}