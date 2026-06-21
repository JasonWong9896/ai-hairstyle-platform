'use client'

import { FormEvent, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ChevronLeft, ExternalLink, ImagePlus, LoaderCircle, LockKeyhole, Pencil, Save, Trash2 } from 'lucide-react'

import { AppNav } from '@/components/AppNav'
import { copy } from '@/lib/i18n'
import { useLanguage } from '@/lib/useLanguage'
import { isUnauthorizedError } from '@/services/api'
import { changeEmail, changePassword, getStoredAuthUser, isAuthSessionActive } from '@/services/auth'
import {
  deleteSalonIntroImage,
  getSalonProfile,
  replaceSalonIntroImage,
  updateSalonProfile,
  uploadSalonIntroImage,
  type SalonProfile,
} from '@/services/salon'

export default function SalonBasicInfoPage() {
  const router = useRouter()
  const { language } = useLanguage()
  const labels = copy[language].salonAdmin
  const [profile, setProfile] = useState<SalonProfile | null>(null)
  const [homepageUrl, setHomepageUrl] = useState('')
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [emailCurrentPassword, setEmailCurrentPassword] = useState('')
  const [newEmail, setNewEmail] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [savingProfile, setSavingProfile] = useState(false)
  const [savingPassword, setSavingPassword] = useState(false)
  const [savingEmail, setSavingEmail] = useState(false)
  const [uploadingIntro, setUploadingIntro] = useState(false)
  const [savingMainImage, setSavingMainImage] = useState(false)
  const [imageActionKey, setImageActionKey] = useState('')

  useEffect(() => {
    if (!isAuthSessionActive('salon')) {
      router.replace('/salon/login')
      return
    }

    getSalonProfile()
      .then((salonData) => {
        setProfile(salonData)
        setHomepageUrl(salonData.homepageUrl ?? '')
        setNewEmail(getStoredAuthUser('salon')?.email ?? '')
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

  const saveProfile = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError('')
    setMessage('')
    setSavingProfile(true)

    try {
      const data = await updateSalonProfile({ homepageUrl })
      setProfile(data)
      setHomepageUrl(data.homepageUrl ?? '')
      setMessage(labels.saved)
    } catch {
      setError(labels.error)
    } finally {
      setSavingProfile(false)
    }
  }

  const savePassword = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError('')
    setMessage('')
    setSavingPassword(true)

    try {
      await changePassword({ currentPassword, newPassword }, 'salon')
      setCurrentPassword('')
      setNewPassword('')
      setMessage(labels.passwordSaved)
    } catch {
      setError(labels.error)
    } finally {
      setSavingPassword(false)
    }
  }

  const saveEmail = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError('')
    setMessage('')
    setSavingEmail(true)

    try {
      const auth = await changeEmail({ newEmail, currentPassword: emailCurrentPassword }, 'salon')
      setNewEmail(auth.user.email)
      setEmailCurrentPassword('')
      setMessage(labels.saved)
    } catch {
      setError(labels.error)
    } finally {
      setSavingEmail(false)
    }
  }

  const uploadIntroImage = async (file?: File) => {
    if (!file) return

    setError('')
    setMessage('')
    setUploadingIntro(true)

    try {
      const data = await uploadSalonIntroImage(file)
      setProfile(data)
      setMessage(labels.saved)
    } catch {
      setError(labels.error)
    } finally {
      setUploadingIntro(false)
    }
  }

  const setMainIntroImage = async (imageUrl: string) => {
    setError('')
    setMessage('')
    setSavingMainImage(true)

    try {
      const data = await updateSalonProfile({ homepageUrl, mainIntroImageUrl: imageUrl })
      setProfile(data)
      setHomepageUrl(data.homepageUrl ?? '')
      setMessage(labels.saved)
    } catch {
      setError(labels.error)
    } finally {
      setSavingMainImage(false)
    }
  }

  const removeIntroImage = async (imageUrl: string) => {
    setError('')
    setMessage('')
    setImageActionKey(`intro-delete-${imageUrl}`)

    try {
      const data = await deleteSalonIntroImage(imageUrl)
      setProfile(data)
      setMessage(labels.saved)
    } catch {
      setError(labels.error)
    } finally {
      setImageActionKey('')
    }
  }

  const replaceIntroImage = async (imageUrl: string, file?: File) => {
    if (!file) return

    setError('')
    setMessage('')
    setImageActionKey(`intro-replace-${imageUrl}`)

    try {
      const data = await replaceSalonIntroImage(imageUrl, file)
      setProfile(data)
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
          <Link href="/salon" className="mb-4 inline-flex items-center gap-2 text-sm font-medium text-teal-700">
            <ChevronLeft className="h-4 w-4" />
            Salon管理へ戻る
          </Link>
          <h1 className="text-3xl font-semibold md:text-4xl">基本情報管理</h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-zinc-600">
            アカウント設定、Salon email、ホームページリンク、Salon intro images を管理します。
          </p>
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
                  <h2 className="text-xl font-semibold">Salon intro images</h2>
                  <p className="mt-1 text-sm text-zinc-600">
                    Images shown on the salon selection page. The main image appears first in the slide.
                  </p>
                </div>

                <label className="inline-flex h-11 cursor-pointer items-center gap-2 rounded-md bg-zinc-950 px-4 text-sm font-medium text-white">
                  {uploadingIntro ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <ImagePlus className="h-4 w-4" />}
                  Upload intro image
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    disabled={uploadingIntro}
                    onChange={(event) => {
                      uploadIntroImage(event.target.files?.[0])
                      event.target.value = ''
                    }}
                  />
                </label>
              </div>

              {profile?.introImages.length ? (
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  {profile.introImages.map((imageUrl) => {
                    const isMain = profile.mainIntroImageUrl === imageUrl
                    const isBusy = imageActionKey.includes(imageUrl)

                    return (
                      <div key={imageUrl} className="overflow-hidden rounded-md border border-zinc-200 bg-white">
                        <img
                          src={imageUrl}
                          alt="Salon intro"
                          className="aspect-[4/3] w-full object-cover"
                        />
                        <div className="flex flex-wrap items-center justify-between gap-2 p-3">
                          <span className={`text-xs font-semibold ${isMain ? 'text-emerald-700' : 'text-zinc-500'}`}>
                            {isMain ? 'Main image' : 'Intro image'}
                          </span>
                          <button
                            type="button"
                            disabled={isMain || savingMainImage || isBusy}
                            onClick={() => setMainIntroImage(imageUrl)}
                            className="rounded-md border border-zinc-300 px-3 py-1.5 text-xs font-medium disabled:cursor-not-allowed disabled:border-zinc-200 disabled:text-zinc-400"
                          >
                            Set main
                          </button>
                          <label className="inline-flex cursor-pointer items-center gap-1 rounded-md border border-zinc-300 px-3 py-1.5 text-xs font-medium text-zinc-700 hover:border-zinc-500">
                            {imageActionKey === `intro-replace-${imageUrl}` ? (
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
                                replaceIntroImage(imageUrl, event.target.files?.[0])
                                event.target.value = ''
                              }}
                            />
                          </label>
                          <button
                            type="button"
                            disabled={isBusy}
                            onClick={() => removeIntroImage(imageUrl)}
                            className="inline-flex items-center gap-1 rounded-md border border-rose-200 px-3 py-1.5 text-xs font-medium text-rose-700 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            {imageActionKey === `intro-delete-${imageUrl}` ? (
                              <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <Trash2 className="h-3.5 w-3.5" />
                            )}
                            Delete
                          </button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              ) : (
                <div className="flex h-32 items-center justify-center rounded-md bg-zinc-50 text-sm text-zinc-500">
                  No salon intro images yet
                </div>
              )}
            </section>

            <div className="grid gap-6 lg:grid-cols-3">
              <form onSubmit={savePassword} className="rounded-lg border border-zinc-200 bg-white p-6 shadow-sm">
                <h2 className="mb-5 text-xl font-semibold">{labels.account}</h2>

                <label className="mb-4 block">
                  <span className="mb-2 block text-sm font-medium text-zinc-700">{labels.currentPassword}</span>
                  <input
                    type="password"
                    value={currentPassword}
                    onChange={(event) => setCurrentPassword(event.target.value)}
                    className="h-11 w-full rounded-md border border-zinc-300 px-3 outline-none focus:border-teal-600"
                    minLength={8}
                    required
                  />
                </label>

                <label className="mb-5 block">
                  <span className="mb-2 block text-sm font-medium text-zinc-700">{labels.newPassword}</span>
                  <input
                    type="password"
                    value={newPassword}
                    onChange={(event) => setNewPassword(event.target.value)}
                    className="h-11 w-full rounded-md border border-zinc-300 px-3 outline-none focus:border-teal-600"
                    minLength={8}
                    required
                  />
                </label>

                <button
                  type="submit"
                  disabled={savingPassword}
                  className="flex h-11 w-full items-center justify-center gap-2 rounded-md bg-zinc-950 px-4 font-medium text-white disabled:bg-zinc-400"
                >
                  {savingPassword ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <LockKeyhole className="h-4 w-4" />}
                  {labels.savePassword}
                </button>
              </form>

              <form onSubmit={saveProfile} className="rounded-lg border border-zinc-200 bg-white p-6 shadow-sm">
                <h2 className="mb-5 text-xl font-semibold">{labels.profile}</h2>

                <label className="mb-4 block">
                  <span className="mb-2 block text-sm font-medium text-zinc-700">{labels.homepage}</span>
                  <input
                    type="url"
                    value={homepageUrl}
                    onChange={(event) => setHomepageUrl(event.target.value)}
                    className="h-11 w-full rounded-md border border-zinc-300 px-3 outline-none focus:border-teal-600"
                    placeholder="https://example-salon.jp"
                  />
                </label>

                <div className="mb-5 flex min-h-11 items-center rounded-md bg-zinc-50 px-3 text-sm text-zinc-600">
                  {profile?.homepageUrl ? (
                    <a className="inline-flex items-center gap-2 text-teal-700" href={profile.homepageUrl} target="_blank">
                      <ExternalLink className="h-4 w-4" />
                      {labels.openHomepage}
                    </a>
                  ) : (
                    labels.emptyHomepage
                  )}
                </div>

                <button
                  type="submit"
                  disabled={savingProfile}
                  className="flex h-11 w-full items-center justify-center gap-2 rounded-md bg-zinc-950 px-4 font-medium text-white disabled:bg-zinc-400"
                >
                  {savingProfile ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  {labels.saveHomepage}
                </button>
              </form>

              <form onSubmit={saveEmail} className="rounded-lg border border-zinc-200 bg-white p-6 shadow-sm">
                <h2 className="mb-5 text-xl font-semibold">Salon email</h2>

                <label className="mb-4 block">
                  <span className="mb-2 block text-sm font-medium text-zinc-700">New email / Login ID</span>
                  <input
                    type="email"
                    value={newEmail}
                    onChange={(event) => setNewEmail(event.target.value)}
                    className="h-11 w-full rounded-md border border-zinc-300 px-3 outline-none focus:border-teal-600"
                    required
                  />
                </label>

                <label className="mb-5 block">
                  <span className="mb-2 block text-sm font-medium text-zinc-700">{labels.currentPassword}</span>
                  <input
                    type="password"
                    value={emailCurrentPassword}
                    onChange={(event) => setEmailCurrentPassword(event.target.value)}
                    className="h-11 w-full rounded-md border border-zinc-300 px-3 outline-none focus:border-teal-600"
                    minLength={8}
                    required
                  />
                </label>

                <button
                  type="submit"
                  disabled={savingEmail}
                  className="flex h-11 w-full items-center justify-center gap-2 rounded-md bg-zinc-950 px-4 font-medium text-white disabled:bg-zinc-400"
                >
                  {savingEmail ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  Save email
                </button>
              </form>
            </div>
          </>
        )}
      </section>
    </main>
  )
}
