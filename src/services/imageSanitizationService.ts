const SUPPORTED_OUTPUT_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp'])

export async function stripImageMetadata(file: File): Promise<File> {
  const isHeic = /\.(heic|heif)$/i.test(file.name) || /image\/(heic|heif)/i.test(file.type)
  const sourceBlob = isHeic ? await convertHeic(file) : file
  const outputType = isHeic
    ? 'image/jpeg'
    : SUPPORTED_OUTPUT_TYPES.has(file.type)
      ? file.type
      : 'image/jpeg'
  const bitmap = await createImageBitmap(sourceBlob)
  const canvas = document.createElement('canvas')
  canvas.width = bitmap.width
  canvas.height = bitmap.height

  const context = canvas.getContext('2d')
  if (!context) {
    bitmap.close()
    throw new Error('This browser could not prepare the image for upload.')
  }

  context.drawImage(bitmap, 0, 0)
  bitmap.close()

  const sanitizedBlob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob)
      else reject(new Error('This image could not be sanitized.'))
    }, outputType, 0.92)
  })

  const extension = outputType === 'image/png' ? '.png' : outputType === 'image/webp' ? '.webp' : '.jpg'
  const baseName = file.name.replace(/\.[^.]+$/, '')

  return new File([sanitizedBlob], `${baseName}${extension}`, {
    type: sanitizedBlob.type,
    lastModified: file.lastModified,
  })
}

async function convertHeic(file: File): Promise<Blob> {
  const { default: heic2any } = await import('heic2any')
  const converted = await heic2any({ blob: file, toType: 'image/jpeg', quality: 0.92 })
  const blob = Array.isArray(converted) ? converted[0] : converted
  if (!blob) throw new Error('This HEIC image could not be converted.')
  return blob
}