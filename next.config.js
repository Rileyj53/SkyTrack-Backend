/** @type {import('next').NextConfig} */
const nextConfig = {
    reactStrictMode: true,
    swcMinify: true,
    env: {
        MONGODB_URI: process.env.MONGODB_URI,
        JWT_SECRET: process.env.JWT_SECRET,
        CSRF_SECRET: process.env.CSRF_SECRET,
        ENCRYPTION_KEY: process.env.ENCRYPTION_KEY,
        SMTP_USER: process.env.SMTP_USER,
        SMTP_PASS: process.env.SMTP_PASS,
        SMTP_HOST: process.env.SMTP_HOST,
        SMTP_PORT: process.env.SMTP_PORT,
        SMTP_SECURE: process.env.SMTP_SECURE,
        SMTP_FROM: process.env.SMTP_FROM,
        NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
        PORT: process.env.PORT,
    },
    // Disable compilation logs
    onDemandEntries: {
        // period (in ms) where the server will keep pages in the buffer
        maxInactiveAge: 25 * 1000,
        // number of pages that should be kept simultaneously without being disposed
        pagesBufferLength: 2,
    },
    // Handle Node.js built-in modules
    webpack: (config, { isServer }) => {
        if (!isServer) {
            config.resolve.fallback = {
                ...config.resolve.fallback,
                crypto: require.resolve('crypto-browserify'),
                stream: require.resolve('stream-browserify'),
                net: false,
                tls: false,
                child_process: false,
                fs: false,
                path: false,
                os: false,
            };
        }
        return config;
    },
    // Configure runtime for API routes
    experimental: {
        serverActions: true,
    },
}

module.exports = nextConfig