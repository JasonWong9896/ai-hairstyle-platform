'use client'

import Link from 'next/link'
import { MouseEvent } from 'react'
import {
  ArrowRight,
  BadgeCheck,
  Building2,
  Coins,
  ImagePlus,
  LockKeyhole,
  Scissors,
  ShieldCheck,
  Sparkles,
  WalletCards,
} from 'lucide-react'

import { AppNav } from '@/components/AppNav'
import { useLanguage } from '@/lib/useLanguage'
import { isAuthSessionActive, type AuthRole } from '@/services/auth'

const protectedRoutes = new Set(['/upload', '/hairstyles', '/preview', '/member', '/salon'])

function requiredRoleForPath(href: string): AuthRole | null {
  if (href === '/salon' || href.startsWith('/salon/')) {
    return 'salon'
  }

  if (href === '/upload' || href === '/hairstyles' || href === '/preview' || href === '/member') {
    return 'customer'
  }

  return null
}

function redirectToLoginFor(href: string) {
  const loginPath = href === '/salon' ? '/salon/login' : '/login'
  window.location.href = `${loginPath}?redirect=${encodeURIComponent(href)}`
}

function guardProtectedNavigation(event: MouseEvent<HTMLElement>, href: string) {
  const requiredRole = requiredRoleForPath(href)
  if (!protectedRoutes.has(href) || !requiredRole || isAuthSessionActive(requiredRole)) {
    return
  }

  event.preventDefault()
  redirectToLoginFor(href)
}

const homeCopy = {
  ja: {
    appName: 'AI Hairstyle Platform',
    navMember: 'ポイント',
    navCustomer: '顧客ログイン',
    navSalon: 'Salon ログイン',
    eyebrow: 'AI Hair Consultation Workspace',
    title: 'AIで髪型相談をシンプルに',
    description:
      '顧客写真と参考スタイルから、自然な仕上がりを確認できる美容室向けワークスペースです。',
    primaryAction: '画像をアップロード',
    secondaryAction: 'ポイントを管理',
    panelTitle: '今すぐ使える機能',
    secure: 'ログイン、ポイント、Stripe Checkout、銀行振込申請に対応しています。',
    workflowTitle: '利用の流れ',
    workflow: [
      ['写真をアップロード', '顧客写真と参考スタイルを選択します。'],
      ['AIプレビューを確認', '髪型の形、長さ、質感を反映した結果を確認します。'],
      ['Salonを探す', '気に入ったスタイルに近いSalonを確認できます。'],
    ],
    actionsTitle: '機能メニュー',
    actions: {
      upload: ['AI試着を開始', '画像アップロード画面へ'],
      member: ['ポイント残高', 'JPYチャージと履歴確認'],
      salon: ['Salon管理', '提携Salon用ログイン'],
      salons: ['おすすめSalon', '登録Salonを確認'],
    },
  },
  en: {
    appName: 'AI Hairstyle Platform',
    navMember: 'Points',
    navCustomer: 'Customer Login',
    navSalon: 'Salon Login',
    eyebrow: 'AI Hair Consultation Workspace',
    title: 'A focused workspace for AI hairstyle previews',
    description:
      'Upload a customer photo and a hairstyle reference, then preview a natural result for salon consultation.',
    primaryAction: 'Upload images',
    secondaryAction: 'Manage points',
    panelTitle: 'Available now',
    secure: 'Supports login, member points, Stripe Checkout, and bank transfer requests.',
    workflowTitle: 'Workflow',
    workflow: [
      ['Upload photos', 'Choose a customer photo and a hairstyle reference.'],
      ['Review preview', 'Check the generated shape, length, and texture.'],
      ['Find a salon', 'Browse registered salons for the selected style.'],
    ],
    actionsTitle: 'Actions',
    actions: {
      upload: ['Start AI try-on', 'Go to image upload'],
      member: ['Point wallet', 'JPY recharge and ledger'],
      salon: ['Salon admin', 'Partner salon login'],
      salons: ['Recommended salons', 'View registered salons'],
    },
  },
  zh: {
    appName: 'AI Hairstyle Platform',
    navMember: '会员积分',
    navCustomer: '顾客登录',
    navSalon: '合作 Salon 登录',
    eyebrow: 'AI 发型咨询工作台',
    title: '用 AI 简化发型咨询流程',
    description:
      '上传顾客照片和参考发型，快速预览自然效果，帮助顾客和发廊更高效地沟通。',
    primaryAction: '上传图片',
    secondaryAction: '管理积分',
    panelTitle: '当前可用功能',
    secure: '已支持登录、会员积分、Stripe Checkout 信用卡充值和银行转账申请。',
    workflowTitle: '使用流程',
    workflow: [
      ['上传照片', '选择顾客照片和参考发型。'],
      ['查看 AI 预览', '确认发型轮廓、长度和质感效果。'],
      ['查找 Salon', '查看已登记的推荐发廊。'],
    ],
    actionsTitle: '功能入口',
    actions: {
      upload: ['开始 AI 试发型', '进入图片上传页面'],
      member: ['会员积分钱包', 'JPY 充值与积分流水'],
      salon: ['Salon 管理', '合作发廊登录'],
      salons: ['推荐 Salon', '查看已登记发廊'],
    },
  },
} as const

