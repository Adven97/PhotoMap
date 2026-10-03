import { useEffect, useRef, useState } from 'react'
import { GalleryView } from './components/GalleryView'
import { InitialView } from './components/InitialView'
import { PhotoMap } from './components/PhotoMap'
import { ProcessingToast } from './components/ProcessingToast'
import { mergePhotoLocations } from './services/photoLocationService'
import { reverseGeocode } from './services/reverseGeocodingService'
import {
  deleteUserPhoto,
  loadPhotoLocations,
  savePlaceForPhotos,
  updatePhotoDescription,
  uploadPhotoLocations,
} from './services/photoStorageService'
import type { PhotoLocation } from './types/photo'
import type { PhotoProcessingResult } from './services/photoExifService'
import './App.css'

type AppProps = {
  userId: string
}

const RESTORE_TIMEOUT_MS = 2500

function App({ userId }: AppProps) {
  const [view, setView] = useState<'upload' | 'map'>('upload')
  const [locations, setLocations] = useState<PhotoLocation[]>([])
  const [selectedLocation, setSelectedLocation] = useState<PhotoLocation | null>(null)
  const [processingResult, setProcessingResult] = useState<PhotoProcessingResult | null>(null)
  const [isRestoring, setIsRestoring] = useState(true)
  const [isSavingPhotos, setIsSavingPhotos] = useState(false)
  const [pendingPhotoDeletionIds, setPendingPhotoDeletionIds] = useState<string[]>([])
  const [saveProgress, setSaveProgress] = useState<{ completed: number; total: number } | null>(null)
  const [storageError, setStorageError] = useState<string | null>(null)
  const placeLookupIds = useRef(new Set<string>())
  const locationsRef = useRef(locations)
  const isMounted = useRef(true)
  const unsavedPhotoCount = locations.reduce(
    (total, location) => total + location.photos.filter((photo) => !photo.storagePath).length,
    0,
  )
  const pendingChangeCount = unsavedPhotoCount + pendingPhotoDeletionIds.length

  useEffect(() => {
    locationsRef.current = locations
  }, [locations])

  useEffect(() => {
    isMounted.current = true
    return () => {
      isMounted.current = false
    }
  }, [])

  useEffect(() => {
    if (unsavedPhotoCount === 0) return

    const warnBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault()
      event.returnValue = ''
    }

    window.addEventListener('beforeunload', warnBeforeUnload)
    return () => window.removeEventListener('beforeunload', warnBeforeUnload)
  }, [unsavedPhotoCount])

  useEffect(() => {
    let isCurrent = true
    const restoreTimeoutId = window.setTimeout(() => {
      if (isCurrent) setIsRestoring(false)
    }, RESTORE_TIMEOUT_MS)

    loadPhotoLocations(userId)
      .then((savedLocations) => {
        if (!isCurrent) {
          savedLocations.flatMap((location) => location.photos).forEach((photo) => {
            URL.revokeObjectURL(photo.previewUrl)
          })
          return
        }

        if (savedLocations.length > 0) {
          setLocations((current) => mergePhotoLocations(savedLocations, current))
          setView('map')
        }
      })
      .catch(() => {
        if (isCurrent) setStorageError('Could not load saved photos from Firestore.')
      })
      .finally(() => {
        window.clearTimeout(restoreTimeoutId)
        if (isCurrent) setIsRestoring(false)
      })

    return () => {
      isCurrent = false
      window.clearTimeout(restoreTimeoutId)
    }
  }, [userId])

  useEffect(() => {
    if (isRestoring) return

    for (const location of locations) {
      if (location.city || location.country || placeLookupIds.current.has(location.id)) continue
      placeLookupIds.current.add(location.id)

      void reverseGeocode(location.latitude, location.longitude)
        .then(async (place) => {
          if (!place || !isMounted.current) return
          const currentLocation = locationsRef.current.find((item) => item.id === location.id)
          if (!currentLocation) return

          setLocations((current) =>
            current.map((currentLocation) =>
              currentLocation.id === location.id
                ? {
                    ...currentLocation,
                    city: place.city ?? undefined,
                    country: place.country ?? undefined,
                  }
                : currentLocation,
            ),
          )

          const savedPhotoIds = currentLocation.photos
            .filter((photo) => photo.storagePath)
            .map((photo) => photo.id)

          if (savedPhotoIds.length > 0) {
            try {
              await savePlaceForPhotos(userId, savedPhotoIds, place)
            } catch {
              if (isMounted.current) setStorageError('Could not save photo location details.')
            }
          }
        })
        .catch(() => undefined)
        .finally(() => placeLookupIds.current.delete(location.id))
    }
  }, [isRestoring, locations, userId])

  useEffect(() => {
    if (!processingResult) return

    const timeoutId = window.setTimeout(() => {
      setProcessingResult(null)
    }, 5000)

    return () => window.clearTimeout(timeoutId)
  }, [processingResult])

  const handlePhotosAdded = (result: PhotoProcessingResult) => {
    setLocations((current) => mergePhotoLocations(current, result.locations))
    setProcessingResult(result)
    setStorageError(null)
  }

  const handleSaveAll = async () => {
    const unsavedLocations = locations.flatMap((location) => {
      const photos = location.photos.filter((photo) => !photo.storagePath)
      return photos.length > 0 ? [{ ...location, photos }] : []
    })

    const photosToDelete = [...pendingPhotoDeletionIds]
    if ((unsavedLocations.length === 0 && photosToDelete.length === 0) || isSavingPhotos) return

    setIsSavingPhotos(true)
    setStorageError(null)
    let completedChanges = 0
    const uploadCount = unsavedLocations.reduce((total, location) => total + location.photos.length, 0)
    setSaveProgress({
      completed: 0,
      total: uploadCount + photosToDelete.length,
    })
    try {
      const uploadedLocations = await uploadPhotoLocations(
        userId,
        unsavedLocations,
        (completed) => {
          completedChanges = completed
          setSaveProgress({ completed: completedChanges, total: uploadCount + photosToDelete.length })
        },
      )
      const uploadedPhotos = new Map(
        uploadedLocations.flatMap((location) =>
          location.photos.map((photo) => [photo.id, photo] as const),
        ),
      )

      setLocations((current) => current.map((location) => ({
        ...location,
        photos: location.photos.map((photo) => {
          const uploadedPhoto = uploadedPhotos.get(photo.id)
          return uploadedPhoto
            ? { ...photo, storagePath: uploadedPhoto.storagePath }
            : photo
        }),
      })))

      for (const photoId of photosToDelete) {
        await deleteUserPhoto(userId, photoId)
        completedChanges += 1
        setSaveProgress({ completed: completedChanges, total: uploadCount + photosToDelete.length })
      }

      setPendingPhotoDeletionIds((current) =>
        current.filter((photoId) => !photosToDelete.includes(photoId)),
      )
    } catch (error) {
      setStorageError(error instanceof Error ? error.message : 'Photo saving failed.')
    } finally {
      setIsSavingPhotos(false)
      setSaveProgress(null)
    }
  }

  const storageNotice = storageError ? (
    <p className="storage-warning" role="alert">
      {storageError}
    </p>
  ) : null

  if (isRestoring) {
    return <main className="app-loading" role="status">Loading your photo collection...</main>
  }

  if (view === 'map') {
    return (
      <>
        <PhotoMap
          locations={locations}
          onLocationSelect={setSelectedLocation}
          onPhotosAdded={handlePhotosAdded}
          onSaveAll={handleSaveAll}
          pendingChangeCount={pendingChangeCount}
          isSavingPhotos={isSavingPhotos}
          saveProgress={saveProgress}
        />
        {processingResult && <ProcessingToast result={processingResult} />}
        {storageNotice}
        {selectedLocation && (
          <GalleryView
            key={selectedLocation.id}
            location={selectedLocation}
            onClose={() => setSelectedLocation(null)}
            onDescriptionSave={async (photoId, description) => {
              const normalizedDescription = description.trim()
              await updatePhotoDescription(userId, photoId, normalizedDescription)

              const updateLocation = (location: PhotoLocation): PhotoLocation => ({
                ...location,
                photos: location.photos.map((photo) =>
                  photo.id === photoId
                    ? { ...photo, description: normalizedDescription || undefined }
                    : photo,
                ),
              })

              setLocations((current) => current.map(updateLocation))
              setSelectedLocation((current) => (current ? updateLocation(current) : current))
              setStorageError(null)
            }}
            onPhotoRemove={async (photoId) => {
              const photo = locations
                .flatMap((location) => location.photos)
                .find((item) => item.id === photoId)

              if (!photo) return

              if (photo.storagePath) {
                setPendingPhotoDeletionIds((current) =>
                  current.includes(photoId) ? current : [...current, photoId],
                )
              }
              setLocations((current) => current.flatMap((location) => {
                const photos = location.photos.filter((item) => item.id !== photoId)
                return photos.length > 0 ? [{ ...location, photos }] : []
              }))
              setSelectedLocation((current) => {
                if (!current) return null
                const photos = current.photos.filter((item) => item.id !== photoId)
                return photos.length > 0 ? { ...current, photos } : null
              })
              if (photo.previewUrl.startsWith('blob:')) {
                URL.revokeObjectURL(photo.previewUrl)
              }
              setStorageError(null)
            }}
          />
        )}
      </>
    )
  }

  return (
    <>
      <InitialView
        onProcessed={async (result) => {
          handlePhotosAdded(result)
          setView('map')
        }}
      />
      {storageNotice}
    </>
  )
}

export default App