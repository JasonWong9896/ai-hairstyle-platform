'use client'

import { MouseEvent, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ExternalLink } from 'lucide-react'

import { AppNav } from '@/components/AppNav'
import { HairstyleImage } from '@/components/hairstyle/HairstyleImage'
import {
  hairstyleCategoryLabels,
  hairstyleCategoryLabel,
  type Hairstyle,
  type HairstyleCategoryKey,
  type HairstyleGender,
} from '@/lib/hairstyleCatalog'
import { getPublicSalonHairstyles, toSalonHairstyles } from '@/services/salon'
import { isAuthSessionActive } from '@/services/auth'
import { useLanguage } from '@/lib/useLanguage'
import { useAppStore } from '@/store/appStore'

type TextKey = 'ja' | 'en' | 'zh'

const text = {
  ja: {
    title: 'ヘアスタイルを選択',
    subtitle: '女性または男性を選び、希望に近い髪型カテゴリで絞り込んでください。',
    gender: {
      women: '女性',
      men: '男性',
    },
    count: '件',
    choose: 'この髪型を選ぶ',
    empty: 'Salonがアップロードしたヘアスタイル画像はまだありません。',
  },
  en: {
    title: 'Choose a Hairstyle',
    subtitle: 'Choose from hairstyle images uploaded by partner salons.',
    gender: {
      women: 'Women',
      men: 'Men',
    },
    count: 'styles',
    choose: 'Choose this style',
    empty: 'No salon-uploaded hairstyle images are available yet.',
  },
  zh: {
    title: '选择发型',
    subtitle: '这里只显示合作 Salon 上传的发型图片。',
    gender: {
      women: '女士',
      men: '男士',
    },
    count: '款发型',
    choose: '选择这个发型',
    empty: '目前还没有 Salon 上传的发型图片。',
  },
} as const

const salonText = {
  ja: {
    bySalon: 'Salon',
    salonHomepage: 'Salon homepage',
  },
  en: {
    bySalon: 'By',
    salonHomepage: 'Salon homepage',
  },
  zh: {
    bySalon: '来自',
    salonHomepage: 'Salon 主页',
  },
} as const

