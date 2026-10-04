import { useState } from 'react'
import { ChevronDown, ChevronUp, LoaderCircle, Save, X } from 'lucide-react'
import type { FormEvent } from 'react'
import { DateRangePicker } from './DateRangePicker'
import type { DateGranularity } from './DateRangePicker'
import { MapPhotoUploader } from './MapPhotoUploader'
import type { PhotoProcessingResult } from '../services/photoExifService'

type MapHeaderProps = {
  query: string
  onQueryChange: (query: string) => void
  onClearSearch: () => void
  dateGranularity: DateGranularity
  dateFrom: string
  dateTo: string
  onDateRangeApply: (
    granularity: DateGranularity,
    dateFrom: string,
    dateTo: string,
  ) => void
  availableYears: string[]
  onSubmit: (event: FormEvent<HTMLFormElement>) => void
  isFiltering: boolean
  checkedCount: number
  locationCount: number
  matchCount: number | null
  lookupFailureCount: number
  onPhotosAdded: (result: PhotoProcessingResult) => Promise<void>
  onSaveAll: () => Promise<void>
  pendingChangeCount: number
  showSaveButton: boolean
  isSavingPhotos: boolean
  saveProgress: { completed: number; total: number } | null
}

export function MapHeader({
  query,
  onQueryChange,
  onClearSearch,
  dateGranularity,
  dateFrom,
  dateTo,
  onDateRangeApply,
  availableYears,
  onSubmit,
  isFiltering,
  checkedCount,
  locationCount,
  matchCount,
  lookupFailureCount,
  onPhotosAdded,
  onSaveAll,
  pendingChangeCount,
  showSaveButton,
  isSavingPhotos,
  saveProgress,
}: MapHeaderProps) {
  const [isExpanded, setIsExpanded] = useState(true)

  return (
    <header className="map-header">
      <div className="map-header-title">
        <p className="map-brand">PhotoMap</p>
        <span>{locationCount} {locationCount === 1 ? 'location' : 'locations'}</span>
        {showSaveButton && (
          <button
            type="button"
            className="map-save-button"
            disabled={isSavingPhotos || pendingChangeCount === 0}
            aria-busy={isSavingPhotos}
            onClick={() => void onSaveAll()}
          >
            {isSavingPhotos ? (
              <LoaderCircle aria-hidden="true" className="is-spinning" size={16} />
            ) : (
              <Save aria-hidden="true" size={16} />
            )}
            {isSavingPhotos
              ? `Saving ${saveProgress?.completed ?? 0}/${saveProgress?.total ?? pendingChangeCount}...`
              : pendingChangeCount > 0
                ? `Save changes (${pendingChangeCount})`
                : 'Save all'}
          </button>
        )}
        <button
          type="button"
          className="map-header-toggle"
          aria-expanded={isExpanded}
          aria-label={isExpanded ? 'Collapse map header' : 'Expand map header'}
          onClick={() => setIsExpanded((expanded) => !expanded)}
        >
          {isExpanded ? <ChevronUp aria-hidden="true" size={18} /> : <ChevronDown aria-hidden="true" size={18} />}
        </button>
      </div>
      {isExpanded && (
        <div className="map-header-content">
          <form className="place-filter" onSubmit={onSubmit}>
            <div className="city-filter-row">
              <label className="visually-hidden" htmlFor="place-filter-input">
                Filter by city or country
              </label>
              <input
                id="place-filter-input"
                type="search"
                value={query}
                placeholder="Filter by city or country"
                onChange={(event) => {
                  if (event.target.value === '') onClearSearch()
                  else onQueryChange(event.target.value)
                }}
              />
              <div className="city-filter-actions">
                {query && (
                  <button
                    type="button"
                    className="city-filter-clear"
                    aria-label="Clear search"
                    title="Clear search"
                    disabled={isFiltering}
                    onClick={onClearSearch}
                  >
                    <X aria-hidden="true" size={16} />
                  </button>
                )}
                <button type="submit" className="city-filter-apply" disabled={isFiltering}>
                  Apply
                </button>
              </div>
            </div>
            <DateRangePicker
              granularity={dateGranularity}
              dateFrom={dateFrom}
              dateTo={dateTo}
              availableYears={availableYears}
              onChange={onDateRangeApply}
            />
          </form>
          <MapPhotoUploader
            disabled={isFiltering || isSavingPhotos}
            onProcessed={onPhotosAdded}
          />
          {isFiltering && (
            <p className="filter-status" role="status">
              Checking locations {checkedCount} of {locationCount}...
            </p>
          )}
          {!isFiltering && matchCount !== null && (
            <p className="filter-status" role="status">
              {matchCount === 0
                ? 'No matching photos.'
                : `${matchCount} matching ${matchCount === 1 ? 'photo' : 'photos'}.`}
              {lookupFailureCount > 0 && ` ${lookupFailureCount} place lookups failed.`}
            </p>
          )}
        </div>
      )}
    </header>
  )
}