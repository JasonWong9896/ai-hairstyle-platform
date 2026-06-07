import { api } from './api'
import { authHeaders } from './auth'
import type { Hairstyle, HairstyleGender } from '@/lib/hairstyleCatalog'

export type SalonProfile = {
  id: string
  name: string
  homepageUrl: string | null
  specialtyImages: string[]
  specialtyImagesWomen: string[]
  specialtyImagesMen: string[]
  introImages: string[]
  mainIntroImageUrl: string | null
  hairstyleDetails: Record<string, SalonHairstyleDetail>
  updatedAt: string | null
}

export type SalonHairstyleDetail = {
  priceYen: number
  requiresCut: boolean
  requiresDye: boolean
  requiresTreatment: boolean
}

export type PublicSalonHairstyle = {
  id: string
  salonId: string
  image: string
  gender: HairstyleGender
  salonName: string
  salonHomepageUrl: string | null
  priceYen: number
  requiresCut: boolean
  requiresDye: boolean
  requiresTreatment: boolean
}

export type PublicSalon = {
  id: string
  name: string
  homepageUrl: string | null
  specialtyImages: string[]
  specialtyImagesWomen: string[]
  specialtyImagesMen: string[]
  introImages: string[]
  mainIntroImageUrl: string | null
  hairstyleDetails: Record<string, SalonHairstyleDetail>
  updatedAt: string | null
}

export async function getSalonProfile() {
  const res = await api.get<SalonProfile>('/salon/me', {
    headers: authHeaders('salon'),
  })

  return res.data
}

export async function updateSalonProfile(input: { homepageUrl?: string; mainIntroImageUrl?: string | null }) {
  const res = await api.patch<SalonProfile>('/salon/me', input, {
    headers: authHeaders('salon'),
  })

  return res.data
}

export async function uploadSalonImage(file: File, gender: HairstyleGender) {
  const formData = new FormData()
  formData.append('file', file)
  formData.append('gender', gender)

  const res = await api.post<SalonProfile>('/salon/images', formData, {
    headers: authHeaders('salon'),
  })

  return res.data
}

export async function deleteSalonImage(imageUrl: string, gender: HairstyleGender) {
  const res = await api.delete<SalonProfile>('/salon/images', {
    headers: authHeaders('salon'),
    data: { imageUrl, gender },
  })

  return res.data
}

export async function replaceSalonImage(imageUrl: string, file: File, gender: HairstyleGender) {
  const formData = new FormData()
  formData.append('file', file)
  formData.append('imageUrl', imageUrl)
  formData.append('gender', gender)

  const res = await api.patch<SalonProfile>('/salon/images', formData, {
    headers: authHeaders('salon'),
  })

  return res.data
}

export async function updateSalonImageDetails(input: {
  imageUrl: string
  priceYen: number
  requiresCut: boolean
  requiresDye: boolean
  requiresTreatment: boolean
}) {
  const res = await api.patch<SalonProfile>('/salon/images/details', input, {
    headers: authHeaders('salon'),
  })

  return res.data
}

export async function uploadSalonIntroImage(file: File) {
  const formData = new FormData()
  formData.append('file', file)

  const res = await api.post<SalonProfile>('/salon/intro-images', formData, {
    headers: authHeaders('salon'),
  })

  return res.data
}

export async function deleteSalonIntroImage(imageUrl: string) {
  const res = await api.delete<SalonProfile>('/salon/intro-images', {
    headers: authHeaders('salon'),
    data: { imageUrl },
  })

  return res.data
}

export async function replaceSalonIntroImage(imageUrl: string, file: File) {
  const formData = new FormData()
  formData.append('file', file)
  formData.append('imageUrl', imageUrl)

  const res = await api.patch<SalonProfile>('/salon/intro-images', formData, {
    headers: authHeaders('salon'),
  })

  return res.data
}

export async function getPublicSalonHairstyles() {
  const res = await api.get<PublicSalonHairstyle[]>('/salon/hairstyles')

  return res.data
}

export async function getPublicSalons() {
  const res = await api.get<PublicSalon[]>('/salon/public')

  return res.data
}

export async function getPublicSalon(salonId: string) {
  const res = await api.get<PublicSalon>(`/salon/public/${salonId}`)

  return res.data
}

export function toSalonHairstyles(items: PublicSalonHairstyle[]): Hairstyle[] {
  return items.map((item, index) => ({
    id: (item.gender === 'women' ? 900000 : 950000) + index,
    gender: item.gender,
    category: 'salon',
    image: item.image,
    salonName: item.salonName,
    salonId: item.salonId,
    salonHomepageUrl: item.salonHomepageUrl,
    priceYen: item.priceYen,
    requiresCut: item.requiresCut,
    requiresDye: item.requiresDye,
    requiresTreatment: item.requiresTreatment,
  }))
}
