import { api } from './api'
import { authHeaders } from './auth'

export type MemberWallet = {
  pointsBalance: number
  lifetimePoints: number
  updatedAt: string
}

export type MemberBankAccount = {
  id: string
  bankName: string
  accountName: string
  accountNumberLast4: string
  createdAt: string
}

export type MemberRecharge = {
  id: string
  bankAccountId: string | null
  amount: number
  points: number
  paymentProvider: 'bank_transfer' | 'stripe_checkout'
  status: 'pending' | 'confirmed' | 'cancelled'
  transferReference: string | null
  createdAt: string
  confirmedAt: string | null
}

export type MemberTransaction = {
  id: string
  pointsDelta: number
  balanceAfter: number
  reason: string
  createdAt: string
}

export type MemberWalletResponse = {
  wallet: MemberWallet
  rechargePolicy: {
    currency: string
    pointsPerCurrencyUnit: number
    confirmationMode: 'manual'
  }
  bankAccounts: MemberBankAccount[]
  recharges: MemberRecharge[]
  transactions: MemberTransaction[]
}

export type RechargeInput = {
  amount: number
  bankAccountId?: string
  bankName?: string
  accountName?: string
  accountNumber?: string
  transferReference?: string
}

export async function getMemberWallet() {
  const res = await api.get<MemberWalletResponse>('/member/wallet', {
    headers: authHeaders('customer'),
  })

  return res.data
}

export async function createBankRecharge(input: RechargeInput) {
  const res = await api.post<{ recharge: MemberRecharge }>(
    '/member/recharges',
    input,
    { headers: authHeaders('customer') },
  )

  return res.data
}

export async function createStripeCheckout(amount: number) {
  const res = await api.post<{
    checkoutUrl: string
    checkoutSessionId: string
    recharge: MemberRecharge
  }>(
    '/member/stripe/checkout',
    { amount },
    { headers: authHeaders('customer') },
  )

  return res.data
}
