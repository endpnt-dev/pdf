export default function PricingPage() {
  const tiers = [
    {
      name: 'Free',
      price: '$0',
      period: 'forever',
      description: 'Perfect for testing and small projects',
      features: [
        '100 operations per month',
        '10 requests per minute',
        'All 13 endpoints',
        '25MB file size limit',
        'Community support'
      ],
      cta: 'Get Started',
      ctaStyle: 'border border-border bg-background text-foreground hover:bg-muted'
    },
    {
      name: 'Starter',
      price: '$19',
      period: 'month',
      description: 'Great for growing applications',
      features: [
        '5,000 operations per month',
        '60 requests per minute',
        'All 13 endpoints',
        '25MB file size limit',
        'Email support',
        'Usage analytics'
      ],
      cta: 'Start Free Trial',
      ctaStyle: 'bg-primary-600 text-white hover:bg-primary-700',
      popular: true
    },
    {
      name: 'Pro',
      price: '$79',
      period: 'month',
      description: 'For high-volume production use',
      features: [
        '25,000 operations per month',
        '300 requests per minute',
        'All 13 endpoints',
        '50MB file size limit (v1.1)',
        'Priority support',
        'Advanced analytics',
        'Custom integrations'
      ],
      cta: 'Start Free Trial',
      ctaStyle: 'border border-border bg-background text-foreground hover:bg-muted'
    },
    {
      name: 'Enterprise',
      price: 'Custom',
      period: '',
      description: 'For large-scale deployments',
      features: [
        '100,000+ operations per month',
        '1,000 requests per minute',
        'All endpoints + early access',
        'Custom file size limits',
        'Dedicated support',
        'SLA guarantees',
        'Custom deployment options',
        'Volume discounts'
      ],
      cta: 'Contact Sales',
      ctaStyle: 'border border-border bg-background text-foreground hover:bg-muted'
    }
  ]

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="container mx-auto px-4 py-16">
        <div className="text-center max-w-3xl mx-auto">
          <h1 className="text-4xl font-bold tracking-tight text-foreground sm:text-5xl">
            Simple, transparent pricing
          </h1>
          <p className="mt-6 text-lg leading-8 text-muted-foreground">
            Choose the plan that fits your needs. All plans include access to all 13 PDF endpoints.
            Start free, scale as you grow.
          </p>
        </div>
      </div>

      {/* Pricing Grid */}
      <div className="container mx-auto px-4 pb-16">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 max-w-7xl mx-auto">
          {tiers.map((tier) => (
            <div
              key={tier.name}
              className={`relative rounded-2xl border ${
                tier.popular
                  ? 'border-primary-600 ring-1 ring-primary-600'
                  : 'border-border'
              } p-8 shadow-sm`}
            >
              {tier.popular && (
                <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                  <span className="bg-primary-600 text-white text-sm font-medium px-3 py-1 rounded-full">
                    Most Popular
                  </span>
                </div>
              )}

              <div className="text-center">
                <h3 className="text-xl font-semibold text-foreground">{tier.name}</h3>
                <div className="mt-4 flex items-baseline justify-center gap-x-2">
                  <span className="text-4xl font-bold tracking-tight text-foreground">
                    {tier.price}
                  </span>
                  {tier.period && (
                    <span className="text-sm font-semibold leading-6 tracking-wide text-muted-foreground">
                      /{tier.period}
                    </span>
                  )}
                </div>
                <p className="mt-6 text-sm leading-6 text-muted-foreground">
                  {tier.description}
                </p>
              </div>

              <ul className="mt-8 space-y-3 text-sm leading-6">
                {tier.features.map((feature) => (
                  <li key={feature} className="flex gap-x-3">
                    <svg
                      className="h-6 w-5 flex-none text-primary-600"
                      viewBox="0 0 20 20"
                      fill="currentColor"
                    >
                      <path
                        fillRule="evenodd"
                        d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z"
                        clipRule="evenodd"
                      />
                    </svg>
                    <span className="text-foreground">{feature}</span>
                  </li>
                ))}
              </ul>

              <button
                className={`mt-8 block w-full rounded-md px-3 py-2 text-center text-sm font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 ${tier.ctaStyle}`}
              >
                {tier.cta}
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* FAQ Section */}
      <div className="border-t border-border">
        <div className="container mx-auto px-4 py-16">
          <h2 className="text-2xl font-bold text-center text-foreground mb-12">
            Frequently asked questions
          </h2>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 max-w-4xl mx-auto">
            <div>
              <h3 className="text-lg font-semibold mb-2">What counts as an operation?</h3>
              <p className="text-muted-foreground">
                Each API call to any endpoint counts as one operation. For example, merging 3 PDFs = 1 operation,
                extracting text from a 50-page PDF = 1 operation.
              </p>
            </div>

            <div>
              <h3 className="text-lg font-semibold mb-2">What about file size limits?</h3>
              <p className="text-muted-foreground">
                Currently 25MB per file on all tiers. Pro tier will increase to 50MB in v1.1
                after our Vercel Pro upgrade.
              </p>
            </div>

            <div>
              <h3 className="text-lg font-semibold mb-2">Can I use both upload and URL methods?</h3>
              <p className="text-muted-foreground">
                Yes! All endpoints support both multipart file uploads and fetching PDFs from URLs.
                Use whatever works best for your workflow.
              </p>
            </div>

            <div>
              <h3 className="text-lg font-semibold mb-2">What about OCR for scanned PDFs?</h3>
              <p className="text-muted-foreground">
                OCR is now available via the /api/v1/extract/ocr endpoint for scanned documents.
                Regular text extraction works great for text-based PDFs.
              </p>
            </div>

            <div>
              <h3 className="text-lg font-semibold mb-2">How does rate limiting work?</h3>
              <p className="text-muted-foreground">
                Rate limits are per-minute sliding windows. If you hit the limit,
                wait a minute and you&apos;ll have your full quota available again.
              </p>
            </div>

            <div>
              <h3 className="text-lg font-semibold mb-2">Can I cancel anytime?</h3>
              <p className="text-muted-foreground">
                Yes, no long-term commitments. Cancel anytime and you&apos;ll still have access
                until the end of your billing period.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="border-t border-border">
        <div className="container mx-auto px-4 py-8">
          <div className="text-center">
            <p className="text-sm text-muted-foreground">
              Questions? <span className="text-primary-600">Contact our team</span> or check out the{' '}
              <a href="/docs" className="text-primary-600 hover:underline">documentation</a>.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}