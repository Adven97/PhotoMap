import cors from 'cors'
import dotenv from 'dotenv'
import express from 'express'
import { v2 as cloudinary } from 'cloudinary'
import { parseCloudinaryResourceId } from './cloudinary.js'

dotenv.config({ path: '.env.local' })

dotenv.config()

const app = express()
const port = Number(process.env.PORT || 3001)

function requireCloudinaryConfig() {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME
  const apiKey = process.env.CLOUDINARY_API_KEY
  const apiSecret = process.env.CLOUDINARY_API_SECRET

  if (!cloudName || !apiKey || !apiSecret) {
    throw new Error('Cloudinary environment variables are missing. Add CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET to .env.local.')
  }

  cloudinary.config({
    cloud_name: cloudName,
    api_key: apiKey,
    api_secret: apiSecret,
    secure: true,
  })

  return { cloudName, apiKey }
}

app.use(cors({ origin: true }))
app.use(express.json({ limit: '25mb' }))

app.get('/health', (_request, response) => {
  response.json({ ok: true })
})

app.post('/api/cloudinary/sign-upload', (request, response) => {
  try {
    const { cloudName, apiKey } = requireCloudinaryConfig()
    const folder = request.body?.folder || 'photomap'
    const timestamp = Math.round(Date.now() / 1000)
    const params = { folder, timestamp }
    const signature = cloudinary.utils.api_sign_request(params, process.env.CLOUDINARY_API_SECRET)

    response.json({
      uploadUrl: `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`,
      cloudName,
      apiKey,
      timestamp,
      signature,
      folder,
    })
  } catch (error) {
    response.status(500).json({
      message: error instanceof Error ? error.message : 'Cloudinary signing failed.',
    })
  }
})

app.post('/api/cloudinary/delete', async (request, response) => {
  try {
    requireCloudinaryConfig()
    const resourceId = parseCloudinaryResourceId(request.body?.url)

    if (!resourceId) {
      response.status(400).json({ message: 'Cloudinary photo URL is missing.' })
      return
    }

    const result = await cloudinary.uploader.destroy(resourceId, {
      resource_type: 'image',
      invalidate: true,
    })

    response.json({ ok: true, result })
  } catch (error) {
    response.status(500).json({
      message: error instanceof Error ? error.message : 'Cloudinary delete failed.',
    })
  }
})

app.listen(port, () => {
  console.log(`Cloudinary upload server running on http://localhost:${port}`)
})
