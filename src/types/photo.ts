export type PhotoRecord = {
  id: string
  fileName: string
  file: File
  previewUrl: string
  storagePath?: string
  latitude: number
  longitude: number
  description?: string
  takenAt?: Date
}

export type PhotoLocation = {
  id: string
  latitude: number
  longitude: number
  city?: string
  country?: string
  photos: PhotoRecord[]
}