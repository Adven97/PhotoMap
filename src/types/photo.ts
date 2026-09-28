export type PhotoRecord = {
  id: string
  file: File
  previewUrl: string
  latitude: number
  longitude: number
  takenAt?: Date
}

export type PhotoLocation = {
  id: string
  latitude: number
  longitude: number
  photos: PhotoRecord[]
}