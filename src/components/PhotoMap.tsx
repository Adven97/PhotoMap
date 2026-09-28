import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import {
  MapContainer,
  Marker,
  TileLayer,
  useMapEvents,
  useMap,
} from 'react-leaflet'
import { divIcon, type LatLngBoundsExpression } from 'leaflet'
import { MapHeader } from './MapHeader'
import type { DateGranularity } from './DateRangePicker'
import { filterLocationsByPlace } from '../services/reverseGeocodingService'
import { mergePhotoLocations } from '../services/photoLocationService'
import type { PhotoLocation } from '../types/photo'
import type { PhotoProcessingResult } from '../services/photoExifService'
import 'leaflet/dist/leaflet.css'

type PhotoLocationsProps = {
  locations: PhotoLocation[]
}

type PhotoMarkersProps = PhotoLocationsProps & {
  onLocationSelect: (location: PhotoLocation) => void
}

type PhotoMapProps = PhotoMarkersProps & {
  onPhotosAdded: (result: PhotoProcessingResult, locations: PhotoLocation[]) => void
}

const MIN_PIN_SIZE = 36
const MAX_PIN_SIZE = 72

function MapBounds({ locations }: PhotoLocationsProps) {
  const map = useMap()

  useEffect(() => {
    if (locations.length === 0) return

    const bounds: LatLngBoundsExpression = locations.map((location) => [
      location.latitude,
      location.longitude,
    ])

    map.fitBounds(bounds, { padding: [48, 48], maxZoom: 14 })
  }, [locations, map])

  return null
}

function PhotoMarkers({ locations, onLocationSelect }: PhotoMarkersProps) {
  const map = useMap()
  const [zoom, setZoom] = useState(2)
  const [, setMapRevision] = useState(0)

  useMapEvents({
    zoomend: (event) => {
      setZoom(event.target.getZoom())
      setMapRevision((revision) => revision + 1)
    },
    moveend: () => setMapRevision((revision) => revision + 1),
  })

  const pinSize = Math.min(
    MAX_PIN_SIZE,
    Math.max(MIN_PIN_SIZE, MIN_PIN_SIZE + (zoom - 2) * 3),
  )
  const locationGroups = groupNearbyLocations(locations, map, pinSize + 8)

  return (
    <>
      {locationGroups.map((group) => (
        <Marker
          key={group.location.id}
          position={[group.location.latitude, group.location.longitude]}
          eventHandlers={{ click: () => onLocationSelect(group.location) }}
          icon={divIcon({
            className: `photo-pin-icon${group.locationCount > 1 ? ' photo-pin-cluster' : ''}`,
            html: `<span class="photo-pin-content"><span class="photo-pin-photo"><img src="${group.location.photos[0].previewUrl}" alt="" /></span>${group.locationCount > 1 ? `<span class="photo-pin-count">${group.location.photos.length > 99 ? '99+' : group.location.photos.length}</span>` : ''}</span>`,
            iconSize: [pinSize, pinSize],
            iconAnchor: [pinSize / 2, pinSize / 2],
          })}
        />
      ))}
    </>
  )
}

type MarkerGroup = {
  location: PhotoLocation
  locationCount: number
}

function groupNearbyLocations(
  locations: PhotoLocation[],
  map: ReturnType<typeof useMap>,
  threshold: number,
): MarkerGroup[] {
  if (locations.length < 2) {
    return locations.map((location) => ({ location, locationCount: 1 }))
  }

  const points = locations.map((location) =>
    map.latLngToContainerPoint([location.latitude, location.longitude]),
  )
  const parents = locations.map((_, index) => index)
  const findRoot = (index: number): number => {
    if (parents[index] !== index) parents[index] = findRoot(parents[index])
    return parents[index]
  }
  const join = (first: number, second: number) => {
    const firstRoot = findRoot(first)
    const secondRoot = findRoot(second)
    if (firstRoot !== secondRoot) parents[secondRoot] = firstRoot
  }
  const buckets = new Map<string, number[]>()
  const maxDistanceSquared = threshold * threshold

  points.forEach((point, index) => {
    const cellX = Math.floor(point.x / threshold)
    const cellY = Math.floor(point.y / threshold)

    for (let offsetX = -1; offsetX <= 1; offsetX += 1) {
      for (let offsetY = -1; offsetY <= 1; offsetY += 1) {
        const neighbors = buckets.get(`${cellX + offsetX}:${cellY + offsetY}`) ?? []
        for (const neighborIndex of neighbors) {
          const neighbor = points[neighborIndex]
          const distanceX = point.x - neighbor.x
          const distanceY = point.y - neighbor.y
          if (distanceX * distanceX + distanceY * distanceY <= maxDistanceSquared) {
            join(index, neighborIndex)
          }
        }
      }
    }

    const cellKey = `${cellX}:${cellY}`
    const cellItems = buckets.get(cellKey) ?? []
    cellItems.push(index)
    buckets.set(cellKey, cellItems)
  })

  const groups = new Map<number, PhotoLocation[]>()
  locations.forEach((location, index) => {
    const root = findRoot(index)
    const group = groups.get(root) ?? []
    group.push(location)
    groups.set(root, group)
  })

  return Array.from(groups.values(), (group) => {
    if (group.length === 1) return { location: group[0], locationCount: 1 }

    const photos = Array.from(
      new Map(group.flatMap((location) => location.photos).map((photo) => [photo.id, photo])).values(),
    )
    const locationIds = group.map((location) => location.id).sort()

    return {
      locationCount: group.length,
      location: {
        id: `cluster-${locationIds.join('|')}`,
        latitude: group.reduce((sum, location) => sum + location.latitude, 0) / group.length,
        longitude: group.reduce((sum, location) => sum + location.longitude, 0) / group.length,
        photos,
      },
    }
  })
}

