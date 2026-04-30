/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  allowedDevOrigins: [
    'noncomprehendible-stickiest-coral.ngrok-free.dev',
    '*.ngrok-free.dev',
    '*.ngrok.io',
    // Rangos LAN privados (RFC1918) para acceso desde la misma WiFi.
    // Incluye 172.* para cubrir la IP interna de WSL2 (netsh portproxy reescribe el Host).
    '192.168.*.*',
    '10.*.*.*',
    '172.*.*.*',
    'localhost',
    '192.168.0.102',
    '192.168.3.214'
  ],
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: 'http://localhost:8000/api/:path*',
      },
    ]
  },
}

module.exports = nextConfig
