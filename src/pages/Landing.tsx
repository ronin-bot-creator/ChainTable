import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'

export default function Landing() {
  const { t } = useTranslation()

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-blue-950 flex flex-col items-center justify-center text-center p-4 relative overflow-hidden">
      {/* Animated Background */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl animate-pulse" />
        <div
          className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl animate-pulse"
          style={{ animationDelay: '1.5s' }}
        />
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-yellow-500/5 rounded-full blur-3xl" />
      </div>

      {/* Decorative icons */}
      <div className="absolute top-20 left-12 text-6xl opacity-20 animate-bounce">🃏</div>
      <div className="absolute bottom-24 right-20 text-6xl opacity-20 animate-bounce">🃏</div>

      <div className="relative z-10 max-w-4xl mx-auto">
        <div className="flex justify-between items-start mb-8">
          <div className="text-left">
            <h1 className="text-6xl md:text-7xl font-extrabold mb-2 bg-gradient-to-r from-yellow-400 via-orange-400 to-red-500 bg-clip-text text-transparent">
              {t('title')}
            </h1>
            <p className="text-xl md:text-2xl max-w-3xl mx-auto text-gray-300 font-medium leading-relaxed">
              {t('tagline_line1', { game: t('tagline_game') })}
            </p>
            <p className="text-base md:text-lg mt-4 max-w-2xl mx-auto text-gray-400 leading-relaxed">
              {t('tagline_line2')}
            </p>
          </div>

          <div className="ml-6" />
        </div>

        {/* Features Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12 animate-fade-in">
          <div className="bg-gradient-to-br from-blue-800/20 to-blue-900/20 backdrop-blur-sm p-6 rounded-2xl border border-blue-700/30 hover:border-blue-500/50 transition-all hover:scale-105">
            <div className="text-4xl mb-3">🌍</div>
            <h3 className="text-white font-bold mb-2">{t('features_public')}</h3>
            <p className="text-gray-400 text-sm">{t('trust_secure')}</p>
          </div>

          <div className="bg-gradient-to-br from-purple-800/20 to-purple-900/20 backdrop-blur-sm p-6 rounded-2xl border border-purple-700/30 hover:border-purple-500/50 transition-all hover:scale-105">
            <div className="text-4xl mb-3">🔒</div>
            <h3 className="text-white font-bold mb-2">{t('features_private')}</h3>
            <p className="text-gray-400 text-sm">{t('trust_multi')}</p>
          </div>

          <div className="bg-gradient-to-br from-yellow-700/20 to-red-700/20 backdrop-blur-sm p-6 rounded-2xl border border-yellow-700/30 hover:border-yellow-500/50 transition-all hover:scale-105">
            <div className="text-4xl mb-3">💰</div>
            <h3 className="text-white font-bold mb-2">{t('features_paid')}</h3>
            <p className="text-gray-400 text-sm">{t('trust_no_middle')}</p>
          </div>
        </div>

        {/* CTA Button */}
        <div className="animate-fade-in">
          <Link to="/auth" className="inline-block group relative">
            <div className="absolute inset-0 bg-gradient-to-r from-yellow-400 to-orange-500 rounded-2xl blur-xl group-hover:blur-2xl transition-all opacity-75 group-hover:opacity-100" />
            <button className="relative bg-gradient-to-r from-yellow-400 to-orange-500 text-black font-bold px-12 py-4 rounded-2xl text-lg hover:scale-105 active:scale-100 transition-all duration-300 shadow-2xl flex items-center gap-3">
              <span className="text-2xl">🎮</span>
              <span>{t('play_now')}</span>
              <span className="text-xl group-hover:translate-x-1 transition-transform">→</span>
            </button>
          </Link>
        </div>

        {/* Trust Indicators */}
        <div className="mt-16 flex flex-wrap items-center justify-center gap-6 text-sm text-gray-500 animate-fade-in">
          <div className="flex items-center gap-2">
            <span className="text-green-400">✓</span>
            <span>{t('trust_secure')}</span>
          </div>
          <div className="hidden md:block w-1 h-1 bg-gray-600 rounded-full" />
          <div className="flex items-center gap-2">
            <span className="text-blue-400">✓</span>
            <span>{t('trust_multi')}</span>
          </div>
          <div className="hidden md:block w-1 h-1 bg-gray-600 rounded-full" />
          <div className="flex items-center gap-2">
            <span className="text-purple-400">✓</span>
            <span>{t('trust_no_middle')}</span>
          </div>
        </div>
      </div>
    </div>
  )
}
