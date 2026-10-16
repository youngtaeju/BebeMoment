'use server'
import { DOWNLOAD_FORMAT_COOKIE, type DownloadFormat } from '@/lib/download-format'
import { cookies } from 'next/headers'

// 기기별 저장 형식(로케일 쿠키와 같은 방식). 다운로드 라우트가 보호자 요청에서만 읽음. 1년 TTL.
export async function setDownloadFormat(format: DownloadFormat): Promise<void> {
  const store = await cookies()
  store.set(DOWNLOAD_FORMAT_COOKIE, format, {
    path: '/',
    maxAge: 60 * 60 * 24 * 365,
    sameSite: 'lax',
  })
}
