'use client'

import { ChangeEvent, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ChevronLeft, ChevronRight } from 'lucide-react'

import { AppNav } from '@/components/AppNav'
import { HairstyleImage } from '@/components/hairstyle/HairstyleImage'
import {
  type Hairstyle,
  type HairstyleGender,
} from '@/lib/hairstyleCatalog'
import { copy } from '@/lib/i18n'
import { useLanguage } from '@/lib/useLanguage'
import { isAuthSessionActive } from '@/services/auth'
import { api } from '@/services/api'
import { getMemberWallet } from '@/services/member'
import { getPublicSalonHairstyles, toSalonHairstyles } from '@/services/salon'
import { useAppStore } from '@/store/appStore'

type UploadSlot = 'customer'
type TextKey = 'ja' | 'en' | 'zh'

const uploadPageText = {
  ja: {
    gender: {
      women: '女性',
      men: '男性',
    },
    selected: '選択済み',
    selectReference: '参考ヘアスタイルを選択してください',
    sampleStyles: 'サンプルヘアスタイル',
    moreStyles: 'もっと見る',
    selectedStyleAlt: '選択済みの参考ヘアスタイル',
    sampleStyleAlt: 'サンプルヘアスタイル',
  },
  en: {
    gender: {
      women: 'Women',
      men: 'Men',
    },
    selected: 'Selected',
    selectReference: 'Choose a reference hairstyle',
    sampleStyles: 'Sample Hairstyles',
    moreStyles: 'More Styles',
    selectedStyleAlt: 'Selected reference hairstyle',
    sampleStyleAlt: 'Sample hairstyle',
  },
  zh: {
    gender: {
      women: '女生',
      men: '男生',
    },
    selected: '已选择',
    selectReference: '请选择参考发型',
    sampleStyles: '样板发型',
    moreStyles: '更多发型',
    selectedStyleAlt: '已选择的参考发型',
    sampleStyleAlt: '样板发型',
  },
} as const

const localizedUploadPageText = {
  ja: {
    gender: {
      women: '女性',
      men: '男性',
    },
    selected: '選択済み',
    selectReference: '参考ヘアスタイルを選択してください',
    sampleStyles: 'サンプルヘアスタイル',
    moreStyles: 'もっと見る',
    selectedStyleAlt: '選択済みの参考ヘアスタイル',
    sampleStyleAlt: 'サンプルヘアスタイル',
  },
  en: uploadPageText.en,
  zh: {
    gender: {
      women: '女士',
      men: '男士',
    },
    selected: '已选择',
    selectReference: '请选择参考发型',
    sampleStyles: '示例发型',
    moreStyles: '查看更多',
    selectedStyleAlt: '已选择的参考发型',
    sampleStyleAlt: '示例发型',
  },
} as const

const salonStyleText = {
  ja: {
    bySalon: 'Salon',
    homepage: 'Salon homepage',
  },
  en: {
    bySalon: 'By',
    homepage: 'Salon homepage',
  },
  zh: {
    bySalon: '来自',
    homepage: 'Salon 主页',
  },
} as const

const pointText = {
  ja: {
    balance: '保有ポイント',
    cost: '1回の生成',
    loading: '確認中',
    unit: 'ポイント',
  },
  en: {
    balance: 'Points balance',
    cost: 'Cost per generation',
    loading: 'Checking',
    unit: 'points',
  },
  zh: {
    balance: '当前点数',
    cost: '每次生成扣除',
    loading: '确认中',
    unit: '点',
  },
} as const

const GENERATION_COST = 10

