import { mkdirSync } from 'fs';
import { join } from 'path';

export const uploadsDir = join(__dirname, '..', '..', 'uploads');

export function ensureUploadsDir() {
  mkdirSync(uploadsDir, { recursive: true });
  return uploadsDir;
}

export function uploadDestination(
  _req: unknown,
  _file: unknown,
  callback: (error: Error | null, destination: string) => void,
) {
  callback(null, ensureUploadsDir());
}

export function uploadUrl(filename: string, headers: { host?: string; forwardedProto?: string }) {
  const publicApiUrl =
    process.env.PUBLIC_API_URL ??
    (headers.host ? `${headers.forwardedProto ?? 'http'}://${headers.host}` : 'http://localhost:8000');

  return `${publicApiUrl.replace(/\/$/, '')}/uploads/${filename}`;
}
