import { useState } from 'react'
import { ChevronDown, ChevronUp, Search } from 'lucide-react'
import type { FormEvent } from 'react'
import { DateRangePicker } from './DateRangePicker'
import type { DateGranularity } from './DateRangePicker'
import { MapPhotoUploader } from './MapPhotoUploader'
import type { PhotoProcessingResult } from '../services/photoExifService'

type MapHeaderProps = {
  query: string
  onQueryChange: (query: string) => void
  dateGranularity: DateGranularity
  onDateGranularityChange: (granularity: DateGranularity) => void
  dateFrom: string
  dateTo: string
  onDateFromChange: (date: string) => void
  onDateToChange: (date: string) => void
  availableYears: string[]
  onSubmit: (event: FormEvent<HTMLFormElement>) => void
  isFiltering: boolean
  checkedCount: number
  locationCount: number
  matchCount: number | null
  lookupFailureCount: number
  onPhotosAdded: (result: PhotoProcessingResult) => void
}

export function MapHeader({
  query,
  onQueryChange,
  dateGranularity,
  onDateGranularityChange,
  dateFrom,
  dateTo,
  onDateFromChange,
  onDateToChange,
  availableYears,
  onSubmit,
  isFiltering,
  checkedCount,
  locationCount,
  matchCount,
  lookupFailureCount,
  onPhotosAdded,
}: MapHeaderProps) {
  const [isExpanded, setIsExpanded] = useState(true)

  return (
    <header className="map-header">
      <div className="map-header-title">
        <p className="map-brand">PhotoMap</p>
        <span>{locationCount} {locationCount === 1 ? 'location' : 'locations'}</span>
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
                onChange={(event) => onQueryChange(event.target.value)}
              />
              <button type="submit" disabled={isFiltering}>
                <Search aria-hidden="true" size={16} />
                Apply
              </button>
            </div>
            <DateRangePicker
              granularity={dateGranularity}
              dateFrom={dateFrom}
              dateTo={dateTo}
              availableYears={availableYears}
              onChange={(granularity, from, to) => {
                onDateGranularityChange(granularity)
                onDateFromChange(from)
                onDateToChange(to)
              }}
            />
          </form>
          <MapPhotoUploader
            disabled={isFiltering}
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