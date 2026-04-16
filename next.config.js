/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    serverComponentsExternalPackages: [
      '@napi-rs/canvas',
      'pdf-lib',
      'pdf-parse',
      'pdfjs-dist',
      'sharp',
      'node-qpdf2',
      'scribe.js-ocr',
    ],
    outputFileTracingIncludes: {
      '/api/v1/encrypt': ['./bin/qpdf/**/*'],
      '/api/v1/decrypt': ['./bin/qpdf/**/*'],
    },
  },
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '**' },
      { protocol: 'http', hostname: '**' },
    ],
  },
  webpack: (config, { isServer }) => {
    if (isServer) {
      config.externals = [
        ...(config.externals || []),
        { '@napi-rs/canvas': 'commonjs @napi-rs/canvas' },
        { 'node-qpdf2': 'commonjs node-qpdf2' },
        { 'scribe.js-ocr': 'commonjs scribe.js-ocr' },
      ];
    }
    return config;
  },
};

module.exports = nextConfig;