'use client'
import { cn } from '@/lib/cn'
import { DOWNLOAD_FORMATS, type DownloadFormat } from '@/lib/download-format'
import { setDownloadFormat } from '@/server/download/set-download-format'
import { useTranslations } from 'next-intl'
import { useState, useTransition } from 'react'

export function DownloadFormatSwitcher({ initial }: { initial: DownloadFormat }) {
  const t = useTranslations('settings.download')
  const [format, setFormat] = useState(initial)
  const [pending, startTransition] = useTransition()

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-1 rounded-full border border-base-200 bg-base-100 p-1 dark:border-base-800 dark:bg-base-800">
        {DOWNLOAD_FORMATS.map((opt) => {
          const active = format === opt
          return (
            <button
              key={opt}
              type="button"
              disabled={pending}
              onClick={() =>
                startTransition(async () => {
                  await setDownloadFormat(opt)
                  setFormat(opt)
                })
              }
              aria-pressed={active}
              className={cn(
                'flex h-8 flex-1 items-center justify-center rounded-full px-3 text-xs font-medium transition disabled:opacity-60',
                active
                  ? 'bg-base-0 text-base-900 shadow-sm dark:bg-base-900 dark:text-base-50'
                  : 'text-base-500 hover:text-base-900 dark:hover:text-base-100',
              )}
            >
              {t(opt)}
            </button>
          )
        })}
      </div>
      <p className="px-1 text-xs text-base-500">{t(`${format}Desc`)}</p>
    </div>
  )
}
