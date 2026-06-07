import type { HairstyleGender } from '@/lib/hairstyleCatalog'
import { create } from 'zustand'

interface AppState {
  customerImage: string | null
  styleImage: string | null
  uploadedImage: string | null
  selectedHairstyle: number | null
  referenceGender: HairstyleGender
  selectedSalonId: string | null
  selectedSalonName: string | null
  generatedImage: string | null
  generatedRequestKey: string | null

  setCustomerImage: (url: string) => void
  setStyleImage: (url: string, salon?: { id?: string | null; name?: string | null }) => void
  clearStyleImage: () => void
  setUploadedImage: (url: string) => void
  setSelectedHairstyle: (id: number) => void
  setReferenceGender: (gender: HairstyleGender) => void
  setGeneratedImage: (url: string, requestKey?: string) => void
}

export const useAppStore = create<AppState>((set) => ({
  customerImage: null,
  styleImage: null,
  uploadedImage: null,
  selectedHairstyle: null,
  referenceGender: 'women',
  selectedSalonId: null,
  selectedSalonName: null,
  generatedImage: null,
  generatedRequestKey: null,

  setCustomerImage: (url) => set({ customerImage: url, generatedImage: null, generatedRequestKey: null }),
  setStyleImage: (url, salon) => set({
    styleImage: url,
    selectedSalonId: salon?.id ?? null,
    selectedSalonName: salon?.name ?? null,
    generatedImage: null,
    generatedRequestKey: null,
  }),
  clearStyleImage: () => set({
    styleImage: null,
    selectedHairstyle: null,
    selectedSalonId: null,
    selectedSalonName: null,
    generatedImage: null,
    generatedRequestKey: null,
  }),
  setUploadedImage: (url) => set({ uploadedImage: url, customerImage: url, generatedImage: null, generatedRequestKey: null }),
  setSelectedHairstyle: (id) => set({ selectedHairstyle: id }),
  setReferenceGender: (gender) => set({ referenceGender: gender }),
  setGeneratedImage: (url, requestKey) => set({ generatedImage: url, generatedRequestKey: requestKey ?? null }),
}))
