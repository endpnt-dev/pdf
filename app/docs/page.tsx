'use client'

import { useState } from 'react'

type EndpointDoc = {
  id: string
  title: string
  method: string
  path: string
  description: string
  parameters: Array<{
    name: string
    type: string
    required: boolean
    description: string
    example?: string
  }>
  exampleRequest: string
  exampleResponse: string
  notes?: string[]
}

export default function DocsPage() {
  const [activeEndpoint, setActiveEndpoint] = useState('get-started')

  const sections = [
    {
      title: 'Getting Started',
      endpoints: [
        { id: 'get-started', title: 'Authentication' },
        { id: 'rate-limits', title: 'Rate Limits' }
      ]
    },
    {
      title: 'Manipulate',
      endpoints: [
        { id: 'merge', title: 'Merge PDFs' },
        { id: 'split', title: 'Split PDF' },
        { id: 'rotate', title: 'Rotate Pages' },
        { id: 'reorder', title: 'Reorder Pages' },
        { id: 'watermark', title: 'Add Watermark' },
        { id: 'compress', title: 'Compress PDF' }
      ]
    },
    {
      title: 'Secure',
      endpoints: [
        { id: 'encrypt', title: 'Encrypt PDF' },
        { id: 'decrypt', title: 'Decrypt PDF' }
      ]
    },
    {
      title: 'Extract',
      endpoints: [
        { id: 'extract-text', title: 'Extract Text' },
        { id: 'extract-metadata', title: 'Extract Metadata' },
        { id: 'extract-images', title: 'Extract Images' },
        { id: 'extract-forms', title: 'Extract Forms' },
        { id: 'extract-ocr', title: 'OCR (Coming Soon)' }
      ]
    },
    {
      title: 'Render',
      endpoints: [
        { id: 'render', title: 'Pages to Image' }
      ]
    }
  ]

  const endpointDocs: Record<string, EndpointDoc | any> = {
    'get-started': {
      title: 'Authentication',
      content: (
        <div className="space-y-6">
          <div>
            <h2 className="text-2xl font-bold mb-4">Getting Started</h2>
            <p className="text-muted-foreground mb-4">
              Welcome to the endpnt PDF API! All endpoints require authentication via API key.
            </p>
          </div>

          <div>
            <h3 className="text-lg font-semibold mb-2">API Key</h3>
            <p className="text-muted-foreground mb-4">
              Include your API key in the <code className="bg-muted px-2 py-1 rounded">x-api-key</code> header:
            </p>
            <pre className="bg-muted p-4 rounded text-sm overflow-x-auto">
{`curl -H "x-api-key: YOUR_API_KEY" \\
     https://pdf.endpnt.dev/api/v1/health`}
            </pre>
          </div>

          <div>
            <h3 className="text-lg font-semibold mb-2">Input Methods</h3>
            <p className="text-muted-foreground mb-4">
              All endpoints support two input methods:
            </p>
            <ul className="list-disc list-inside space-y-2 text-muted-foreground">
              <li><strong>File Upload:</strong> Use multipart/form-data with a <code>pdf</code> field</li>
              <li><strong>URL:</strong> Send JSON with a <code>pdf_url</code> parameter</li>
            </ul>
          </div>

          <div>
            <h3 className="text-lg font-semibold mb-2">Response Format</h3>
            <p className="text-muted-foreground mb-4">
              All responses follow this structure:
            </p>
            <pre className="bg-muted p-4 rounded text-sm overflow-x-auto">
{`{
  "success": true,
  "data": { ... },
  "meta": {
    "request_id": "req_a1b2c3",
    "processing_ms": 340,
    "remaining_credits": 4847
  }
}`}
            </pre>
          </div>
        </div>
      )
    },

    'rate-limits': {
      title: 'Rate Limits',
      content: (
        <div className="space-y-6">
          <div>
            <h2 className="text-2xl font-bold mb-4">Rate Limits</h2>
            <p className="text-muted-foreground mb-4">
              Rate limits are based on your plan tier and use sliding windows:
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full border border-border">
              <thead>
                <tr className="border-b border-border">
                  <th className="px-4 py-2 text-left">Tier</th>
                  <th className="px-4 py-2 text-left">Per Minute</th>
                  <th className="px-4 py-2 text-left">Per Month</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-border">
                  <td className="px-4 py-2">Free</td>
                  <td className="px-4 py-2">10 requests</td>
                  <td className="px-4 py-2">100 operations</td>
                </tr>
                <tr className="border-b border-border">
                  <td className="px-4 py-2">Starter</td>
                  <td className="px-4 py-2">60 requests</td>
                  <td className="px-4 py-2">5,000 operations</td>
                </tr>
                <tr className="border-b border-border">
                  <td className="px-4 py-2">Pro</td>
                  <td className="px-4 py-2">300 requests</td>
                  <td className="px-4 py-2">25,000 operations</td>
                </tr>
                <tr>
                  <td className="px-4 py-2">Enterprise</td>
                  <td className="px-4 py-2">1,000 requests</td>
                  <td className="px-4 py-2">100,000+ operations</td>
                </tr>
              </tbody>
            </table>
          </div>

          <div>
            <h3 className="text-lg font-semibold mb-2">Rate Limit Headers</h3>
            <p className="text-muted-foreground mb-4">
              Check your remaining credits in the response:
            </p>
            <pre className="bg-muted p-4 rounded text-sm overflow-x-auto">
{`{
  "meta": {
    "remaining_credits": 4847
  }
}`}
            </pre>
          </div>
        </div>
      )
    },

    'merge': {
      id: 'merge',
      title: 'Merge PDFs',
      method: 'POST',
      path: '/api/v1/merge',
      description: 'Merge multiple PDF files into a single document',
      parameters: [
        {
          name: 'pdfs',
          type: 'file[]',
          required: true,
          description: 'Multiple PDF files to merge (multipart upload)'
        },
        {
          name: 'pdf_urls',
          type: 'string[]',
          required: true,
          description: 'Array of PDF URLs to merge (JSON body alternative)'
        }
      ],
      exampleRequest: `curl -X POST https://pdf.endpnt.dev/api/v1/merge \\
  -H "x-api-key: YOUR_API_KEY" \\
  -F "pdfs=@file1.pdf" \\
  -F "pdfs=@file2.pdf"`,
      exampleResponse: `{
  "success": true,
  "data": {
    "pdf": "base64_encoded_merged_pdf...",
    "page_count": 24,
    "file_size_bytes": 845200,
    "pdfs_merged": 2
  }
}`,
      notes: ['Merges PDFs in the order provided', 'Preserves metadata from first PDF', 'Works with 1 PDF (returns unchanged)']
    },

    'extract-metadata': {
      id: 'extract-metadata',
      title: 'Extract Metadata',
      method: 'POST',
      path: '/api/v1/extract/metadata',
      description: 'Extract metadata and document information from a PDF',
      parameters: [
        {
          name: 'pdf',
          type: 'file',
          required: true,
          description: 'PDF file to analyze'
        }
      ],
      exampleRequest: `curl -X POST https://pdf.endpnt.dev/api/v1/extract/metadata \\
  -H "x-api-key: YOUR_API_KEY" \\
  -F "pdf=@document.pdf"`,
      exampleResponse: `{
  "success": true,
  "data": {
    "page_count": 15,
    "file_size_bytes": 2048576,
    "title": "Annual Report 2023",
    "author": "John Doe",
    "creation_date": "2023-12-01T10:30:00Z",
    "is_encrypted": false,
    "pdf_version": "1.4"
  }
}`
    }
  }

  const renderContent = () => {
    const doc = endpointDocs[activeEndpoint]

    if (!doc) return null

    if (doc.content) {
      return doc.content
    }

    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold mb-2">{doc.title}</h2>
          <div className="flex items-center gap-2 mb-4">
            <span className="bg-primary-600 text-white px-2 py-1 rounded text-sm font-mono">
              {doc.method}
            </span>
            <span className="font-mono text-sm">{doc.path}</span>
          </div>
          <p className="text-muted-foreground">{doc.description}</p>
        </div>

        {doc.parameters && (
          <div>
            <h3 className="text-lg font-semibold mb-4">Parameters</h3>
            <div className="overflow-x-auto">
              <table className="min-w-full border border-border">
                <thead>
                  <tr className="border-b border-border">
                    <th className="px-4 py-2 text-left">Name</th>
                    <th className="px-4 py-2 text-left">Type</th>
                    <th className="px-4 py-2 text-left">Required</th>
                    <th className="px-4 py-2 text-left">Description</th>
                  </tr>
                </thead>
                <tbody>
                  {doc.parameters.map((param: any, index: number) => (
                    <tr key={index} className="border-b border-border">
                      <td className="px-4 py-2 font-mono text-sm">{param.name}</td>
                      <td className="px-4 py-2 text-sm">{param.type}</td>
                      <td className="px-4 py-2 text-sm">
                        {param.required ? (
                          <span className="text-red-600">Yes</span>
                        ) : (
                          <span className="text-muted-foreground">No</span>
                        )}
                      </td>
                      <td className="px-4 py-2 text-sm">{param.description}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        <div>
          <h3 className="text-lg font-semibold mb-4">Example Request</h3>
          <pre className="bg-muted p-4 rounded text-sm overflow-x-auto">
            {doc.exampleRequest}
          </pre>
        </div>

        <div>
          <h3 className="text-lg font-semibold mb-4">Example Response</h3>
          <pre className="bg-muted p-4 rounded text-sm overflow-x-auto">
            {doc.exampleResponse}
          </pre>
        </div>

        {doc.notes && (
          <div>
            <h3 className="text-lg font-semibold mb-4">Notes</h3>
            <ul className="list-disc list-inside space-y-1">
              {doc.notes.map((note: string, index: number) => (
                <li key={index} className="text-muted-foreground">{note}</li>
              ))}
            </ul>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8">
        <div className="flex flex-col lg:flex-row gap-8">
          {/* Sidebar */}
          <div className="w-full lg:w-64 flex-shrink-0">
            <div className="sticky top-8">
              <h1 className="text-2xl font-bold mb-6">Documentation</h1>

              <nav className="space-y-6">
                {sections.map((section) => (
                  <div key={section.title}>
                    <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                      {section.title}
                    </h3>
                    <ul className="space-y-1">
                      {section.endpoints.map((endpoint) => (
                        <li key={endpoint.id}>
                          <button
                            onClick={() => setActiveEndpoint(endpoint.id)}
                            className={`block w-full text-left px-3 py-2 rounded text-sm ${
                              activeEndpoint === endpoint.id
                                ? 'bg-primary-600 text-white'
                                : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                            }`}
                          >
                            {endpoint.title}
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </nav>
            </div>
          </div>

          {/* Main Content */}
          <div className="flex-1 max-w-none">
            <div className="prose prose-slate dark:prose-invert max-w-none">
              {renderContent()}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}