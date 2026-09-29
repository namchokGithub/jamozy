import { createContext, useContext } from 'react'
import type { ContentStatus } from '../../../domain/models/content-status'
import {
  adminDictionaries,
  adminLocales,
  type AdminLocale,
  type AdminMessageKey,
} from './dictionaries'

export type { AdminLocale, AdminMessageKey } from './dictionaries'

export type AdminTranslate = (
  key: AdminMessageKey,
  params?: Record<string, string | number>,
) => string

export interface AdminI18nValue {
  locale: AdminLocale
  setLocale: (locale: AdminLocale) => void
  t: AdminTranslate
}

const storageKey = 'jamozy.admin.locale'
export const defaultAdminLocale: AdminLocale = 'en'

export function readStoredAdminLocale(): AdminLocale {
  try {
    const stored = window.localStorage.getItem(storageKey)
    return (
      adminLocales.find((locale) => locale === stored) ?? defaultAdminLocale
    )
  } catch {
    return defaultAdminLocale
  }
}

export function storeAdminLocale(locale: AdminLocale): void {
  try {
    window.localStorage.setItem(storageKey, locale)
  } catch {
    // Preference is best-effort; the UI still switches for this visit.
  }
}

export function createAdminTranslate(locale: AdminLocale): AdminTranslate {
  const dictionary = adminDictionaries[locale]
  return (key, params) =>
    dictionary[key].replace(/\{(\w+)\}/g, (match, name: string) =>
      params && name in params ? String(params[name]) : match,
    )
}

export const AdminI18nContext = createContext<AdminI18nValue>({
  locale: defaultAdminLocale,
  setLocale: () => undefined,
  t: createAdminTranslate(defaultAdminLocale),
})

export function useAdminTranslation(): AdminI18nValue {
  return useContext(AdminI18nContext)
}

export function statusKey(status: ContentStatus | undefined): AdminMessageKey {
  return `status.${status ?? 'draft'}`
}

export function formatAdminError(
  t: AdminTranslate,
  error: AdminMessageKey,
  detail?: string,
): string {
  return detail ? `${t(error)} ${detail}` : t(error)
}
