'use client'

import { FormEvent, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { CalendarCheck, CheckCircle, ImagePlus, LoaderCircle, Pencil, Save, Settings, Trash2 } from 'lucide-react'

import { AppNav } from '@/components/AppNav'
import { AvailabilityWeekEditor } from '@/components/AvailabilityWeekEditor'
import { copy } from '@/lib/i18n'
import type { HairstyleGender } from '@/lib/hairstyleCatalog'
import { useLanguage } from '@/lib/useLanguage'
import { isUnauthorizedError } from '@/services/api'
import { isAuthSessionActive } from '@/services/auth'
import {
  completeManagedSalonBooking,
  getManagedSalonBookings,
  type ManagedSalonBooking,
} from '@/services/booking'
import {
  deleteSalonImage,
  getSalonProfile,
  replaceSalonImage,
  updateSalonImageDetails,
  uploadSalonImage,
  type SalonHairstyleDetail,
  type SalonProfile,
} from '@/services/salon'
import {
  createSalonStylist,
  currentAvailabilitySlots,
  getSalonStylists,
  updateSalonStylistAvailability,
  uploadSalonStylistImage,
  type AvailabilitySlot,
  type StylistProfile,
} from '@/services/stylist'

type SalonHairstyleDetailDraft = Omit<SalonHairstyleDetail, 'priceYen'> & {
  priceYen: number | ''
}

export default function SalonPage() {
  const router = useRouter()
  const { language } = useLanguage()
  const labels = copy[language].salonAdmin
  const [profile, setProfile] = useState<SalonProfile | null>(null)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [selectedUploadGender, setSelectedUploadGender] = useState<HairstyleGender>('women')
  const [imageActionKey, setImageActionKey] = useState('')
  const [stylists, setStylists] = useState<StylistProfile[]>([])
  const [stylistName, setStylistName] = useState('')
  const [stylistEmail, setStylistEmail] = useState('')
  const [stylistPassword, setStylistPassword] = useState('')
  const [savingStylist, setSavingStylist] = useState(false)
  const [bookings, setBookings] = useState<ManagedSalonBooking[]>([])
  const [bookingActionKey, setBookingActionKey] = useState('')
  const [detailDrafts, setDetailDrafts] = useState<Record<string, SalonHairstyleDetailDraft>>({})

  useEffect(() => {
    if (!isAuthSessionActive('salon')) {
      router.replace('/salon/login')
      return
    }

    Promise.all([getSalonProfile(), getSalonStylists(), getManagedSalonBookings()])
      .then(([salonData, stylistData, bookingData]) => {
        setProfile(salonData)
        setDetailDrafts(salonData.hairstyleDetails ?? {})
        setStylists(stylistData)
        setBookings(bookingData)
      })
      .catch((err) => {
        if (isUnauthorizedError(err)) {
          router.replace('/salon/login')
          return
        }

        setError(labels.error)
      })
      .finally(() => setLoading(false))
  }, [router])

  const uploadImage = async (file?: File) => {
    if (!file) return

    setError('')
    setMessage('')
    setUploading(true)

    try {
      const data = await uploadSalonImage(file, selectedUploadGender)
      setProfile(data)
      setDetailDrafts(data.hairstyleDetails ?? {})
      setMessage(labels.saved)
    } catch {
      setError(labels.error)
    } finally {
      setUploading(false)
    }
  }

  const removeSpecialtyImage = async (imageUrl: string, gender: HairstyleGender) => {
    setError('')
    setMessage('')
    setImageActionKey(`style-delete-${gender}-${imageUrl}`)

    try {
      const data = await deleteSalonImage(imageUrl, gender)
      setProfile(data)
      setDetailDrafts(data.hairstyleDetails ?? {})
      setMessage(labels.saved)
    } catch {
      setError(labels.error)
    } finally {
      setImageActionKey('')
    }
  }

  const replaceSpecialtyImage = async (imageUrl: string, gender: HairstyleGender, file?: File) => {
    if (!file) return

    setError('')
    setMessage('')
    setImageActionKey(`style-replace-${gender}-${imageUrl}`)

    try {
      const data = await replaceSalonImage(imageUrl, file, gender)
      setProfile(data)
      setDetailDrafts(data.hairstyleDetails ?? {})
      setMessage(labels.saved)
    } catch {
      setError(labels.error)
    } finally {
      setImageActionKey('')
    }
  }

  const createStylist = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError('')
    setMessage('')
    setSavingStylist(true)

    try {
      const stylist = await createSalonStylist({
        name: stylistName,
        email: stylistEmail,
        password: stylistPassword,
      })
      setStylists((current) => [stylist, ...current])
      setStylistName('')
      setStylistEmail('')
      setStylistPassword('')
      setMessage(labels.saved)
    } catch {
      setError(labels.error)
    } finally {
      setSavingStylist(false)
    }
  }

  const uploadStylistImage = async (stylistId: string, file?: File) => {
    if (!file) return

    setError('')
    setMessage('')
    setImageActionKey(`stylist-image-${stylistId}`)

    try {
      const updated = await uploadSalonStylistImage(stylistId, file)
      setStylists((current) => current.map((stylist) => stylist.id === stylistId ? updated : stylist))
      setMessage(labels.saved)
    } catch {
      setError(labels.error)
    } finally {
      setImageActionKey('')
    }
  }

  const addStylistSlot = async (stylist: StylistProfile, slot: AvailabilitySlot) => {
    const nextSlots = [
      ...currentDateSlots(stylist.availabilitySlots),
      slot,
    ]
    setStylists((current) => current.map((item) => item.id === stylist.id ? { ...item, availabilitySlots: nextSlots } : item))
  }

  const updateStylistSlot = async (
    stylist: StylistProfile,
    index: number,
    patch: Partial<AvailabilitySlot>,
  ) => {
    const nextSlots = stylist.availabilitySlots.map((slot, slotIndex) =>
      slotIndex === index ? { ...slot, ...patch } : slot,
    )
    setStylists((current) => current.map((item) => item.id === stylist.id ? { ...item, availabilitySlots: nextSlots } : item))
  }

  const removeStylistSlot = async (stylist: StylistProfile, index: number) => {
    const nextSlots = stylist.availabilitySlots.filter((_, slotIndex) => slotIndex !== index)
    setStylists((current) => current.map((item) => item.id === stylist.id ? { ...item, availabilitySlots: nextSlots } : item))
  }

  const saveStylistSlots = async (stylistId: string, slots: AvailabilitySlot[]) => {
    setError('')
    setMessage('')
    setImageActionKey(`stylist-slots-${stylistId}`)

    try {
      const updated = await updateSalonStylistAvailability(stylistId, currentDateSlots(slots))
      setStylists((current) => current.map((stylist) => stylist.id === stylistId ? updated : stylist))
      setMessage(labels.saved)
    } catch {
      setError(labels.error)
    } finally {
      setImageActionKey('')
    }
  }

  const completeBooking = async (bookingId: string) => {
    setError('')
    setMessage('')
    setBookingActionKey(bookingId)

    try {
      const updated = await completeManagedSalonBooking(bookingId)
      setBookings((current) => current.map((booking) => booking.id === bookingId ? updated : booking))
      setMessage('预约已标记为完了')
    } catch {
      setError(labels.error)
    } finally {
      setBookingActionKey('')
    }
  }

  const updateDetailDraft = (imageUrl: string, patch: Partial<SalonHairstyleDetailDraft>) => {
    const baseDetail = {
      priceYen: 0,
      requiresCut: false,
      requiresDye: false,
      requiresTreatment: false,
    }

    setDetailDrafts((current) => ({
      ...current,
      [imageUrl]: Object.assign(
        {},
        baseDetail,
        profile?.hairstyleDetails?.[imageUrl] ?? {},
        current[imageUrl] ?? {},
        patch,
      ),
    }))
  }

  const saveImageDetails = async (imageUrl: string) => {
    setError('')
    setMessage('')
    setImageActionKey(`style-detail-${imageUrl}`)

    try {
      const detail = detailDrafts[imageUrl] ?? profile?.hairstyleDetails?.[imageUrl] ?? {
        priceYen: 0,
        requiresCut: false,
        requiresDye: false,
        requiresTreatment: false,
      }
      const data = await updateSalonImageDetails({
        imageUrl,
        ...detail,
        priceYen: detail.priceYen === '' ? 0 : detail.priceYen,
      })
      setProfile(data)
      setDetailDrafts(data.hairstyleDetails ?? {})
      setMessage(labels.saved)
    } catch {
      setError(labels.error)
    } finally {
      setImageActionKey('')
    }
  }

  return (
    <main className="min-h-screen bg-zinc-50 px-6 py-8 text-zinc-950">
      <section className="mx-auto flex max-w-6xl flex-col gap-8">
        <AppNav />

        <div>
          <h1 className="text-3xl font-semibold md:text-4xl">{labels.title}</h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-zinc-600">{labels.description}</p>
        </div>

        {loading ? (
          <div className="text-sm text-zinc-600">{labels.loading}</div>
        ) : (
          <>
            {(message || error) && (
              <div
                className={`rounded-md px-4 py-3 text-sm ${
                  error ? 'bg-rose-50 text-rose-700' : 'bg-emerald-50 text-emerald-800'
                }`}
              >
                {error || message}
              </div>
            )}

            <section className="rounded-lg border border-zinc-200 bg-white p-6 shadow-sm">
              <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-xl font-semibold">预约列表</h2>
                  <p className="mt-1 text-sm text-zinc-600">
                    过了当天预约时间但还没有按完了的预约会显示红色。没有选择发型师的预约不显示发型师。
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    getManagedSalonBookings()
                      .then(setBookings)
                      .catch(() => setError(labels.error))
                  }}
                  className="inline-flex h-10 items-center gap-2 rounded-md border border-zinc-300 px-4 text-sm font-semibold"
                >
                  <CalendarCheck className="h-4 w-4" />
                  更新
                </button>
              </div>

              <SalonBookingList
                bookings={bookings}
                busyKey={bookingActionKey}
                onComplete={completeBooking}
              />
            </section>

            <section className="rounded-lg border border-zinc-200 bg-white p-6 shadow-sm">
              <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-xl font-semibold">{labels.gallery}</h2>
                  <div className="mt-3 inline-flex rounded-md border border-zinc-300 bg-white p-1">
                    {(['women', 'men'] as const).map((gender) => {
                      const isActive = selectedUploadGender === gender

                      return (
                        <button
                          key={gender}
                          type="button"
                          onClick={() => setSelectedUploadGender(gender)}
                          className={`rounded px-4 py-2 text-sm font-semibold ${
                            isActive
                              ? 'bg-zinc-950 text-white'
                              : 'text-zinc-700 hover:bg-zinc-100'
                          }`}
                        >
                          {gender === 'women' ? '女性' : '男性'}
                        </button>
                      )
                    })}
                  </div>
                </div>

                <label className="inline-flex h-11 cursor-pointer items-center gap-2 rounded-md bg-zinc-950 px-4 text-sm font-medium text-white">
                  {uploading ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <ImagePlus className="h-4 w-4" />}
                  {selectedUploadGender === 'women' ? '女性' : '男性'} {labels.uploadImage}
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    disabled={uploading}
                    onChange={(event) => {
                      uploadImage(event.target.files?.[0])
                      event.target.value = ''
                    }}
                  />
                </label>
              </div>

              <div className="grid gap-6 lg:grid-cols-2">
                <SalonGenderGallery
                  title="女性"
                  gender="women"
                  images={profile?.specialtyImagesWomen ?? profile?.specialtyImages ?? []}
                  details={profile?.hairstyleDetails ?? {}}
                  detailDrafts={detailDrafts}
                  emptyText={labels.emptyGallery}
                  altText={labels.gallery}
                  busyKey={imageActionKey}
                  onDelete={removeSpecialtyImage}
                  onReplace={replaceSpecialtyImage}
                  onDetailChange={updateDetailDraft}
                  onSaveDetails={saveImageDetails}
                />
                <SalonGenderGallery
                  title="男性"
                  gender="men"
                  images={profile?.specialtyImagesMen ?? []}
                  details={profile?.hairstyleDetails ?? {}}
                  detailDrafts={detailDrafts}
                  emptyText={labels.emptyGallery}
                  altText={labels.gallery}
                  busyKey={imageActionKey}
                  onDelete={removeSpecialtyImage}
                  onReplace={replaceSpecialtyImage}
                  onDetailChange={updateDetailDraft}
                  onSaveDetails={saveImageDetails}
                />
              </div>
            </section>

            <section className="rounded-lg border border-zinc-200 bg-white p-6 shadow-sm">
              <div className="mb-5">
                <h2 className="text-xl font-semibold">Stylist login and schedule</h2>
                <p className="mt-1 text-sm text-zinc-600">
                  Create stylist login accounts, upload profile photos, and manage bookable time slots.
                </p>
              </div>

              <form onSubmit={createStylist} className="mb-6 grid gap-3 rounded-md bg-zinc-50 p-4 md:grid-cols-[1fr_1fr_1fr_auto]">
                <input
                  type="text"
                  value={stylistName}
                  onChange={(event) => setStylistName(event.target.value)}
                  placeholder="Stylist name"
                  className="h-11 rounded-md border border-zinc-300 px-3 outline-none focus:border-teal-600"
                  required
                />
                <input
                  type="email"
                  value={stylistEmail}
                  onChange={(event) => setStylistEmail(event.target.value)}
                  placeholder="stylist@example.com"
                  className="h-11 rounded-md border border-zinc-300 px-3 outline-none focus:border-teal-600"
                  required
                />
                <input
                  type="password"
                  value={stylistPassword}
                  onChange={(event) => setStylistPassword(event.target.value)}
                  placeholder="Password"
                  minLength={8}
                  className="h-11 rounded-md border border-zinc-300 px-3 outline-none focus:border-teal-600"
                  required
                />
                <button
                  type="submit"
                  disabled={savingStylist}
                  className="inline-flex h-11 items-center justify-center gap-2 rounded-md bg-zinc-950 px-4 text-sm font-semibold text-white disabled:bg-zinc-400"
                >
                  {savingStylist ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  Create
                </button>
              </form>

              {stylists.length ? (
                <div className="grid gap-5">
                  {stylists.map((stylist) => (
                    <StylistAdminCard
                      key={stylist.id}
                      stylist={stylist}
                      busyKey={imageActionKey}
                      onUploadImage={uploadStylistImage}
                      onAddSlot={addStylistSlot}
                      onChangeSlot={updateStylistSlot}
                      onRemoveSlot={removeStylistSlot}
                      onSaveSlots={saveStylistSlots}
                    />
                  ))}
                </div>
              ) : (
                <div className="flex h-32 items-center justify-center rounded-md bg-zinc-50 text-sm text-zinc-500">
                  No stylists have been created yet
                </div>
              )}
            </section>

            <section className="rounded-lg border border-zinc-200 bg-white p-6 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <h2 className="text-xl font-semibold">基本情報管理</h2>
                  <p className="mt-1 text-sm text-zinc-600">
                    アカウント設定、Salon email、ホームページリンク、Salon intro images を管理します。
                  </p>
                </div>
                <Link
                  href="/salon/basic-info"
                  className="inline-flex h-10 items-center gap-2 rounded-md bg-zinc-950 px-4 text-sm font-semibold text-white"
                >
                  <Settings className="h-4 w-4" />
                  開く
                </Link>
              </div>
            </section>
          </>
        )}
      </section>
    </main>
  )
}

