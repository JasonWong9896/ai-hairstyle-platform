'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'

import { AppNav } from '@/components/AppNav'
import { useLanguage } from '@/lib/useLanguage'
import { api } from '@/services/api'
import { authHeaders, isAuthSessionActive } from '@/services/auth'
import { getMemberWallet } from '@/services/member'
import { getPublicSalonHairstyles } from '@/services/salon'
import { useAppStore } from '@/store/appStore'

const inFlightGenerations = new Map<string, Promise<string>>()
const GENERATION_COST = 10

const previewCopy = {
  ja: {
    title: 'AI生成プレビュー',
    description: '左が顧客写真、中央が参考ヘアスタイル、右がAI生成結果です。',
    reselect: '画像を選び直す',
    generate: 'AI画像を生成',
    loading: '生成中です。少々お待ちください...',
    error: '生成に失敗しました。AIサービスが起動しているか確認してください。',
    errorWithDetail: '生成に失敗しました: ',
    customer: '顧客の元画像',
    reference: 'ヘアスタイル参考',
    result: 'AI結果',
    empty: '画像がありません',
    generating: '生成中...',
    findSalon: '近くのサロンを探す',
    bookSalon: 'このSalonを予約する',
    salonStyleBy: 'この発型をアップロードしたSalon',
    points: '保有ポイント',
    cost: '1回の生成',
    pointUnit: 'ポイント',
    loadingPoints: '確認中',
    recharge: 'ポイントをチャージ',
    missingResult: 'AIサービスから画像URLが返りませんでした。',
  },
  en: {
    title: 'AI Generated Preview',
    description: 'The customer photo is on the left, the hairstyle reference is in the center, and the AI result is on the right.',
    reselect: 'Choose Images Again',
    generate: 'Generate AI image',
    loading: 'Generating. Please wait...',
    error: 'Generation failed. Please check whether the AI service is running.',
    errorWithDetail: 'Generation failed: ',
    customer: 'Original Customer Photo',
    reference: 'Hairstyle Reference',
    result: 'AI Result',
    empty: 'No image',
    generating: 'Generating...',
    findSalon: 'Find Nearby Salons',
    bookSalon: 'Book this salon',
    salonStyleBy: 'Salon that uploaded this hairstyle',
    points: 'Points balance',
    cost: 'Cost per generation',
    pointUnit: 'points',
    loadingPoints: 'Checking',
    recharge: 'Recharge points',
    missingResult: 'The AI service did not return an image URL.',
  },
  zh: {
    title: 'AI 生成预览',
    description: '左侧是顾客照片，中间是参考发型，右侧是 AI 生成结果。',
    reselect: '重新选择图片',
    generate: '生成 AI 图片',
    loading: '正在生成，请稍等...',
    error: '生成失败。请确认 AI 服务是否正常启动。',
    errorWithDetail: '生成失败: ',
    customer: '顾客原图',
    reference: '发型参考',
    result: 'AI 结果',
    empty: '暂无图片',
    generating: '生成中...',
    findSalon: '查找附近沙龙',
    bookSalon: '预约这个 Salon',
    salonStyleBy: '上传这张发型的 Salon',
    points: '当前点数',
    cost: '每次生成扣除',
    pointUnit: '点',
    loadingPoints: '确认中',
    recharge: '充值点数',
    missingResult: 'AI 服务没有返回图片地址。',
  },
}

function getErrorMessage(err: unknown) {
  if (
    typeof err === 'object' &&
    err !== null &&
    'response' in err &&
    typeof err.response === 'object' &&
    err.response !== null &&
    'data' in err.response
  ) {
    const data = err.response.data as {
      detail?: string
      message?: string
      error?: string
    }

    return data.detail || data.message || data.error
  }

  return undefined
}

