'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { MouseEvent, useEffect, useState } from 'react'
import {
  Building2,
  Coins,
  Home,
  Images,
  LogIn,
  LogOut,
  Scissors,
  Sparkles,
  Upload,
} from 'lucide-react'

import { LanguageSwitcher } from './LanguageSwitcher'
import { useLanguage } from '@/lib/useLanguage'
import { clearAuth, isAuthSessionActive, type AuthRole } from '@/services/auth'

const navCopy = {
  ja: {
    home: 'ホーム',
    upload: '画像アップロード',
    hairstyles: '髪型選択',
    preview: 'AIプレビュー',
    member: 'ポイント',
    salons: 'Salon選択',
    salon: 'Salon管理',
    login: 'ログイン',
    logout: 'ログアウト',
  },
  en: {
    home: 'Home',
    upload: 'Upload',
    hairstyles: 'Styles',
    preview: 'AI Preview',
    member: 'Points',
    salons: 'Salons',
    salon: 'Salon Admin',
    login: 'Login',
    logout: 'Logout',
  },
  zh: {
    home: '首页',
    upload: '上传图片',
    hairstyles: '选择发型',
    preview: 'AI 预览',
    member: '会员点数',
    salons: '推荐 Salon',
    salon: 'Salon 管理',
    login: '登录',
    logout: '退出登录',
  },
}

const navItems = [
  { href: '/', key: 'home', icon: Home },
  { href: '/upload', key: 'upload', icon: Upload },
  { href: '/hairstyles', key: 'hairstyles', icon: Scissors },
  { href: '/preview', key: 'preview', icon: Sparkles },
  { href: '/member', key: 'member', icon: Coins },
  { href: '/salons', key: 'salons', icon: Images },
  { href: '/salon', key: 'salon', icon: Building2 },
] as const

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

export function AppNav({ className = '' }: { className?: string }) {
  const pathname = usePathname()
  const router = useRouter()
  const { language } = useLanguage()
  const labels = navCopy[language]
  const [loggedIn, setLoggedIn] = useState(false)
  const currentRole = requiredRoleForPath(pathname)
  const loginHref = currentRole === 'salon' ? '/salon/login' : '/login'

  useEffect(() => {
    const refresh = () => setLoggedIn(isAuthSessionActive(currentRole ?? undefined))
    refresh()

    window.addEventListener('storage', refresh)
    window.addEventListener('focus', refresh)
    const interval = window.setInterval(refresh, 30_000)

    return () => {
      window.removeEventListener('storage', refresh)
      window.removeEventListener('focus', refresh)
      window.clearInterval(interval)
    }
  }, [currentRole])

  const guardNavigation = (event: MouseEvent<HTMLAnchorElement>, href: string) => {
    const requiredRole = requiredRoleForPath(href)
    if (!protectedRoutes.has(href) || !requiredRole || isAuthSessionActive(requiredRole)) {
      setLoggedIn(isAuthSessionActive(currentRole ?? undefined))
      return
    }

    event.preventDefault()
    setLoggedIn(false)
    const loginPath = href === '/salon' ? '/salon/login' : '/login'
    router.push(`${loginPath}?redirect=${encodeURIComponent(href)}`)
  }

  const logout = () => {
    clearAuth(currentRole ?? undefined)
    setLoggedIn(false)
    router.push(loginHref)
  }

  return (
    <header
      className={`flex flex-wrap items-center justify-between gap-4 ${className}`}
    >
      <Link href="/" className="flex min-w-0 items-center gap-2 font-semibold text-zinc-950">
        <Sparkles className="h-5 w-5 text-sky-700" />
        <span className="truncate">AI Hairstyle Platform</span>
      </Link>

      <div className="flex flex-wrap items-center justify-end gap-2">
        <nav className="flex flex-wrap items-center justify-end gap-2">
          {navItems.map((item) => {
            const Icon = item.icon
            const active =
              item.href === '/'
                ? pathname === '/'
                : pathname === item.href || pathname.startsWith(`${item.href}/`)

            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={(event) => guardNavigation(event, item.href)}
                className={`inline-flex h-10 items-center gap-2 rounded-md border px-3 text-sm font-medium transition ${
                  active
                    ? 'border-sky-300 bg-sky-50 text-sky-800'
                    : 'border-zinc-200 bg-white text-zinc-700 hover:border-zinc-300 hover:text-zinc-950'
                }`}
              >
                <Icon className="h-4 w-4" />
                <span>{labels[item.key]}</span>
              </Link>
            )
          })}
        </nav>
        <LanguageSwitcher />
        {loggedIn ? (
          <button
            type="button"
            onClick={logout}
            className="inline-flex h-10 items-center gap-2 rounded-md border border-rose-200 bg-white px-3 text-sm font-medium text-rose-700 transition hover:border-rose-300 hover:bg-rose-50"
          >
            <LogOut className="h-4 w-4" />
            {labels.logout}
          </button>
        ) : (
          <Link
            href={loginHref}
            className="inline-flex h-10 items-center gap-2 rounded-md border border-zinc-200 bg-white px-3 text-sm font-medium text-zinc-700 transition hover:border-zinc-300 hover:text-zinc-950"
          >
            <LogIn className="h-4 w-4" />
            {labels.login}
          </Link>
        )}
      </div>
    </header>
  )
}
