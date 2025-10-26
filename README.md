# SkyTrack Backend

Link to frontend - https://github.com/Rileyj53/SkyTrack-Frontend

SkyTrack is a Node.js backend built with Next.js and MongoDB. It provides a set of API
endpoints for managing flight schools, aircraft tracking and user authentication.

This repository only contains the server code. See `API_ENDPOINTS.md` for a detailed
list of all available API routes and `SkyTrack.postman_collection.json` for a ready
made Postman collection.

## Requirements

- Node.js 18 or newer
- npm
- MongoDB instance

## Setup

1. Install dependencies:

   ```bash
   npm install
   ```

2. Create a `.env.local` file in the project root and provide the required
   environment variables (see [Configuration](#configuration)).

3. Run the development server:

   ```bash
   npm run dev
   ```

   The server will start using the port defined in your `.env.local` file
   and logs the base URL when ready.

## Building for Production

To build and run the optimized production build:

```bash
npm run build
npm start
```

## Configuration

The application relies on several secrets and environment variables. They
can be placed in the `.env.local` file. Below is the list of the important
variables used by the server:

- `MONGODB_URI` - connection string for MongoDB
- `JWT_SECRET` - secret used to sign JWT tokens
- `CSRF_SECRET` - secret for CSRF protection
- `ENCRYPTION_KEY` - 32 character key for AES encryption
- `SMTP_USER` - SMTP username for sending emails
- `SMTP_PASS` - SMTP password for sending emails
- `SMTP_HOST` - SMTP server host
- `SMTP_PORT` - SMTP server port
- `SMTP_SECURE` - set to `true` if the SMTP server requires SSL
- `SMTP_FROM` - email address used in the "from" field
- `AEROAPI_KEY` - API key for flight tracking data
- `NEXT_PUBLIC_APP_URL` - base URL of the application (e.g. `http://localhost:3000`)
- `PORT` - port number for the HTTP server

Make sure all of the above values are set before running the project.

## Testing the API

Import `SkyTrack.postman_collection.json` into Postman to try the various
endpoints. Refer to `API_ENDPOINTS.md` for detailed request and response
information.
