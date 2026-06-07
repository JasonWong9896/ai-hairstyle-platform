'use client'

import { useEffect, useState } from 'react'

import { defaultLanguage, Language } from './i18n'

const languageKey = 'preferredLanguage'

function isLanguage(value: string | null): value is Language {
  return value === 'ja' || value === 'en' || value === 'zh'
}

export function useLanguage() {
  const [language, setLanguageState] = useState<Language>(defaultLanguage)

  useEffect(() => {
    const saved = localStorage.getItem(languageKey)
    if (isLanguage(saved)) {
      setLanguageState(saved)
    }
  }, [])

  const setLanguage = (nextLanguage: Language) => {
    localStorage.setItem(languageKey, nextLanguage)
    setLanguageState(nextLanguage)
    window.dispatchEvent(new CustomEvent('languagechange', { detail: nextLanguage }))
  }

  useEffect(() => {
    const handleLanguageChange = (event: Event) => {
      const nextLanguage = (event as CustomEvent<Language>).detail
      if (isLanguage(nextLanguage)) {
        setLanguageState(nextLanguage)
      }
    }

    window.addEventListener('languagechange', handleLanguageChange)
    return () => window.removeEventListener('languagechange', handleLanguageChange)
  }, [])

  return { language, setLanguage }
}
