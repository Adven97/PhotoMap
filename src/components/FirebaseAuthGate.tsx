import { lazy, Suspense, useEffect, useState } from 'react'
import {
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithPopup,
  signOut,
} from 'firebase/auth'
import type { User } from 'firebase/auth'
import { LogIn, LogOut, MapPinned } from 'lucide-react'
import { firebaseAuth, hasFirebaseConfig } from '../firebase/firebaseApp'

const App = lazy(() => import('../App'))
const isGuestModeOnly = import.meta.env.MODE === 'guest'

export function FirebaseAuthGate() {
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(hasFirebaseConfig && !isGuestModeOnly)
  const [isSigningIn, setIsSigningIn] = useState(false)
  const [isGuest, setIsGuest] = useState(false)
  const [authError, setAuthError] = useState<string | null>(null)

  useEffect(() => {
    if (isGuestModeOnly || !firebaseAuth) return

    return onAuthStateChanged(firebaseAuth, (nextUser) => {
      setUser(nextUser)
      setAuthError(null)
      setIsLoading(false)
    }, () => {
      setAuthError('Could not verify your sign-in. Check your connection and try again.')
      setIsLoading(false)
    })
  }, [])

  const handleSignIn = async () => {
    if (isGuestModeOnly || !firebaseAuth) return

    setIsSigningIn(true)
    setAuthError(null)
    try {
      await signInWithPopup(firebaseAuth, new GoogleAuthProvider())
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : 'Google sign-in failed.')
    } finally {
      setIsSigningIn(false)
    }
  }

  const handleSignOut = async () => {
    if (!firebaseAuth) return

    try {
      await signOut(firebaseAuth)
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : 'Sign-out failed.')
    }
  }

  if (!hasFirebaseConfig && !isGuestModeOnly) {
    return (
      <main className="auth-page">
        <section className="auth-panel" aria-labelledby="firebase-setup-title">
          <div className="auth-mark">
            <MapPinned aria-hidden="true" size={24} />
          </div>
          <p className="eyebrow">PhotoMap</p>
          <h1 id="firebase-setup-title">Firebase setup required</h1>
          <p>
            Add your Firebase web app values to <code>.env.local</code>, using
            <code> .env.example</code> as a template, then restart the dev server.
          </p>
        </section>
      </main>
    )
  }

  if (isLoading) {
    return (
      <main className="app-loading" role="status">
        <span className="auth-loader" aria-hidden="true" />
        <span>Checking your account...</span>
      </main>
    )
  }

  if (isGuest) {
    return (
      <Suspense fallback={<main className="app-loading" role="status">Loading PhotoMap...</main>}>
        <App key="guest" isGuest />
      </Suspense>
    )
  }

  if (!user) {
    return (
      <main className="auth-page">
        <section className="auth-panel" aria-labelledby="sign-in-title">
          <div className="auth-mark">
            <MapPinned aria-hidden="true" size={24} />
          </div>
          <p className="eyebrow">PhotoMap</p>
          <h1 id="sign-in-title">Your photos, mapped</h1>
          <p>Sign in to save your photo collection to your account.</p>
          <button
            type="button"
            className="google-sign-in"
            disabled={isSigningIn || isGuestModeOnly}
            onClick={() => void handleSignIn()}
          >
            <LogIn aria-hidden="true" size={18} />
            {isSigningIn
              ? 'Connecting...'
              : isGuestModeOnly
                ? 'Google sign-in unavailable'
                : 'Continue with Google'}
          </button>
          {isGuestModeOnly && (
            <p className="guest-mode-note">Guest mode only. Photos stay in this session and are not saved.</p>
          )}
          <button
            type="button"
            className="guest-sign-in"
            onClick={() => setIsGuest(true)}
          >
            Continue as a guest
          </button>
          {authError && <p className="auth-error" role="alert">{authError}</p>}
        </section>
      </main>
    )
  }

  return (
    <div className="authenticated-app">
      <div className="account-bar">
        <span title={user.email ?? undefined}>{user.displayName ?? user.email}</span>
        <button type="button" aria-label="Sign out" title="Sign out" onClick={() => void handleSignOut()}>
          <LogOut aria-hidden="true" size={16} />
        </button>
      </div>
      {authError && <p className="auth-error auth-toast" role="alert">{authError}</p>}
      <Suspense fallback={<main className="app-loading" role="status">Loading PhotoMap...</main>}>
        <App key={user.uid} userId={user.uid} />
      </Suspense>
    </div>
  )
}