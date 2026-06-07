'use client'

import { FormEvent, ReactNode, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  Banknote,
  CheckCircle2,
  Clock3,
  Coins,
  CreditCard,
  History as HistoryIcon,
  Landmark,
  LoaderCircle,
  ReceiptText,
  ShieldCheck,
  WalletCards,
} from 'lucide-react'

import { AppNav } from '@/components/AppNav'
import { useLanguage } from '@/lib/useLanguage'
import {
  createBankRecharge,
  createStripeCheckout,
  getMemberWallet,
  type MemberRecharge,
  type MemberWalletResponse,
} from '@/services/member'
import { isAuthSessionActive } from '@/services/auth'

type PaymentMode = 'card' | 'bank'

const memberCopy = {
  ja: {
    title: 'メンバーポイント',
    subtitle: 'JPYでチャージし、AIプレビューや予約関連サービスに使えるポイントを管理します。',
    back: '戻る',
    tryOn: 'AI試着',
    currentPoints: '現在のポイント',
    lifetimePoints: '累計ポイント',
    bankAccounts: '銀行口座',
    secured: 'Stripe決済と署名付きWebhookで入金を確認します',
    rechargeTitle: 'ポイントチャージ',
    amount: 'チャージ金額',
    cardMode: 'カード',
    bankMode: '銀行振込',
    cardTitle: 'Stripe Checkoutで支払う',
    cardDescription: 'カード情報はStripeの決済画面で安全に処理されます。支払い完了後、Webhook確認でポイントが反映されます。',
    cardButton: 'Stripeでカード決済',
    bankTitle: '銀行振込の申請',
    bankDescription: '振込情報を送信すると保留中のチャージとして記録されます。管理者の入金確認後にポイントが反映されます。',
    bankAccount: '銀行口座',
    newAccount: '新しい口座を使う',
    ending: '下4桁',
    bankName: '銀行名',
    accountName: '口座名義',
    accountNumber: '口座番号',
    transferReference: '振込メモ',
    transferPlaceholder: '振込番号またはメモ',
    bankButton: '振込申請を送信',
    activity: 'チャージ履歴',
    ledger: 'ポイント履歴',
    noRecharges: 'チャージ履歴はまだありません',
    noLedger: 'ポイント履歴はまだありません',
    rate: '1 JPY = 1 point',
    credited: '反映済み',
    pending: '確認待ち',
    cancelled: 'キャンセル',
    stripe: 'Stripe Checkout',
    bankTransfer: '銀行振込',
    bankRecharge: '銀行チャージ',
    stripeRecharge: 'Stripeチャージ',
    balanceAfter: '反映後残高',
    loading: '読み込み中...',
    loadError: 'メンバーポイントを読み込めませんでした',
    submitError: 'チャージ申請を送信できませんでした',
    stripeError: 'Stripe Checkoutを開始できませんでした',
    submitted: 'チャージ申請を送信しました。確認後にポイントが反映されます。',
  },
  en: {
    title: 'Member Points',
    subtitle: 'Recharge in JPY and manage points for AI previews and booking-related services.',
    back: 'Back',
    tryOn: 'AI Try-on',
    currentPoints: 'Current points',
    lifetimePoints: 'Lifetime points',
    bankAccounts: 'Bank accounts',
    secured: 'Payments are confirmed through Stripe and signed webhooks',
    rechargeTitle: 'Recharge points',
    amount: 'Recharge amount',
    cardMode: 'Card',
    bankMode: 'Bank transfer',
    cardTitle: 'Pay with Stripe Checkout',
    cardDescription: 'Card details are handled securely on Stripe Checkout. Points are credited after Stripe confirms payment by webhook.',
    cardButton: 'Pay by card with Stripe',
    bankTitle: 'Submit bank transfer',
    bankDescription: 'Send transfer details to create a pending recharge. Points are credited after admin confirmation.',
    bankAccount: 'Bank account',
    newAccount: 'Use a new account',
    ending: 'ending',
    bankName: 'Bank name',
    accountName: 'Account name',
    accountNumber: 'Account number',
    transferReference: 'Transfer reference',
    transferPlaceholder: 'Bank trace id or payment memo',
    bankButton: 'Submit transfer request',
    activity: 'Recharge activity',
    ledger: 'Point ledger',
    noRecharges: 'No recharge records yet',
    noLedger: 'No point ledger entries yet',
    rate: '1 JPY = 1 point',
    credited: 'Credited',
    pending: 'Pending',
    cancelled: 'Cancelled',
    stripe: 'Stripe Checkout',
    bankTransfer: 'Bank transfer',
    bankRecharge: 'Bank recharge',
    stripeRecharge: 'Stripe recharge',
    balanceAfter: 'Balance after credit',
    loading: 'Loading...',
    loadError: 'Unable to load member points',
    submitError: 'Unable to submit recharge',
    stripeError: 'Unable to start Stripe Checkout',
    submitted: 'Recharge request submitted. Points are added after confirmation.',
  },
  zh: {
    title: '会员积分',
    subtitle: '使用日币充值积分，用于AI试发型和预约相关服务。',
    back: '返回',
    tryOn: 'AI试发型',
    currentPoints: '当前积分',
    lifetimePoints: '累计积分',
    bankAccounts: '银行账户',
    secured: '通过Stripe支付和签名Webhook确认入账',
    rechargeTitle: '积分充值',
    amount: '充值金额',
    cardMode: '信用卡',
    bankMode: '银行转账',
    cardTitle: '使用Stripe Checkout支付',
    cardDescription: '信用卡信息由Stripe托管页面安全处理。Stripe通过Webhook确认支付后，积分自动入账。',
    cardButton: '使用Stripe信用卡支付',
    bankTitle: '提交银行转账记录',
    bankDescription: '提交后会生成待确认充值单，管理员确认到账后积分入账。',
    bankAccount: '银行账户',
    newAccount: '使用新账户',
    ending: '尾号',
    bankName: '银行名称',
    accountName: '户名',
    accountNumber: '银行账号',
    transferReference: '转账备注',
    transferPlaceholder: '银行流水号或付款备注',
    bankButton: '提交转账申请',
    activity: '充值记录',
    ledger: '积分流水',
    noRecharges: '暂无充值记录',
    noLedger: '暂无积分流水',
    rate: '1 JPY = 1 point',
    credited: '已入账',
    pending: '待确认',
    cancelled: '已取消',
    stripe: 'Stripe Checkout',
    bankTransfer: '银行转账',
    bankRecharge: '银行充值',
    stripeRecharge: 'Stripe充值',
    balanceAfter: '入账后余额',
    loading: '加载中...',
    loadError: '无法加载会员积分',
    submitError: '提交充值失败',
    stripeError: '无法启动Stripe Checkout',
    submitted: '充值申请已提交，确认后积分会入账。',
  },
} as const

