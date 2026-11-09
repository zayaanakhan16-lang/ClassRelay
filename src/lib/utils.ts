import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

export function uid(prefix = 'id'): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 9)}`;
}

export function formatRelative(ts: number): string {
  const diff = Date.now() - ts;
  const minutes = Math.round(diff / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  const days = Math.round(hours / 24);
  return days === 1 ? 'yesterday' : `${days} days ago`;
}

/** Word count used to gate the "keep explaining" prompts in the classroom. */
export function wordCount(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

export const clamp = (value: number, min: number, max: number): number => Math.min(max, Math.max(min, value));

export const pct = (part: number, whole: number): number => (whole <= 0 ? 0 : Math.round((part / whole) * 100));
