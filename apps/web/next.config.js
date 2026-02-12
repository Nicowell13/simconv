/** @type {import('next').NextConfig} */
const nextConfig = {
    output: 'standalone',
    async rewrites() {
        console.log('API_INTERNAL_BASE_URL:', process.env.API_INTERNAL_BASE_URL);
        const apiBase = process.env.API_INTERNAL_BASE_URL || 'http://localhost:4000';
        console.log('Using API Base:', apiBase);
        return [
            {
                source: '/api/:path*',
                destination: `${apiBase}/:path*`,
            },
        ];
    },
};

module.exports = nextConfig;