export function PhotoMap({ locations, onLocationSelect, onPhotosAdded }: PhotoMapProps) {
  const [query, setQuery] = useState('')
  const [dateGranularity, setDateGranularity] = useState<DateGranularity>('day')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [visibleLocations, setVisibleLocations] = useState(locations)
  const [isFiltering, setIsFiltering] = useState(false)
  const [checkedCount, setCheckedCount] = useState(0)
  const [matchCount, setMatchCount] = useState<number | null>(null)
  const [lookupFailureCount, setLookupFailureCount] = useState(0)
  const availableYears = Array.from(
    new Set(
      locations.flatMap((location) =>
        location.photos.flatMap((photo) =>
          photo.takenAt ? [String(photo.takenAt.getFullYear())] : [],
        ),
      ),
    ),
  ).sort((first, second) => Number(second) - Number(first))

  const dateFilteredLocations = filterLocationsByDate(
    locations,
    dateGranularity,
    dateFrom,
    dateTo,
  )

  const handlePhotosAdded = (result: PhotoProcessingResult) => {
    const mergedLocations = mergePhotoLocations(locations, result.locations)
    onPhotosAdded(result, mergedLocations)
    setVisibleLocations(mergedLocations)
    setQuery('')
    setDateFrom('')
    setDateTo('')
    setMatchCount(null)
    setLookupFailureCount(0)
    setCheckedCount(0)
  }

  const handleFilter = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const normalizedQuery = query.trim()
    const hasDateFilter = Boolean(dateFrom || dateTo)

    if (!normalizedQuery && !hasDateFilter) {
      setVisibleLocations(locations)
      setMatchCount(null)
      setLookupFailureCount(0)
      setCheckedCount(0)
      return
    }

    setIsFiltering(true)
    setCheckedCount(0)
    setMatchCount(null)

    const result = normalizedQuery
      ? await filterLocationsByPlace(
          dateFilteredLocations,
          normalizedQuery,
          setCheckedCount,
        )
      : {
          locations: dateFilteredLocations,
          checked: dateFilteredLocations.length,
          lookupFailures: 0,
        }

    setVisibleLocations(result.locations)
    setMatchCount(
      result.locations.reduce((total, location) => total + location.photos.length, 0),
    )
    setLookupFailureCount(result.lookupFailures)
    setIsFiltering(false)
  }

  return (
    <div className="map-page">
      <MapHeader
        query={query}
        onQueryChange={setQuery}
        dateGranularity={dateGranularity}
        onDateGranularityChange={(granularity) => {
          setDateGranularity(granularity)
          setDateFrom('')
          setDateTo('')
        }}
        dateFrom={dateFrom}
        dateTo={dateTo}
        onDateFromChange={setDateFrom}
        onDateToChange={setDateTo}
        availableYears={availableYears}
        onSubmit={handleFilter}
        isFiltering={isFiltering}
        checkedCount={checkedCount}
        locationCount={dateFilteredLocations.length}
        matchCount={matchCount}
        lookupFailureCount={lookupFailureCount}
        onPhotosAdded={handlePhotosAdded}
      />
      <MapContainer
        className="photo-map"
        center={[20, 0]}
        zoom={2}
        scrollWheelZoom
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <MapBounds locations={visibleLocations} />
        <PhotoMarkers
          locations={visibleLocations}
          onLocationSelect={onLocationSelect}
        />
      </MapContainer>
    </div>
  )
}

function filterLocationsByDate(
  locations: PhotoLocation[],
  granularity: DateGranularity,
  from: string,
  to: string,
): PhotoLocation[] {
  if (!from && !to) return locations

  const lowerBound = from && to && from > to ? to : from
  const upperBound = from && to && from > to ? from : to

  return locations.flatMap((location) => {
    const photos = location.photos.filter((photo) => {
      if (!photo.takenAt) return false

      const dateValue = getDateValue(photo.takenAt, granularity)
      if (from && !to) return dateValue === from
      return (!lowerBound || dateValue >= lowerBound) &&
        (!upperBound || dateValue <= upperBound)
    })

    return photos.length > 0 ? [{ ...location, photos }] : []
  })
}

function getDateValue(date: Date, granularity: DateGranularity): string {
  const year = String(date.getFullYear()).padStart(4, '0')
  if (granularity === 'year') return year

  const month = String(date.getMonth() + 1).padStart(2, '0')
  if (granularity === 'month') return `${year}-${month}`

  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}