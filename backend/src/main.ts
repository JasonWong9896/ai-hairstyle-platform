import { NestFactory } from '@nestjs/core'
import { AppModule } from './app.module'

import { NestExpressApplication } from '@nestjs/platform-express'
import { existsSync, readFileSync } from 'fs'
import { join } from 'path'

function loadEnvFile() {
  const envPath = join(__dirname, '..', '.env')
  if (!existsSync(envPath)) {
    return
  }

  for (const line of readFileSync(envPath, 'utf-8').split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#') || !trimmed.includes('=')) {
      continue
    }

    const [key, ...valueParts] = trimmed.split('=')
    process.env[key.trim()] ??= valueParts.join('=').trim()
  }
}

async function bootstrap() {
  loadEnvFile()

  const app =
    await NestFactory.create<NestExpressApplication>(
      AppModule,
      {
        rawBody: true,
        httpsOptions: httpsOptions(),
      },
    )

  app.disable('x-powered-by')
  app.use(securityHeaders)
  app.use(createRateLimiter())

  app.useStaticAssets(
    join(__dirname, '..', 'uploads'),
    {
      prefix: '/uploads/',
    },
  )

  app.enableCors({
    origin(origin, callback) {
      const allowedOrigins = configuredOrigins()
      if (!origin || allowedOrigins.has(origin)) {
        callback(null, true)
        return
      }

      callback(new Error('Not allowed by CORS'), false)
    },
    methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
      'Authorization',
      'Content-Type',
      'Stripe-Signature',
      'X-Member-Admin-Key',
    ],
    maxAge: 86400,
  })

  const port = Number(process.env.PORT ?? 8000)
  const host = process.env.HOST ?? '0.0.0.0'

  await app.listen(port, host)
}

bootstrap()

function httpsOptions() {
  const keyPath = process.env.HTTPS_KEY_PATH;
  const certPath = process.env.HTTPS_CERT_PATH;

  if (!keyPath && !certPath) {
    return undefined;
  }

  if (!keyPath || !certPath) {
    throw new Error('HTTPS_KEY_PATH and HTTPS_CERT_PATH must be configured together');
  }

  if (!existsSync(keyPath) || !existsSync(certPath)) {
    throw new Error('HTTPS certificate files were not found');
  }

  return {
    key: readFileSync(keyPath),
    cert: readFileSync(certPath),
  };
}

function configuredOrigins(): Set<string> {
  const frontendUrl = process.env.FRONTEND_URL ?? 'http://localhost:3000'
  const corsOrigins = process.env.CORS_ORIGINS ?? ''
  const origins = [frontendUrl, ...corsOrigins.split(',')]
    .map((value) => value.trim().replace(/\/$/, ''))
    .filter(Boolean)

  return new Set(origins)
}

function securityHeaders(_req: any, res: any, next: () => void) {
  res.setHeader('X-Content-Type-Options', 'nosniff')
  res.setHeader('X-Frame-Options', 'DENY')
  res.setHeader('Referrer-Policy', 'no-referrer')
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()')
  res.setHeader('Cross-Origin-Resource-Policy', 'same-site')
  next()
}

function createRateLimiter() {
  const hits = new Map<string, { count: number; resetAt: number }>()
  const windowMs = 60_000

  return (req: any, res: any, next: () => void) => {
    const now = Date.now()
    const path = String(req.originalUrl ?? req.url ?? '')
    const ip = String(
      req.headers?.['x-forwarded-for']?.split(',')[0]?.trim() ??
        req.socket?.remoteAddress ??
        'unknown',
    )
    const max = sensitivePath(path) ? 30 : 240
    const key = `${ip}:${path.split('?')[0]}`
    const current = hits.get(key)

    if (!current || current.resetAt <= now) {
      hits.set(key, { count: 1, resetAt: now + windowMs })
      next()
      return
    }

    current.count += 1
    if (current.count > max) {
      res.status(429).json({ message: 'Too many requests' })
      return
    }

    if (hits.size > 5000) {
      for (const [hitKey, value] of hits) {
        if (value.resetAt <= now) {
          hits.delete(hitKey)
        }
      }
    }

    next()
  }
}

function sensitivePath(path: string): boolean {
  return [
    '/auth/login',
    '/auth/register',
    '/auth/resend-confirmation',
    '/auth/forgot-password',
    '/auth/reset-password',
    '/member/recharges',
    '/member/stripe/checkout',
  ].some((prefix) => path.startsWith(prefix))
}
