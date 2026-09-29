import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
} from 'firebase/firestore'
import type { DocumentData } from 'firebase/firestore'
import { firestore } from '../firebase/firebaseServices'
import type { PhotoLocation, PhotoRecord } from '../types/photo'

const LOCATION_PRECISION = 4

type CloudPhoto = {
  id: string
  fileName: string
  storagePath: string
  contentType: string
  lastModified: number
  latitude: number
  longitude: number
  takenAt: Timestamp | null
  description?: string
  city?: string
  country?: string
}

export async function loadPhotoLocations(userId: string): Promise<PhotoLocation[]> {
  const { database } = requireServices()
  const photosQuery = collection(database, 'users', userId, 'photos')
  const snapshot = await getDocs(photosQuery)
  const documents = snapshot.docs.map((photoDocument) => ({
    id: photoDocument.id,
    data: photoDocument.data() as DocumentData,
  }))
  const photos = await mapWithConcurrency(documents, 4, async ({ id, data }) => {
    const cloudPhoto = parseCloudPhoto(id, data)
    const file = new File([''], cloudPhoto.fileName, {
      type: cloudPhoto.contentType,
      lastModified: cloudPhoto.lastModified,
    })
    const photo: PhotoRecord = {
      id: cloudPhoto.id,
      fileName: cloudPhoto.fileName,
      file,
      previewUrl: cloudPhoto.storagePath,
      storagePath: cloudPhoto.storagePath,
      latitude: cloudPhoto.latitude,
      longitude: cloudPhoto.longitude,
      description: cloudPhoto.description,
      takenAt: cloudPhoto.takenAt?.toDate(),
    }

    return {
      photo,
      city: cloudPhoto.city,
      country: cloudPhoto.country,
    }
  })

  const locations = new Map<string, PhotoLocation>()
  for (const { photo, city, country } of photos) {
    const locationKey = createLocationKey(photo.latitude, photo.longitude)
    const existingLocation = locations.get(locationKey)
    if (existingLocation) {
      existingLocation.photos.push(photo)
      existingLocation.city ??= city
      existingLocation.country ??= country
      continue
    }

    locations.set(locationKey, {
      id: `location-${locationKey}`,
      latitude: photo.latitude,
      longitude: photo.longitude,
      city,
      country,
      photos: [photo],
    })
  }

  return Array.from(locations.values())
}

export async function uploadPhotoLocations(
  userId: string,
  locations: PhotoLocation[],
  onProgress?: (completed: number, total: number) => void,
): Promise<PhotoLocation[]> {
  const { database } = requireServices()
  const uploadedLocations: PhotoLocation[] = []
  const uploadedPhotoIds: string[] = []
  const totalPhotos = locations.reduce((total, location) => total + location.photos.length, 0)

  try {
    for (const location of locations) {
      const uploadedPhotos: PhotoRecord[] = []

      for (const photo of location.photos) {
        const photoRef = doc(database, 'users', userId, 'photos', photo.id)
        const storagePath = await uploadPhotoToCloudinary(photo.file, userId)

        try {
          await setDoc(photoRef, {
            fileName: photo.fileName,
            storagePath,
            contentType: photo.file.type,
            lastModified: photo.file.lastModified,
            sizeBytes: photo.file.size,
            latitude: photo.latitude,
            longitude: photo.longitude,
            takenAt: photo.takenAt ? Timestamp.fromDate(photo.takenAt) : null,
            description: photo.description ?? '',
            city: location.city ?? null,
            country: location.country ?? null,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          })
        } catch (error) {
          await deleteCloudinaryAsset(storagePath).catch(() => undefined)
          await deleteDoc(photoRef).catch(() => undefined)
          throw error
        }

        uploadedPhotoIds.push(photo.id)
        uploadedPhotos.push({ ...photo, storagePath, previewUrl: storagePath })
        onProgress?.(uploadedPhotoIds.length, totalPhotos)
      }

      uploadedLocations.push({ ...location, photos: uploadedPhotos })
    }
  } catch (error) {
    await Promise.all(uploadedPhotoIds.map((photoId) =>
      deleteUserPhoto(userId, photoId).catch(() => undefined),
    ))
    throw error
  }

  return uploadedLocations
}

