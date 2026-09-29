import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import { FirebaseAuthGate } from './components/FirebaseAuthGate'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <FirebaseAuthGate />
  </StrictMode>,
)
