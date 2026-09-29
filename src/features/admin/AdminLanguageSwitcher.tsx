import { adminLocales } from './i18n/dictionaries'
import { useAdminTranslation } from './i18n/admin-i18n'

export function AdminLanguageSwitcher() {
  const { locale, setLocale, t } = useAdminTranslation()
  return (
    <div
      role="group"
      aria-label={t('language.label')}
      className="flex items-center gap-2 text-sm"
    >
      <span className="font-semibold text-[#8b7d72]">
        {t('language.label')}
      </span>
      <div className="inline-flex rounded-full border border-[#eadfd4] bg-white/90 p-0.5">
        {adminLocales.map((option) => (
          <button
            key={option}
            type="button"
            aria-pressed={locale === option}
            onClick={() => setLocale(option)}
            className={`rounded-full px-3 py-1 font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#bc6c5d] ${
              locale === option
                ? 'bg-[#a85d4e] text-white'
                : 'text-[#39465b] hover:text-[#8d4c43]'
            }`}
          >
            {t(`language.${option}`)}
          </button>
        ))}
      </div>
    </div>
  )
}
