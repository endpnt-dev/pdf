import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'endpnt PDF API - Complete PDF Processing API',
  description: 'Merge, split, extract, and secure PDFs with one API call. 13 endpoints, generous free tier.',
  keywords: ['pdf api', 'pdf processing', 'pdf merge', 'pdf split', 'pdf extraction', 'api'],
  authors: [{ name: 'endpnt' }],
  creator: 'endpnt',
  publisher: 'endpnt',
  robots: 'index, follow',
  openGraph: {
    title: 'endpnt PDF API - Complete PDF Processing API',
    description: 'Merge, split, extract, and secure PDFs with one API call. 13 endpoints, generous free tier.',
    url: 'https://pdf.endpnt.dev',
    siteName: 'endpnt PDF API',
    locale: 'en_US',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'endpnt PDF API - Complete PDF Processing API',
    description: 'Merge, split, extract, and secure PDFs with one API call. 13 endpoints, generous free tier.',
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className="dark">
      <body className="font-sans antialiased min-h-screen">
        {children}
      </body>
    </html>
  )
}