export function HairstylesClient() {
  const router = useRouter()
  const { language } = useLanguage()
  const labels = text[language as TextKey] ?? text.zh
  const salonLabels = salonText[language as TextKey] ?? salonText.zh
  const categoryLabels = hairstyleCategoryLabels[language as TextKey] ?? hairstyleCategoryLabels.zh
  const referenceGender = useAppStore((s) => s.referenceGender)
  const setSelectedHairstyle = useAppStore((s) => s.setSelectedHairstyle)
  const setStyleImage = useAppStore((s) => s.setStyleImage)
  const setReferenceGender = useAppStore((s) => s.setReferenceGender)

  const [selectedGender, setSelectedGender] = useState<HairstyleGender>(referenceGender)
  const [selectedCategory, setSelectedCategory] = useState<HairstyleCategoryKey>('salon')
  const [salonHairstyles, setSalonHairstyles] = useState<Hairstyle[]>([])

  useEffect(() => {
    if (!isAuthSessionActive('customer')) {
      router.replace('/login?redirect=/hairstyles')
    }
  }, [router])

  const activeCategories = ['salon'] as const
  const visibleHairstyles = salonHairstyles.filter(
    (style) => style.gender === selectedGender && style.category === selectedCategory,
  )

  useEffect(() => {
    getPublicSalonHairstyles()
      .then((items) => {
        setSalonHairstyles(toSalonHairstyles(items))
      })
      .catch((error) => {
        console.error('Failed to load salon hairstyles', error)
      })
  }, [])

  const handleGenderChange = (gender: HairstyleGender) => {
    setSelectedGender(gender)
    setReferenceGender(gender)
    setSelectedCategory('salon')
  }

  const handleSelect = (style: Hairstyle) => {
    setReferenceGender(style.gender)
    setSelectedHairstyle(style.id)
    setStyleImage(style.image, { id: style.salonId, name: style.salonName })
    router.push('/upload')
  }

  return (
    <main className="min-h-screen bg-zinc-50 px-6 py-8 text-zinc-950">
      <section className="mx-auto flex max-w-7xl flex-col gap-8">
        <AppNav />

        <div className="flex flex-col gap-3">
          <h1 className="text-3xl font-semibold md:text-4xl">{labels.title}</h1>
          <p className="max-w-2xl text-sm leading-6 text-zinc-600">{labels.subtitle}</p>
        </div>

        <div className="flex flex-wrap gap-3">
          {(['women', 'men'] as const).map((gender) => {
            const isActive = selectedGender === gender

            return (
              <button
                key={gender}
                type="button"
                className={`rounded-md border px-5 py-2 text-sm font-semibold transition ${
                  isActive
                    ? 'border-zinc-950 bg-zinc-950 text-white'
                    : 'border-zinc-300 bg-white text-zinc-700 hover:border-zinc-500'
                }`}
                onClick={() => handleGenderChange(gender)}
              >
                {labels.gender[gender]}
              </button>
            )
          })}
        </div>

        <div className="flex flex-wrap gap-2">
          {activeCategories.map((category) => {
            const isActive = selectedCategory === category

            return (
              <button
                key={category}
                type="button"
                className={`rounded-full border px-4 py-2 text-sm transition ${
                  isActive
                    ? 'border-emerald-700 bg-emerald-50 text-emerald-900'
                    : 'border-zinc-200 bg-white text-zinc-600 hover:border-zinc-400'
                }`}
                onClick={() => setSelectedCategory(category)}
              >
                {hairstyleCategoryLabel(categoryLabels, category)}
              </button>
            )
          })}
        </div>

        <div className="flex items-center justify-between gap-4 border-b border-zinc-200 pb-3">
          <h2 className="text-xl font-semibold">{hairstyleCategoryLabel(categoryLabels, selectedCategory)}</h2>
          <span className="text-sm text-zinc-500">
            {visibleHairstyles.length} {labels.count}
          </span>
        </div>

        {visibleHairstyles.length ? (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {visibleHairstyles.map((style, index) => (
            <div
              key={style.id}
              role="button"
              tabIndex={0}
              className="group overflow-hidden rounded-lg border border-zinc-200 bg-white text-left shadow-sm transition hover:-translate-y-0.5 hover:border-zinc-400 hover:shadow-md"
              onClick={() => handleSelect(style)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault()
                  handleSelect(style)
                }
              }}
            >
              <div className="aspect-[4/5] overflow-hidden bg-zinc-100">
                <HairstyleImage
                  src={style.image}
                  alt={`${hairstyleCategoryLabel(categoryLabels, selectedCategory)} ${index + 1}`}
                  width={420}
                  height={525}
                  sizes="(min-width: 1024px) 25vw, (min-width: 640px) 50vw, 100vw"
                  className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
                />
              </div>
              <div className="flex items-center justify-between gap-3 p-4">
                <div className="min-w-0">
                  <div className="text-sm text-zinc-500">{labels.gender[style.gender]}</div>
                  <div className="mt-1 text-base font-semibold">
                    {hairstyleCategoryLabel(categoryLabels, selectedCategory)} {index + 1}
                  </div>
                  {style.salonName && (
                    <div className="mt-2 text-xs text-zinc-500">
                      {salonLabels.bySalon} <span className="font-medium text-zinc-700">{style.salonName}</span>
                      {style.salonHomepageUrl && (
                        <a
                          href={style.salonHomepageUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="ml-2 inline-flex items-center gap-1 text-teal-700 hover:text-teal-900"
                          onClick={(event: MouseEvent<HTMLAnchorElement>) => event.stopPropagation()}
                          aria-label={salonLabels.salonHomepage}
                        >
                          <ExternalLink className="h-3.5 w-3.5" />
                          {salonLabels.salonHomepage}
                        </a>
                      )}
                    </div>
                  )}
                </div>
                <span className="shrink-0 rounded-md bg-zinc-950 px-3 py-2 text-xs font-semibold text-white">
                  {labels.choose}
                </span>
              </div>
            </div>
            ))}
          </div>
        ) : (
          <div className="flex min-h-48 items-center justify-center rounded-lg border border-dashed border-zinc-300 bg-white px-4 text-center text-sm text-zinc-500">
            {labels.empty}
          </div>
        )}
      </section>
    </main>
  )
}
