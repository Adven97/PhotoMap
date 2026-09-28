import exifr from 'exifr'
import type { PhotoLocation, PhotoRecord } from '../types/photo'

type ExifMetadata = {
  latitude?: unknown
  longitude?: unknown
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
): Promise<PhotoProcessingResult> {
  const locations = new Map<string, PhotoLocation>()
  const skippedPhotos: SkippedPhoto[] = []

  for (const [index, file] of files.entries()) {
    try {
      const metadata = (await exifr.parse(file, {
        gps: true,
        exif: true,
        tiff: true,
      })) as ExifMetadata | undefined

      const latitude = toCoordinate(metadata?.latitude, -90, 90)
      const longitude = toCoordinate(metadata?.longitude, -180, 180)

      if (latitude === undefined || longitude === undefined) {
        skippedPhotos.push({
          fileName: file.name,
          reason: 'missing-location',
        })
        continue
      }

      const photo: PhotoRecord = {
        id: createPhotoId(file, index),
        file,
        previewUrl: URL.createObjectURL(file),
        latitude,
        longitude,
        takenAt: toDate(
          metadata?.DateTimeOriginal ??
            metadata?.CreateDate ??
            metadata?.ModifyDate,
        ),
      }

      const locationKey = createLocationKey(latitude, longitude)
      const existingLocation = locations.get(locationKey)

      if (existingLocation) {
        existingLocation.photos.push(photo)
      } else {
        locations.set(locationKey, {
          id: `location-${locationKey}`,
          latitude,
          longitude,
          photos: [photo],
        })
      }
    } catch {
      skippedPhotos.push({
        fileName: file.name,
        reason: 'read-failed',
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
  return `${file.name}-${file.lastModified}-${index}`
}