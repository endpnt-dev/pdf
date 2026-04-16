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
    ],
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**',
      },
      {
        protocol: 'http',
        hostname: '**',
      },
    ],
  },
  webpack: (config, { isServer }) => {
    if (isServer) {
      config.externals = [
        ...(config.externals || []),
        { '@napi-rs/canvas': 'commonjs @napi-rs/canvas' },
      ];
    }
    return config;
  },
};

module.exports = nextConfig;