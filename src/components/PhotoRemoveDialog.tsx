import { Trash2 } from 'lucide-react'

type PhotoRemoveDialogProps = {
  photoName: string
  isRemoving: boolean
  hasError: boolean
  onConfirm: () => void
  onCancel: () => void
}

export function PhotoRemoveDialog({
  photoName,
  isRemoving,
  hasError,
  onConfirm,
  onCancel,
}: PhotoRemoveDialogProps) {
  return (
    <div
      className="photo-remove-overlay"
      onClick={(event) => {
        event.stopPropagation()
        if (!isRemoving) onCancel()
      }}
    >
      <section
        className="photo-remove-dialog"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="photo-remove-title"
        aria-describedby="photo-remove-description"
        onClick={(event) => event.stopPropagation()}
      >
        <h2 id="photo-remove-title">Remove photo?</h2>
        <p id="photo-remove-description">
          Remove <strong>{photoName}</strong> from your collection?
        </p>
        <div className="gallery-remove-actions">
          <button
            type="button"
            className="gallery-remove-confirm"
            disabled={isRemoving}
            onClick={onConfirm}
          >
            <Trash2 aria-hidden="true" size={15} />
            {isRemoving ? 'Removing...' : 'Confirm removal'}
          </button>
          <button
            type="button"
            className="gallery-description-cancel"
            disabled={isRemoving}
            onClick={onCancel}
          >
            Cancel
          </button>
        </div>
        {hasError && (
          <p className="gallery-description-error" role="alert">
            Could not remove this photo. Try again.
          </p>
        )}
      </section>
    </div>
  )
}