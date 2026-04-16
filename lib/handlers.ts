import { NextRequest, NextResponse } from 'next/server'
import { validateApiKey, getApiKeyFromHeaders } from './auth'
import { checkRateLimit } from './rate-limit'
import { successResponse, errorResponse, generateRequestId, getErrorMessage } from './response'
import { ApiTier } from './config'

export interface AuthContext {
  apiKey: string
  tier: ApiTier
  requestId: string
}

export type PdfHandler = (
  request: NextRequest,
  context: AuthContext
) => Promise<NextResponse>

export function withAuth(handler: PdfHandler): (request: NextRequest) => Promise<NextResponse> {
  return async (request: NextRequest) => {
    const startTime = Date.now()
    const requestId = generateRequestId()

    try {
      // 1. API Key validation
      const apiKey = getApiKeyFromHeaders(request.headers)
      if (!apiKey) {
        return errorResponse('AUTH_REQUIRED', getErrorMessage('AUTH_REQUIRED'), 401, {
          request_id: requestId
        })
      }

      const keyInfo = validateApiKey(apiKey)
      if (!keyInfo) {
        return errorResponse('INVALID_API_KEY', getErrorMessage('INVALID_API_KEY'), 401, {
          request_id: requestId
        })
      }

      // 2. Rate limit check
      const rateLimitResult = await checkRateLimit(apiKey, keyInfo.tier)
      if (!rateLimitResult.allowed) {
        return errorResponse('RATE_LIMIT_EXCEEDED', getErrorMessage('RATE_LIMIT_EXCEEDED'), 429, {
          request_id: requestId,
          remaining_credits: rateLimitResult.remaining
        })
      }

      // 3. Call the actual handler
      const context: AuthContext = {
        apiKey,
        tier: keyInfo.tier,
        requestId
      }

      const response = await handler(request, context)

      // 4. Add timing metadata if response is successful
      if (response.status >= 200 && response.status < 300) {
        const processingTime = Date.now() - startTime

        // Parse the existing response to add timing
        const responseData = await response.json()
        if (responseData.meta) {
          responseData.meta.processing_ms = processingTime
          responseData.meta.remaining_credits = rateLimitResult.remaining
        }

        return NextResponse.json(responseData, {
          status: response.status,
          headers: response.headers
        })
      }

      return response

    } catch (error) {
      console.error('API error:', error)

      // Handle known error codes
      if (error instanceof Error) {
        const errorCode = error.message
        if (getErrorMessage(errorCode as any) !== errorCode) {
          return errorResponse(
            errorCode as any,
            getErrorMessage(errorCode as any),
            400,
            { request_id: requestId }
          )
        }
      }

      return errorResponse('INTERNAL_ERROR', getErrorMessage('INTERNAL_ERROR'), 500, {
        request_id: requestId
      })
    }
  }
}