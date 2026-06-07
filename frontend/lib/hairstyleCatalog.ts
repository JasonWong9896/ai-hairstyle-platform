export type HairstyleGender = 'women' | 'men'
export type HairstyleCategoryKey =
  | 'short'
  | 'bob'
  | 'medium'
  | 'long'
  | 'perm'
  | 'layer'
  | 'business'
  | 'centerPart'
  | 'wolfLayer'
  | 'natural'
  | 'salon'

export interface Hairstyle {
  id: number
  gender: HairstyleGender
  category: HairstyleCategoryKey
  image: string
  salonId?: string
  salonName?: string
  salonHomepageUrl?: string | null
  priceYen?: number
  requiresCut?: boolean
  requiresDye?: boolean
  requiresTreatment?: boolean
}

export const hairstyleCategories = {
  women: ['short', 'bob', 'medium', 'long', 'perm', 'layer', 'salon'],
  men: ['short', 'business', 'centerPart', 'perm', 'wolfLayer', 'natural', 'salon'],
} as const

export const hairstyleCategoryLabels = {
  ja: {
    short: 'ショート',
    bob: 'ボブ',
    medium: 'ミディアム',
    long: 'ロング',
    perm: 'パーマ',
    layer: 'レイヤー',
    business: 'ビジネス',
    centerPart: 'センターパート',
    wolfLayer: 'ウルフ / レイヤー',
    natural: 'ナチュラル',
  },
  en: {
    short: 'Short',
    bob: 'Bob',
    medium: 'Medium',
    long: 'Long',
    perm: 'Perm',
    layer: 'Layers',
    business: 'Business',
    centerPart: 'Center Part',
    wolfLayer: 'Wolf / Layers',
    natural: 'Natural',
  },
  zh: {
    short: '短发',
    bob: '波波头',
    medium: '中长发',
    long: '长发',
    perm: '卷发 / 烫发',
    layer: '层次感',
    business: '商务清爽',
    centerPart: '中分',
    wolfLayer: '狼尾 / 层次',
    natural: '自然休闲',
  },
} as const

export function hairstyleCategoryLabel(
  labels: (typeof hairstyleCategoryLabels)[keyof typeof hairstyleCategoryLabels],
  category: HairstyleCategoryKey,
) {
  return category === 'salon' ? 'Salon' : labels[category]
}

const womenImages = [
  'hotpepper_004720dfef6f86.jpg',
  'hotpepper_00e4e237589fca.jpg',
  'hotpepper_0166494133cfea.jpg',
  'hotpepper_0193668a1d6adb.jpg',
  'hotpepper_01ee6061303bc5.jpg',
  'hotpepper_0217f83cbc74d0.jpg',
  'hotpepper_023d6b6988d3cf.jpg',
  'hotpepper_0253f33ac379d6.jpg',
  'hotpepper_02797bf145788d.jpg',
  'hotpepper_02d24a4de45f28.jpg',
  'hotpepper_02d53ac7c298e9.jpg',
  'hotpepper_03358478ea6363.jpg',
  'hotpepper_033b7a3733cfd7.jpg',
  'hotpepper_0379d4bba98946.jpg',
  'hotpepper_043f7f599a5319.jpg',
  'hotpepper_049b4a31215c43.jpg',
  'hotpepper_0573291e1fdc2d.jpg',
  'hotpepper_05a54299701237.jpg',
  'hotpepper_05fa905065a49d.jpg',
  'hotpepper_06114f460a13ac.jpg',
  'hotpepper_061bfd59e9b6a3.jpg',
  'hotpepper_061f1c450f70cd.jpg',
  'hotpepper_06865915800e84.jpg',
  'hotpepper_068ff546486d2b.jpg',
  'hotpepper_0692aca4f4e70a.jpg',
  'hotpepper_06aaa7cfa2d0fc.jpg',
  'hotpepper_06d44c642c8ef0.jpg',
  'hotpepper_0715aa8bcb3848.jpg',
  'hotpepper_07b17557275913.jpg',
  'hotpepper_07e413f35d945f.jpg',
  'hotpepper_07eb9f1895da10.jpg',
  'hotpepper_07ff2c72f4737a.jpg',
  'hotpepper_088236ca87a36b.jpg',
  'hotpepper_089cf9328bb4db.jpg',
  'hotpepper_08c66fcd1e2c93.jpg',
  'hotpepper_08d30b4ffcaeed.jpg',
]

const menImages = [
  'hotpepper_0037cb486612b3.jpg',
  'hotpepper_008725f76b1078.jpg',
  'hotpepper_00fc195c61c319.jpg',
  'hotpepper_0147ae33eb0ccf.jpg',
  'hotpepper_019ba1e73e1d90.jpg',
  'hotpepper_01e5cd2b13e786.jpg',
  'hotpepper_0256da48c32581.jpg',
  'hotpepper_0261ace0b13017.jpg',
  'hotpepper_03139c7df609c0.jpg',
  'hotpepper_03c12cd69b4965.jpg',
  'hotpepper_03dc215ed8d4d9.jpg',
  'hotpepper_051b7bdf2753e1.jpg',
  'hotpepper_0521fed61cf3fd.jpg',
  'hotpepper_05748e61610676.jpg',
  'hotpepper_059b2c3e544fbb.jpg',
  'hotpepper_0690482b62e3d3.jpg',
  'hotpepper_06c52e52307b6e.jpg',
  'hotpepper_076249f16c083f.jpg',
  'hotpepper_07a3a64076d688.jpg',
  'hotpepper_087df32a8a8dae.jpg',
  'hotpepper_09068836baa04b.jpg',
  'hotpepper_09f5e086c45cb0.jpg',
  'hotpepper_0c4257860cb0ad.jpg',
  'hotpepper_0c57e312196488.jpg',
  'hotpepper_0c7329d9e81152.jpg',
  'hotpepper_0cf52558aed38a.jpg',
  'hotpepper_0ee39db0657389.jpg',
  'hotpepper_0f9d42c19b375f.jpg',
  'hotpepper_108f4aa60caffc.jpg',
  'hotpepper_10eccf930720d9.jpg',
  'hotpepper_118c1742f2eca7.jpg',
  'hotpepper_131e332cf58d97.jpg',
  'hotpepper_13d2d446e76561.jpg',
  'hotpepper_14c56d10d5ea8c.jpg',
  'hotpepper_153c08832ed8a5.jpg',
  'hotpepper_1547982e3d56e4.jpg',
]

export const hairstyles = [
  ...buildHairstyles('women', womenImages),
  ...buildHairstyles('men', menImages),
]

export function getHairstylesByGender(gender: HairstyleGender) {
  return hairstyles.filter((style) => style.gender === gender)
}

function buildHairstyles(gender: HairstyleGender, filenames: string[]): Hairstyle[] {
  const categoryList = hairstyleCategories[gender].filter((category) => category !== 'salon')

  return filenames.map((filename, index) => ({
    id: gender === 'women' ? index + 1 : index + 1001,
    gender,
    category: categoryList[Math.floor(index / 6)] ?? categoryList[categoryList.length - 1],
    image: `/hairstyles/hotpepper/${gender}/${filename}`,
  }))
}
