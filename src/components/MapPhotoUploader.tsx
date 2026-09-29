import { useRef, useState } from 'react'
import type { DragEvent } from 'react'
import { ImagePlus, LoaderCircle, Plus, Trash2, Upload } from 'lucide-react'
import { processPhotoFiles, type PhotoProcessingResult } from '../services/photoExifService'

type MapPhotoUploaderProps = {
  disabled: boolean
  onProcessed: (result: PhotoProcessingResult) => void | Promise<void>
}

export function MapPhotoUploader({ disabled, onProcessed }: MapPhotoUploaderProps) {
  const [files, setFiles] = useState<File[]>([])
  const [isDragging, setIsDragging] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const addFiles = (selectedFiles: FileList | File[]) => {
    const imageFiles = Array.from(selectedFiles).filter((file) =>
      file.type.startsWith('image/'),
    )

    setFiles((currentFiles) => {
      const existingFiles = new Set(
        currentFiles.map((file) => `${file.name}-${file.lastModified}-${file.size}`),
      )

      return [
        ...currentFiles,
        ...imageFiles.filter(
          (file) => !existingFiles.has(`${file.name}-${file.lastModified}-${file.size}`),
        ),
      ]
    })
  }

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    setIsDragging(false)
    if (!disabled && !isProcessing) addFiles(event.dataTransfer.files)
  }

  const handleAdd = async () => {
    if (files.length === 0 || disabled || isProcessing) return

    setIsProcessing(true)
    setError(null)
    try {
      const result = await processPhotoFiles(files)
      await onProcessed(result)
      setFiles([])
    } catch {
      setError('Photos could not be processed. Try selecting them again.')
    } finally {
      setIsProcessing(false)
    }
  }

  return (
    <section className="map-photo-uploader" aria-label="Add photos to map">
      <div
        className={`map-drop-zone${isDragging ? ' is-dragging' : ''}`}
        onDragEnter={(event) => {
          event.preventDefault()
          if (!disabled && !isProcessing) setIsDragging(true)
        }}
        onDragOver={(event) => event.preventDefault()}
        onDragLeave={(event) => {
          if (event.currentTarget === event.target) setIsDragging(false)
        }}
        onDrop={handleDrop}
      >
        <Upload aria-hidden="true" size={19} />
        <span>Drop photos here</span>
        <span className="map-drop-separator">or</span>
        <button
          type="button"
          className="map-select-button"
          disabled={disabled || isProcessing}
          onClick={() => fileInputRef.current?.click()}
        >
          <Plus aria-hidden="true" size={15} />
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

      {files.length > 0 && (
        <div className="map-upload-selection">
          <span>{files.length} {files.length === 1 ? 'photo' : 'photos'} ready</span>
          <div className="map-upload-actions">
            <button
              type="button"
              className="map-clear-button"
              disabled={disabled || isProcessing}
              onClick={() => setFiles([])}
            >
              <Trash2 aria-hidden="true" size={14} />
              Clear
            </button>
            <button
              type="button"
              className="map-add-button"
              disabled={disabled || isProcessing}
              onClick={handleAdd}
            >
              {isProcessing ? (
                <LoaderCircle aria-hidden="true" className="is-spinning" size={15} />
              ) : (
                <ImagePlus aria-hidden="true" size={15} />
              )}
              {isProcessing ? 'Adding...' : 'Add photos'}
            </button>
          </div>
        </div>
      )}
      {error && <p className="map-upload-error" role="alert">{error}</p>}
    </section>
  )
}