export async function updatePhotoDescription(
  userId: string,
  photoId: string,
  description: string,
): Promise<void> {
  const { database } = requireServices()
  await updateDoc(doc(database, 'users', userId, 'photos', photoId), {
    description,
    updatedAt: serverTimestamp(),
  })
}

export async function savePlaceForPhotos(
  userId: string,
  photoIds: string[],
  place: { city: string | null; country: string | null },
): Promise<void> {
  const { database } = requireServices()
  await Promise.all(photoIds.map((photoId) =>
    updateDoc(doc(database, 'users', userId, 'photos', photoId), {
      city: place.city,
      country: place.country,
      updatedAt: serverTimestamp(),
    }),
  ))
}

export async function deleteUserPhoto(userId: string, photoId: string): Promise<void> {
  const { database } = requireServices()
  const photoRef = doc(database, 'users', userId, 'photos', photoId)
  const snapshot = await getDoc(photoRef)
  const storedPhoto = snapshot.exists() ? snapshot.data() : null

  if (typeof storedPhoto?.storagePath === 'string') {
    await deleteCloudinaryAsset(storedPhoto.storagePath).catch(() => undefined)
  }

  await deleteDoc(photoRef)
}

async function uploadPhotoToCloudinary(file: File, userId: string): Promise<string> {
  const folder = `photomap/${userId}`
  const response = await fetch('/api/cloudinary/sign-upload', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ folder }),
  })

  if (!response.ok) {
    const message = await response.text()
    throw new Error(message || 'Unable to prepare Cloudinary upload.')
  }

  const payload = await response.json() as {
    uploadUrl: string
    apiKey: string
    timestamp: number
    signature: string
    folder: string
  }

  const formData = new FormData()
  formData.append('file', file)
  formData.append('api_key', payload.apiKey)
  formData.append('timestamp', String(payload.timestamp))
  formData.append('signature', payload.signature)
  formData.append('folder', payload.folder)

  const uploadResponse = await fetch(payload.uploadUrl, {
    method: 'POST',
    body: formData,
  })

  const uploadResult = await uploadResponse.json() as {
    secure_url?: string
    url?: string
    error?: { message?: string }
  }

  const uploadedUrl = uploadResult.secure_url ?? uploadResult.url

  if (!uploadResponse.ok || !uploadedUrl) {
    throw new Error(uploadResult.error?.message || 'Cloudinary upload failed.')
  }

  return uploadedUrl
}

async function deleteCloudinaryAsset(url: string): Promise<void> {
  const response = await fetch('/api/cloudinary/delete', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url }),
  })

  if (!response.ok) {
    const message = await response.text()
    throw new Error(message || 'Unable to remove Cloudinary asset.')
  }
}

function parseCloudPhoto(id: string, data: DocumentData): CloudPhoto {
  if (
    typeof data.fileName !== 'string' ||
    typeof data.storagePath !== 'string' ||
    typeof data.latitude !== 'number' ||
    typeof data.longitude !== 'number'
  ) {
    throw new Error(`Photo metadata for ${id} is incomplete.`)
  }

  return {
    id,
    fileName: data.fileName,
    storagePath: data.storagePath,
    contentType: typeof data.contentType === 'string' ? data.contentType : 'image/jpeg',
    lastModified: typeof data.lastModified === 'number' ? data.lastModified : Date.now(),
    latitude: data.latitude,
    longitude: data.longitude,
    takenAt: data.takenAt instanceof Timestamp ? data.takenAt : null,
    description: typeof data.description === 'string' ? data.description : undefined,
    city: typeof data.city === 'string' ? data.city : undefined,
    country: typeof data.country === 'string' ? data.country : undefined,
  }
}

function createLocationKey(latitude: number, longitude: number): string {
  return `${latitude.toFixed(LOCATION_PRECISION)}:${longitude.toFixed(LOCATION_PRECISION)}`
}

async function mapWithConcurrency<T, Result>(
  items: T[],
  concurrency: number,
  mapItem: (item: T) => Promise<Result>,
): Promise<Result[]> {
  const results = new Array<Result>(items.length)
  let nextIndex = 0

  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (nextIndex < items.length) {
      const currentIndex = nextIndex
      nextIndex += 1
      results[currentIndex] = await mapItem(items[currentIndex])
    }
  }))

  return results
}

function requireServices() {
  if (!firestore) {
    throw new Error('Firebase is not configured. Add the web app values to .env.local.')
  }

  return { database: firestore }
}