/**
 * ImageUploader — §11 Step 1.
 * Upload / camera / drag-drop, preview, retake, remove; validates type,
 * size and decode (corrupt files), compresses oversized images client-side.
 */

import { useCallback, useRef, useState } from 'react'
import { Camera, ImageUp, Loader2, RotateCcw, Trash2, UploadCloud } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { IMAGE_COMPRESS_QUALITY, IMAGE_MAX_BYTES, IMAGE_MAX_DIMENSION } from '@/config/app'

export interface UploaderValue {
  dataUrl: string | null
  fileName: string
}

async function decodeImage(file: File): Promise<HTMLImageElement> {
  const url = URL.createObjectURL(file)
  try {
    const img = new Image()
    img.src = url
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve()
      img.onerror = () => reject(new Error('decode failed'))
      setTimeout(() => reject(new Error('decode timeout')), 8000)
    })
    return img
  } finally {
    URL.revokeObjectURL(url)
  }
}

async function compress(file: File): Promise<string> {
  const img = await decodeImage(file)
  const scale = Math.min(1, IMAGE_MAX_DIMENSION / Math.max(img.naturalWidth, img.naturalHeight))
  const w = Math.max(1, Math.round(img.naturalWidth * scale))
  const h = Math.max(1, Math.round(img.naturalHeight * scale))
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('canvas unavailable')
  ctx.drawImage(img, 0, 0, w, h)
  const isJpegLike = file.type === 'image/jpeg' || file.type === 'image/webp' || file.type === 'image/png'
  return canvas.toDataURL(isJpegLike ? 'image/jpeg' : 'image/jpeg', IMAGE_COMPRESS_QUALITY)
}

const ACCEPTED = ['image/jpeg', 'image/png', 'image/webp', 'image/avif']

export function ImageUploader({
  value,
  onChange,
  onError,
  label = 'Photo of the problem',
  required,
}: {
  value: UploaderValue | null
  onChange: (v: UploaderValue | null) => void
  onError?: (msg: string | null) => void
  label?: string
  required?: boolean
}) {
  const [busy, setBusy] = useState(false)
  const [drag, setDrag] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const cameraRef = useRef<HTMLInputElement>(null)

  const handleFile = useCallback(
    async (file: File | undefined | null) => {
      if (!file) return
      onError?.(null)
      if (!ACCEPTED.includes(file.type)) {
        onError?.(`Unsupported file type (${file.type || 'unknown'}). Use JPG, PNG or WebP.`)
        return
      }
      if (file.size > IMAGE_MAX_BYTES) {
        onError?.(`File is ${(file.size / 1024 / 1024).toFixed(1)} MB — maximum is ${IMAGE_MAX_BYTES / 1024 / 1024} MB.`)
        return
      }
      setBusy(true)
      try {
        const dataUrl = await compress(file)
        onChange({ dataUrl, fileName: file.name })
      } catch {
        onError?.('That image could not be read — it may be corrupted. Try another photo.')
        onChange(null)
      } finally {
        setBusy(false)
      }
    },
    [onChange, onError],
  )

  if (value?.dataUrl) {
    return (
      <div className="space-y-3">
        <p className="text-sm font-medium" id="uploader-label">
          {label}
          {required ? <span className="ml-1 text-destructive">*</span> : null}
        </p>
        <div className="relative overflow-hidden rounded-xl border border-border/70 bg-muted">
          <img src={value.dataUrl} alt="Preview of the uploaded problem" className="max-h-72 w-full object-cover" />
          <div className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-2 bg-gradient-to-t from-black/70 to-transparent p-3">
            <span className="truncate font-mono text-[10px] text-white/90">{value.fileName}</span>
            <div className="flex gap-2">
              <Button
                type="button"
                size="sm"
                variant="secondary"
                className="h-8 bg-white/90 text-black hover:bg-white"
                onClick={() => cameraRef.current?.click()}
              >
                <RotateCcw className="mr-1.5 size-3.5" aria-hidden /> Retake
              </Button>
              <Button
                type="button"
                size="sm"
                variant="secondary"
                className="h-8 bg-white/90 text-black hover:bg-white"
                onClick={() => {
                  onChange(null)
                  onError?.(null)
                }}
              >
                <Trash2 className="mr-1.5 size-3.5" aria-hidden /> Remove
              </Button>
            </div>
          </div>
        </div>
        <InputsRefs
          cameraRef={cameraRef}
          inputRef={inputRef}
          onFile={handleFile}
          busy={busy}
        />
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <p className="text-sm font-medium" id="uploader-label">
        {label}
        {required ? <span className="ml-1 text-destructive" aria-hidden>*</span> : null}
        <span className="ml-2 text-xs font-normal text-muted-foreground">JPG / PNG / WebP, max 8 MB</span>
      </p>
      <div
        onDragOver={(e) => {
          e.preventDefault()
          setDrag(true)
        }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => {
          e.preventDefault()
          setDrag(false)
          void handleFile(e.dataTransfer.files?.[0])
        }}
        className={cn(
          'flex flex-col items-center justify-center rounded-xl border-2 border-dashed px-6 py-10 text-center transition-colors',
          drag ? 'border-primary bg-primary/5' : 'border-border bg-muted/30',
        )}
      >
        {busy ? (
          <Loader2 className="size-8 animate-spin text-primary" aria-label="Processing image" />
        ) : (
          <UploadCloud className={cn('size-8', drag ? 'text-primary' : 'text-muted-foreground')} aria-hidden />
        )}
        <p className="mt-3 text-sm font-medium">{busy ? 'Compressing photo…' : 'Drag a photo here'}</p>
        <p className="mt-1 text-xs text-muted-foreground">or choose one of the options below</p>
        <div className="mt-4 flex flex-wrap justify-center gap-2">
          <Button type="button" variant="outline" size="sm" onClick={() => inputRef.current?.click()} disabled={busy}>
            <ImageUp className="mr-2 size-4" aria-hidden /> Upload file
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={() => cameraRef.current?.click()} disabled={busy}>
            <Camera className="mr-2 size-4" aria-hidden /> Use camera
          </Button>
        </div>
      </div>
      <InputsRefs cameraRef={cameraRef} inputRef={inputRef} onFile={handleFile} busy={busy} />
    </div>
  )
}

function InputsRefs({
  cameraRef,
  inputRef,
  onFile,
  busy,
}: {
  cameraRef: React.RefObject<HTMLInputElement | null>
  inputRef: React.RefObject<HTMLInputElement | null>
  onFile: (f: File | null) => void
  busy: boolean
}) {
  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="sr-only"
        aria-label="Choose photo file"
        onChange={(e) => {
          void onFile(e.target.files?.[0] ?? null)
          e.currentTarget.value = ''
        }}
        disabled={busy}
      />
      <input
        ref={cameraRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="sr-only"
        aria-label="Take photo with camera"
        onChange={(e) => {
          void onFile(e.target.files?.[0] ?? null)
          e.currentTarget.value = ''
        }}
        disabled={busy}
      />
    </>
  )
}
