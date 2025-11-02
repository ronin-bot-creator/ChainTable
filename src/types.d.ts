declare module '@rainbow-me/rainbowkit';

// Deep import for RainbowKit locales (not exported via package.json exports)
declare module '@rainbow-me/rainbowkit/dist/locales' {
	export type Locale =
		| 'ar' | 'ar-AR' | 'de' | 'de-DE' | 'en' | 'en-US' | 'es' | 'es-419'
		| 'fr' | 'fr-FR' | 'hi' | 'hi-IN' | 'id' | 'id-ID' | 'ja' | 'ja-JP'
		| 'ko' | 'ko-KR' | 'ms' | 'ms-MY' | 'pt' | 'pt-BR' | 'ru' | 'ru-RU'
		| 'th' | 'th-TH' | 'tr' | 'tr-TR' | 'ua' | 'uk-UA' | 'vi' | 'vi-VN'
		| 'zh' | 'zh-CN' | 'zh-HK' | 'zh-TW' | 'zh-Hans' | 'zh-Hant';

	export function setLocale(locale: Locale): Promise<void>;
}
