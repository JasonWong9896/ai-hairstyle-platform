import { api } from './api'
import { authHeaders } from './auth'
import type { HairstyleGender } from '@/lib/hairstyleCatalog'

export type SalonBookingInput = {
  salonId: string
  stylistId?: string
  customerName: string
  customerEmail: string
  styleImageUrl?: string
  styleGender?: HairstyleGender
  paymentMethod?: 'card' | 'points'
  preferredDate: string
  preferredTime: string
}

export type SalonAvailabilitySlot = {
  time: string
  label: string
  stylistIds: string[]
}

export type ManagedSalonBooking = {
  id: string
  salonId: string
  stylistId: string | null
  stylistName: string | null
  stylistEmail: string | null
  customerName: string
  customerEmail: string
  styleImageUrl: string | null
  styleGender: HairstyleGender | null
  preferredDate: string
  preferredTime: string
  status: string
  paymentStatus: string
  paymentAmountYen: number
  checkoutSessionId: string | null
  completedAt: string | null
  createdAt: string
}

export type SalonBookingResponse = {
  id: string
  checkoutUrl: string | null
  checkoutSessionId: string | null
  paymentStatus: string
  paymentAmountYen: number
  wallet?: {
    pointsBalance: number
    lifetimePoints: number
    updatedAt: string
  } | null
}

export async function createSalonBooking(input: SalonBookingInput) {
  const res = await api.post<SalonBookingResponse>('/bookings/salon', input, {
    headers: authHeaders('customer'),
  })
  return res.data
}

export async function getManagedSalonBookings() {
  const res = await api.get<ManagedSalonBooking[]>('/bookings/salon/manage', {
    headers: authHeaders('salon'),
  })

  return res.data
}

export async function completeManagedSalonBooking(bookingId: string) {
  const res = await api.patch<ManagedSalonBooking>(
    `/bookings/salon/manage/${bookingId}/complete`,
    undefined,
    { headers: authHeaders('salon') },
  )

  return res.data
}

export async function getSalonBookingAvailability(input: {
  salonId: string
  date: string
  stylistId?: string
}) {
  const params = new URLSearchParams({ date: input.date })
  if (input.stylistId) {
    params.set('stylistId', input.stylistId)
  }

  const res = await api.get<{ slots: SalonAvailabilitySlot[] }>(
    `/bookings/salon/${input.salonId}/availability?${params.toString()}`,
  )

  return res.data
}
