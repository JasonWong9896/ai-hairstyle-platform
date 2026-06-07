import { api } from './api'
import { authHeaders } from './auth'

export type AvailabilitySlot = {
  date: string
  dayOfWeek?: number
  startTime: string
  endTime: string
}

export type StylistProfile = {
  id: string
  email: string
  name: string | null
  salonId: string
  salonName: string | null
  profileImages: string[]
  availabilitySlots: AvailabilitySlot[]
  updatedAt: string | null
}

export async function getSalonStylists() {
  const res = await api.get<StylistProfile[]>('/salon/stylists', {
    headers: authHeaders('salon'),
  })

  return res.data
}

export async function getPublicSalonStylists(salonId: string) {
  const res = await api.get<StylistProfile[]>(`/stylist/public/salon/${salonId}`)

  return res.data
}

export async function createSalonStylist(input: { email: string; password: string; name?: string }) {
  const res = await api.post<StylistProfile>('/salon/stylists', input, {
    headers: authHeaders('salon'),
  })

  return res.data
}

export async function uploadSalonStylistImage(stylistId: string, file: File) {
  const formData = new FormData()
  formData.append('file', file)

  const res = await api.post<StylistProfile>(`/salon/stylists/${stylistId}/images`, formData, {
    headers: authHeaders('salon'),
  })

  return res.data
}

export async function updateSalonStylistAvailability(stylistId: string, slots: AvailabilitySlot[]) {
  const res = await api.patch<StylistProfile>(
    `/salon/stylists/${stylistId}/availability`,
    { slots },
    { headers: authHeaders('salon') },
  )

  return res.data
}

export async function getStylistProfile() {
  const res = await api.get<StylistProfile>('/stylist/me', {
    headers: authHeaders('stylist'),
  })

  return res.data
}

export async function uploadStylistImage(file: File) {
  const formData = new FormData()
  formData.append('file', file)

  const res = await api.post<StylistProfile>('/stylist/me/images', formData, {
    headers: authHeaders('stylist'),
  })

  return res.data
}

export async function updateStylistAvailability(slots: AvailabilitySlot[]) {
  const res = await api.patch<StylistProfile>(
    '/stylist/me/availability',
    { slots },
    { headers: authHeaders('stylist') },
  )

  return res.data
}

export function currentAvailabilitySlots(slots: AvailabilitySlot[]) {
  return slots.filter(isCurrentAvailabilitySlot)
}

export function isCurrentAvailabilitySlot(slot: AvailabilitySlot) {
  return isDateInAvailabilityWindow(slot.date) && !isPastSlot(slot)
}

function isDateInAvailabilityWindow(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false
  }

  const date = parseDateOnly(value)
  if (!date || toDateInputValue(date) !== value) {
    return false
  }

  const today = dateOnly(new Date())
  const latest = new Date(today)
  latest.setMonth(latest.getMonth() + 1)

  return date >= today && date <= latest
}

function parseDateOnly(value: string) {
  const [year, month, day] = value.split('-').map(Number)
  const date = new Date(year, month - 1, day)

  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return null
  }

  return dateOnly(date)
}

function dateOnly(value: Date) {
  return new Date(value.getFullYear(), value.getMonth(), value.getDate())
}

function toDateInputValue(value: Date) {
  const year = value.getFullYear()
  const month = String(value.getMonth() + 1).padStart(2, '0')
  const day = String(value.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function isPastSlot(slot: AvailabilitySlot) {
  if (slot.date !== toDateInputValue(new Date())) {
    return false
  }

  if (!/^\d{2}:\d{2}$/.test(slot.startTime)) {
    return true
  }

  return minutesFromTime(slot.startTime) <= currentMinutes()
}

function currentMinutes() {
  const now = new Date()
  return now.getHours() * 60 + now.getMinutes()
}

function minutesFromTime(value: string) {
  const [hours, minutes] = value.split(':').map(Number)
  return hours * 60 + minutes
}
