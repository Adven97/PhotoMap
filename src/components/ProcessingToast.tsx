import { AlertTriangle, CheckCircle2 } from 'lucide-react'
import type { PhotoProcessingResult } from '../services/photoExifService'

type ProcessingToastProps = {
  result: PhotoProcessingResult
}

export function ProcessingToast({ result }: ProcessingToastProps) {
  const successfulCount = result.locations.reduce(
    (total, location) => total + location.photos.length,
    0,
  )
  const failedCount = result.skippedPhotos.length
  const hasSuccessfulPhotos = successfulCount > 0

  return (
    <aside
      className={`processing-toast${hasSuccessfulPhotos ? '' : ' is-error'}`}
      role="status"
      aria-live="polite"
    >
      {hasSuccessfulPhotos ? (
        <CheckCircle2 aria-hidden="true" size={21} />
      ) : (
        <AlertTriangle aria-hidden="true" size={21} />
      )}
      <div>
        <strong>
          {hasSuccessfulPhotos
            ? 'Photos added to map'
            : 'No photos were added'}
        </strong>
        <p>
          {hasSuccessfulPhotos
            ? `${successfulCount} ${successfulCount === 1 ? 'photo' : 'photos'} ready to save, ${failedCount} skipped.`
            : `${failedCount} ${failedCount === 1 ? 'photo' : 'photos'} failed. Photos need readable GPS location data.`}
        </p>
      </div>
    </aside>
  )
}