'use client'

import { FormEvent, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import Link from 'next/link'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import { CalendarCheck, ChevronLeft, Clock, CreditCard, Mail, User, WalletCards } from 'lucide-react'

import { AppNav } from '@/components/AppNav'
import type { HairstyleGender } from '@/lib/hairstyleCatalog'
import { useLanguage } from '@/lib/useLanguage'
import {
  createSalonBooking,
  getSalonBookingAvailability,
  type SalonAvailabilitySlot,
  type SalonBookingResponse,
} from '@/services/booking'
import { isAuthSessionActive } from '@/services/auth'
import { getPublicSalon, type PublicSalon } from '@/services/salon'
import { getPublicSalonStylists, type StylistProfile } from '@/services/stylist'
import { useAppStore } from '@/store/appStore'

const pageLabels = {
  ja: {
    back: 'Salon選択へ戻る',
    titleSuffix: 'のヘアスタイル選択',
    subtitle: '予約したいヘアスタイルを選択してください。',
    empty: 'このSalonはまだヘアスタイル画像をアップロードしていません',
    choose: 'この発型を選択',
    selected: '選択中',
    booking: '予約内容',
    selectedStyle: '選択したヘアスタイル',
    generatedPreview: 'AI生成プレビュー',
    price: '価格',
    paymentMethod: '支払い方法',
    cardPayment: 'クレジットカード',
    pointsPayment: 'ポイントで支払う',
    insufficientPoints: 'ポイントが不足しています。ポイントをチャージしてください。',
    rechargePoints: 'ポイントをチャージ',
    cut: '剪头',
    dye: '染发',
    treatment: '护发',
    payAndBook: '支払いへ進む',
    name: 'お名前',
    email: 'メール',
    date: '希望日',
    time: '希望時間',
    submit: '予約内容を送信',
    done: '予約内容を受け付けました。',
    bankTransferPending: '予約内容を受け付けました。銀行振込でお支払いください。',
    bankTransferTitle: '銀行振込',
    bankTransferAmount: 'お支払い金額',
    bankTransferReference: '予約番号',
    bankTransferInstruction: '振込時に予約番号をメモ欄へ入力してください。振込先口座はSalonから案内されます。',
    bookingAccepted: '予約済み',
    pickFirst: 'ヘアスタイルを選択してください',
    bookingFailed: '予約の送信に失敗しました',
    duplicateBooking: '同じ時間帯の重複予約はできません。',
    timeUnavailable: '選択した時間は予約できません。別の時間を選択してください。',
    pastTime: '現在時刻より前の時間は予約できません。',
  },
  en: {
    back: 'Back to salon selection',
    titleSuffix: 'hairstyle selection',
    subtitle: 'Choose a hairstyle from this salon before booking.',
    empty: 'This salon has not uploaded hairstyle images yet',
    choose: 'Choose this style',
    selected: 'Selected',
    booking: 'Booking details',
    selectedStyle: 'Selected hairstyle',
    generatedPreview: 'AI generated preview',
    price: 'Price',
    paymentMethod: 'Payment method',
    cardPayment: 'Credit card',
    pointsPayment: 'Pay with points',
    insufficientPoints: 'Not enough points. Please recharge points.',
    rechargePoints: 'Recharge points',
    cut: 'Haircut',
    dye: 'Dye',
    treatment: 'Treatment',
    payAndBook: 'Pay and book',
    name: 'Name',
    email: 'Email',
    date: 'Preferred date',
    time: 'Preferred time',
    submit: 'Send booking request',
    done: 'Booking request received.',
    bankTransferPending: 'Booking request received. Please pay by bank transfer.',
    bankTransferTitle: 'Bank transfer',
    bankTransferAmount: 'Payment amount',
    bankTransferReference: 'Booking reference',
    bankTransferInstruction: 'Include the booking reference in your transfer memo. The salon will provide the destination bank account.',
    bookingAccepted: 'Booked',
    pickFirst: 'Please choose a hairstyle',
    bookingFailed: 'Failed to send booking request',
    duplicateBooking: 'Please do not book the same time slot more than once.',
    timeUnavailable: 'This time slot is no longer available. Please choose another time.',
    pastTime: 'You cannot book a time slot before the current time.',
  },
  zh: {
    back: '返回 Salon 选择',
    titleSuffix: '发型选择',
    subtitle: '请选择想预约的发型。',
    empty: '这个 Salon 还没有上传发型图片',
    choose: '选择此发型',
    selected: '已选择',
    booking: '预约内容',
    selectedStyle: '已选择发型',
    generatedPreview: 'AI 生成预览',
    price: '价格',
    paymentMethod: '支付方式',
    cardPayment: '信用卡',
    pointsPayment: '使用点数支付',
    insufficientPoints: '点数不足，请先充值点数。',
    rechargePoints: '充值点数',
    cut: '剪头',
    dye: '染发',
    treatment: '护发',
    payAndBook: '支付并预约',
    name: '姓名',
    email: '邮箱',
    date: '希望日期',
    time: '希望时间',
    submit: '提交预约',
    done: '已接收预约内容。',
    bankTransferPending: '已接收预约内容。请先使用银行转账付款。',
    bankTransferTitle: '银行转账',
    bankTransferAmount: '付款金额',
    bankTransferReference: '预约编号',
    bankTransferInstruction: '转账时请在备注栏填写预约编号。收款银行账户由 Salon 另行通知。',
    bookingAccepted: '已预约',
    pickFirst: '请先选择发型',
    bookingFailed: '预约提交失败',
    duplicateBooking: '请不要重复预约同一个时间段。',
    timeUnavailable: '这个时间段已经不能预约了，请选择其他时间。',
    pastTime: '当前时间之前的时间段不能预约。',
  },
} as const

type TextKey = keyof typeof pageLabels
type PaymentMethod = 'card' | 'points'
const salonGenderLabels = {
  ja: { women: '女性', men: '男性' },
  en: { women: 'Women', men: 'Men' },
  zh: { women: '女性', men: '男性' },
} as const

export default function SalonDetailPage() {
  const params = useParams<{ salonId: string }>()
  const router = useRouter()
  const searchParams = useSearchParams()
  const { language } = useLanguage()
  const t = pageLabels[language as TextKey] ?? pageLabels.ja
  const genderLabels = salonGenderLabels[language as TextKey] ?? salonGenderLabels.ja
  const storedStyleImage = useAppStore((s) => s.styleImage)
  const storedReferenceGender = useAppStore((s) => s.referenceGender)
  const storedSalonId = useAppStore((s) => s.selectedSalonId)
  const setStyleImage = useAppStore((s) => s.setStyleImage)
  const setSelectedHairstyle = useAppStore((s) => s.setSelectedHairstyle)
  const setReferenceGender = useAppStore((s) => s.setReferenceGender)
  const generatedImage = useAppStore((s) => s.generatedImage)
  const [salon, setSalon] = useState<PublicSalon | null>(null)
  const [stylists, setStylists] = useState<StylistProfile[]>([])
  const [selectedImage, setSelectedImage] = useState('')
  const [selectedGeneratedImage, setSelectedGeneratedImage] = useState('')
  const [selectedGender, setSelectedGender] = useState<HairstyleGender>('women')
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('card')
  const [selectedStylistId, setSelectedStylistId] = useState('')
  const [selectedDate, setSelectedDate] = useState(() => todayInputValue())
  const [selectedTime, setSelectedTime] = useState('')
  const [timeSlots, setTimeSlots] = useState<SalonAvailabilitySlot[]>([])
  const [loadingTimeSlots, setLoadingTimeSlots] = useState(false)
  const [bookingDone, setBookingDone] = useState(false)
  const [bookingDoneMessage, setBookingDoneMessage] = useState('')
  const [bankTransferBooking, setBankTransferBooking] = useState<SalonBookingResponse | null>(null)
  const [bookingError, setBookingError] = useState('')
  const [submittingBooking, setSubmittingBooking] = useState(false)

  useEffect(() => {
    const redirectPath = `/salons/${params.salonId}`

    if (!isAuthSessionActive('customer')) {
      router.replace(`/login?redirect=${encodeURIComponent(redirectPath)}`)
      return
    }

    Promise.all([getPublicSalon(params.salonId), getPublicSalonStylists(params.salonId)])
      .then(([salonData, stylistData]) => {
        setSalon(salonData)
        setStylists(stylistData)
      })
      .catch((error) => {
        console.error('Failed to load salon', error)
        router.replace('/salons')
      })
  }, [params.salonId, router])

  const heroImage = useMemo(() => {
    if (!salon) return null
    return salon.mainIntroImageUrl ?? salon.introImages[0] ?? salon.specialtyImages[0] ?? null
  }, [salon])
  const selectedDetail = selectedImage ? salon?.hairstyleDetails?.[selectedImage] : null
  const queryStyleImage = searchParams.get('styleImage')
  const queryStyleGender = toHairstyleGender(searchParams.get('styleGender'))
  const queryGeneratedImage = searchParams.get('generatedImage')

  useEffect(() => {
    if (!salon || !selectedDate || !stylists.length) {
      setTimeSlots([])
      setSelectedTime('')
      return
    }

    setLoadingTimeSlots(true)
    getSalonBookingAvailability({
      salonId: salon.id,
      date: selectedDate,
      stylistId: selectedStylistId || undefined,
    })
      .then((data) => {
        setTimeSlots(data.slots)
        setSelectedTime((current) =>
          data.slots.some((slot) => slot.time === current) ? current : data.slots[0]?.time ?? '',
        )
      })
      .catch((error) => {
        console.error('Failed to load booking availability', error)
        setTimeSlots([])
        setSelectedTime('')
      })
      .finally(() => setLoadingTimeSlots(false))
  }, [salon, selectedDate, selectedStylistId, stylists.length])

  useEffect(() => {
    if (!salon || selectedImage) {
      return
    }

    const initialStyleImage =
      queryStyleImage || (storedSalonId === salon.id ? storedStyleImage : null)

    if (!initialStyleImage) {
      return
    }

    const genderOrder = uniqueGenders([
      queryStyleGender,
      storedReferenceGender,
      'women',
      'men',
    ])

    for (const gender of genderOrder) {
      const images = salonImagesByGender(salon, gender)
      const index = images.indexOf(initialStyleImage)

      if (index >= 0) {
        setSelectedImage(initialStyleImage)
        setSelectedGeneratedImage(queryGeneratedImage || generatedImage || '')
        setSelectedGender(gender)
        setStyleImage(initialStyleImage, { id: salon.id, name: salon.name })
        setSelectedHairstyle((gender === 'women' ? 980000 : 990000) + index)
        setReferenceGender(gender)
        return
      }
    }
  }, [
    queryStyleGender,
    queryStyleImage,
    queryGeneratedImage,
    generatedImage,
    salon,
    selectedImage,
    setReferenceGender,
    setSelectedHairstyle,
    setStyleImage,
    storedReferenceGender,
    storedSalonId,
    storedStyleImage,
  ])

  const selectStyle = (imageUrl: string, index: number, gender: HairstyleGender) => {
    if (isAuthSessionActive('salon') && !isAuthSessionActive('customer')) {
      router.push(`/login?redirect=${encodeURIComponent(`/salons/${params.salonId}`)}`)
      return
    }

    setSelectedImage(imageUrl)
    setSelectedGeneratedImage('')
    setSelectedGender(gender)
    setStyleImage(imageUrl, { id: salon?.id, name: salon?.name })
    setSelectedHairstyle((gender === 'women' ? 980000 : 990000) + index)
    setReferenceGender(gender)
    setBookingDone(false)
    setBookingDoneMessage('')
    setBankTransferBooking(null)
    setBookingError('')
  }

  const submitBooking = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    if (isAuthSessionActive('salon') && !isAuthSessionActive('customer')) {
      router.push(`/login?redirect=${encodeURIComponent(`/salons/${params.salonId}`)}`)
      return
    }

    if (!salon) {
      setBookingError(t.bookingFailed)
      return
    }

    const formData = new FormData(event.currentTarget)
    setBookingError('')
    setBookingDone(false)
    setBookingDoneMessage('')
    setBankTransferBooking(null)
    setSubmittingBooking(true)

    try {
      const booking = await createSalonBooking({
        salonId: salon.id,
        stylistId: selectedStylistId || undefined,
        customerName: String(formData.get('customerName') ?? ''),
        customerEmail: String(formData.get('customerEmail') ?? ''),
        styleImageUrl: selectedImage || undefined,
        styleGender: selectedImage ? selectedGender : undefined,
        paymentMethod: selectedDetail?.priceYen ? paymentMethod : undefined,
        preferredDate: selectedDate || String(formData.get('preferredDate') ?? ''),
        preferredTime: selectedTime || String(formData.get('preferredTime') ?? ''),
      })
      if (booking.checkoutUrl) {
        window.location.href = booking.checkoutUrl
        return
      }
      setBookingDone(true)
      setBookingDoneMessage(
        booking.paymentAmountYen > 0 && booking.paymentStatus === 'pending'
          ? t.bankTransferPending
          : t.done,
      )
      setBankTransferBooking(
        booking.paymentAmountYen > 0 && booking.paymentStatus === 'pending'
          ? booking
          : null,
      )
      if (selectedDate && stylists.length) {
        await refreshTimeSlots(salon.id, selectedDate, selectedStylistId, setTimeSlots, setSelectedTime)
      }
    } catch (error) {
      console.error('Failed to create salon booking', error)
      const message = bookingErrorMessage(error)
      if (message === 'Duplicate booking for this time slot') {
        setBookingError(t.duplicateBooking)
      } else if (message === 'Selected time is no longer available') {
        setBookingError(t.timeUnavailable)
      } else if (message === 'Selected time is in the past') {
        setBookingError(t.pastTime)
      } else if (message === 'Not enough member points') {
        setBookingError(t.insufficientPoints)
      } else if (message) {
        setBookingError(message)
      } else {
        setBookingError(t.bookingFailed)
      }
      if (selectedDate && stylists.length) {
        await refreshTimeSlots(salon.id, selectedDate, selectedStylistId, setTimeSlots, setSelectedTime)
      }
    } finally {
      setSubmittingBooking(false)
    }
  }

  if (!salon) {
    return (
      <main className="min-h-screen bg-[#eef2f6] px-4 py-6 text-[#17202f] lg:px-6">
        <section className="mx-auto max-w-[1280px]">
          <AppNav />
          <div className="mt-8 text-sm text-[#667085]">Loading...</div>
        </section>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-[#eef2f6] text-[#17202f]">
      <header className="border-b border-[#d9e0ea] bg-white">
        <div className="mx-auto max-w-[1280px] px-4 py-4 lg:px-6">
          <AppNav />
        </div>
      </header>

      <section className="mx-auto max-w-[1280px] px-4 py-6 lg:px-6">
        <Link href="/salons" className="mb-5 inline-flex items-center gap-2 text-sm font-medium text-[#2f6fed]">
          <ChevronLeft className="h-4 w-4" />
          {t.back}
        </Link>

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
          <section className="min-w-0">
            <div className="overflow-hidden rounded-md border border-[#d9e0ea] bg-white">
              {heroImage && (
                <img src={heroImage} alt={salon.name} className="h-72 w-full object-cover" />
              )}
              <div className="p-5">
                <h1 className="text-3xl font-semibold">
                  {salon.name} {t.titleSuffix}
                </h1>
                <p className="mt-2 text-sm text-[#667085]">{t.subtitle}</p>
              </div>
            </div>

            <div className="mt-5 grid gap-7">
              {(['women', 'men'] as const).map((gender) => (
                <SalonStyleSection
                  key={gender}
                  title={genderLabels[gender]}
                  salonName={salon.name}
                  images={gender === 'women' ? salon.specialtyImagesWomen ?? salon.specialtyImages : salon.specialtyImagesMen ?? []}
                  details={salon.hairstyleDetails ?? {}}
                  selectedImage={selectedImage}
                  chooseText={t.choose}
                  selectedText={t.selected}
                  onSelect={(imageUrl, index) => selectStyle(imageUrl, index, gender)}
                />
              ))}
            </div>

            {!salon.specialtyImages.length && (
              <div className="mt-5 flex min-h-44 items-center justify-center rounded-md border border-dashed border-[#c8d1de] bg-white text-sm text-[#667085]">
                {t.empty}
              </div>
            )}
          </section>

          <aside className="lg:sticky lg:top-5 lg:self-start">
            <form onSubmit={submitBooking} className="rounded-md border border-[#d9e0ea] bg-white p-5">
              <h2 className="text-xl font-semibold">{t.booking}</h2>

              {selectedImage && (
                <>
                  <h3 className="mt-4 text-sm font-semibold text-[#344054]">{t.selectedStyle}</h3>
                  <img src={selectedImage} alt={t.selected} className="mt-4 aspect-[4/5] w-full rounded-md object-cover" />
                  {selectedDetail && (
                    <div className="mt-3 rounded-md bg-[#f5f7fb] p-3 text-sm text-[#344054]">
                      <div className="font-semibold">
                        {t.price}: {formatYen(selectedDetail.priceYen)}
                      </div>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {selectedDetail.requiresCut && <span className="rounded bg-white px-2 py-1">{t.cut}</span>}
                        {selectedDetail.requiresDye && <span className="rounded bg-white px-2 py-1">{t.dye}</span>}
                        {selectedDetail.requiresTreatment && <span className="rounded bg-white px-2 py-1">{t.treatment}</span>}
                      </div>
                    </div>
                  )}
                  {Boolean(selectedDetail?.priceYen) && (
                    <div className="mt-4">
                      <div className="mb-2 text-sm font-semibold text-[#344054]">{t.paymentMethod}</div>
                      <div className="grid grid-cols-2 gap-2">
                        <PaymentMethodButton
                          active={paymentMethod === 'card'}
                          icon={<CreditCard className="h-4 w-4" />}
                          label={t.cardPayment}
                          onClick={() => setPaymentMethod('card')}
                        />
                        <PaymentMethodButton
                          active={paymentMethod === 'points'}
                          icon={<WalletCards className="h-4 w-4" />}
                          label={t.pointsPayment}
                          onClick={() => setPaymentMethod('points')}
                        />
                      </div>
                    </div>
                  )}
                </>
              )}

              {selectedGeneratedImage && (
                <section className="mt-4">
                  <h3 className="text-sm font-semibold text-[#344054]">{t.generatedPreview}</h3>
                  <img
                    src={selectedGeneratedImage}
                    alt={t.generatedPreview}
                    className="mt-3 aspect-[4/5] w-full rounded-md object-cover"
                  />
                </section>
              )}

              <div className="mt-5 grid gap-4">
                <Field icon={<User className="h-4 w-4" />} label={t.name} name="customerName" type="text" />
                <Field icon={<Mail className="h-4 w-4" />} label={t.email} name="customerEmail" type="email" />
                <label className="block">
                  <span className="mb-2 flex items-center gap-2 text-sm font-semibold text-[#344054]">
                    <CalendarCheck className="h-4 w-4" />
                    {t.date}
                  </span>
                  <input
                    name="preferredDate"
                    type="date"
                    value={selectedDate}
                    onChange={(event) => setSelectedDate(event.target.value)}
                    min={todayInputValue()}
                    required
                    className="h-11 w-full rounded-md border border-[#c8d1de] bg-white px-3 outline-none focus:border-[#2f6fed]"
                  />
                </label>
                {stylists.length ? (
                  <>
                    <label className="block">
                      <span className="mb-2 flex items-center gap-2 text-sm font-semibold text-[#344054]">
                        <User className="h-4 w-4" />
                        Stylist
                      </span>
                      <select
                        value={selectedStylistId}
                        onChange={(event) => {
                          setSelectedStylistId(event.target.value)
                        }}
                        className="h-11 w-full rounded-md border border-[#c8d1de] bg-white px-3 outline-none focus:border-[#2f6fed]"
                      >
                        <option value="">No preference</option>
                        {stylists.map((stylist) => (
                          <option key={stylist.id} value={stylist.id}>
                            {stylist.name ?? stylist.email}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="block">
                      <span className="mb-2 flex items-center gap-2 text-sm font-semibold text-[#344054]">
                        <Clock className="h-4 w-4" />
                        {t.time}
                      </span>
                      <select
                        name="preferredTime"
                        value={selectedTime}
                        onChange={(event) => setSelectedTime(event.target.value)}
                        required
                        className="h-11 w-full rounded-md border border-[#c8d1de] bg-white px-3 outline-none focus:border-[#2f6fed]"
                      >
                        {timeSlots.length ? (
                          timeSlots.map((slot) => (
                            <option key={slot.time} value={slot.time}>
                              {slot.label}
                            </option>
                          ))
                        ) : (
                          <option value="" disabled>
                            {loadingTimeSlots
                              ? 'Loading times...'
                              : selectedDate
                                ? 'No available time'
                                : 'Choose date first'}
                          </option>
                        )}
                      </select>
                    </label>
                  </>
                ) : (
                  <Field icon={<Clock className="h-4 w-4" />} label={t.time} name="preferredTime" type="time" />
                )}
              </div>

              {bookingError && <p className="mt-4 text-sm text-rose-700">{bookingError}</p>}
              {bookingError === t.insufficientPoints && (
                <button
                  type="button"
                  onClick={() => router.push('/member')}
                  className="mt-3 inline-flex h-10 w-full items-center justify-center rounded-md border border-rose-200 bg-white px-4 text-sm font-semibold text-rose-700"
                >
                  {t.rechargePoints}
                </button>
              )}
              {bookingDone && (
                <p className="mt-4 rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
                  {bookingDoneMessage || t.done}
                </p>
              )}
              {bankTransferBooking && (
                <section className="mt-4 rounded-md border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-950">
                  <h3 className="font-semibold">{t.bankTransferTitle}</h3>
                  <dl className="mt-3 grid gap-2">
                    <div className="flex items-center justify-between gap-3">
                      <dt className="text-emerald-800">{t.bankTransferAmount}</dt>
                      <dd className="font-semibold">{formatYen(bankTransferBooking.paymentAmountYen)}</dd>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <dt className="text-emerald-800">{t.bankTransferReference}</dt>
                      <dd className="font-semibold">{bankTransferBooking.id}</dd>
                    </div>
                  </dl>
                  <p className="mt-3 leading-6 text-emerald-800">{t.bankTransferInstruction}</p>
                </section>
              )}

              <button
                type="submit"
                disabled={submittingBooking || bookingDone}
                className="mt-5 inline-flex h-11 w-full items-center justify-center rounded-md bg-[#17202f] px-4 text-sm font-semibold text-white disabled:bg-[#98a2b3]"
              >
                {bookingDone ? t.bookingAccepted : selectedDetail?.priceYen ? t.payAndBook : t.submit}
              </button>
            </form>
          </aside>
        </div>
      </section>
    </main>
  )
}

async function refreshTimeSlots(
  salonId: string,
  date: string,
  stylistId: string,
  setTimeSlots: (slots: SalonAvailabilitySlot[]) => void,
  setSelectedTime: (updater: (current: string) => string) => void,
) {
  try {
    const data = await getSalonBookingAvailability({
      salonId,
      date,
      stylistId: stylistId || undefined,
    })
    setTimeSlots(data.slots)
    setSelectedTime((current) =>
      data.slots.some((slot) => slot.time === current) ? current : data.slots[0]?.time ?? '',
    )
  } catch (error) {
    console.error('Failed to refresh booking availability', error)
  }
}

function bookingErrorMessage(error: unknown) {
  if (!error || typeof error !== 'object') {
    return ''
  }

  const response = 'response' in error ? error.response : undefined
  if (!response || typeof response !== 'object') {
    return ''
  }

  const data = 'data' in response ? response.data : undefined
  if (!data || typeof data !== 'object') {
    return ''
  }

  const message = 'message' in data ? data.message : undefined
  return Array.isArray(message) ? message[0] : typeof message === 'string' ? message : ''
}

function todayInputValue() {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function formatYen(value: number | undefined) {
  return new Intl.NumberFormat('ja-JP', {
    style: 'currency',
    currency: 'JPY',
    maximumFractionDigits: 0,
  }).format(value ?? 0)
}

function toHairstyleGender(value: string | null): HairstyleGender | null {
  return value === 'women' || value === 'men' ? value : null
}

function uniqueGenders(values: Array<HairstyleGender | null>): HairstyleGender[] {
  return values.filter((value, index, array): value is HairstyleGender =>
    Boolean(value) && array.indexOf(value) === index,
  )
}

function salonImagesByGender(salon: PublicSalon, gender: HairstyleGender) {
  return gender === 'women'
    ? salon.specialtyImagesWomen ?? salon.specialtyImages
    : salon.specialtyImagesMen ?? []
}

function SalonStyleSection({
  title,
  salonName,
  images,
  details,
  selectedImage,
  chooseText,
  selectedText,
  onSelect,
}: {
  title: string
  salonName: string
  images: string[]
  details: PublicSalon['hairstyleDetails']
  selectedImage: string
  chooseText: string
  selectedText: string
  onSelect: (imageUrl: string, index: number) => void
}) {
  if (!images.length) {
    return null
  }

  return (
    <section>
      <h2 className="mb-3 text-lg font-semibold">{title}</h2>
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {images.map((imageUrl, index) => {
          const isSelected = selectedImage === imageUrl
          const detail = details[imageUrl]

          return (
            <button
              key={`${imageUrl}-${index}`}
              type="button"
              onClick={() => onSelect(imageUrl, index)}
              className={`overflow-hidden rounded-md border bg-white text-left transition hover:-translate-y-0.5 hover:shadow-md ${
                isSelected ? 'border-[#2f6fed] ring-2 ring-[#dbe8ff]' : 'border-[#d9e0ea]'
              }`}
            >
              <img src={imageUrl} alt={`${salonName} ${title} style ${index + 1}`} className="aspect-[4/5] w-full object-cover" />
              <div className="grid gap-2 p-3">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm font-semibold">Style {index + 1}</span>
                  <span className={`rounded-md px-2 py-1 text-xs font-semibold ${
                    isSelected ? 'bg-[#eaf2ff] text-[#2f6fed]' : 'bg-[#17202f] text-white'
                  }`}>
                    {isSelected ? selectedText : chooseText}
                  </span>
                </div>
                {detail && (
                  <div className="text-xs text-[#667085]">
                    <span className="font-semibold text-[#344054]">{formatYen(detail.priceYen)}</span>
                    {detail.requiresCut && <span className="ml-2">剪头</span>}
                    {detail.requiresDye && <span className="ml-2">染发</span>}
                    {detail.requiresTreatment && <span className="ml-2">护发</span>}
                  </div>
                )}
              </div>
            </button>
          )
        })}
      </div>
    </section>
  )
}

function PaymentMethodButton({
  active,
  icon,
  label,
  onClick,
}: {
  active: boolean
  icon: ReactNode
  label: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex h-11 items-center justify-center gap-2 rounded-md border px-3 text-sm font-semibold transition ${
        active
          ? 'border-[#17202f] bg-[#17202f] text-white'
          : 'border-[#c8d1de] bg-white text-[#344054] hover:border-[#98a2b3]'
      }`}
    >
      {icon}
      <span>{label}</span>
    </button>
  )
}

function Field({
  icon,
  label,
  name,
  type,
}: {
  icon: ReactNode
  label: string
  name: string
  type: string
}) {
  return (
    <label className="block">
      <span className="mb-2 flex items-center gap-2 text-sm font-semibold text-[#344054]">
        {icon}
        {label}
      </span>
      <input
        name={name}
        type={type}
        required
        className="h-11 w-full rounded-md border border-[#c8d1de] bg-white px-3 outline-none focus:border-[#2f6fed]"
      />
    </label>
  )
}
