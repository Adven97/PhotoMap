# PRD: PhotoMap

## 1. Problem / Goal
Users come back from vacation with hundreds of photos scattered across their phone/drive, with no simple way to see **where** they were taken. PhotoMap lets users upload their photos and automatically see their travel route on a map, without manually tagging locations.

## 2. Target user
A private individual who wants to visualize their vacation photos on a map. Single-user accounts — each user only sees their own data.

## 3. Scope

### 3.1 In scope (MVP + already planned extensions)
- Photo upload (multiple files at once)
- EXIF metadata reading: geographic coordinates (lat/lng) and date taken
- Validation: a photo without geolocation data triggers an error/warning and is skipped
- Interactive map (Leaflet + OpenStreetMap) with pins at the locations where photos were taken
- Grouping photos from the same/nearby location under a single pin
- Clicking a pin opens a gallery/preview of photos from that location
- Filtering and sorting photos by place name and date
- Optional text caption under each photo
- Google account sign-in (Firebase Authentication)
- Persistent storage: photo metadata in Firestore, photo files in Cloudinary
- After logging back in, the user sees their previously uploaded photos and pins

## 4. Key user flows
1. User signs in with their Google account
2. User uploads vacation photos (multiple files)
3. The app reads EXIF data; photos without geolocation are flagged with an error and skipped
4. Photos with valid EXIF data appear on the map as pins (grouped by location)
5. The user can filter/sort photos by place or date
6. Clicking a pin opens a gallery of photos from that location, with optional captions
7. Data persists — after logging out and back in, everything is still there

## 5. Tech stack
- **Frontend:** React + TypeScript + Vite
- **Map:** Leaflet + OpenStreetMap (free, no credit card required)
- **Authentication:** Firebase Authentication (Google provider)
- **Database:** Firestore (photo metadata: URL, coordinates, date, caption, user ID)
- **File storage:** Cloudinary (instead of Firebase Storage — avoids the Blaze plan / credit card requirement)
- **AI coding tool:** GitHub Copilot (Agent mode) in VS Code

## 6. Data model (draft)
Photo document in Firestore:
```
{
  userId: string,
  photoUrl: string,       // URL from Cloudinary
  latitude: number,
  longitude: number,
  takenAt: timestamp,
  caption?: string,       // optional
  locationName?: string   // e.g. from reverse geocoding, TBD
}
```

## 7. Success criteria ("done" definition)
- A user can sign in, upload photos, see them on the map, and find them again after signing back in
- Photos without GPS data are correctly filtered out with a clear message
- No data loss between sessions
