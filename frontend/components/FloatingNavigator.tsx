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
  Menu,
  Scissors,
  Sparkles,
  UserRound,
  Upload,
  X,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

import { clearAuth, isAuthSessionActive, type AuthRole } from '@/services/auth'

type FloatingNavItem = {
  href: string
  label: string
  icon: LucideIcon
  protected?: boolean
  salon?: boolean
  stylist?: boolean
}

const items: FloatingNavItem[] = [
  { href: '/', label: 'Home', icon: Home },
  { href: '/upload', label: 'Upload', icon: Upload, protected: true },
  { href: '/hairstyles', label: 'Hairstyles', icon: Scissors, protected: true },
  { href: '/preview', label: 'AI Preview', icon: Sparkles, protected: true },
  { href: '/member', label: 'Points', icon: Coins, protected: true },
  { href: '/salons', label: 'Salon選択', icon: Images },
  { href: '/salon', label: 'Salon管理', icon: Building2, protected: true, salon: true },
  { href: '/stylist', label: 'Stylist', icon: UserRound, protected: true, stylist: true },
]

function requiredRoleForItem(item: FloatingNavItem): AuthRole {
  if (item.stylist) return 'stylist'
  if (item.salon) return 'salon'
  return 'customer'
}

function currentRoleForPath(pathname: string): AuthRole | null {
  if (pathname.startsWith('/stylist')) return 'stylist'
  if (pathname.startsWith('/salon')) return 'salon'
  if (['/upload', '/hairstyles', '/preview', '/member'].some((path) => pathname.startsWith(path))) {
    return 'customer'
  }
  return null
}

export function FloatingNavigator() {
  const pathname = usePathname()
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [loggedIn, setLoggedIn] = useState(false)
  const currentRole = currentRoleForPath(pathname)

  useEffect(() => {
    const refresh = () => setLoggedIn(isAuthSessionActive(currentRole ?? undefined))
    refresh()

    window.addEventListener('focus', refresh)
    window.addEventListener('storage', refresh)

    if (process.env.NODE_ENV === 'development') {
      fetch('/__nextjs_disable_dev_indicator', { method: 'POST' }).catch(() => undefined)
    }

    return () => {
      window.removeEventListener('focus', refresh)
      window.removeEventListener('storage', refresh)
    }
  }, [currentRole])

  useEffect(() => {
    setOpen(false)
    setLoggedIn(isAuthSessionActive(currentRole ?? undefined))
  }, [currentRole, pathname])

  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false)
      }
    }

    window.addEventListener('keydown', closeOnEscape)
    return () => window.removeEventListener('keydown', closeOnEscape)
  }, [])

  const guardNavigation = (
    event: MouseEvent<HTMLAnchorElement>,
    href: string,
    protectedRoute?: boolean,
    salonRoute?: boolean,
    stylistRoute?: boolean,
  ) => {
    const requiredRole = stylistRoute ? 'stylist' : salonRoute ? 'salon' : 'customer'
    if (!protectedRoute || isAuthSessionActive(requiredRole)) {
      setLoggedIn(isAuthSessionActive(currentRole ?? undefined))
      return
    }

    event.preventDefault()
    setLoggedIn(false)
    const loginPath = stylistRoute ? '/stylist/login' : salonRoute ? '/salon/login' : '/login'
    router.push(`${loginPath}?redirect=${encodeURIComponent(href)}`)
  }

  const logout = () => {
    clearAuth(currentRole ?? undefined)
    setLoggedIn(false)
    setOpen(false)
    router.push('/login')
  }

  return (
    <div className="fixed bottom-5 left-5 z-[2147483647]">
      {open && (
        <div className="mb-3 w-[min(calc(100vw-2.5rem),320px)] overflow-hidden rounded-md border border-[#d9e0ea] bg-white shadow-xl">
          <div className="flex items-center justify-between border-b border-[#e6ebf2] px-4 py-3">
            <div>
              <div className="text-sm font-semibold text-[#17202f]">Navigator</div>
              <div className="text-xs text-[#667085]">AI Hairstyle Platform</div>
            </div>
            <button
              type="button"
              aria-label="Close navigator"
              onClick={() => setOpen(false)}
              className="grid h-8 w-8 place-items-center rounded-md text-[#667085] transition hover:bg-[#f2f4f7] hover:text-[#17202f]"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <nav className="grid gap-1 p-2">
            {items.map((item) => {
              const Icon = item.icon
              const requiredRole = item.protected ? requiredRoleForItem(item) : null
              const active =
                item.href === '/'
                  ? pathname === '/'
                  : pathname === item.href || pathname.startsWith(`${item.href}/`)

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={(event) => guardNavigation(event, item.href, item.protected, requiredRole === 'salon', requiredRole === 'stylist')}
                  className={`flex h-11 items-center gap-3 rounded-md px-3 text-sm font-medium transition ${
                    active
                      ? 'bg-[#eaf2ff] text-[#2f6fed]'
                      : 'text-[#344054] hover:bg-[#f8fafc] hover:text-[#17202f]'
                  }`}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  <span className="min-w-0 flex-1 truncate">{item.label}</span>
                </Link>
              )
            })}
          </nav>

          <div className="border-t border-[#e6ebf2] p-2">
            {loggedIn ? (
              <button
                type="button"
                onClick={logout}
                className="flex h-11 w-full items-center gap-3 rounded-md px-3 text-sm font-medium text-rose-700 transition hover:bg-rose-50"
              >
                <LogOut className="h-4 w-4" />
                Logout
              </button>
            ) : (
              <Link
                href={pathname.startsWith('/stylist') ? '/stylist/login' : pathname.startsWith('/salon') ? '/salon/login' : '/login'}
                onClick={() => setOpen(false)}
                className="flex h-11 items-center gap-3 rounded-md px-3 text-sm font-medium text-[#344054] transition hover:bg-[#f8fafc]"
              >
                <LogIn className="h-4 w-4" />
                Login
              </Link>
            )}
          </div>
        </div>
      )}

      <button
        type="button"
        aria-label={open ? 'Close navigator' : 'Open navigator'}
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
        className="grid h-12 w-12 place-items-center rounded-full border border-[#c8d1de] bg-[#17202f] text-white shadow-lg transition hover:bg-[#0f1724] focus:outline-none focus:ring-4 focus:ring-[#dbe8ff]"
      >
        {open ? <X className="h-5 w-5" /> : <span className="text-sm font-bold">N</span>}
        <Menu className="sr-only" />
      </button>
    </div>
  )
}
