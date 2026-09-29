import { useRef, useState } from 'react'
import type { DragEvent } from 'react'
import { ImagePlus, Trash2, Upload } from 'lucide-react'
import { processPhotoFiles, type PhotoProcessingResult } from '../services/photoExifService'

type InitialViewProps = {
  onProcessed: (result: PhotoProcessingResult) => Promise<void>
}

export function InitialView({ onProcessed }: InitialViewProps) {
  const [files, setFiles] = useState<File[]>([])
  const [isDragging, setIsDragging] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const [processingProgress, setProcessingProgress] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const addFiles = (selectedFiles: FileList | File[]) => {
    const imageFiles = Array.from(selectedFiles).filter((file) =>
      file.type.startsWith('image/'),
    )

    setFiles((currentFiles) => {
      const existingFiles = new Set(
        currentFiles.map((file) => `${file.name}-${file.lastModified}`),
      )

      return [
        ...currentFiles,
        ...imageFiles.filter(
          (file) => !existingFiles.has(`${file.name}-${file.lastModified}`),
        ),
      ]
    })
  }

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    setIsDragging(false)
    addFiles(event.dataTransfer.files)
  }

  const handleSave = async () => {
    setIsProcessing(true)
    setProcessingProgress(0)
    setError(null)
    try {
      const result = await processPhotoFiles(files, (completed, total) => {
        setProcessingProgress(total > 0 ? Math.round((completed / total) * 100) : 0)
      })
      const photoCount = result.locations.reduce(
        (total, location) => total + location.photos.length,
        0,
      )

      if (photoCount === 0) {
        setError('No photos with readable GPS location data were found. Check that location data is included in the photos.')
        return
      }

      await onProcessed(result)
    } catch {
      setError('Photos could not be processed. Try selecting them again.')
    } finally {
      setIsProcessing(false)
      setProcessingProgress(0)
    }
  }

  return (
    <main className="upload-page">
      <header className="page-header">
        <p className="eyebrow">PhotoMap</p>
        <h1>Add photos</h1>
        <p className="intro">Place your vacation memories on a map.</p>
      </header>

      <section className="upload-card" aria-labelledby="upload-heading">
        <div className="section-heading">
          <ImagePlus aria-hidden="true" size={22} strokeWidth={1.8} />
          <div>
            <h2 id="upload-heading">Your photo collection</h2>
            <p>Choose images from your device to get started.</p>
          </div>
        </div>

        <div
          className={`drop-zone${isDragging ? ' is-dragging' : ''}`}
          onDragEnter={(event) => {
            event.preventDefault()
            setIsDragging(true)
          }}
          onDragOver={(event) => event.preventDefault()}
          onDragLeave={(event) => {
            if (event.currentTarget === event.target) setIsDragging(false)
          }}
          onDrop={handleDrop}
        >
          <Upload aria-hidden="true" size={28} strokeWidth={1.6} />
          <p className="drop-title">Drop your photos here</p>
          <p className="drop-description">JPEG, PNG, or HEIC images</p>
          <button
            type="button"
            className="select-button"
            onClick={() => fileInputRef.current?.click()}
          >
            Select files
          </button>
          <input
            ref={fileInputRef}
            className="visually-hidden"
            type="file"
            accept="image/*"
            multiple
            onChange={(event) => {
              if (event.target.files) addFiles(event.target.files)
              event.target.value = ''
            }}
          />
        </div>

        <div className="upload-actions">
          <button
            type="button"
            className="clear-button"
            disabled={files.length === 0}
            onClick={() => setFiles([])}
          >
            <Trash2 aria-hidden="true" size={16} />
            Clear
          </button>
        </div>

        {files.length > 0 && (
          <div className="selected-files" aria-live="polite">
            <div className="files-heading">
              <span>{files.length} {files.length === 1 ? 'photo' : 'photos'} selected</span>
            </div>
            <p
              className="selected-files-summary"
              title={files.map((file) => file.name).join(', ')}
            >
              {files.slice(0, 5).map((file) => file.name).join(', ')}
              {files.length > 5 && `... and ${files.length - 5} more`}
            </p>
          </div>
        )}

        {isProcessing && (
          <div className="processing-progress" aria-live="polite">
            <div className="processing-progress-bar" style={{ width: `${processingProgress}%` }} />
            <span>{processingProgress}% processed</span>
          </div>
        )}

        {error && <p className="map-upload-error" role="alert">{error}</p>}

        <button
          type="button"
          className="save-button"
          disabled={files.length === 0 || isProcessing}
          onClick={handleSave}
        >
          <ImagePlus aria-hidden="true" size={18} />
          {isProcessing ? 'Processing photos...' : 'Add to map'}
        </button>
      </section>
    </main>
  )
}