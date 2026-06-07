# HTTPS deployment

Recommended production setup:

1. Run the frontend on `127.0.0.1:3000`.
2. Run the backend on `127.0.0.1:8000`.
3. Put Caddy, Nginx, Cloudflare, or another TLS reverse proxy in front.
4. Set public URLs to `https://...`.

Example backend environment:

```env
FRONTEND_URL=https://example.com
CORS_ORIGINS=https://example.com
PUBLIC_API_URL=https://api.example.com
```

Example frontend environment:

```env
NEXT_PUBLIC_API_URL=https://api.example.com
```

Example Caddyfile:

```caddyfile
example.com {
  reverse_proxy 127.0.0.1:3000
}

api.example.com {
  reverse_proxy 127.0.0.1:8000
}
```

Stripe webhook endpoint:

```text
https://api.example.com/member/stripe/webhook
```

The backend also supports direct HTTPS if `HTTPS_KEY_PATH` and
`HTTPS_CERT_PATH` are both configured, but a reverse proxy is safer and easier
to operate for production certificates.
