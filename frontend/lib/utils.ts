import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatCurrency(amount: number): string {
  return `GHS ${amount.toFixed(2)}`
}

export function formatPhoneNumber(phone: string | null | undefined): string {
  // Format phone numbers for display
  if (!phone) return 'N/A'
  if (phone.startsWith('0')) {
    return phone
  }
  if (phone.startsWith('233')) {
    return '0' + phone.substring(3)
  }
  return phone
}