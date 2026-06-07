'use client'

import { FormEvent, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { LoaderCircle, LogIn } from 'lucide-react'

import { AppNav } from '@/components/AppNav'
import { login, saveAuth } from '@/services/auth'

export default function StylistLoginPage() {
  const router = useRouter()
  const [redirect, setRedirect] = useState<string | null>(null)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    setRedirect(new URLSearchParams(window.location.search).get('redirect'))
  }, [])

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError('')
    setLoading(true)

    try {
      const auth = await login({ email, password, role: 'stylist' })
      saveAuth(auth)
      router.push(redirect ?? '/stylist')
    } catch {
      setError('Stylist login failed. Please check your email and password.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="min-h-screen bg-zinc-50 px-6 py-8 text-zinc-950">
      <section className="mx-auto flex max-w-xl flex-col gap-8">
        <AppNav />

        <div>
          <h1 className="text-3xl font-semibold">Stylist Login</h1>
          <p className="mt-3 text-sm leading-6 text-zinc-600">
            Sign in with the stylist account created by your salon.
          </p>
        </div>

        <form onSubmit={submit} className="rounded-lg border border-zinc-200 bg-white p-6 shadow-sm">
          <label className="mb-4 block">
            <span className="mb-2 block text-sm font-medium text-zinc-700">Email</span>
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="h-11 w-full rounded-md border border-zinc-300 px-3 outline-none focus:border-teal-600"
              required
            />
          </label>

          <label className="mb-5 block">
            <span className="mb-2 block text-sm font-medium text-zinc-700">Password</span>
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="h-11 w-full rounded-md border border-zinc-300 px-3 outline-none focus:border-teal-600"
              required
            />
          </label>

          {error && <p className="mb-4 text-sm text-rose-700">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="flex h-11 w-full items-center justify-center gap-2 rounded-md bg-zinc-950 px-4 font-medium text-white disabled:bg-zinc-400"
          >
            {loading ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <LogIn className="h-4 w-4" />}
            Login
          </button>
        </form>
      </section>
    </main>
  )
}
