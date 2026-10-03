import exifr from 'exifr'
import type { PhotoLocation, PhotoRecord } from '../types/photo'
import { stripImageMetadata } from './imageSanitizationService'

type ExifMetadata = {
  latitude?: unknown
  longitude?: unknown
  ImageDescription?: unknown
  UserComment?: unknown
  XPComment?: unknown
  XPSubject?: unknown
  XPTitle?: unknown
  DateTimeOriginal?: unknown
  CreateDate?: unknown
  ModifyDate?: unknown
}

export type SkippedPhoto = {
  fileName: string
  reason: 'missing-location' | 'read-failed'
}

export type PhotoProcessingResult = {
  locations: PhotoLocation[]
  skippedPhotos: SkippedPhoto[]
}

const LOCATION_PRECISION = 4

export async function processPhotoFiles(
  files: File[],
  onProgress?: (completed: number, total: number) => void,
): Promise<PhotoProcessingResult> {
  const locations = new Map<string, PhotoLocation>()
  const skippedPhotos: SkippedPhoto[] = []
  const concurrency = Math.min(3, Math.max(1, files.length))
  let processedCount = 0

  const results = await mapWithConcurrency(files, concurrency, async (file, index) => {
    try {
      const metadata = (await exifr.parse(file, {
        gps: true,
        exif: true,
        tiff: true,
      })) as ExifMetadata | undefined

      const latitude = toCoordinate(metadata?.latitude, -90, 90)
      const longitude = toCoordinate(metadata?.longitude, -180, 180)

      if (latitude === undefined || longitude === undefined) {
        return { skipped: { fileName: file.name, reason: 'missing-location' as const } }
      }

      const sanitizedFile = await stripImageMetadata(file)
      const photo: PhotoRecord = {
        id: createPhotoId(file, index),
        fileName: sanitizedFile.name,
        file: sanitizedFile,
        previewUrl: URL.createObjectURL(sanitizedFile),
        latitude,
        longitude,
        description: firstDescription(
          metadata?.ImageDescription,
          metadata?.UserComment,
          toDescription(metadata?.XPComment, 'utf-16le'),
          toDescription(metadata?.XPSubject, 'utf-16le'),
          toDescription(metadata?.XPTitle, 'utf-16le'),
        ),
        takenAt: toDate(
          metadata?.DateTimeOriginal ??
            metadata?.CreateDate ??
            metadata?.ModifyDate,
        ),
      }

      return {
        photo,
        locationKey: createLocationKey(latitude, longitude),
      }
    } catch {
      return { skipped: { fileName: file.name, reason: 'read-failed' as const } }
    } finally {
      processedCount += 1
      onProgress?.(processedCount, files.length)
    }
  })

  for (const result of results) {
    if (result == null) continue

    if ('skipped' in result) {
      const skipped = result.skipped
      if (skipped) skippedPhotos.push(skipped)
      continue
    }

    const existingLocation = locations.get(result.locationKey)
    if (existingLocation) {
      existingLocation.photos.push(result.photo)
    } else {
      locations.set(result.locationKey, {
        id: `location-${result.locationKey}`,
        latitude: result.photo.latitude,
        longitude: result.photo.longitude,
        city: undefined,
        country: undefined,
        photos: [result.photo],
      })
    }
  }

  return {
    locations: Array.from(locations.values()),
    skippedPhotos,
  }
}

function toCoordinate(
  value: unknown,
  minimum: number,
  maximum: number,
): number | undefined {
  if (typeof value !== 'number' || !Number.isFinite(value)) return undefined
  if (value < minimum || value > maximum) return undefined
  return value
}

function toDate(value: unknown): Date | undefined {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value
  if (typeof value !== 'string' && typeof value !== 'number') return undefined

  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? undefined : date
}

function createLocationKey(latitude: number, longitude: number): string {
  return `${latitude.toFixed(LOCATION_PRECISION)}:${longitude.toFixed(LOCATION_PRECISION)}`
}

function createPhotoId(file: File, index: number): string {
  return crypto.randomUUID?.() ?? `${file.name}-${file.lastModified}-${index}`
}

async function mapWithConcurrency<T, Result>(
  items: T[],
  concurrency: number,
  mapItem: (item: T, index: number) => Promise<Result>,
): Promise<Result[]> {
  const results = new Array<Result>(items.length)
  let nextIndex = 0

  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (nextIndex < items.length) {
      const currentIndex = nextIndex
      nextIndex += 1
      results[currentIndex] = await mapItem(items[currentIndex], currentIndex)
    }
  }))

  return results
}

function firstDescription(...values: unknown[]): string | undefined {
  for (const value of values) {
    const description = toDescription(value)
    if (description) return description
  }

  return undefined
}

function toDescription(
  value: unknown,
  encoding: 'utf-8' | 'utf-16le' = 'utf-8',
): string | undefined {
  let description: string

  if (typeof value === 'string') {
    description = value
  } else if (value instanceof ArrayBuffer) {
    description = new TextDecoder(encoding).decode(value)
  } else if (ArrayBuffer.isView(value)) {
    const bytes = new Uint8Array(value.buffer, value.byteOffset, value.byteLength)
    description = new TextDecoder(encoding).decode(bytes)
  } else if (Array.isArray(value) && value.every((byte) => typeof byte === 'number')) {
    description = new TextDecoder(encoding).decode(new Uint8Array(value))
  } else {
    return undefined
  }

  const normalized = description.replace(/\0/g, '').trim()
  return normalized || undefined
}