export default function MemberPage() {
  const router = useRouter()
  const { language } = useLanguage()
  const t = memberCopy[language]
  const [data, setData] = useState<MemberWalletResponse | null>(null)
  const [amount, setAmount] = useState('1000')
  const [paymentMode, setPaymentMode] = useState<PaymentMode>('card')
  const [bankAccountId, setBankAccountId] = useState('')
  const [bankName, setBankName] = useState('')
  const [accountName, setAccountName] = useState('')
  const [accountNumber, setAccountNumber] = useState('')
  const [transferReference, setTransferReference] = useState('')
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [stripeSubmitting, setStripeSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  const selectedBankAccount = useMemo(
    () => data?.bankAccounts.find((account) => account.id === bankAccountId),
    [bankAccountId, data?.bankAccounts],
  )

  const loadWallet = async () => {
    setError('')

    try {
      const wallet = await getMemberWallet()
      setData(wallet)
      setBankAccountId((current) => current || wallet.bankAccounts[0]?.id || '')
    } catch (err: any) {
      if (err?.response?.status === 401) {
        router.push('/login?redirect=/member')
        return
      }

      setError(err?.response?.data?.message ?? t.loadError)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!isAuthSessionActive('customer')) {
      router.push('/login?redirect=/member')
      return
    }

    void loadWallet()
  }, [])

  const submitBankRecharge = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError('')
    setMessage('')
    setSubmitting(true)

    try {
      await createBankRecharge({
        amount: Number(amount),
        bankAccountId: selectedBankAccount ? selectedBankAccount.id : undefined,
        bankName: selectedBankAccount ? undefined : bankName,
        accountName: selectedBankAccount ? undefined : accountName,
        accountNumber: selectedBankAccount ? undefined : accountNumber,
        transferReference,
      })
      setMessage(t.submitted)
      setTransferReference('')
      await loadWallet()
    } catch (err: any) {
      setError(err?.response?.data?.message ?? t.submitError)
    } finally {
      setSubmitting(false)
    }
  }

  const startStripeCheckout = async () => {
    setError('')
    setMessage('')
    setStripeSubmitting(true)

    try {
      const checkout = await createStripeCheckout(Number(amount))
      window.location.href = checkout.checkoutUrl
    } catch (err: any) {
      setError(err?.response?.data?.message ?? t.stripeError)
      setStripeSubmitting(false)
    }
  }

  return (
    <main className="min-h-screen bg-[#eef2f6] text-[#17202f]">
      <header className="border-b border-[#d9e0ea] bg-[#fbfcfe]">
        <div className="mx-auto flex max-w-[1280px] flex-col gap-4 px-4 py-4 lg:px-6">
          <AppNav />
          <div className="flex min-w-0 items-center gap-3">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-md bg-[#17202f] text-white">
              <WalletCards className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <h1 className="truncate text-xl font-semibold">{t.title}</h1>
              <p className="truncate text-sm text-[#667085]">{t.rate}</p>
            </div>
          </div>
        </div>
      </header>

      <div className="mx-auto grid max-w-[1280px] gap-4 px-4 py-5 lg:grid-cols-[260px_minmax(0,1fr)_360px] lg:px-6">
        <aside className="lg:sticky lg:top-5 lg:self-start">
          <section className="rounded-md border border-[#d9e0ea] bg-white p-4">
            <p className="text-sm font-semibold text-[#667085]">{t.currentPoints}</p>
            <p className="mt-2 text-4xl font-semibold">
              {loading ? '...' : formatNumber(data?.wallet.pointsBalance ?? 0, language)}
            </p>
            <div className="mt-5 grid gap-3">
              <StatRow
                icon={<HistoryIcon className="h-4 w-4" />}
                label={t.lifetimePoints}
                value={loading ? '...' : formatNumber(data?.wallet.lifetimePoints ?? 0, language)}
              />
              <StatRow
                icon={<Landmark className="h-4 w-4" />}
                label={t.bankAccounts}
                value={loading ? '...' : String(data?.bankAccounts.length ?? 0)}
              />
            </div>
            <div className="mt-5 flex gap-2 rounded-md border border-[#cce4d5] bg-[#f1fbf5] p-3 text-sm leading-6 text-[#247047]">
              <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{t.secured}</span>
            </div>
          </section>
        </aside>

        <section className="min-w-0 rounded-md border border-[#d9e0ea] bg-white">
          <div className="border-b border-[#e6ebf2] p-4 sm:p-5">
            <p className="text-sm font-semibold uppercase text-[#2f6fed]">
              {t.rechargeTitle}
            </p>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-[#667085]">
              {t.subtitle}
            </p>
          </div>

          <div className="p-4 sm:p-5">
            {error && (
              <Alert tone="error">{error}</Alert>
            )}
            {message && (
              <Alert tone="success">{message}</Alert>
            )}

            <div className="grid gap-5">
              <label className="block">
                <span className="mb-2 block text-sm font-semibold text-[#344054]">
                  {t.amount}
                </span>
                <div className="flex h-12 items-center rounded-md border border-[#c8d1de] bg-white focus-within:border-[#2f6fed]">
                  <span className="px-3 text-sm font-semibold text-[#667085]">JPY</span>
                  <input
                    type="number"
                    min="100"
                    step="1"
                    value={amount}
                    onChange={(event) => setAmount(event.target.value)}
                    className="h-full min-w-0 flex-1 rounded-r-md border-0 px-2 text-lg font-semibold outline-none"
                    required
                  />
                </div>
              </label>

              <div className="grid grid-cols-2 rounded-md border border-[#c8d1de] bg-[#f8fafc] p-1">
                <ModeButton
                  active={paymentMode === 'card'}
                  icon={<CreditCard className="h-4 w-4" />}
                  label={t.cardMode}
                  onClick={() => setPaymentMode('card')}
                />
                <ModeButton
                  active={paymentMode === 'bank'}
                  icon={<Banknote className="h-4 w-4" />}
                  label={t.bankMode}
                  onClick={() => setPaymentMode('bank')}
                />
              </div>

              {paymentMode === 'card' ? (
                <section className="rounded-md border border-[#d9e0ea] bg-[#fbfcfe] p-4">
                  <div className="flex items-start gap-3">
                    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-md bg-[#17202f] text-white">
                      <CreditCard className="h-4 w-4" />
                    </span>
                    <div>
                      <h2 className="font-semibold">{t.cardTitle}</h2>
                      <p className="mt-1 text-sm leading-6 text-[#667085]">
                        {t.cardDescription}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={startStripeCheckout}
                    disabled={stripeSubmitting || loading}
                    className="mt-4 inline-flex h-11 w-full items-center justify-center gap-2 rounded-md bg-[#17202f] px-4 text-sm font-semibold text-white transition hover:bg-[#0f1724] disabled:cursor-not-allowed disabled:bg-[#98a6ba] sm:w-auto"
                  >
                    {stripeSubmitting ? (
                      <LoaderCircle className="h-4 w-4 animate-spin" />
                    ) : (
                      <CreditCard className="h-4 w-4" />
                    )}
                    {t.cardButton}
                  </button>
                </section>
              ) : (
                <form
                  onSubmit={submitBankRecharge}
                  className="rounded-md border border-[#d9e0ea] bg-[#fbfcfe] p-4"
                >
                  <div className="flex items-start gap-3">
                    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-md bg-[#eaf2ff] text-[#2f6fed]">
                      <Landmark className="h-4 w-4" />
                    </span>
                    <div>
                      <h2 className="font-semibold">{t.bankTitle}</h2>
                      <p className="mt-1 text-sm leading-6 text-[#667085]">
                        {t.bankDescription}
                      </p>
                    </div>
                  </div>

                  <div className="mt-4 grid gap-4">
                    {Boolean(data?.bankAccounts.length) && (
                      <label className="block">
                        <span className="mb-2 block text-sm font-semibold text-[#344054]">
                          {t.bankAccount}
                        </span>
                        <select
                          value={bankAccountId}
                          onChange={(event) => setBankAccountId(event.target.value)}
                          className="h-11 w-full rounded-md border border-[#c8d1de] bg-white px-3 outline-none focus:border-[#2f6fed]"
                        >
                          <option value="">{t.newAccount}</option>
                          {data?.bankAccounts.map((account) => (
                            <option key={account.id} value={account.id}>
                              {account.bankName} {t.ending} {account.accountNumberLast4}
                            </option>
                          ))}
                        </select>
                      </label>
                    )}

                    {!selectedBankAccount && (
                      <div className="grid gap-4 sm:grid-cols-2">
                        <TextField label={t.bankName} value={bankName} onChange={setBankName} />
                        <TextField label={t.accountName} value={accountName} onChange={setAccountName} />
                        <TextField
                          className="sm:col-span-2"
                          label={t.accountNumber}
                          value={accountNumber}
                          onChange={setAccountNumber}
                        />
                      </div>
                    )}

                    <TextField
                      label={t.transferReference}
                      value={transferReference}
                      onChange={setTransferReference}
                      placeholder={t.transferPlaceholder}
                    />

                    <button
                      type="submit"
                      disabled={submitting || loading}
                      className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-md bg-[#2f6fed] px-4 text-sm font-semibold text-white transition hover:bg-[#225ed0] disabled:cursor-not-allowed disabled:bg-[#9bb8ee] sm:w-auto"
                    >
                      {submitting ? (
                        <LoaderCircle className="h-4 w-4 animate-spin" />
                      ) : (
                        <ReceiptText className="h-4 w-4" />
                      )}
                      {t.bankButton}
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        </section>

        <aside className="grid gap-4 lg:sticky lg:top-5 lg:self-start">
          <ActivityPanel
            title={t.activity}
            empty={t.noRecharges}
            items={data?.recharges ?? []}
            renderItem={(item) => (
              <RechargeItem key={item.id} recharge={item} language={language} copy={t} />
            )}
          />
          <section className="rounded-md border border-[#d9e0ea] bg-white">
            <div className="flex items-center gap-2 border-b border-[#e6ebf2] px-4 py-3">
              <Clock3 className="h-4 w-4 text-[#2f6fed]" />
              <h2 className="font-semibold">{t.ledger}</h2>
            </div>
            <div className="grid gap-1 p-2">
              {data?.transactions.length ? (
                data.transactions.map((item) => (
                  <article key={item.id} className="rounded-md px-3 py-2 hover:bg-[#f8fafc]">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold">
                          {item.reason === 'stripe_checkout'
                            ? t.stripeRecharge
                            : item.reason === 'bank_recharge'
                              ? t.bankRecharge
                              : item.reason}
                        </p>
                        <p className="mt-1 text-xs text-[#667085]">
                          {formatDate(item.createdAt, language)}
                        </p>
                      </div>
                      <p className="text-sm font-semibold text-[#247047]">
                        +{formatNumber(item.pointsDelta, language)}
                      </p>
                    </div>
                    <p className="mt-1 text-xs text-[#667085]">
                      {t.balanceAfter} {formatNumber(item.balanceAfter, language)}
                    </p>
                  </article>
                ))
              ) : (
                <EmptyState>{loading ? t.loading : t.noLedger}</EmptyState>
              )}
            </div>
          </section>
        </aside>
      </div>
    </main>
  )
}

function StatRow({
  icon,
  label,
  value,
}: {
  icon: ReactNode
  label: string
  value: string
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-md bg-[#f8fafc] px-3 py-2">
      <div className="flex min-w-0 items-center gap-2 text-sm text-[#667085]">
        <span className="text-[#2f6fed]">{icon}</span>
        <span className="truncate">{label}</span>
      </div>
      <span className="text-sm font-semibold">{value}</span>
    </div>
  )
}

function ModeButton({
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
      className={`inline-flex h-10 items-center justify-center gap-2 rounded text-sm font-semibold transition ${
        active
          ? 'bg-white text-[#17202f] shadow-sm'
          : 'text-[#667085] hover:bg-white/70 hover:text-[#344054]'
      }`}
    >
      {icon}
      {label}
    </button>
  )
}

function TextField({
  className = '',
  label,
  value,
  onChange,
  placeholder,
}: {
  className?: string
  label: string
  value: string
  onChange: (value: string) => void
  placeholder?: string
}) {
  return (
    <label className={`block ${className}`}>
      <span className="mb-2 block text-sm font-semibold text-[#344054]">
        {label}
      </span>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="h-11 w-full rounded-md border border-[#c8d1de] bg-white px-3 outline-none focus:border-[#2f6fed]"
        required={!placeholder}
      />
    </label>
  )
}

function Alert({ tone, children }: { tone: 'error' | 'success'; children: ReactNode }) {
  return (
    <p
      className={`mb-4 rounded-md px-4 py-3 text-sm font-medium ${
        tone === 'error'
          ? 'bg-[#fff1f3] text-[#b42318]'
          : 'bg-[#effbf4] text-[#247047]'
      }`}
    >
      {children}
    </p>
  )
}

function ActivityPanel<T>({
  title,
  empty,
  items,
  renderItem,
}: {
  title: string
  empty: string
  items: T[]
  renderItem: (item: T) => ReactNode
}) {
  return (
    <section className="rounded-md border border-[#d9e0ea] bg-white">
      <div className="flex items-center gap-2 border-b border-[#e6ebf2] px-4 py-3">
        <ReceiptText className="h-4 w-4 text-[#2f6fed]" />
        <h2 className="font-semibold">{title}</h2>
      </div>
      <div className="grid gap-1 p-2">
        {items.length ? items.map(renderItem) : <EmptyState>{empty}</EmptyState>}
      </div>
    </section>
  )
}

function RechargeItem({
  recharge,
  language,
  copy,
}: {
  recharge: MemberRecharge
  language: keyof typeof memberCopy
  copy: (typeof memberCopy)[keyof typeof memberCopy]
}) {
  return (
    <article className="rounded-md px-3 py-2 hover:bg-[#f8fafc]">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold">
            {formatMoney(recharge.amount, language)} / {formatNumber(recharge.points, language)}
          </p>
          <p className="mt-1 text-xs text-[#667085]">
            {recharge.paymentProvider === 'stripe_checkout' ? copy.stripe : copy.bankTransfer}
            {' / '}
            {formatDate(recharge.createdAt, language)}
          </p>
        </div>
        <StatusBadge status={recharge.status} copy={copy} />
      </div>
    </article>
  )
}

function StatusBadge({
  status,
  copy,
}: {
  status: 'pending' | 'confirmed' | 'cancelled'
  copy: (typeof memberCopy)[keyof typeof memberCopy]
}) {
  const label =
    status === 'confirmed'
      ? copy.credited
      : status === 'pending'
        ? copy.pending
        : copy.cancelled
  const className =
    status === 'confirmed'
      ? 'border-[#aadfbd] bg-[#effbf4] text-[#247047]'
      : status === 'pending'
        ? 'border-[#f7d89a] bg-[#fff8e6] text-[#946800]'
        : 'border-[#d0d5dd] bg-[#f8fafc] text-[#667085]'

  return (
    <span className={`rounded-md border px-2 py-1 text-xs font-semibold ${className}`}>
      {label}
    </span>
  )
}

function EmptyState({ children }: { children: ReactNode }) {
  return (
    <p className="rounded-md border border-dashed border-[#c8d1de] px-3 py-6 text-center text-sm text-[#667085]">
      {children}
    </p>
  )
}

function formatMoney(value: number, language: keyof typeof memberCopy) {
  return new Intl.NumberFormat(localeFor(language), {
    style: 'currency',
    currency: 'JPY',
    maximumFractionDigits: 0,
  }).format(value)
}

function formatNumber(value: number, language: keyof typeof memberCopy) {
  return new Intl.NumberFormat(localeFor(language)).format(value)
}

function formatDate(value: string, language: keyof typeof memberCopy) {
  return new Intl.DateTimeFormat(localeFor(language), {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value))
}

function localeFor(language: keyof typeof memberCopy) {
  return language === 'ja' ? 'ja-JP' : language === 'zh' ? 'zh-CN' : 'en-US'
}