export default function UploadPage() {
  const router = useRouter()
  const { language } = useLanguage()
  const t = copy[language]
  const pageText = localizedUploadPageText[language as TextKey] ?? localizedUploadPageText.zh
  const customerImage = useAppStore((s) => s.customerImage)
  const styleImage = useAppStore((s) => s.styleImage)
  const selectedHairstyle = useAppStore((s) => s.selectedHairstyle)
  const referenceGender = useAppStore((s) => s.referenceGender)
  const setCustomerImage = useAppStore((s) => s.setCustomerImage)
  const setStyleImage = useAppStore((s) => s.setStyleImage)
  const clearStyleImage = useAppStore((s) => s.clearStyleImage)
  const setSelectedHairstyle = useAppStore((s) => s.setSelectedHairstyle)
  const setReferenceGender = useAppStore((s) => s.setReferenceGender)
  const [uploadingSlot, setUploadingSlot] = useState<UploadSlot | null>(null)
  const [error, setError] = useState('')
  const [pointsBalance, setPointsBalance] = useState<number | null>(null)
  const [pointsLoading, setPointsLoading] = useState(true)
  const [salonHairstyles, setSalonHairstyles] = useState<Hairstyle[]>([])

  useEffect(() => {
    if (!isAuthSessionActive('customer')) {
      router.replace('/login?redirect=/upload')
    }
  }, [router])

  useEffect(() => {
    getPublicSalonHairstyles()
      .then((items) => {
        setSalonHairstyles(toSalonHairstyles(items))
      })
      .catch((err) => {
        console.error('Failed to load salon hairstyles', err)
      })
  }, [])

  useEffect(() => {
    let active = true

    getMemberWallet()
      .then((data) => {
        if (active) {
          setPointsBalance(data.wallet.pointsBalance)
        }
      })
      .catch((err) => {
        const status = err?.response?.status
        if (status === 401 || status === 403) {
          router.replace('/login?redirect=/upload')
        }
      })
      .finally(() => {
        if (active) {
          setPointsLoading(false)
        }
      })

    return () => {
      active = false
    }
  }, [router])

  const uploadImage = async (file?: File) => {
    if (!file) return

    setError('')
    setUploadingSlot('customer')

    try {
      const formData = new FormData()
      formData.append('file', file)

      const res = await api.post('/upload', formData)
      setCustomerImage(res.data.imageUrl)
    } catch (err) {
      console.error(err)
      setError(t.upload.uploadError)
    } finally {
      setUploadingSlot(null)
    }
  }

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    uploadImage(event.target.files?.[0])
    event.target.value = ''
  }

  const handleGenderChange = (gender: HairstyleGender) => {
    if (gender !== referenceGender) {
      clearStyleImage()
    }

    setReferenceGender(gender)
  }

  const handleStyleSelect = (style: Hairstyle) => {
    setReferenceGender(style.gender)
    setSelectedHairstyle(style.id)
    setStyleImage(style.image, { id: style.salonId, name: style.salonName })
  }

  const referenceSalonStyles = salonHairstyles.filter((style) => style.gender === referenceGender)
  const sampleStyles = referenceSalonStyles.slice(0, 10)
  const hasMoreStyles = referenceSalonStyles.length > 10
  const canPreview = Boolean(customerImage && styleImage && !uploadingSlot)

  return (
    <main className="min-h-screen bg-zinc-50 px-6 py-8 text-zinc-950">
      <section className="mx-auto flex max-w-6xl flex-col gap-8">
        <AppNav />

        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-semibold">{t.upload.title}</h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-zinc-600">{t.upload.description}</p>
          </div>

          <PointSummary
            balance={pointsBalance}
            loading={pointsLoading}
            cost={GENERATION_COST}
            language={language as TextKey}
          />
        </div>

        <div className="grid gap-5 lg:grid-cols-[minmax(280px,420px)_1fr]">
          <CustomerUploadCard
            title={t.upload.customerTitle}
            description={t.upload.customerDescription}
            imageUrl={customerImage}
            loading={uploadingSlot === 'customer'}
            loadingText={t.upload.uploading}
            chooseText={t.upload.chooseImage}
            inputId="customer-image"
            onChange={handleFileChange}
          />

          <StylePickerCard
            title={t.upload.styleTitle}
            description={t.upload.styleDescription}
            selectedGender={referenceGender}
            selectedStyleId={selectedHairstyle}
            selectedImage={styleImage}
            labels={pageText}
            salonLabels={salonStyleText[language as TextKey] ?? salonStyleText.zh}
            sampleStyles={sampleStyles}
            hasMoreStyles={hasMoreStyles}
            onGenderChange={handleGenderChange}
            onStyleSelect={handleStyleSelect}
            onMoreStyles={() => router.push('/hairstyles?source=upload&salonOnly=1')}
          />
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <div className="flex justify-end">
          <button
            type="button"
            disabled={!canPreview}
            onClick={() => router.push('/preview?generate=1')}
            className="rounded-md bg-zinc-950 px-5 py-3 text-sm font-medium text-white disabled:cursor-not-allowed disabled:bg-zinc-300"
          >
            {t.upload.generate}
          </button>
        </div>
      </section>
    </main>
  )
}