export default function PreviewPage() {
  const router = useRouter()
  const { language } = useLanguage()
  const t = previewCopy[language]
  const customerImage = useAppStore((s) => s.customerImage ?? s.uploadedImage)
  const styleImage = useAppStore((s) => s.styleImage)
  const generatedImage = useAppStore((s) => s.generatedImage)
  const generatedRequestKey = useAppStore((s) => s.generatedRequestKey)
  const selectedSalonId = useAppStore((s) => s.selectedSalonId)
  const selectedSalonName = useAppStore((s) => s.selectedSalonName)
  const referenceGender = useAppStore((s) => s.referenceGender)
  const setGeneratedImage = useAppStore((s) => s.setGeneratedImage)

  const [loading, setLoading] = useState(false)
  const [pointsBalance, setPointsBalance] = useState<number | null>(null)
  const [generationCost, setGenerationCost] = useState(GENERATION_COST)
  const [pointsLoading, setPointsLoading] = useState(true)
  const [error, setError] = useState('')
  const [matchedSalon, setMatchedSalon] = useState<{ id: string; name: string } | null>(null)
  const autoGenerateRequestKey = useRef<string | null>(null)

  useEffect(() => {
    if (!isAuthSessionActive('customer')) {
      router.replace('/login?redirect=/preview')
    }
  }, [router])

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
          router.replace('/login?redirect=/preview')
          return
        }

        if (active) {
          setError(getErrorMessage(err) ?? t.error)
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
  }, [router, t.error])

  useEffect(() => {
    if (selectedSalonId) {
      setMatchedSalon({
        id: selectedSalonId,
        name: selectedSalonName ?? 'Salon',
      })
      return
    }

    if (!styleImage) {
      setMatchedSalon(null)
      return
    }

    let active = true
    getPublicSalonHairstyles()
      .then((items) => {
        if (!active) return

        const match = items.find((item) => item.image === styleImage)
        setMatchedSalon(match ? { id: match.salonId, name: match.salonName } : null)
      })
      .catch((err) => {
        console.error('Failed to match salon hairstyle', err)
        if (active) {
          setMatchedSalon(null)
        }
      })

    return () => {
      active = false
    }
  }, [selectedSalonId, selectedSalonName, styleImage])

  const requestKey = useMemo(() => {
    if (!customerImage || !styleImage) return ''
    return `${customerImage}|${styleImage}`
  }, [customerImage, styleImage])

  const generateAI = useCallback(async (force = false) => {
    if (!customerImage || !styleImage) {
      router.replace('/upload')
      return
    }

    if (!requestKey || (!force && generatedImage && generatedRequestKey === requestKey)) {
      return
    }

    setLoading(true)
    setError('')

    try {
      let request = inFlightGenerations.get(requestKey)

      if (!request) {
        request = api
          .post('/ai/generate', {
            customerImage,
            styleImage,
          },
          {
            headers: authHeaders('customer'),
          },
          )
          .then((res) => {
            const imageUrl = normalizeGeneratedImageUrl(res.data)
            if (!imageUrl) {
              throw new Error(t.missingResult)
            }

            if (typeof res.data?.wallet?.pointsBalance === 'number') {
              setPointsBalance(res.data.wallet.pointsBalance)
            } else {
              setPointsBalance((current) =>
                current === null ? current : Math.max(0, current - generationCost),
              )
            }

            if (typeof res.data?.pointsCharged === 'number') {
              setGenerationCost(res.data.pointsCharged)
            }

            return imageUrl
          })
          .finally(() => {
            inFlightGenerations.delete(requestKey)
          })

        inFlightGenerations.set(requestKey, request)
      }

      const imageUrl = await request
      setGeneratedImage(imageUrl, requestKey)
    } catch (err) {
      console.error(err)
      const detail = getErrorMessage(err)
      setError(detail ? `${t.errorWithDetail}${detail}` : t.error)
      getMemberWallet()
        .then((data) => setPointsBalance(data.wallet.pointsBalance))
        .catch(() => undefined)
    } finally {
      setLoading(false)
    }
  }, [
    customerImage,
    generatedImage,
    generatedRequestKey,
    generationCost,
    requestKey,
    router,
    setGeneratedImage,
    styleImage,
    t.error,
    t.errorWithDetail,
    t.missingResult,
  ])

  useEffect(() => {
    if (!customerImage || !styleImage) {
      router.replace('/upload')
      return
    }

    const searchParams = new URLSearchParams(window.location.search)
    if (searchParams.get('generate') !== '1' || !requestKey) {
      return
    }

    if (autoGenerateRequestKey.current === requestKey) {
      return
    }

    autoGenerateRequestKey.current = requestKey
    generateAI(false).finally(() => {
      router.replace('/preview')
    })
  }, [customerImage, generateAI, requestKey, router, styleImage])

  const imageToShow = generatedRequestKey === requestKey ? generatedImage : null

  return (
    <main className="min-h-screen bg-zinc-50 px-6 py-8 text-zinc-950">
      <section className="mx-auto flex max-w-6xl flex-col gap-8">
        <AppNav />

        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-semibold">{t.title}</h1>
            <p className="mt-2 text-sm text-zinc-600">{t.description}</p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="rounded-lg border border-zinc-200 bg-white px-4 py-3 text-sm shadow-sm">
              <div className="text-zinc-500">{t.points}</div>
              <div className="mt-1 text-2xl font-semibold">
                {pointsLoading || pointsBalance === null
                  ? t.loadingPoints
                  : formatPoints(pointsBalance, language, t.pointUnit)}
              </div>
            </div>
            <div className="rounded-lg border border-zinc-200 bg-white px-4 py-3 text-sm shadow-sm">
              <div className="text-zinc-500">{t.cost}</div>
              <div className="mt-1 text-2xl font-semibold">
                {formatPoints(generationCost, language, t.pointUnit)}
              </div>
            </div>
            <button
              type="button"
              disabled={loading || !customerImage || !styleImage}
              onClick={() => generateAI(true)}
              className="rounded-md bg-zinc-950 px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:bg-zinc-300"
            >
              {loading ? t.generating : t.generate}
            </button>
            <button
              type="button"
              onClick={() => router.push('/member')}
              className="rounded-md border border-zinc-300 bg-white px-4 py-2 text-sm font-medium"
            >
              {t.recharge}
            </button>
            <button
              type="button"
              onClick={() => router.push('/upload')}
              className="rounded-md border border-zinc-300 bg-white px-4 py-2 text-sm font-medium"
            >
              {t.reselect}
            </button>
          </div>
        </div>

        {loading && <div className="text-sm text-zinc-600">{t.loading}</div>}
        {error && <div className="text-sm text-red-600">{error}</div>}

        <div className="grid gap-5 lg:grid-cols-3">
          <PreviewImage title={t.customer} imageUrl={customerImage} emptyText={t.empty} />
          <PreviewImage title={t.reference} imageUrl={styleImage} emptyText={t.empty} />
          <PreviewImage
            title={t.result}
            imageUrl={imageToShow}
            loading={loading}
            emptyText={t.empty}
            generatingText={t.generating}
          />
        </div>

        {matchedSalon && (
          <div className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">
            <div className="text-sm text-zinc-500">{t.salonStyleBy}</div>
            <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
              <div className="text-lg font-semibold">{matchedSalon.name}</div>
              <button
                type="button"
                onClick={() => {
                  const params = new URLSearchParams()
                  if (styleImage) {
                    params.set('styleImage', styleImage)
                    params.set('styleGender', referenceGender)
                  }
                  if (imageToShow && !imageToShow.startsWith('data:image/')) {
                    params.set('generatedImage', imageToShow)
                  }
                  const query = params.toString()
                  router.push(`/salons/${matchedSalon.id}${query ? `?${query}` : ''}`)
                }}
                className="rounded-md bg-zinc-950 px-5 py-3 text-sm font-medium text-white"
              >
                {t.bookSalon}
              </button>
            </div>
          </div>
        )}

        <button
          onClick={() => router.push('/salons')}
          className="w-fit rounded-md bg-zinc-950 px-5 py-3 text-sm font-medium text-white"
        >
          {t.findSalon}
        </button>
      </section>
    </main>
  )
}