function SalonBookingList({
  bookings,
  busyKey,
  onComplete,
}: {
  bookings: ManagedSalonBooking[]
  busyKey: string
  onComplete: (bookingId: string) => void
}) {
  if (!bookings.length) {
    return (
      <div className="flex h-32 items-center justify-center rounded-md bg-zinc-50 text-sm text-zinc-500">
        まだ予約はありません
      </div>
    )
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[820px] border-collapse text-left text-sm">
        <thead>
          <tr className="border-b border-zinc-200 text-xs uppercase text-zinc-500">
            <th className="py-3 pr-4 font-semibold">预约时间</th>
            <th className="py-3 pr-4 font-semibold">顾客</th>
            <th className="py-3 pr-4 font-semibold">发型师</th>
            <th className="py-3 pr-4 font-semibold">发型</th>
            <th className="py-3 pr-4 font-semibold">状态</th>
            <th className="py-3 text-right font-semibold">管理</th>
          </tr>
        </thead>
        <tbody>
          {bookings.map((booking) => {
            const fulfilled = booking.status === 'fulfilled'
            const overdue = !fulfilled && isPastBookingTime(booking)
            const busy = busyKey === booking.id

            return (
              <tr
                key={booking.id}
                className={`border-b border-zinc-100 ${
                  overdue ? 'bg-rose-50 text-rose-900' : 'text-zinc-800'
                }`}
              >
                <td className="py-3 pr-4 font-medium">
                  {booking.preferredDate} {booking.preferredTime}
                </td>
                <td className="py-3 pr-4">
                  <div className="font-medium">{booking.customerName}</div>
                  <div className="text-xs text-zinc-500">{booking.customerEmail}</div>
                </td>
                <td className="py-3 pr-4">
                  {booking.stylistId ? (
                    <div>
                      <div className="font-medium">{booking.stylistName ?? booking.stylistEmail}</div>
                      {booking.stylistEmail && <div className="text-xs text-zinc-500">{booking.stylistEmail}</div>}
                    </div>
                  ) : (
                    null
                  )}
                </td>
                <td className="py-3 pr-4">
                  {booking.styleImageUrl ? (
                    <a
                      href={booking.styleImageUrl}
                      target="_blank"
                      className="inline-flex items-center gap-2 text-teal-700"
                    >
                      <img
                        src={booking.styleImageUrl}
                        alt="Selected hairstyle"
                        className="h-12 w-10 rounded object-cover"
                      />
                      查看
                    </a>
                  ) : (
                    <span className="text-zinc-400">未选择</span>
                  )}
                </td>
                <td className="py-3 pr-4">
                  <span className={`rounded-md px-2 py-1 text-xs font-semibold ${
                    fulfilled
                      ? 'bg-emerald-100 text-emerald-800'
                      : overdue
                        ? 'bg-rose-100 text-rose-800'
                        : 'bg-zinc-100 text-zinc-700'
                  }`}>
                    {fulfilled ? '完了' : overdue ? '未到店' : '预约中'}
                  </span>
                </td>
                <td className="py-3 text-right">
                  <button
                    type="button"
                    disabled={fulfilled || busy}
                    onClick={() => onComplete(booking.id)}
                    className="inline-flex h-9 items-center gap-2 rounded-md bg-zinc-950 px-3 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:bg-zinc-300"
                  >
                    {busy ? <LoaderCircle className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle className="h-3.5 w-3.5" />}
                    完了
                  </button>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

function isPastBookingTime(booking: ManagedSalonBooking) {
  const [year, month, day] = booking.preferredDate.split('-').map(Number)
  const [hours, minutes] = booking.preferredTime.split(':').map(Number)
  return new Date(year, month - 1, day, hours, minutes).getTime() <= Date.now()
}

function currentDateSlots(slots: AvailabilitySlot[]) {
  return currentAvailabilitySlots(slots)
}

function SalonGenderGallery({
  title,
  gender,
  images,
  details,
  detailDrafts,
  emptyText,
  altText,
  busyKey,
  onDelete,
  onReplace,
  onDetailChange,
  onSaveDetails,
}: {
  title: string
  gender: HairstyleGender
  images: string[]
  details: Record<string, SalonHairstyleDetail>
  detailDrafts: Record<string, SalonHairstyleDetailDraft>
  emptyText: string
  altText: string
  busyKey: string
  onDelete: (imageUrl: string, gender: HairstyleGender) => void
  onReplace: (imageUrl: string, gender: HairstyleGender, file?: File) => void
  onDetailChange: (imageUrl: string, patch: Partial<SalonHairstyleDetailDraft>) => void
  onSaveDetails: (imageUrl: string) => void
}) {
  return (
    <section>
      <h3 className="mb-3 text-sm font-semibold text-zinc-700">{title}</h3>
      {images.length ? (
        <div className="grid gap-4 sm:grid-cols-2">
          {images.map((imageUrl) => {
            const replaceKey = `style-replace-${gender}-${imageUrl}`
            const deleteKey = `style-delete-${gender}-${imageUrl}`
            const detailKey = `style-detail-${imageUrl}`
            const isBusy = busyKey === replaceKey || busyKey === deleteKey || busyKey === detailKey
            const detail = detailDrafts[imageUrl] ?? details[imageUrl] ?? {
              priceYen: 0,
              requiresCut: false,
              requiresDye: false,
              requiresTreatment: false,
            }

            return (
              <div key={imageUrl} className="overflow-hidden rounded-md border border-zinc-200 bg-white">
                <img
                  src={imageUrl}
                  alt={`${title} ${altText}`}
                  className="aspect-[4/5] w-full object-cover"
                />
                <div className="grid gap-3 p-3">
                  <label className="block">
                    <span className="mb-1 block text-xs font-semibold text-zinc-600">価格 (JPY)</span>
                    <input
                      type="number"
                      min={0}
                      value={detail.priceYen}
                      onChange={(event) => onDetailChange(imageUrl, {
                        priceYen: event.target.value === '' ? '' : Number(event.target.value),
                      })}
                      className="h-9 w-full rounded-md border border-zinc-300 px-2 text-sm"
                    />
                  </label>
                  <div className="flex flex-wrap gap-3 text-xs font-medium text-zinc-700">
                    <label className="inline-flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={detail.requiresCut}
                        onChange={(event) => onDetailChange(imageUrl, { requiresCut: event.target.checked })}
                      />
                      剪头
                    </label>
                    <label className="inline-flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={detail.requiresDye}
                        onChange={(event) => onDetailChange(imageUrl, { requiresDye: event.target.checked })}
                      />
                      染发
                    </label>
                    <label className="inline-flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={detail.requiresTreatment}
                        onChange={(event) => onDetailChange(imageUrl, { requiresTreatment: event.target.checked })}
                      />
                      护发
                    </label>
                  </div>
                  <button
                    type="button"
                    disabled={isBusy}
                    onClick={() => onSaveDetails(imageUrl)}
                    className="inline-flex h-9 items-center justify-center gap-2 rounded-md bg-zinc-950 px-3 text-xs font-semibold text-white disabled:bg-zinc-300"
                  >
                    {busyKey === detailKey ? <LoaderCircle className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                    保存价格信息
                  </button>
                  <div className="flex flex-wrap items-center gap-2">
                  <label className="inline-flex cursor-pointer items-center gap-1 rounded-md border border-zinc-300 px-3 py-1.5 text-xs font-medium text-zinc-700 hover:border-zinc-500">
                    {busyKey === replaceKey ? (
                      <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Pencil className="h-3.5 w-3.5" />
                    )}
                    Replace
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      disabled={isBusy}
                      onChange={(event) => {
                        onReplace(imageUrl, gender, event.target.files?.[0])
                        event.target.value = ''
                      }}
                    />
                  </label>
                  <button
                    type="button"
                    disabled={isBusy}
                    onClick={() => onDelete(imageUrl, gender)}
                    className="inline-flex items-center gap-1 rounded-md border border-rose-200 px-3 py-1.5 text-xs font-medium text-rose-700 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {busyKey === deleteKey ? (
                      <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Trash2 className="h-3.5 w-3.5" />
                    )}
                    Delete
                  </button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      ) : (
        <div className="flex h-32 items-center justify-center rounded-md bg-zinc-50 text-sm text-zinc-500">
          {emptyText}
        </div>
      )}
    </section>
  )
}

function StylistAdminCard({
  stylist,
  busyKey,
  onUploadImage,
  onAddSlot,
  onChangeSlot,
  onRemoveSlot,
  onSaveSlots,
}: {
  stylist: StylistProfile
  busyKey: string
  onUploadImage: (stylistId: string, file?: File) => void
  onAddSlot: (stylist: StylistProfile, slot: AvailabilitySlot) => void
  onChangeSlot: (stylist: StylistProfile, index: number, patch: Partial<AvailabilitySlot>) => void
  onRemoveSlot: (stylist: StylistProfile, index: number) => void
  onSaveSlots: (stylistId: string, slots: AvailabilitySlot[]) => void
}) {
  const imageBusy = busyKey === `stylist-image-${stylist.id}`
  const slotsBusy = busyKey === `stylist-slots-${stylist.id}`

  return (
    <article className="rounded-md border border-zinc-200 p-4">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold">{stylist.name ?? stylist.email}</h3>
          <p className="text-sm text-zinc-500">{stylist.email}</p>
        </div>
        <label className="inline-flex h-10 cursor-pointer items-center gap-2 rounded-md bg-zinc-950 px-4 text-sm font-medium text-white">
          {imageBusy ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <ImagePlus className="h-4 w-4" />}
          Upload photo
          <input
            type="file"
            accept="image/*"
            className="hidden"
            disabled={imageBusy}
            onChange={(event) => {
              onUploadImage(stylist.id, event.target.files?.[0])
              event.target.value = ''
            }}
          />
        </label>
      </div>

      {stylist.profileImages.length ? (
        <div className="mb-5 grid gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {stylist.profileImages.map((imageUrl) => (
            <img
              key={imageUrl}
              src={imageUrl}
              alt={stylist.name ?? stylist.email}
              className="aspect-square w-full rounded-md object-cover"
            />
          ))}
        </div>
      ) : (
        <div className="mb-5 flex h-24 items-center justify-center rounded-md bg-zinc-50 text-sm text-zinc-500">
          No profile photos yet
        </div>
      )}

      <div className="mb-3 flex items-center justify-between gap-3">
        <h4 className="text-sm font-semibold text-zinc-700">Bookable time slots</h4>
      </div>

      <AvailabilityWeekEditor
        slots={stylist.availabilitySlots}
        onAddSlot={(slot) => onAddSlot(stylist, slot)}
        onChangeSlot={(index, patch) => onChangeSlot(stylist, index, patch)}
        onRemoveSlot={(index) => onRemoveSlot(stylist, index)}
      />

      <button
        type="button"
        disabled={slotsBusy}
        onClick={() => onSaveSlots(stylist.id, stylist.availabilitySlots)}
        className="mt-4 inline-flex h-10 items-center gap-2 rounded-md bg-zinc-950 px-4 text-sm font-semibold text-white disabled:bg-zinc-400"
      >
        {slotsBusy ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
        Save time slots
      </button>
    </article>
  )
}
