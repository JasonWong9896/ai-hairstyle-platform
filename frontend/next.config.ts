import type { NextConfig } from "next";

const apiUrl = process.env.NEXT_PUBLIC_API_URL
const parsedApiUrl = apiUrl ? new URL(apiUrl) : undefined
const apiHost = parsedApiUrl?.hostname
const apiPort = parsedApiUrl?.port ?? '8000'
const apiOrigin = parsedApiUrl?.origin ?? 'http://localhost:8000'
const scriptSrc =
  process.env.NODE_ENV === 'development'
    ? "script-src 'self' 'unsafe-inline' 'unsafe-eval'"
    : "script-src 'self' 'unsafe-inline'"

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              scriptSrc,
              "style-src 'self' 'unsafe-inline'",
              `img-src 'self' data: blob: http://localhost:8000 http://127.0.0.1:8000 ${apiOrigin}`,
              `connect-src 'self' ${apiOrigin}`,
              "base-uri 'self'",
              "form-action 'self'",
            ].join('; '),
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=()',
          },
        ],
      },
    ]
  },
  images: {
    remotePatterns: [
      {
        protocol: 'http',
        hostname: 'localhost',
        port: '8000',
        pathname: '/uploads/**',
      },
      {
        protocol: 'http',
        hostname: '127.0.0.1',
        port: '8000',
        pathname: '/uploads/**',
      },
      ...(apiHost
        ? [
            {
              protocol: 'http' as const,
              hostname: apiHost,
              port: apiPort,
              pathname: '/uploads/**',
            },
          ]
        : []),
    ],
  },
};

export default nextConfig;
