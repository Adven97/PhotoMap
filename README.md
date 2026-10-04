# React + TypeScript + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the ESLint configuration

If you are developing a production application, we recommend updating the configuration to enable type-aware lint rules:

```js
export default defineConfig([
  # PhotoMap

  PhotoMap reads photo coordinates and capture dates in the browser, removes embedded image metadata, and stores each photo in the signed-in user's Firebase collection.

  ## Firebase setup

  1. Create a Firebase project at [Firebase Console](https://console.firebase.google.com/) and register a Web app.
  2. In **Authentication → Sign-in method**, enable Google. Add `localhost` and your production hostname under authorized domains.
  3. Create a Cloud Firestore database. Select a region close to your users.
  4. Create the Firebase Storage bucket. The bucket requires a billing-enabled Firebase plan; check the current Firebase pricing and quotas before enabling uploads.
  5. Copy the Web app configuration into `.env.local`, using `.env.example` as the template. Set the Storage bucket value exactly as shown in Project settings. Restart Vite after changing environment variables.
  6. Deploy the included owner-only rules before uploading real photos:

  ```powershell
  npm install --global firebase-tools
  firebase login
  firebase use --add
  firebase deploy --only firestore:rules,storage
  ```

  7. Configure bucket CORS for authenticated browser image reads. Replace the origins in `storage.cors.json` with your actual development and production origins, then run:

  ```powershell
  gcloud storage buckets update gs://YOUR_STORAGE_BUCKET --cors-file=storage.cors.json
  ```

  Install and authenticate the Google Cloud CLI first if it is not already available. CORS is needed because PhotoMap loads private Storage files as blobs using the authenticated Firebase SDK.

  The Firebase Web API key is public client configuration, not a service-account credential. Never add a service-account JSON file or private key to this frontend project. Firestore and Storage rules enforce data ownership.

  ## Stored data

  Each photo is stored at `users/{uid}/photos/{photoId}` in Firestore. Metadata includes the original display filename, Storage path, MIME type, size, coordinates, capture time, description, and optional city/country. The sanitized image is stored at `users/{uid}/photos/{photoId}/original` in Storage. The app groups photo documents by rounded coordinates to create map locations and pins.

  New Firebase accounts start empty. Existing IndexedDB collections are not migrated. Photos are decoded locally to read EXIF, then re-encoded before upload to remove EXIF metadata. HEIC files are converted to JPEG for upload.

  Both rules files require the authenticated UID to match the `{uid}` path. They limit stored images to 25 MB and to JPEG, PNG, or WebP content. Update the limit in both rule files together if product requirements change.

  ## Run locally

  ```powershell
  npm install
  npm run dev
  ```

  To run the frontend without the Cloudinary server or Firebase configuration, start guest-only demo mode:

  ```powershell
  npm run dev:guest
  ```

  Guest mode disables Google sign-in and photo persistence. Photos and edits are kept only for the current browser session.

  Useful checks:

  ```powershell
  npm run lint
  npm run build
  ```
    },
