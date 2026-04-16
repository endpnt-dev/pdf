import { ApiTier } from './config'

export interface ApiKey {
  tier: ApiTier
  name: string
}

export interface ApiKeys {
  [key: string]: ApiKey
}

export function validateApiKey(key: string | null): ApiKey | null {
  if (!key) {
    return null
  }

  // Check if key has the correct prefix
  if (!key.startsWith('ek_')) {
    return null
  }

  try {
    const apiKeysJson = process.env.API_KEYS
    if (!apiKeysJson) {
      console.error('API_KEYS environment variable not set')
      return null
    }

    const apiKeys: ApiKeys = JSON.parse(apiKeysJson)
    const keyInfo = apiKeys[key]

    if (!keyInfo) {
      return null
    }

    return keyInfo
  } catch (error) {
    console.error('Failed to parse API_KEYS:', error)
    return null
  }
}

export function getApiKeyFromHeaders(headers: Headers): string | null {
  return headers.get('x-api-key')
}