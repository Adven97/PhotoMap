import { useEffect, useState } from 'react'
import { X } from 'lucide-react'
import { reverseGeocode } from '../services/reverseGeocodingService'
import type { PhotoLocation, PhotoRecord } from '../types/photo'

type GalleryViewProps = {
  location: PhotoLocation
  onClose: () => void
}

const dateFormatter = new Intl.DateTimeFormat(undefined, {
  dateStyle: 'long',
  timeStyle: 'short',
})

type PlaceState =
  | { status: 'loading' }
  | { status: 'loaded'; name: string | null }
  | { status: 'error' }

export function GalleryView({ location, onClose }: GalleryViewProps) {
  const [selectedPhotoId, setSelectedPhotoId] = useState(location.photos[0].id)
  const [place, setPlace] = useState<PlaceState>({ status: 'loading' })
  const selectedPhoto = findPhoto(location.photos, selectedPhotoId)

  useEffect(() => {
    let isCurrent = true

    reverseGeocode(location.latitude, location.longitude)
      .then((name) => {
        if (isCurrent) setPlace({ status: 'loaded', name })
      })
      .catch(() => {
        if (isCurrent) setPlace({ status: 'error' })
      })

    return () => {
      isCurrent = false
    }
  }, [location.latitude, location.longitude])

  return (
    <div
      className="gallery-overlay"
      role="dialog"
      aria-modal="true"
      aria-label="Photo gallery"
      onClick={onClose}
    >
      <div className="gallery-view" onClick={(event) => event.stopPropagation()}>
        <button type="button" className="gallery-close" onClick={onClose} aria-label="Close gallery">
          <X aria-hidden="true" size={22} />
        </button>

        <div className="gallery-main">
          <img
            className="gallery-image"
            src={selectedPhoto.previewUrl}
            alt={selectedPhoto.file.name}
          />
          <div className="gallery-thumbnails" aria-label="Photos at this location">
            {location.photos.map((photo) => (
              <button
                key={photo.id}
                type="button"
                className={`gallery-thumbnail${photo.id === selectedPhoto.id ? ' is-selected' : ''}`}
                onClick={() => setSelectedPhotoId(photo.id)}
                aria-label={`View ${photo.file.name}`}
              >
                <img src={photo.previewUrl} alt="" />
              </button>
            ))}
          </div>
        </div>

        <aside className="gallery-info">
          <p className="eyebrow">Photo details</p>
          <h2>{selectedPhoto.file.name}</h2>
          <dl>
            <div>
              <dt>Taken</dt>
              <dd>{formatTakenAt(selectedPhoto)}</dd>
            </div>
            <div>
              <dt>Location</dt>
              <dd>
                {place.status === 'loading' && 'Finding place...'}
                {place.status === 'error' && 'Place unavailable'}
                {place.status === 'loaded' && (place.name ?? 'Place unavailable')}
              </dd>
            </div>
          </dl>
        </aside>
      </div>
    </div>
  )
}

function findPhoto(photos: PhotoRecord[], photoId: string): PhotoRecord {
  return photos.find((photo) => photo.id === photoId) ?? photos[0]
}

function formatTakenAt(photo: PhotoRecord): string {
  return photo.takenAt ? dateFormatter.format(photo.takenAt) : 'Date unavailable'
}