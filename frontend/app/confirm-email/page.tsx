'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { CheckCircle2, LoaderCircle, XCircle } from 'lucide-react'

import { confirmEmail } from '@/services/auth'

type Status = 'loading' | 'confirmed' | 'error'

export default function ConfirmEmailPage() {
  const [status, setStatus] = useState<Status>('loading')
  const [message, setMessage] = useState('正在确认邮箱...')

  useEffect(() => {
    const token = new URLSearchParams(window.location.search).get('token')
    if (!token) {
      setStatus('error')
      setMessage('确认链接缺少 token。')
      return
    }

    confirmEmail(token)
      .then(() => {
        setStatus('confirmed')
        setMessage('邮箱确认完成。现在可以登录使用账号。')
      })
      .catch((error) => {
        setStatus('error')
        setMessage(error?.response?.data?.message ?? '确认链接无效或已过期。')
      })
  }, [])

  const Icon =
    status === 'loading' ? LoaderCircle : status === 'confirmed' ? CheckCircle2 : XCircle

  return (
    <main className="flex min-h-screen items-center justify-center bg-zinc-50 px-6 text-zinc-950">
      <section className="w-full max-w-md rounded-lg border border-zinc-200 bg-white p-6 text-center shadow-sm">
        <Icon
          className={`mx-auto mb-4 h-10 w-10 ${
            status === 'loading'
              ? 'animate-spin text-zinc-500'
              : status === 'confirmed'
                ? 'text-emerald-700'
                : 'text-rose-700'
          }`}
        />
        <h1 className="text-2xl font-semibold">Email confirmation</h1>
        <p className="mt-3 text-sm leading-6 text-zinc-600">{message}</p>
        {status !== 'loading' && (
          <div className="mt-6 flex justify-center gap-3">
            <Link
              href="/login"
              className="rounded-md bg-zinc-950 px-4 py-2 text-sm font-medium text-white"
            >
              顾客登录
            </Link>
            <Link
              href="/salon/login"
              className="rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700"
            >
              Salon 登录
            </Link>
          </div>
        )}
      </section>
    </main>
  )
}