function CustomerUploadCard({
  title,
  description,
  imageUrl,
  loading,
  loadingText,
  chooseText,
  inputId,
  onChange,
}: {
  title: string
  description: string
  imageUrl: string | null
  loading: boolean
  loadingText: string
  chooseText: string
  inputId: string
  onChange: (event: ChangeEvent<HTMLInputElement>) => void
}) {
  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-4">
      <div className="mb-4">
        <h2 className="text-base font-semibold">{title}</h2>
        <p className="mt-1 text-sm leading-5 text-zinc-600">{description}</p>
      </div>

      <label
        htmlFor={inputId}
        className="flex aspect-[4/5] cursor-pointer items-center justify-center overflow-hidden rounded-md border border-dashed border-zinc-300 bg-zinc-50 text-center text-sm text-zinc-500"
      >
        {imageUrl ? (
          <img src={imageUrl} alt={title} className="h-full w-full object-cover" />
        ) : (
          <span>{loading ? loadingText : chooseText}</span>
        )}
      </label>

      <input id={inputId} type="file" accept="image/*" onChange={onChange} className="sr-only" />
    </div>
  )
}

function PointSummary({
  balance,
  loading,
  cost,
  language,
}: {
  balance: number | null
  loading: boolean
  cost: number
  language: TextKey
}) {
  const labels = pointText[language] ?? pointText.zh

  return (
    <div className="flex flex-wrap gap-3">
      <div className="rounded-lg border border-zinc-200 bg-white px-4 py-3 text-sm shadow-sm">
        <div className="text-zinc-500">{labels.balance}</div>
        <div className="mt-1 text-2xl font-semibold">
          {loading || balance === null ? labels.loading : formatPoints(balance, language, labels.unit)}
        </div>
      </div>
      <div className="rounded-lg border border-zinc-200 bg-white px-4 py-3 text-sm shadow-sm">
        <div className="text-zinc-500">{labels.cost}</div>
        <div className="mt-1 text-2xl font-semibold">{formatPoints(cost, language, labels.unit)}</div>
      </div>
    </div>
  )
}

