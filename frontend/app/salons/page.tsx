'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { ArrowRight, ExternalLink, Images } from 'lucide-react'

import { AppNav } from '@/components/AppNav'
import { useLanguage } from '@/lib/useLanguage'
import { isAuthSessionActive } from '@/services/auth'
import { getPublicSalons, type PublicSalon } from '@/services/salon'

const pageLabels = {
  ja: {
    title: 'Salon選択',
    subtitle: '登録済みのSalonから、紹介画像と得意なヘアスタイルを確認して予約へ進めます。',
    styles: '登録ヘアスタイル',
    choose: 'このSalonを選択',
    homepage: 'ホームページ',
    empty: '表示できるSalonがまだありません',
    noImages: '紹介画像なし',
  },
  en: {
    title: 'Select Salon',
    subtitle: 'Review registered salons, their intro images, and their hairstyle portfolio before booking.',
    styles: 'hairstyles',
    choose: 'Choose this salon',
    homepage: 'Homepage',
    empty: 'No salons are available yet',
    noImages: 'No intro images',
  },
  zh: {
    title: '选择 Salon',
    subtitle: '查看已登录 Salon 的介绍图片和上传发型，选择后预约。',
    styles: '个发型',
    choose: '选择此 Salon',
    homepage: '主页',
    empty: '还没有可显示的 Salon',
    noImages: '暂无介绍图片',
  },
} as const

type TextKey = keyof typeof pageLabels

export default function SalonsPage() {
  const pathname = usePathname()
  const router = useRouter()
  const { language } = useLanguage()
  const t = pageLabels[language as TextKey] ?? pageLabels.ja
  const [salons, setSalons] = useState<PublicSalon[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!isAuthSessionActive('customer')) {
      router.replace(`/login?redirect=${encodeURIComponent(pathname)}`)
      return
    }

    getPublicSalons()
      .then(setSalons)
      .catch((error) => {
        console.error('Failed to load salons', error)
      })
      .finally(() => setLoading(false))
  }, [pathname, router])

  return (
    <main className="min-h-screen bg-[#eef2f6] text-[#17202f]">
      <header className="border-b border-[#d9e0ea] bg-white">
        <div className="mx-auto max-w-[1280px] px-4 py-4 lg:px-6">
          <AppNav />
        </div>
      </header>

      <section className="mx-auto max-w-[1280px] px-4 py-6 lg:px-6">
        <div className="mb-6">
          <h1 className="text-3xl font-semibold md:text-4xl">{t.title}</h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-[#667085]">{t.subtitle}</p>
        </div>

        {loading ? (
          <div className="text-sm text-[#667085]">Loading...</div>
        ) : salons.length ? (
          <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {salons.map((salon) => (
              <SalonCard key={salon.id} salon={salon} labels={t} />
            ))}
          </div>
        ) : (
          <div className="flex min-h-56 items-center justify-center rounded-md border border-dashed border-[#c8d1de] bg-white text-sm text-[#667085]">
            {t.empty}
          </div>
        )}
      </section>
    </main>
  )
}

function SalonCard({
  salon,
  labels,
}: {
  salon: PublicSalon
  labels: (typeof pageLabels)[TextKey]
}) {
  const [activeIndex, setActiveIndex] = useState(0)
  const slides = useMemo(() => orderedIntroImages(salon), [salon])
  const activeImage = slides[activeIndex] ?? null

  return (
    <article className="overflow-hidden rounded-md border border-[#d9e0ea] bg-white">
      <Link href={`/salons/${salon.id}`} className="block">
        <div className="relative aspect-[4/3] bg-[#f8fafc]">
          {activeImage ? (
            <img src={activeImage} alt={salon.name} className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full items-center justify-center gap-2 text-sm text-[#667085]">
              <Images className="h-4 w-4" />
              {labels.noImages}
            </div>
          )}
        </div>
      </Link>

      {slides.length > 1 && (
        <div className="flex gap-2 overflow-x-auto border-b border-[#e6ebf2] p-3">
          {slides.map((image, index) => (
            <button
              key={image}
              type="button"
              onClick={() => setActiveIndex(index)}
              className={`h-14 w-20 shrink-0 overflow-hidden rounded border ${
                activeIndex === index ? 'border-[#2f6fed] ring-2 ring-[#dbe8ff]' : 'border-[#d9e0ea]'
              }`}
            >
              <img src={image} alt="" className="h-full w-full object-cover" />
            </button>
          ))}
        </div>
      )}

      <div className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="truncate text-xl font-semibold">{salon.name}</h2>
            <p className="mt-1 text-sm text-[#667085]">
              {salon.specialtyImages.length} {labels.styles}
            </p>
          </div>
          {salon.homepageUrl && (
            <a
              href={salon.homepageUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex shrink-0 items-center gap-1 text-sm font-medium text-teal-700"
            >
              <ExternalLink className="h-4 w-4" />
              {labels.homepage}
            </a>
          )}
        </div>

        <Link
          href={`/salons/${salon.id}`}
          className="mt-5 inline-flex h-10 w-full items-center justify-center gap-2 rounded-md bg-[#17202f] px-4 text-sm font-semibold text-white transition hover:bg-[#0f1724]"
        >
          {labels.choose}
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    </article>
  )
}

function orderedIntroImages(salon: PublicSalon) {
  const images = salon.introImages
  if (!salon.mainIntroImageUrl) {
    return images
  }

  return [
    salon.mainIntroImageUrl,
    ...images.filter((image) => image !== salon.mainIntroImageUrl),
  ]
}
