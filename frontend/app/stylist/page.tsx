'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ImagePlus, LoaderCircle, Save } from 'lucide-react'

import { AppNav } from '@/components/AppNav'
import { AvailabilityWeekEditor } from '@/components/AvailabilityWeekEditor'
import { getStoredAuthUser, isAuthSessionActive } from '@/services/auth'
import {
  currentAvailabilitySlots,
  getStylistProfile,
  updateStylistAvailability,
  uploadStylistImage,
  type AvailabilitySlot,
  type StylistProfile,
} from '@/services/stylist'

export default function StylistPage() {
  const router = useRouter()
  const [profile, setProfile] = useState<StylistProfile | null>(null)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState('')

  useEffect(() => {
    if (!isAuthSessionActive('stylist') || getStoredAuthUser('stylist')?.role !== 'stylist') {
      router.replace('/stylist/login')
      return
    }

    getStylistProfile()
      .then(setProfile)
      .catch(() => router.replace('/stylist/login'))
  }, [router])

  const uploadImage = async (file?: File) => {
    if (!file) return

    setBusy('image')
    setError('')
    setMessage('')
    try {
      setProfile(await uploadStylistImage(file))
      setMessage('Saved')
    } catch {
      setError('Action failed')
    } finally {
      setBusy('')
    }
  }

  const updateSlot = (index: number, patch: Partial<AvailabilitySlot>) => {
    if (!profile) return
    setProfile({
      ...profile,
      availabilitySlots: profile.availabilitySlots.map((slot, slotIndex) =>
        slotIndex === index ? { ...slot, ...patch } : slot,
      ),
    })
  }

  const addSlot = (slot: AvailabilitySlot) => {
    if (!profile) return
    setProfile({
      ...profile,
      availabilitySlots: [
        ...profile.availabilitySlots,
        slot,
      ],
    })
  }

  const removeSlot = (index: number) => {
    if (!profile) return
    setProfile({
      ...profile,
      availabilitySlots: profile.availabilitySlots.filter((_, slotIndex) => slotIndex !== index),
    })
  }

  const saveSlots = async () => {
    if (!profile) return

    setBusy('slots')
    setError('')
    setMessage('')
    try {
      setProfile(await updateStylistAvailability(currentDateSlots(profile.availabilitySlots)))
      setMessage('Saved')
    } catch {
      setError('Action failed')
    } finally {
      setBusy('')
    }
  }

  return (
    <main className="min-h-screen bg-zinc-50 px-6 py-8 text-zinc-950">
      <section className="mx-auto flex max-w-5xl flex-col gap-8">
        <AppNav />

        <div>
          <h1 className="text-3xl font-semibold">Stylist Admin</h1>
          <p className="mt-3 text-sm text-zinc-600">
            Manage profile photos and bookable time slots.
          </p>
        </div>

        {(message || error) && (
          <div className={`rounded-md px-4 py-3 text-sm ${error ? 'bg-rose-50 text-rose-700' : 'bg-emerald-50 text-emerald-800'}`}>
            {error || message}
          </div>
        )}

        {!profile ? (
          <div className="text-sm text-zinc-600">Loading...</div>
        ) : (
          <>
            <section className="rounded-lg border border-zinc-200 bg-white p-6 shadow-sm">
              <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-xl font-semibold">{profile.name ?? profile.email}</h2>
                  <p className="text-sm text-zinc-500">{profile.salonName}</p>
                </div>
                <label className="inline-flex h-11 cursor-pointer items-center gap-2 rounded-md bg-zinc-950 px-4 text-sm font-medium text-white">
                  {busy === 'image' ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <ImagePlus className="h-4 w-4" />}
                  Upload photo
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    disabled={busy === 'image'}
                    onChange={(event) => {
                      uploadImage(event.target.files?.[0])
                      event.target.value = ''
                    }}
                  />
                </label>
              </div>

              {profile.profileImages.length ? (
                <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-5">
                  {profile.profileImages.map((imageUrl) => (
                    <img key={imageUrl} src={imageUrl} alt={profile.name ?? profile.email} className="aspect-square w-full rounded-md object-cover" />
                  ))}
                </div>
              ) : (
                <div className="flex h-32 items-center justify-center rounded-md bg-zinc-50 text-sm text-zinc-500">
                  No profile photos yet
                </div>
              )}
            </section>

            <section className="rounded-lg border border-zinc-200 bg-white p-6 shadow-sm">
              <div className="mb-4">
                <h2 className="text-xl font-semibold">Bookable time slots</h2>
              </div>

              <AvailabilityWeekEditor
                slots={profile.availabilitySlots}
                onAddSlot={addSlot}
                onChangeSlot={updateSlot}
                onRemoveSlot={removeSlot}
              />

              <button
                type="button"
                onClick={saveSlots}
                disabled={busy === 'slots'}
                className="mt-5 inline-flex h-11 items-center gap-2 rounded-md bg-zinc-950 px-4 text-sm font-semibold text-white disabled:bg-zinc-400"
              >
                {busy === 'slots' ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                Save time slots
              </button>
            </section>
          </>
        )}
      </section>
    </main>
  )
}

function currentDateSlots(slots: AvailabilitySlot[]) {
  return currentAvailabilitySlots(slots)
}
