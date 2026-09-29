import { useMemo, useState, type PropsWithChildren } from 'react'
import {
  AdminI18nContext,
  createAdminTranslate,
  readStoredAdminLocale,
  storeAdminLocale,
  type AdminLocale,
} from './admin-i18n'

export function AdminI18nProvider({ children }: PropsWithChildren) {
  const [locale, setLocaleState] = useState(readStoredAdminLocale)
  const value = useMemo(
    () => ({
      locale,
      setLocale: (next: AdminLocale) => {
        storeAdminLocale(next)
        setLocaleState(next)
      },
      t: createAdminTranslate(locale),
    }),
    [locale],
  )
  return (
    <AdminI18nContext.Provider value={value}>
      <div lang={locale}>{children}</div>
    </AdminI18nContext.Provider>
  )
}
