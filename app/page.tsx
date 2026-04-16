'use client'

import { useState } from 'react'
import Link from 'next/link'

export default function HomePage() {
  const [isDemoActive, setIsDemoActive] = useState(false)
  const [demoResult, setDemoResult] = useState<any>(null)

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    setIsDemoActive(true)
    setDemoResult(null)

    try {
      const formData = new FormData()
      formData.append('pdf', file)

      const response = await fetch('/api/v1/extract/metadata', {
        method: 'POST',
        headers: {
          'x-api-key': 'demo_key_placeholder'
        },
        body: formData
      })

      const result = await response.json()
      setDemoResult(result)
    } catch (error) {
      setDemoResult({ error: 'Demo failed. Full API requires authentication.' })
    } finally {
      setIsDemoActive(false)
    }
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Hero Section */}
      <div className="container mx-auto px-4 py-16">
        <div className="text-center max-w-4xl mx-auto">
          <h1 className="text-4xl font-bold tracking-tight text-foreground sm:text-6xl">
            The Complete PDF API
          </h1>
          <p className="mt-6 text-lg leading-8 text-muted-foreground max-w-2xl mx-auto">
            Merge, split, extract, and secure PDFs with one API call.
            13 endpoints, generous free tier, sub-second response times.
          </p>

          {/* Stats Grid */}
          <div className="mt-10 grid grid-cols-2 gap-4 sm:grid-cols-4">
            <div className="text-center">
              <div className="text-3xl font-bold text-primary-600">13</div>
              <div className="text-sm text-muted-foreground">Endpoints</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-primary-600">25MB</div>
              <div className="text-sm text-muted-foreground">Max File Size</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-primary-600">&lt;1s</div>
              <div className="text-sm text-muted-foreground">Response Time</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-primary-600">100</div>
              <div className="text-sm text-muted-foreground">Free Operations</div>
            </div>
          </div>

          {/* CTA Buttons */}
          <div className="mt-10 flex items-center justify-center gap-x-6">
            <Link
              href="/docs"
              className="rounded-md bg-primary-600 px-3.5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-primary-700"
            >
              View Documentation
            </Link>
            <Link
              href="/pricing"
              className="text-sm font-semibold leading-6 text-foreground hover:text-primary-600"
            >
              View Pricing <span aria-hidden="true">→</span>
            </Link>
          </div>
        </div>
      </div>

      {/* Features Grid */}
      <div className="container mx-auto px-4 py-16 border-t border-border">
        <h2 className="text-3xl font-bold text-center text-foreground mb-12">
          Everything you need for PDF processing
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {/* Manipulation */}
          <div className="text-center">
            <div className="text-2xl mb-4">🔧</div>
            <h3 className="text-lg font-semibold mb-2">Manipulation</h3>
            <p className="text-muted-foreground text-sm">
              Merge, split, rotate, reorder, watermark, and compress PDFs
            </p>
          </div>

          {/* Security */}
          <div className="text-center">
            <div className="text-2xl mb-4">🔒</div>
            <h3 className="text-lg font-semibold mb-2">Security</h3>
            <p className="text-muted-foreground text-sm">
              Encrypt and decrypt PDFs with password protection
            </p>
          </div>

          {/* Extraction */}
          <div className="text-center">
            <div className="text-2xl mb-4">📄</div>
            <h3 className="text-lg font-semibold mb-2">Extraction</h3>
            <p className="text-muted-foreground text-sm">
              Extract text, metadata, images, and form fields
            </p>
          </div>

          {/* Rendering */}
          <div className="text-center">
            <div className="text-2xl mb-4">🖼️</div>
            <h3 className="text-lg font-semibold mb-2">Rendering</h3>
            <p className="text-muted-foreground text-sm">
              Convert PDF pages to PNG/JPEG images at any DPI
            </p>
          </div>

          {/* File Input */}
          <div className="text-center">
            <div className="text-2xl mb-4">📤</div>
            <h3 className="text-lg font-semibold mb-2">Flexible Input</h3>
            <p className="text-muted-foreground text-sm">
              Upload files or provide URLs - works both ways
            </p>
          </div>

          {/* Speed */}
          <div className="text-center">
            <div className="text-2xl mb-4">⚡</div>
            <h3 className="text-lg font-semibold mb-2">Lightning Fast</h3>
            <p className="text-muted-foreground text-sm">
              Optimized for speed with sub-second processing
            </p>
          </div>
        </div>
      </div>

      {/* Interactive Demo */}
      <div className="container mx-auto px-4 py-16 border-t border-border">
        <h2 className="text-3xl font-bold text-center text-foreground mb-8">
          Try it now
        </h2>

        <div className="max-w-2xl mx-auto">
          <div className="border border-border rounded-lg p-6">
            <h3 className="text-lg font-semibold mb-4">PDF Metadata Extraction</h3>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Upload a PDF file
                </label>
                <input
                  type="file"
                  accept=".pdf"
                  onChange={handleFileUpload}
                  disabled={isDemoActive}
                  className="block w-full text-sm text-foreground file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-primary-600 file:text-white hover:file:bg-primary-700 disabled:opacity-50"
                />
              </div>

              {isDemoActive && (
                <div className="text-center py-4">
                  <div className="inline-block animate-spin rounded-full h-6 w-6 border-b-2 border-primary-600"></div>
                  <p className="text-sm text-muted-foreground mt-2">Extracting metadata...</p>
                </div>
              )}

              {demoResult && (
                <div className="mt-4">
                  <h4 className="text-sm font-medium text-foreground mb-2">Result:</h4>
                  <pre className="text-xs bg-muted p-4 rounded overflow-x-auto">
                    {JSON.stringify(demoResult, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Code Examples */}
      <div className="container mx-auto px-4 py-16 border-t border-border">
        <h2 className="text-3xl font-bold text-center text-foreground mb-12">
          Start building in minutes
        </h2>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* cURL */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">cURL</h3>
            <pre className="text-xs bg-muted p-4 rounded overflow-x-auto">
{`curl -X POST https://pdf.endpnt.dev/api/v1/merge \\
  -H "x-api-key: YOUR_API_KEY" \\
  -F "pdfs=@file1.pdf" \\
  -F "pdfs=@file2.pdf"`}
            </pre>
          </div>

          {/* Node.js */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Node.js</h3>
            <pre className="text-xs bg-muted p-4 rounded overflow-x-auto">
{`const formData = new FormData()
formData.append('pdf', file)
formData.append('text', 'CONFIDENTIAL')
formData.append('position', 'diagonal')

fetch('https://pdf.endpnt.dev/api/v1/watermark', {
  method: 'POST',
  headers: { 'x-api-key': 'YOUR_API_KEY' },
  body: formData
})`}
            </pre>
          </div>

          {/* Python */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Python</h3>
            <pre className="text-xs bg-muted p-4 rounded overflow-x-auto">
{`import requests

files = {'pdf': open('document.pdf', 'rb')}
data = {'ranges': '1-3,7,10-12', 'output_format': 'zip'}

response = requests.post(
  'https://pdf.endpnt.dev/api/v1/split',
  headers={'x-api-key': 'YOUR_API_KEY'},
  files=files,
  data=data
)`}
            </pre>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="border-t border-border">
        <div className="container mx-auto px-4 py-8">
          <div className="flex justify-between items-center text-sm text-muted-foreground">
            <div>
              Health Check: <a href="/api/v1/health" className="text-primary-600 hover:underline">/api/v1/health</a>
            </div>
            <div>
              Part of the <span className="font-semibold">endpnt.dev</span> API platform
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}