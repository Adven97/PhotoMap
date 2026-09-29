import assert from 'node:assert/strict'
import test from 'node:test'
import { parseCloudinaryResourceId } from './cloudinary.js'

test('parses Cloudinary public id from a secure URL', () => {
  const result = parseCloudinaryResourceId(
    'https://res.cloudinary.com/demo/image/upload/v1740000000/photomap/user-123/photo.jpg',
  )

  assert.equal(result, 'photomap/user-123/photo')
})

test('parses Cloudinary public id from a URL with a dot extension', () => {
  const result = parseCloudinaryResourceId(
    'https://res.cloudinary.com/demo/image/upload/v1740000000/folder/name.jpg',
  )

  assert.equal(result, 'folder/name')
})
