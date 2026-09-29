import type { PhotoLocation } from '../types/photo'

type NominatimResponse = {
  address?: {
    city?: string
    town?: string
    village?: string
    municipality?: string
    hamlet?: string
    county?: string
    country?: string
  }
}

export type PlaceDetails = {
  city: string | null
  country: string | null
}

const lookupCache = new Map<string, Promise<PlaceDetails | null>>()
let requestQueue = Promise.resolve()
let lastRequestAt = 0

export type PlaceFilterResult = {
  locations: PhotoLocation[]
  checked: number
  lookupFailures: number
}

export function reverseGeocode(
  latitude: number,
  longitude: number,
): Promise<PlaceDetails | null> {
  const cacheKey = `${latitude.toFixed(4)},${longitude.toFixed(4)}`
  const cachedLookup = lookupCache.get(cacheKey)
  if (cachedLookup) return cachedLookup

  const lookup = requestQueue.then(async () => {
    const delay = Math.max(0, 1100 - (Date.now() - lastRequestAt))
    if (delay > 0) await new Promise((resolve) => setTimeout(resolve, delay))

    lastRequestAt = Date.now()
    const url = new URL('https://nominatim.openstreetmap.org/reverse')
    url.searchParams.set('format', 'jsonv2')
    url.searchParams.set('lat', latitude.toString())
    url.searchParams.set('lon', longitude.toString())
    url.searchParams.set('zoom', '10')
    url.searchParams.set('addressdetails', '1')
    url.searchParams.set('accept-language', 'en')

    const response = await fetch(url)
    if (!response.ok) throw new Error('Reverse geocoding request failed')

    const result = (await response.json()) as NominatimResponse
    const address = result.address
    const city =
      address?.city ??
      address?.town ??
      address?.village ??
      address?.municipality ??
      address?.hamlet ??
      address?.county

    const country = address?.country ?? null
    if (!city && !country) return null

    return { city: city ?? null, country }
  })

  requestQueue = lookup.then(
    () => undefined,
    () => undefined,
  )
  lookupCache.set(cacheKey, lookup)

  return lookup.catch((error: unknown) => {
    lookupCache.delete(cacheKey)
    throw error
  })
}

export function formatPlaceName(place: PlaceDetails | null): string | null {
  if (!place) return null
  if (place.city && place.country) return `${place.city}, ${place.country}`
  return place.city ?? place.country
}

export async function filterLocationsByPlace(
  locations: PhotoLocation[],
  query: string,
  onProgress: (checked: number) => void,
): Promise<PlaceFilterResult> {
  const normalizedQuery = query.trim().toLocaleLowerCase()
  const matches: PhotoLocation[] = []
  let lookupFailures = 0

  for (const [index, location] of locations.entries()) {
    try {
      const place = location.city || location.country
        ? { city: location.city ?? null, country: location.country ?? null }
        : await reverseGeocode(location.latitude, location.longitude)
      const placeName = formatPlaceName(place)

      if (placeName?.toLocaleLowerCase().includes(normalizedQuery)) {
        matches.push(location)
      }
    } catch {
      lookupFailures += 1
    }

    onProgress(index + 1)
  }

  return {
    locations: matches,
    checked: locations.length,
    lookupFailures,
  }
}