function StylePickerCard({
  title,
  description,
  selectedGender,
  selectedStyleId,
  selectedImage,
  labels,
  salonLabels,
  sampleStyles,
  hasMoreStyles,
  onGenderChange,
  onStyleSelect,
  onMoreStyles,
}: {
  title: string
  description: string
  selectedGender: HairstyleGender
  selectedStyleId: number | null
  selectedImage: string | null
  labels: (typeof localizedUploadPageText)[TextKey]
  salonLabels: (typeof salonStyleText)[TextKey]
  sampleStyles: Hairstyle[]
  hasMoreStyles: boolean
  onGenderChange: (gender: HairstyleGender) => void
  onStyleSelect: (style: Hairstyle) => void
  onMoreStyles: () => void
}) {
  const sliderRef = useRef<HTMLDivElement>(null)

  const scrollSamples = (direction: 'left' | 'right') => {
    const slider = sliderRef.current
    if (!slider) return

    const cardWidth = slider.querySelector('button')?.getBoundingClientRect().width ?? 128
    const gap = 12
    const distance = cardWidth + gap

    slider.scrollBy({
      left: direction === 'left' ? -distance : distance,
      behavior: 'smooth',
    })
  }

  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-4">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-base font-semibold">{title}</h2>
          <p className="mt-1 max-w-2xl text-sm leading-5 text-zinc-600">{description}</p>
        </div>
        <div className="flex gap-2">
          {(['women', 'men'] as const).map((gender) => {
            const isActive = selectedGender === gender

            return (
              <button
                key={gender}
                type="button"
                className={`rounded-md border px-4 py-2 text-sm font-semibold transition ${
                  isActive
                    ? 'border-zinc-950 bg-zinc-950 text-white'
                    : 'border-zinc-300 bg-white text-zinc-700 hover:border-zinc-500'
                }`}
                onClick={() => onGenderChange(gender)}
              >
                {labels.gender[gender]}
              </button>
            )
          })}
        </div>
      </div>

      <div className="mb-4 grid gap-4 md:grid-cols-[140px_1fr]">
        <div>
          <div className="mb-2 text-sm font-medium text-zinc-700">{labels.selected}</div>
          <div className="aspect-[4/5] overflow-hidden rounded-md border border-zinc-200 bg-zinc-50">
            {selectedImage ? (
              <HairstyleImage
                src={selectedImage}
                alt={labels.selectedStyleAlt}
                width={280}
                height={350}
                sizes="140px"
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="flex h-full items-center justify-center px-4 text-center text-sm text-zinc-500">
                {labels.selectReference}
              </div>
            )}
          </div>
        </div>

        <div className="min-w-0">
          <div className="mb-2 text-sm font-medium text-zinc-700">
            {labels.gender[selectedGender]} {labels.sampleStyles}
          </div>
          <div className="relative">
            <button
              type="button"
              aria-label="Previous styles"
              className="absolute left-2 top-1/2 z-10 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-zinc-200 bg-white/95 text-zinc-800 shadow-sm hover:border-zinc-500"
              onClick={() => scrollSamples('left')}
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <div ref={sliderRef} className="no-scrollbar flex snap-x gap-3 overflow-x-auto scroll-smooth px-1 py-1">
              {sampleStyles.length ? sampleStyles.map((style, index) => {
                const isSelected = selectedStyleId === style.id || selectedImage === style.image

                return (
                  <button
                    key={style.id}
                    type="button"
                    className={`w-32 shrink-0 snap-start overflow-hidden rounded-md border bg-white text-left transition ${
                      isSelected ? 'border-emerald-700 ring-2 ring-emerald-100' : 'border-zinc-200 hover:border-zinc-400'
                    }`}
                    onClick={() => onStyleSelect(style)}
                  >
                    <div className="aspect-[4/5] overflow-hidden bg-zinc-100">
                      <HairstyleImage
                        src={style.image}
                        alt={`${labels.gender[style.gender]} ${labels.sampleStyleAlt} ${index + 1}`}
                        width={240}
                        height={300}
                        sizes="128px"
                        className="h-full w-full object-cover"
                      />
                    </div>
                    <div className="px-3 py-2 text-xs font-medium text-zinc-700">
                      Salon {index + 1}
                      {style.salonName && (
                        <span className="mt-1 block truncate text-[11px] font-normal text-zinc-500">
                          {salonLabels.bySalon} {style.salonName}
                        </span>
                      )}
                    </div>
                  </button>
                )
              }) : (
                <div className="flex min-h-40 flex-1 items-center justify-center rounded-md border border-dashed border-zinc-200 bg-zinc-50 px-4 text-center text-sm text-zinc-500">
                  {labels.selectReference}
                </div>
              )}
            </div>
            <button
              type="button"
              aria-label="Next styles"
              className="absolute right-2 top-1/2 z-10 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-zinc-200 bg-white/95 text-zinc-800 shadow-sm hover:border-zinc-500"
              onClick={() => scrollSamples('right')}
            >
              <ChevronRight className="h-5 w-5" />
            </button>
          </div>
        </div>
      </div>

      {hasMoreStyles && (
        <div className="flex justify-end">
          <button
            type="button"
            onClick={onMoreStyles}
            className="rounded-md border border-zinc-300 bg-white px-4 py-2 text-sm font-semibold text-zinc-800 hover:border-zinc-500"
          >
            {labels.moreStyles}
          </button>
        </div>
      )}
    </div>
  )
}

function formatPoints(value: number, language: TextKey, unit: string) {
  return `${new Intl.NumberFormat(localeFor(language)).format(value)} ${unit}`
}

function localeFor(language: TextKey) {
  if (language === 'ja') return 'ja-JP'
  if (language === 'zh') return 'zh-CN'
  return 'en-US'
}
