import { useEffect, useState } from 'react'
import { Pencil, Save, Trash2, X } from 'lucide-react'
import { PhotoRemoveDialog } from './PhotoRemoveDialog'
import { formatPlaceName, reverseGeocode } from '../services/reverseGeocodingService'
import type { PhotoLocation, PhotoRecord } from '../types/photo'

type GalleryViewProps = {
  location: PhotoLocation
  onClose: () => void
  onDescriptionSave: (photoId: string, description: string) => Promise<void>
  onPhotoRemove: (photoId: string) => Promise<void>
}

const dateFormatter = new Intl.DateTimeFormat(undefined, {
  dateStyle: 'long',
  timeStyle: 'short',
})

type PlaceState =
  | { status: 'loading' }
  | { status: 'loaded'; name: string | null }
  | { status: 'error' }

export function GalleryView({ location, onClose, onDescriptionSave, onPhotoRemove }: GalleryViewProps) {
  const [selectedPhotoId, setSelectedPhotoId] = useState(location.photos[0].id)
  const [place, setPlace] = useState<PlaceState>({ status: 'loading' })
  const [descriptionDrafts, setDescriptionDrafts] = useState<Record<string, string>>({})
  const [editingPhotoId, setEditingPhotoId] = useState<string | null>(null)
  const [isConfirmingRemoval, setIsConfirmingRemoval] = useState(false)
  const [isRemovingPhoto, setIsRemovingPhoto] = useState(false)
  const [removeError, setRemoveError] = useState(false)
  const [saveState, setSaveState] = useState<{
    photoId: string
    status: 'saving' | 'saved' | 'error'
  } | null>(null)
  const selectedPhoto = findPhoto(location.photos, selectedPhotoId)
  const description = descriptionDrafts[selectedPhoto.id] ?? selectedPhoto.description ?? ''
  const isDescriptionDirty = description !== (selectedPhoto.description ?? '')
  const hasSavedDescription = Boolean(selectedPhoto.description?.trim())
  const isEditingDescription = !hasSavedDescription || editingPhotoId === selectedPhoto.id
  const descriptionSaveStatus =
    saveState?.photoId === selectedPhoto.id ? saveState.status : 'idle'

  const handleDescriptionSave = async () => {
    setSaveState({ photoId: selectedPhoto.id, status: 'saving' })

    try {
      await onDescriptionSave(selectedPhoto.id, description)
      setDescriptionDrafts((current) => {
        if (current[selectedPhoto.id] !== description) return current

        const next = { ...current }
        delete next[selectedPhoto.id]
        return next
      })
      setEditingPhotoId(null)
      setSaveState({ photoId: selectedPhoto.id, status: 'saved' })
    } catch {
      setSaveState({ photoId: selectedPhoto.id, status: 'error' })
    }
  }

  const handlePhotoRemove = async () => {
    setIsRemovingPhoto(true)
    setRemoveError(false)

    try {
      await onPhotoRemove(selectedPhoto.id)
      const remainingPhotos = location.photos.filter((photo) => photo.id !== selectedPhoto.id)

      if (remainingPhotos.length > 0) {
        setSelectedPhotoId(remainingPhotos[0].id)
        setIsConfirmingRemoval(false)
        setIsRemovingPhoto(false)
      }
    } catch {
      setRemoveError(true)
      setIsRemovingPhoto(false)
    }
  }

  useEffect(() => {
    let isCurrent = true

    reverseGeocode(location.latitude, location.longitude)
      .then((name) => {
        if (isCurrent) setPlace({ status: 'loaded', name: formatPlaceName(name) })
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
            alt={selectedPhoto.fileName}
          />
          <div className="gallery-thumbnails" aria-label="Photos at this location">
            {location.photos.map((photo) => (
              <button
                key={photo.id}
                type="button"
                className={`gallery-thumbnail${photo.id === selectedPhoto.id ? ' is-selected' : ''}`}
                onClick={() => setSelectedPhotoId(photo.id)}
                aria-label={`View ${photo.fileName}`}
              >
                <img src={photo.previewUrl} alt="" />
              </button>
            ))}
          </div>
        </div>

        <aside className="gallery-info">
          <p className="eyebrow">Photo details</p>
          <h2>{selectedPhoto.fileName}</h2>
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
          <div className="gallery-description">
            <div className="gallery-description-heading">
              <span>Description</span>
              {hasSavedDescription && !isEditingDescription && (
                <button
                  type="button"
                  className="gallery-description-edit"
                  onClick={() => {
                    setEditingPhotoId(selectedPhoto.id)
                    setSaveState(null)
                  }}
                >
                  <Pencil aria-hidden="true" size={14} />
                  Edit
                </button>
              )}
            </div>
            {isEditingDescription ? (
              <textarea
                aria-label="Description"
                value={description}
                disabled={descriptionSaveStatus === 'saving'}
                onChange={(event) => {
                  setDescriptionDrafts((current) => ({
                    ...current,
                    [selectedPhoto.id]: event.target.value,
                  }))
                  setSaveState(null)
                }}
                placeholder="Add a description..."
                rows={5}
              />
            ) : (
              <p className="gallery-description-text">{selectedPhoto.description}</p>
            )}
            {isEditingDescription && (
              <div className="gallery-description-actions">
                <button
                  type="button"
                  className="gallery-description-save"
                  disabled={!isDescriptionDirty || descriptionSaveStatus === 'saving'}
                  onClick={() => void handleDescriptionSave()}
                >
                  <Save aria-hidden="true" size={16} />
                  {descriptionSaveStatus === 'saving' ? 'Saving...' : 'Save description'}
                </button>
                {hasSavedDescription && (
                  <button
                    type="button"
                    className="gallery-description-cancel"
                    disabled={descriptionSaveStatus === 'saving'}
                    onClick={() => {
                      setDescriptionDrafts((current) => {
                        const next = { ...current }
                        delete next[selectedPhoto.id]
                        return next
                      })
                      setEditingPhotoId(null)
                      setSaveState(null)
                    }}
                  >
                    Cancel
                  </button>
                )}
                {descriptionSaveStatus === 'saved' && (
                  <span className="gallery-description-status" role="status">Saved</span>
                )}
                {descriptionSaveStatus === 'error' && (
                  <span className="gallery-description-error" role="alert">
                    Could not save. Try again.
                  </span>
                )}
              </div>
            )}
          </div>
          <div className="gallery-remove-section">
            <button
              type="button"
              className="gallery-remove-button"
              onClick={() => setIsConfirmingRemoval(true)}
            >
              <Trash2 aria-hidden="true" size={16} />
              Remove photo
            </button>
          </div>
        </aside>
      </div>
      {isConfirmingRemoval && (
        <PhotoRemoveDialog
          photoName={selectedPhoto.fileName}
          isRemoving={isRemovingPhoto}
          hasError={removeError}
          onConfirm={() => void handlePhotoRemove()}
          onCancel={() => {
            setIsConfirmingRemoval(false)
            setRemoveError(false)
          }}
        />
      )}
    </div>
  )
}

function findPhoto(photos: PhotoRecord[], photoId: string): PhotoRecord {
  return photos.find((photo) => photo.id === photoId) ?? photos[0]
}

function formatTakenAt(photo: PhotoRecord): string {
  return photo.takenAt ? dateFormatter.format(photo.takenAt) : 'Date unavailable'
}