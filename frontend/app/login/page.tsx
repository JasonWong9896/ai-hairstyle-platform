'use client'

import { FormEvent, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { LoaderCircle, LockKeyhole, UserPlus } from 'lucide-react'

import { AppNav } from '@/components/AppNav'
import { copy } from '@/lib/i18n'
import { useLanguage } from '@/lib/useLanguage'
import { login, register, saveAuth } from '@/services/auth'

type Mode = 'login' | 'register'
const forgotPasswordLabel = {
  ja: 'パスワードを忘れた場合',
  en: 'Forgot password?',
  zh: '忘记密码？',
}

export default function LoginPage() {
  const router = useRouter()
  const { language } = useLanguage()
  const t = copy[language]
  const [mode, setMode] = useState<Mode>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)

  const isRegister = mode === 'register'

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError('')
    setMessage('')
    setLoading(true)

    try {
      if (isRegister) {
        await register({ email, password, name, role: 'customer' })
        setPassword('')
        setMessage('确认邮件已发送。若这是未确认账号的重复注册，我们已重新发送确认链接。请查看邮箱后再登录。')
        setMode('login')
        return
      }

      const auth = await login({ email, password, role: 'customer' })
      saveAuth(auth)
      const redirect = new URLSearchParams(window.location.search).get('redirect')
      router.push(redirect ?? '/upload')
    } catch (err: any) {
      setError(err?.response?.data?.message ?? t.login.error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="min-h-screen bg-zinc-50 text-zinc-950">
      <div className="mx-auto flex min-h-screen w-full max-w-6xl flex-col px-6 py-8">
        <AppNav className="mb-8" />

        <section className="grid flex-1 gap-10 lg:grid-cols-[1fr_420px] lg:items-center">
          <div className="max-w-2xl">
            <p className="mb-4 text-sm font-semibold uppercase tracking-wide text-teal-700">
              {t.appName}
            </p>
            <h1 className="text-4xl font-semibold leading-tight sm:text-5xl">
              {t.login.title}
            </h1>
            <p className="mt-5 max-w-xl text-lg leading-8 text-zinc-600">
              {t.login.description}
            </p>
          </div>

          <form
            onSubmit={submit}
            className="rounded-lg border border-zinc-200 bg-white p-6 shadow-sm"
          >
            <div className="mb-6 flex rounded-md bg-zinc-100 p-1">
              <button
                type="button"
                onClick={() => setMode('login')}
                className={`flex-1 rounded px-4 py-2 text-sm font-medium ${
                  mode === 'login'
                    ? 'bg-white text-zinc-950 shadow-sm'
                    : 'text-zinc-500'
                }`}
              >
                {t.login.loginTab}
              </button>
              <button
                type="button"
                onClick={() => setMode('register')}
                className={`flex-1 rounded px-4 py-2 text-sm font-medium ${
                  mode === 'register'
                    ? 'bg-white text-zinc-950 shadow-sm'
                    : 'text-zinc-500'
                }`}
              >
                {t.login.registerTab}
              </button>
            </div>

            {isRegister && (
              <label className="mb-4 block">
                <span className="mb-2 block text-sm font-medium text-zinc-700">
                  {t.login.name}
                </span>
                <input
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  className="h-11 w-full rounded-md border border-zinc-300 px-3 outline-none focus:border-teal-600"
                  placeholder={t.login.namePlaceholder}
                />
              </label>
            )}

            <label className="mb-4 block">
              <span className="mb-2 block text-sm font-medium text-zinc-700">
                {t.login.email}
              </span>
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className="h-11 w-full rounded-md border border-zinc-300 px-3 outline-none focus:border-teal-600"
                placeholder="member@example.com"
                required
              />
            </label>

            <label className="mb-5 block">
              <span className="mb-2 block text-sm font-medium text-zinc-700">
                {t.login.password}
              </span>
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="h-11 w-full rounded-md border border-zinc-300 px-3 outline-none focus:border-teal-600"
                placeholder={t.login.passwordPlaceholder}
                minLength={8}
                required
              />
            </label>

            {!isRegister && (
              <div className="mb-5 flex justify-end">
                <Link
                  href="/reset-password?role=customer"
                  className="text-sm font-medium text-teal-700 hover:text-teal-800"
                >
                  {forgotPasswordLabel[language]}
                </Link>
              </div>
            )}

            {error && (
              <p className="mb-4 rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-700">
                {error}
              </p>
            )}

            {message && (
              <p className="mb-4 rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
                {message}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="flex h-11 w-full items-center justify-center gap-2 rounded-md bg-zinc-950 px-4 font-medium text-white disabled:cursor-not-allowed disabled:bg-zinc-400"
            >
              {loading ? (
                <LoaderCircle className="h-4 w-4 animate-spin" />
              ) : isRegister ? (
                <UserPlus className="h-4 w-4" />
              ) : (
                <LockKeyhole className="h-4 w-4" />
              )}
              {isRegister ? t.login.submitRegister : t.login.submitLogin}
            </button>
          </form>
        </section>
      </div>
    </main>
  )
}
