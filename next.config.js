/** @type {import('next').NextConfig} */
const nextConfig = {
  // Static export to ensure no Server Components requests fail silently in Capacitor
  output: 'export',
  trailingSlash: true,
  images: {
    unoptimized: true,
  },
  typescript: {
    ignoreBuildErrors: false,
  },
};

module.exports = nextConfig;