function normalizeGeneratedImageUrl(data: any): string | null {
  const raw =
    data?.imageUrl ??
    data?.image_url ??
    data?.url ??
    data?.outputUrl ??
    data?.output_url ??
    data?.output?.[0] ??
    data?.data?.[0]?.url ??
    data?.data?.[0]?.b64_json ??
    data?.choices?.[0]?.message?.images?.[0]?.image_url?.url ??
    data?.choices?.[0]?.message?.images?.[0]?.imageUrl?.url ??
    data?.result ??
    data?.image ??
    findFirstImageValue(data)

  if (typeof raw !== 'string') {
    return null
  }

  const value = raw.trim()
  if (!value) {
    return null
  }

  if (/^(https?:|blob:|data:image\/)/i.test(value)) {
    return value
  }

  if (/^[A-Za-z0-9+/=]+$/.test(value) && value.length > 200) {
    return `data:image/png;base64,${value}`
  }

  const apiBase = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000'
  return new URL(value.replace(/^\/+/, ''), `${apiBase.replace(/\/$/, '')}/`).toString()
}

function findFirstImageValue(value: unknown): string | null {
  if (typeof value === 'string') {
    return /^(https?:|blob:|data:image\/)/i.test(value) || isLikelyBase64Image(value)
      ? value
      : null
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      const image = findFirstImageValue(item)
      if (image) return image
    }
  }

  if (value && typeof value === 'object') {
    for (const item of Object.values(value)) {
      const image = findFirstImageValue(item)
      if (image) return image
    }
  }

  return null
}

function isLikelyBase64Image(value: string) {
  return /^[A-Za-z0-9+/=]+$/.test(value.trim()) && value.trim().length > 200
}

function formatNumber(value: number, language: keyof typeof previewCopy) {
  return new Intl.NumberFormat(localeFor(language)).format(value)
}

function formatPoints(value: number, language: keyof typeof previewCopy, unit: string) {
  return `${formatNumber(value, language)} ${unit}`
}

function localeFor(language: keyof typeof previewCopy) {
  if (language === 'ja') return 'ja-JP'
  if (language === 'zh') return 'zh-CN'
  return 'en-US'
}

function PreviewImage({
  title,
  imageUrl,
  loading = false,
  emptyText,
  generatingText,
}: {
  title: string
  imageUrl?: string | null
  loading?: boolean
  emptyText: string
  generatingText?: string
}) {
  return (
    <div>
      <h2 className="mb-3 text-base font-semibold">{title}</h2>
      <div className="flex aspect-[4/5] items-center justify-center overflow-hidden rounded-lg border border-zinc-200 bg-white text-sm text-zinc-500">
        {imageUrl ? (
          <img src={imageUrl} alt={title} className="h-full w-full object-cover" />
        ) : (
          <span>{loading ? generatingText : emptyText}</span>
        )}
      </div>
    </div>
  )
}
