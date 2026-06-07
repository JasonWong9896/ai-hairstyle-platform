'use client'

import { languages } from '@/lib/i18n'
import { useLanguage } from '@/lib/useLanguage'

export function LanguageSwitcher({ className = '' }: { className?: string }) {
  const { language, setLanguage } = useLanguage()

  return (
    <div className={`flex rounded-md border border-[#dfe3eb] bg-[#f8fafc] p-1 shadow-sm ${className}`}>
      {languages.map((item) => (
        <button
          key={item.code}
          type="button"
          onClick={() => setLanguage(item.code)}
          className={`rounded px-3 py-1.5 text-sm font-semibold transition ${
            language === item.code
              ? 'bg-white text-[#2f80ed] shadow-sm'
              : 'text-[#667085] hover:bg-white/70 hover:text-[#263244]'
          }`}
        >
          {item.label}
        </button>
      ))}
    </div>
  )
}
