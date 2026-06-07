'use client'

import Link from 'next/link'
import { FormEvent, useEffect, useState } from 'react'
import { CheckCircle2, KeyRound, LoaderCircle, Mail } from 'lucide-react'

import { AppNav } from '@/components/AppNav'
import { useLanguage } from '@/lib/useLanguage'
import { requestPasswordReset, resetPassword } from '@/services/auth'

type Role = 'customer' | 'salon'

const pageCopy = {
  ja: {
    eyebrow: 'Password reset',
    title: 'メールでパスワードを再設定',
    description:
      '登録済みメールアドレスへ再設定リンクと6桁の認証コードを送信します。',
    email: 'メールアドレス',
    role: 'アカウント種別',
    customer: '顧客',
    salon: 'Salon',
    send: 'リンクとコードを送信',
    sent:
      'メールを送信しました。届いたリンクを開くか、6桁の認証コードを入力してください。',
    code: '認証コード',
    codeHint: 'メールに記載された6桁のコード',
    newPassword: '新しいパスワード',
    newPasswordHint: '8文字以上',
    reset: 'パスワードを変更',
    done: 'パスワードを変更しました。新しいパスワードでログインできます。',
    login: 'ログインへ戻る',
    linkMode: 'メールリンクで認証中です。',
    codeMode: 'コードで再設定',
    genericError: '処理できませんでした。入力内容を確認してください。',
  },
  en: {
    eyebrow: 'Password reset',
    title: 'Reset your password by email',
    description:
      'We will send a secure reset link and a 6-digit verification code to your registered email.',
    email: 'Email address',
    role: 'Account type',
    customer: 'Customer',
    salon: 'Salon',
    send: 'Send link and code',
    sent:
      'Email sent. Open the reset link, or enter the 6-digit verification code here.',
    code: 'Verification code',
    codeHint: '6-digit code from the email',
    newPassword: 'New password',
    newPasswordHint: 'At least 8 characters',
    reset: 'Change password',
    done: 'Password changed. You can now log in with the new password.',
    login: 'Back to login',
    linkMode: 'Verifying with the email link.',
    codeMode: 'Reset with code',
    genericError: 'The request could not be completed. Please check the form.',
  },
  zh: {
    eyebrow: '密码重置',
    title: '通过邮件重置密码',
    description: '向注册邮箱发送安全重置链接和 6 位认证码。',
    email: '邮箱地址',
    role: '账户类型',
    customer: '顾客',
    salon: 'Salon',
    send: '发送链接和认证码',
    sent: '邮件已发送。可以点击邮件里的链接，或在这里输入 6 位认证码。',
    code: '认证码',
    codeHint: '邮件中的 6 位数字',
    newPassword: '新密码',
    newPasswordHint: '至少 8 位',
    reset: '更改密码',
    done: '密码已更改。现在可以使用新密码登录。',
    login: '返回登录',
    linkMode: '正在使用邮件链接验证。',
    codeMode: '使用认证码重置',
    genericError: '请求未能完成，请检查输入内容。',
  },
}

