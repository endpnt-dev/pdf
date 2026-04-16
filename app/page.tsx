export default function HomePage() {
  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-16">
        <div className="text-center">
          <h1 className="text-4xl font-bold tracking-tight text-foreground sm:text-6xl">
            endpnt PDF API
          </h1>
          <p className="mt-6 text-lg leading-8 text-muted-foreground">
            The complete PDF API. Merge, split, extract, and secure PDFs with one API call.
          </p>
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
          <div className="mt-10">
            <div className="text-sm text-muted-foreground">
              Health Check: <a href="/api/v1/health" className="text-primary-600 hover:underline">/api/v1/health</a>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}