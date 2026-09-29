export function parseCloudinaryResourceId(url) {
  if (!url || typeof url !== 'string') {
    return null
  }

  try {
    const parsed = new URL(url)
    const pathSegments = parsed.pathname.split('/').filter(Boolean)
    const uploadIndex = pathSegments.findIndex((segment) => segment === 'upload')

    if (uploadIndex === -1) {
      return null
    }

    const resourceSegments = [...pathSegments.slice(uploadIndex + 1)]
    const versionPrefix = resourceSegments[0]
    if (versionPrefix && /^v\d+$/.test(versionPrefix)) {
      resourceSegments.shift()
    }

    if (resourceSegments.length === 0) {
      return null
    }

    const lastSegment = resourceSegments[resourceSegments.length - 1]
    if (lastSegment && /\.[A-Za-z0-9]+$/.test(lastSegment)) {
      resourceSegments[resourceSegments.length - 1] = lastSegment.replace(/\.[A-Za-z0-9]+$/, '')
    }

    return resourceSegments.join('/')
  } catch {
    return null
  }
}
