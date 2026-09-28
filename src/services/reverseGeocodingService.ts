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

const lookupCache = new Map<string, Promise<string | null>>()
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
): Promise<string | null> {
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

    if (city && address?.country) return `${city}, ${address.country}`
    return city ?? address?.country ?? null
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
      const place = await reverseGeocode(location.latitude, location.longitude)
      if (place?.toLocaleLowerCase().includes(normalizedQuery)) {
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