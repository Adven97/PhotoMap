import { getFirestore } from 'firebase/firestore'
import { getStorage } from 'firebase/storage'
import { firebaseApp } from './firebaseApp'

export const firestore = firebaseApp ? getFirestore(firebaseApp) : null
export const firebaseStorage = firebaseApp ? getStorage(firebaseApp) : null