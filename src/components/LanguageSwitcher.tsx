import { useTranslation } from 'react-i18next'

export default function LanguageSwitcher() {
  const { i18n, t } = useTranslation()

  const toggleLanguage = () => {
    const next = i18n.language === 'es' ? 'en' : 'es'
    i18n.changeLanguage(next)
    try {
      localStorage.setItem('i18nextLng', next)
    } catch {}
  }

  // Show current language (ES/EN) — not the target language.
  const current = (i18n.language || 'es').slice(0, 2).toUpperCase()

  return (
    <button
      onClick={toggleLanguage}
      aria-label={t('change_language')}
      className="fixed top-4 right-4 z-50 bg-slate-800/80 text-gray-100 px-3 py-2 rounded-md shadow-md hover:opacity-90 transition"
    >
      {current}
    </button>
  )
}
