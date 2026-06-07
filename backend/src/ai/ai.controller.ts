import {
  BadGatewayException,
  Body,
  Controller,
  Headers,
  Post,
} from '@nestjs/common'
import axios, { AxiosError } from 'axios'
import { randomUUID } from 'crypto'
import { mkdirSync, writeFileSync } from 'fs'
import { extname, join } from 'path'
import { MemberService } from '../member/member.service'

@Controller('ai')
export class AiController {
  private readonly previewCost = 10

  constructor(private readonly memberService: MemberService) {}

  @Post('generate')
  async generate(
    @Headers('authorization') authorization: string | undefined,
    @Headers('host') host: string | undefined,
    @Body() body: any,
  ) {

    console.log('AI REQUEST:', body)

    const charge = await this.memberService.chargeAiPreview(
      bearerToken(authorization),
      this.previewCost,
    )

    try {
      const res = await axios.post(
        process.env.AI_SERVICE_URL ?? 'http://127.0.0.1:9000/generate',
        body,
        {
          timeout: 600000,
        },
      )

      const normalized = normalizeAiResponse(res.data)
      const imageUrl = await materializeGeneratedImage(normalized.imageUrl, host)

      return {
        ...normalized,
        imageUrl,
        wallet: charge.wallet,
        pointTransaction: charge.transaction,
        pointsCharged: this.previewCost,
      }
    } catch (err) {
      await this.memberService.refundAiPreview(charge.userId, this.previewCost)

      if (err instanceof AxiosError) {
        const detail =
          err.response?.data?.detail ??
          err.response?.data ??
          err.message

        throw new BadGatewayException({
          message: 'AI image generation failed',
          detail,
        })
      }

      throw err
    }
  }
}

function bearerToken(authorization: string | undefined): string | undefined {
  if (!authorization?.toLowerCase().startsWith('bearer ')) {
    return undefined
  }

  return authorization.slice('bearer '.length).trim()
}

function normalizeAiResponse(data: any) {
  if (typeof data === 'string') {
    return { imageUrl: data }
  }

  if (!data || typeof data !== 'object') {
    return { imageUrl: null }
  }

  return {
    ...data,
    imageUrl:
      data.imageUrl ??
      data.image_url ??
      data.url ??
      data.outputUrl ??
      data.output_url ??
      data.result ??
      data.image ??
      null,
  }
}

async function materializeGeneratedImage(
  imageUrl: string | null,
  host: string | undefined,
): Promise<string | null> {
  if (!imageUrl) {
    return null
  }

  const trimmed = imageUrl.trim()
  if (!trimmed) {
    return null
  }

  let imageBytes: Buffer | null = null
  let extension = '.png'

  if (trimmed.startsWith('data:image/')) {
    const match = trimmed.match(/^data:image\/([a-zA-Z0-9.+-]+);base64,(.+)$/)
    if (!match) {
      return trimmed
    }

    extension = extensionForMimeSubtype(match[1])
    imageBytes = Buffer.from(match[2], 'base64')
  } else if (/^https?:\/\//i.test(trimmed)) {
    try {
      const response = await axios.get<ArrayBuffer>(trimmed, {
        responseType: 'arraybuffer',
        timeout: 600000,
      })
      imageBytes = Buffer.from(response.data)
      extension = extensionFromUrl(trimmed) ?? extensionFromContentType(response.headers['content-type']) ?? extension
    } catch {
      return trimmed
    }
  } else {
    return trimmed
  }

  const uploadsDir = join(__dirname, '..', '..', 'uploads')
  mkdirSync(uploadsDir, { recursive: true })

  const filename = `${randomUUID()}${extension}`
  writeFileSync(join(uploadsDir, filename), imageBytes)

  return uploadUrl(filename, host)
}

function uploadUrl(filename: string, host: string | undefined): string {
  const publicApiUrl =
    process.env.PUBLIC_API_URL ?? (host ? `http://${host}` : 'http://localhost:8000')

  return `${publicApiUrl.replace(/\/$/, '')}/uploads/${filename}`
}

function extensionFromUrl(value: string): string | null {
  try {
    const extension = extname(new URL(value).pathname).toLowerCase()
    return ['.jpg', '.jpeg', '.png', '.webp'].includes(extension) ? extension : null
  } catch {
    return null
  }
}

function extensionFromContentType(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null
  }

  if (value.includes('image/jpeg')) return '.jpg'
  if (value.includes('image/png')) return '.png'
  if (value.includes('image/webp')) return '.webp'
  return null
}

function extensionForMimeSubtype(value: string): string {
  if (value === 'jpeg' || value === 'jpg') return '.jpg'
  if (value === 'webp') return '.webp'
  return '.png'
}
