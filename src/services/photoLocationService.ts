import type { PhotoLocation, PhotoRecord } from '../types/photo'

export function mergePhotoLocations(
  existingLocations: PhotoLocation[],
  incomingLocations: PhotoLocation[],
): PhotoLocation[] {
  const locations = new Map(
    existingLocations.map((location) => [location.id, { ...location, photos: [...location.photos] }]),
  )

  for (const incomingLocation of incomingLocations) {
    const existingLocation = locations.get(incomingLocation.id)
    if (!existingLocation) {
      locations.set(incomingLocation.id, incomingLocation)
      continue
    }

    const photos = new Map(
      existingLocation.photos.map((photo) => [getPhotoKey(photo), photo]),
    )

    for (const photo of incomingLocation.photos) {
      const photoKey = getPhotoKey(photo)
      if (photos.has(photoKey)) {
        URL.revokeObjectURL(photo.previewUrl)
      } else {
        photos.set(photoKey, photo)
      }
    }

    locations.set(incomingLocation.id, {
      ...existingLocation,
      photos: Array.from(photos.values()),
    })
  }

  return Array.from(locations.values())
}

export function getPhotoKey(photo: PhotoRecord): string {
  return `${photo.fileName}:${photo.file.lastModified}:${photo.file.size}`
}
