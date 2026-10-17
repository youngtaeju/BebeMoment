import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { parseExif } from './exif'

/** 최소 TIFF(리틀엔디언) — IFD0 에 EXIF IFD 포인터 하나, EXIF IFD 에 날짜 태그들. */
function tiffWithDates(dates: { DateTimeOriginal?: string; CreateDate?: string }): Buffer {
  const tags = [
    [0x9003, dates.DateTimeOriginal],
    [0x9004, dates.CreateDate],
  ].filter((t): t is [number, string] => t[1] !== undefined)
  const exifIfd = 26
  const dataStart = exifIfd + 2 + tags.length * 12 + 4
  const b = Buffer.alloc(dataStart + tags.length * 20)
  b.write('II', 0, 'ascii')
  b.writeUInt16LE(42, 2)
  b.writeUInt32LE(8, 4)
  b.writeUInt16LE(1, 8)
  b.writeUInt16LE(0x8769, 10)
  b.writeUInt16LE(4, 12)
  b.writeUInt32LE(1, 14)
  b.writeUInt32LE(exifIfd, 18)
  b.writeUInt32LE(0, 22)
  b.writeUInt16LE(tags.length, exifIfd)
  tags.forEach(([tag, value], i) => {
    const entry = exifIfd + 2 + i * 12
    const at = dataStart + i * 20
    b.writeUInt16LE(tag, entry)
    b.writeUInt16LE(2, entry + 2)
    b.writeUInt32LE(20, entry + 4)
    b.writeUInt32LE(at, entry + 8)
    b.write(`${value}\0`, at, 'ascii')
  })
  return b
}

// IFD0 ASCII 태그만 담은 최소 JPEG(SOI + APP1 Exif + EOI). 값은 오프셋 저장이라 5바이트 이상(NUL 포함)만.
function jpegWithAsciiTags(tags: Array<[number, string]>): Buffer {
  const entriesEnd = 8 + 2 + tags.length * 12 + 4
  const values = tags.map(([, v]) => Buffer.from(`${v}\0`, 'latin1'))
  const tiff = Buffer.alloc(entriesEnd + values.reduce((n, v) => n + v.length, 0))
  tiff.write('II', 0, 'latin1')
  tiff.writeUInt16LE(42, 2)
  tiff.writeUInt32LE(8, 4)
  tiff.writeUInt16LE(tags.length, 8)
  let valueOffset = entriesEnd
  tags.forEach(([tag], i) => {
    const entry = 10 + i * 12
    const value = values[i] as Buffer
    tiff.writeUInt16LE(tag, entry)
    tiff.writeUInt16LE(2, entry + 2)
    tiff.writeUInt32LE(value.length, entry + 4)
    tiff.writeUInt32LE(valueOffset, entry + 8)
    value.copy(tiff, valueOffset)
    valueOffset += value.length
  })
  const payload = Buffer.concat([Buffer.from('Exif\0\0', 'latin1'), tiff])
  const length = Buffer.alloc(2)
  length.writeUInt16BE(payload.length + 2)
  return Buffer.concat([
    Buffer.from([0xff, 0xd8, 0xff, 0xe1]),
    length,
    payload,
    Buffer.from([0xff, 0xd9]),
  ])
}

const MAKE = 0x010f
const MODEL = 0x0110

describe('parseExif', () => {
  it('returns empty object for unparseable buffer', async () => {
    const result = await parseExif(Buffer.from('not an image'))
    expect(result).toEqual({})
  })

  it('returns empty object for empty buffer', async () => {
    const result = await parseExif(Buffer.alloc(0))
    expect(result).toEqual({})
  })

  it('drops string values that carry NUL characters', async () => {
    // 깨진 EXIF(오프셋 오류·0 채움) 재현. jsonb 는 \u0000 을 거부.
    const result = await parseExif(
      jpegWithAsciiTags([
        [MAKE, 'sam\0sung'],
        [MODEL, 'Galaxy S25+'],
      ]),
    )
    expect(JSON.stringify(result.raw)).not.toContain('\\u0000')
    expect(result.cameraMake).toBeUndefined()
    expect(result.cameraModel).toBe('Galaxy S25+')
  })
})

// EXIF 날짜는 시간대 없는 벽시계다. taken_at 은 그 벽시계를 UTC 필드에 담는다 — 서버 시간대가
// 끼어들면 운영(TZ=Asia/Seoul)에서 9시간 이른 값이 저장돼 아침 사진이 전날로 묶였다.
describe.each([
  ['UTC', 0],
  ['Asia/Seoul', -540],
  ['America/Los_Angeles', 420],
])('parseExif 촬영 시각 — 서버 시간대가 %s 여도', (zone, offset) => {
  let saved: string | undefined
  beforeEach(() => {
    saved = process.env.TZ
    process.env.TZ = zone
  })
  afterEach(() => {
    if (saved === undefined) delete process.env.TZ
    else process.env.TZ = saved
  })

  it('정말 그 시간대에서 돈다', () => {
    expect(new Date('2026-10-12T07:44:52Z').getTimezoneOffset()).toBe(offset)
  })

  it('EXIF 벽시계를 그대로 UTC 필드에 담는다', async () => {
    const { takenAt } = await parseExif(tiffWithDates({ DateTimeOriginal: '2026:10:12 07:44:52' }))
    expect(takenAt?.toISOString()).toBe('2026-10-12T07:44:52.000Z')
  })

  it('DateTimeOriginal 이 없으면 CreateDate 를 쓴다', async () => {
    const { takenAt } = await parseExif(tiffWithDates({ CreateDate: '2026:10:12 23:10:05' }))
    expect(takenAt?.toISOString()).toBe('2026-10-12T23:10:05.000Z')
  })

  it('자리표시자 날짜는 촬영 시각으로 치지 않는다 — 파일명·수정시각으로 넘어가게', async () => {
    const { takenAt } = await parseExif(tiffWithDates({ DateTimeOriginal: '0000:00:00 00:00:00' }))
    expect(takenAt).toBeUndefined()
  })
})