export default function ResetPasswordPage() {
  const { language } = useLanguage()
  const t = pageCopy[language]
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<Role>('customer')
  const [code, setCode] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [token, setToken] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [requesting, setRequesting] = useState(false)
  const [resetting, setResetting] = useState(false)
  const [done, setDone] = useState(false)

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const tokenValue = params.get('token')
    const roleValue = params.get('role')
    if (roleValue === 'salon' || roleValue === 'customer') {
      setRole(roleValue)
    }
    if (tokenValue) {
      setToken(tokenValue)
      setMessage(t.linkMode)
    }
  }, [t.linkMode])

  const submitRequest = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError('')
    setMessage('')
    setRequesting(true)

    try {
      await requestPasswordReset({ email, role })
      setMessage(t.sent)
    } catch (err: any) {
      setError(err?.response?.data?.message ?? t.genericError)
    } finally {
      setRequesting(false)
    }
  }

  const submitReset = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError('')
    setResetting(true)

    try {
      await resetPassword(
        token
          ? { token, newPassword }
          : { email, role, code, newPassword },
      )
      setDone(true)
      setMessage(t.done)
      setCode('')
      setNewPassword('')
    } catch (err: any) {
      setError(err?.response?.data?.message ?? t.genericError)
    } finally {
      setResetting(false)
    }
  }

  return (
    <main className="min-h-screen bg-slate-50 text-slate-950">
      <div className="mx-auto flex min-h-screen w-full max-w-6xl flex-col px-6 py-8">
        <AppNav className="mb-8" />

        <section className="grid flex-1 gap-8 lg:grid-cols-[1fr_440px] lg:items-center">
          <div className="max-w-2xl">
            <p className="mb-4 inline-flex items-center gap-2 rounded-md border border-sky-200 bg-sky-50 px-3 py-2 text-sm font-semibold text-sky-800">
              <KeyRound className="h-4 w-4" />
              {t.eyebrow}
            </p>
            <h1 className="text-4xl font-semibold leading-tight sm:text-5xl">
              {t.title}
            </h1>
            <p className="mt-5 max-w-xl text-lg leading-8 text-slate-600">
              {t.description}
            </p>
          </div>

          <div className="space-y-4">
            <form
              onSubmit={submitRequest}
              className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm"
            >
              <div className="mb-5 flex items-center gap-2 text-lg font-semibold">
                <Mail className="h-5 w-5 text-sky-700" />
                {t.send}
              </div>

              <label className="mb-4 block">
                <span className="mb-2 block text-sm font-medium text-slate-700">
                  {t.email}
                </span>
                <input
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  className="h-11 w-full rounded-md border border-slate-300 px-3 outline-none focus:border-sky-600"
                  placeholder="member@example.com"
                  required
                />
              </label>

              <div className="mb-5">
                <span className="mb-2 block text-sm font-medium text-slate-700">
                  {t.role}
                </span>
                <div className="grid grid-cols-2 rounded-md bg-slate-100 p-1">
                  {(['customer', 'salon'] as Role[]).map((value) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setRole(value)}
                      className={`h-10 rounded text-sm font-medium ${
                        role === value
                          ? 'bg-white text-slate-950 shadow-sm'
                          : 'text-slate-500'
                      }`}
                    >
                      {value === 'customer' ? t.customer : t.salon}
                    </button>
                  ))}
                </div>
              </div>

              <button
                type="submit"
                disabled={requesting}
                className="flex h-11 w-full items-center justify-center gap-2 rounded-md bg-slate-950 px-4 font-medium text-white disabled:cursor-not-allowed disabled:bg-slate-400"
              >
                {requesting && <LoaderCircle className="h-4 w-4 animate-spin" />}
                {t.send}
              </button>
            </form>

            <form
              onSubmit={submitReset}
              className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm"
            >
              <div className="mb-5 flex items-center gap-2 text-lg font-semibold">
                <KeyRound className="h-5 w-5 text-sky-700" />
                {token ? t.linkMode : t.codeMode}
              </div>

              {!token && (
                <label className="mb-4 block">
                  <span className="mb-2 block text-sm font-medium text-slate-700">
                    {t.code}
                  </span>
                  <input
                    inputMode="numeric"
                    pattern="[0-9]{6}"
                    maxLength={6}
                    value={code}
                    onChange={(event) => setCode(event.target.value.replace(/\D/g, ''))}
                    className="h-11 w-full rounded-md border border-slate-300 px-3 outline-none focus:border-sky-600"
                    placeholder={t.codeHint}
                    required
                  />
                </label>
              )}

              <label className="mb-5 block">
                <span className="mb-2 block text-sm font-medium text-slate-700">
                  {t.newPassword}
                </span>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(event) => setNewPassword(event.target.value)}
                  className="h-11 w-full rounded-md border border-slate-300 px-3 outline-none focus:border-sky-600"
                  placeholder={t.newPasswordHint}
                  minLength={8}
                  required
                />
              </label>

              <button
                type="submit"
                disabled={resetting || done}
                className="flex h-11 w-full items-center justify-center gap-2 rounded-md bg-sky-700 px-4 font-medium text-white disabled:cursor-not-allowed disabled:bg-slate-400"
              >
                {resetting ? (
                  <LoaderCircle className="h-4 w-4 animate-spin" />
                ) : done ? (
                  <CheckCircle2 className="h-4 w-4" />
                ) : null}
                {t.reset}
              </button>
            </form>

            {(message || error) && (
              <p
                className={`rounded-md px-3 py-2 text-sm ${
                  error
                    ? 'bg-rose-50 text-rose-700'
                    : 'bg-emerald-50 text-emerald-800'
                }`}
              >
                {error || message}
              </p>
            )}

            <Link
              href="/login"
              className="block rounded-md border border-slate-300 bg-white px-4 py-3 text-center text-sm font-medium text-slate-700"
            >
              {t.login}
            </Link>
          </div>
        </section>
      </div>
    </main>
  )
}