export default function HomePage() {
  const { language } = useLanguage()
  const t = homeCopy[language]

  return (
    <main className="min-h-screen bg-[#eef2f6] text-[#17202f]">
      <header className="border-b border-[#d9e0ea] bg-white">
        <div className="mx-auto max-w-[1280px] px-4 py-4 lg:px-6">
          <AppNav />
        </div>
      </header>

      <div className="mx-auto grid max-w-[1280px] gap-5 px-4 py-6 lg:grid-cols-[minmax(0,1fr)_360px] lg:px-6">
        <section className="min-w-0">
          <div className="rounded-md border border-[#d9e0ea] bg-white p-5 sm:p-7">
            <div className="inline-flex items-center gap-2 rounded-md border border-[#cfe1ff] bg-[#f2f7ff] px-3 py-1.5 text-sm font-semibold text-[#2f6fed]">
              <Sparkles className="h-4 w-4" />
              {t.eyebrow}
            </div>

            <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_280px] lg:items-end">
              <div>
                <h1 className="max-w-3xl text-4xl font-semibold leading-tight sm:text-5xl">
                  {t.title}
                </h1>
                <p className="mt-4 max-w-2xl text-base leading-7 text-[#596579]">
                  {t.description}
                </p>
              </div>

              <div className="grid gap-3">
                <Link
                  href="/upload"
                  onClick={(event) => guardProtectedNavigation(event, '/upload')}
                  className="inline-flex h-12 items-center justify-center gap-2 rounded-md bg-[#2f6fed] px-4 text-sm font-semibold text-white transition hover:bg-[#225ed0]"
                >
                  <ImagePlus className="h-4 w-4" />
                  {t.primaryAction}
                </Link>
                <Link
                  href="/member"
                  onClick={(event) => guardProtectedNavigation(event, '/member')}
                  className="inline-flex h-12 items-center justify-center gap-2 rounded-md border border-[#c8d1de] bg-white px-4 text-sm font-semibold text-[#344054] transition hover:border-[#98a6ba]"
                >
                  <WalletCards className="h-4 w-4" />
                  {t.secondaryAction}
                </Link>
              </div>
            </div>
          </div>

          <section className="mt-5 rounded-md border border-[#d9e0ea] bg-white">
            <div className="border-b border-[#e6ebf2] px-5 py-4">
              <h2 className="text-lg font-semibold">{t.workflowTitle}</h2>
            </div>
            <div className="grid gap-0 md:grid-cols-3">
              {t.workflow.map(([title, description], index) => (
                <article
                  key={title}
                  className="border-b border-[#e6ebf2] p-5 md:border-b-0 md:border-r md:last:border-r-0"
                >
                  <span className="grid h-9 w-9 place-items-center rounded-md bg-[#f2f7ff] text-sm font-semibold text-[#2f6fed]">
                    {index + 1}
                  </span>
                  <h3 className="mt-4 font-semibold">{title}</h3>
                  <p className="mt-2 text-sm leading-6 text-[#667085]">
                    {description}
                  </p>
                </article>
              ))}
            </div>
          </section>
        </section>

        <aside className="grid gap-5 lg:sticky lg:top-5 lg:self-start">
          <section className="rounded-md border border-[#d9e0ea] bg-white p-5">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-[#247047]" />
              <h2 className="font-semibold">{t.panelTitle}</h2>
            </div>
            <p className="mt-3 text-sm leading-6 text-[#667085]">{t.secure}</p>
          </section>

          <section className="rounded-md border border-[#d9e0ea] bg-white">
            <div className="border-b border-[#e6ebf2] px-5 py-4">
              <h2 className="font-semibold">{t.actionsTitle}</h2>
            </div>
            <div className="grid gap-1 p-2">
              <ActionLink
                href="/upload"
                icon={<Scissors className="h-4 w-4" />}
                title={t.actions.upload[0]}
                description={t.actions.upload[1]}
              />
              <ActionLink
                href="/member"
                icon={<Coins className="h-4 w-4" />}
                title={t.actions.member[0]}
                description={t.actions.member[1]}
              />
              <ActionLink
                href="/salon"
                icon={<LockKeyhole className="h-4 w-4" />}
                title={t.actions.salon[0]}
                description={t.actions.salon[1]}
              />
              <ActionLink
                href="/salons"
                icon={<BadgeCheck className="h-4 w-4" />}
                title={t.actions.salons[0]}
                description={t.actions.salons[1]}
              />
            </div>
          </section>
        </aside>
      </div>
    </main>
  )
}

function ActionLink({
  href,
  icon,
  title,
  description,
}: {
  href: string
  icon: React.ReactNode
  title: string
  description: string
}) {
  return (
    <Link
      href={href}
      onClick={(event) => guardProtectedNavigation(event, href)}
      className="group flex items-center justify-between gap-3 rounded-md px-3 py-3 transition hover:bg-[#f8fafc]"
    >
      <span className="flex min-w-0 items-center gap-3">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-md bg-[#eef4ff] text-[#2f6fed]">
          {icon}
        </span>
        <span className="min-w-0">
          <span className="block truncate text-sm font-semibold">{title}</span>
          <span className="mt-1 block truncate text-xs text-[#667085]">
            {description}
          </span>
        </span>
      </span>
      <ArrowRight className="h-4 w-4 shrink-0 text-[#98a2b3] transition group-hover:translate-x-0.5 group-hover:text-[#2f6fed]" />
    </Link>
  )
}
