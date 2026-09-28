import { useEffect, useState } from 'react'
import { GalleryView } from './components/GalleryView'
import { InitialView } from './components/InitialView'
import { PhotoMap } from './components/PhotoMap'
import { ProcessingToast } from './components/ProcessingToast'
import { mergePhotoLocations } from './services/photoLocationService'
import type { PhotoLocation } from './types/photo'
import type { PhotoProcessingResult } from './services/photoExifService'
import './App.css'

function App() {
  const [view, setView] = useState<'upload' | 'map'>('upload')
  const [locations, setLocations] = useState<PhotoLocation[]>([])
  const [selectedLocation, setSelectedLocation] = useState<PhotoLocation | null>(null)
  const [processingResult, setProcessingResult] = useState<PhotoProcessingResult | null>(null)

  useEffect(() => {
    if (!processingResult) return

    const timeoutId = window.setTimeout(() => {
      setProcessingResult(null)
    }, 5000)

    return () => window.clearTimeout(timeoutId)
  }, [processingResult])

  if (view === 'map') {
    return (
      <>
        <PhotoMap
          locations={locations}
          onLocationSelect={setSelectedLocation}
          onPhotosAdded={(result, mergedLocations) => {
            setLocations(mergedLocations)
            setSelectedLocation(null)
            setProcessingResult(result)
          }}
        />
        {processingResult && <ProcessingToast result={processingResult} />}
        {selectedLocation && (
          <GalleryView
            key={selectedLocation.id}
            location={selectedLocation}
            onClose={() => setSelectedLocation(null)}
          />
        )}
      </>
    )
  }

  return (
    <InitialView
      onSaved={(result) => {
        setLocations(mergePhotoLocations([], result.locations))
        setProcessingResult(result)
        setView('map')
      }}
    />
  )
}

export default App
