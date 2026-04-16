import { NextRequest, NextResponse } from 'next/server'
import { API_VERSION } from '@/lib/config'

export async function GET(request: NextRequest) {
  return NextResponse.json({
    status: 'ok',
    version: API_VERSION,
    timestamp: new Date().toISOString(),
    service: 'endpnt-pdf'
  }, { status: 200 })
}