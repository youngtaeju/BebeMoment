// 보호자 기기별 사진 저장 형식 쿠키. 미설정·그 외 값은 원본.
export const DOWNLOAD_FORMAT_COOKIE = 'download_format'

export const DOWNLOAD_FORMATS = ['original', 'gallery'] as const
export type DownloadFormat = (typeof DOWNLOAD_FORMATS)[number]

export function parseDownloadFormat(raw: string | undefined): DownloadFormat {
  return raw === 'gallery' ? 'gallery' : 'original'
}
