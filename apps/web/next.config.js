/** @type {import('next').NextConfig} */
const nextConfig = {
    output: 'standalone',
    async rewrites() {
        console.log('API_INTERNAL_BASE_URL:', process.env.API_INTERNAL_BASE_URL);
        const isProd = process.env.NODE_ENV === 'production';
        const defaultUrl = isProd ? 'http://api:4000' : 'http://localhost:4000';
        const apiBase = process.env.API_INTERNAL_BASE_URL || defaultUrl;
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
