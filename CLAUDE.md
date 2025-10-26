# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

- `npm run dev` - Start development server (uses custom server.js with Next.js)
- `npm run build` - Build for production
- `npm start` - Start production server
- `npm run lint` - Run ESLint

## Architecture Overview

SkyTrack is a Next.js backend API for flight school management with MongoDB persistence. The application uses a custom Express-like server (server.js) rather than the default Next.js server.

### Core Structure

- **API Routes**: Located in `src/app/api/` using Next.js App Router pattern
- **Models**: Mongoose schemas in `src/models/` with centralized exports via index.ts
- **Database**: MongoDB connection with retry logic and health checks in `src/lib/db.ts`
- **Middleware**: Layered security middleware in `src/middleware/` (CORS, rate limiting, security headers, request logging)
- **Authentication**: JWT-based auth with CSRF protection, MFA support, and API key authentication

### Key Components

**Organizations**: Schools and flight clubs with hierarchical data management
- Schools have students, instructors, planes, programs, flight schedules
- Flight clubs have members and aircraft tracking capabilities

**Security Architecture**:
- Multi-layered middleware in `src/middleware.ts` applies CORS, rate limiting, security headers
- CSRF protection integrated into secure API routes
- API key authentication for external integrations
- JWT tokens with blacklist support for session management

**Database Models** (via `src/models/index.ts`):
- Core entities: User, School, Student, Instructor, Plane, Program
- Operational: FlightSchedule, FlightScheduleRequest, FlightInvoice, StudentLedger
- System: ApiKey, BlacklistedToken, WaitlistEntry, SchoolBillingUsage

### Environment Configuration

Required environment variables in `.env.local`:
- `MONGODB_URI` - MongoDB connection string
- `JWT_SECRET` - JWT signing secret
- `CSRF_SECRET` - CSRF protection secret
- `ENCRYPTION_KEY` - 32-character AES encryption key
- `SMTP_*` - Email configuration (USER, PASS, HOST, PORT, SECURE, FROM)
- `AEROAPI_KEY` - Flight tracking API integration
- `NEXT_PUBLIC_APP_URL` - Application base URL
- `PORT` - Server port

### Development Notes

- Database connection uses robust retry logic with exponential backoff
- Models are initialized after successful database connection
- Middleware chain processes security, CORS, rate limiting, and logging
- API routes follow RESTful patterns with proper error handling
- Flight scheduling and billing systems support complex operational workflows