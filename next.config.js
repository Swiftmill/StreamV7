/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    appDir: true
  },
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'image.tmdb.org' },
      { protocol: 'https', hostname: 'assets.static-streamv7.local' },
      { protocol: 'https', hostname: 'test-streams.mux.dev' }
    ]
  }
};

module.exports = nextConfig;
