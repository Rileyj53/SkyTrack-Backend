const { createServer } = require('http');
const { parse } = require('url');
const next = require('next');
require('dotenv').config({ path: '.env.local' });

// Set NODE_ENV if not already set
if (!process.env.NODE_ENV) {
    process.env.NODE_ENV = 'development';
}

const dev = process.env.NODE_ENV !== 'production';
const app = next({ dev });
const handle = app.getRequestHandler();

// Disable Next.js compilation logs
process.env.NEXT_TELEMETRY_DISABLED = '1';
process.env.NEXT_SHARP_PATH = './node_modules/sharp';

// Debug environment variables
console.log('Environment variables:');
console.log('PORT:', process.env.PORT);
console.log('NODE_ENV:', process.env.NODE_ENV);

const port = process.env.PORT;
if (!port) {
    console.error('PORT environment variable is not set!');
    process.exit(1);
}

// Set NEXT_PUBLIC_APP_URL based on PORT
process.env.NEXT_PUBLIC_APP_URL = `http://localhost:${port}`;
console.log('NEXT_PUBLIC_APP_URL:', process.env.NEXT_PUBLIC_APP_URL);

app.prepare().then(() => {
    createServer((req, res) => {
        const parsedUrl = parse(req.url, true);
        handle(req, res, parsedUrl);
    }).listen(port, (err) => {
        if (err) throw err;
        console.log(`> Ready on ${process.env.NEXT_PUBLIC_APP_URL}`);
    });
});