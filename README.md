# Travel Planner Chrome Extension

A Chrome extension that extracts and organizes travel recommendations from any webpage. Automatically identifies places (hotels, restaurants, activities, transportation) from travel content and lets you save them to a personal list with booking links and Google Maps integration.

## Features

- **Smart Place Extraction**: Automatically scans webpages for travel-related places
- **Categorization**: Organizes places into Accommodation, Activities, Food & Dining, and Transportation
- **Google Maps Integration**: One-click access to maps for any saved place
- **Booking Links**: Preserves booking URLs from original content
- **Location Filtering**: Filter saved places by location
- **User Authentication**: Secure Google Sign-In to sync across devices
- **Trip Organization**: Group places into trips for better organization

## Project Structure

```
travel-planner/
├── extension/              # Chrome Extension (Manifest V3)
│   ├── manifest.json       # Extension configuration
│   ├── popup/              # Extension popup UI
│   │   ├── popup.html
│   │   ├── popup.css
│   │   └── popup.js
│   ├── content/            # Content script for page scanning
│   │   └── content.js
│   ├── background/         # Service worker
│   │   └── background.js
│   ├── styles/             # Content script styles
│   │   └── content.css
│   └── icons/              # Extension icons
│
├── backend/                # Node.js API Server
│   ├── src/
│   │   ├── index.ts        # Server entry point
│   │   ├── config/         # Configuration
│   │   ├── routes/         # API routes
│   │   ├── middleware/     # Express middleware
│   │   └── services/       # Business logic
│   └── prisma/
│       └── schema.prisma   # Database schema
│
└── package.json            # Monorepo configuration
```

## Prerequisites

- Node.js 18+
- npm or yarn
- Google Cloud Console account (for OAuth)

## Setup

### 1. Clone and Install Dependencies

```bash
git clone <repository-url>
cd travel-planner
npm install
```

### 2. Configure Google OAuth

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing
3. Navigate to APIs & Services > Credentials
4. Create OAuth 2.0 Client ID:
   - Application type: Chrome Extension
   - Item ID: Your extension ID (get this after loading unpacked extension)
5. Note your Client ID

### 3. Backend Setup

```bash
cd backend

# Copy environment file
cp .env.example .env

# Edit .env and add your credentials:
# - JWT_SECRET: Generate a secure random string
# - GOOGLE_CLIENT_ID: From Google Cloud Console

# Generate Prisma client and setup database
npm run db:generate
npm run db:push

# Start development server
npm run dev
```

### 4. Extension Setup

1. Update `extension/manifest.json`:
   - Replace `YOUR_GOOGLE_CLIENT_ID` with your actual Google Client ID

2. Load the extension in Chrome:
   - Navigate to `chrome://extensions`
   - Enable "Developer mode"
   - Click "Load unpacked"
   - Select the `extension` folder

3. Note your Extension ID and update:
   - Google Cloud Console OAuth client
   - Backend `.env` CORS_ORIGIN setting

## Development

### Backend

```bash
cd backend
npm run dev          # Start with hot reload
npm run build        # Build for production
npm run start        # Run production build
npm run db:migrate   # Run database migrations
```

### Extension

After making changes to extension files, click the refresh icon in `chrome://extensions` to reload.

## API Endpoints

### Authentication
- `POST /api/auth/google` - Authenticate with Google token
- `GET /api/auth/verify` - Verify JWT token
- `GET /api/auth/me` - Get current user info
- `DELETE /api/auth/account` - Delete user account

### Places
- `GET /api/places` - List all places (with filters)
- `GET /api/places/stats` - Get statistics
- `GET /api/places/:id` - Get single place
- `POST /api/places` - Create place
- `POST /api/places/bulk` - Create multiple places
- `PATCH /api/places/:id` - Update place
- `DELETE /api/places/:id` - Delete place

### Trips
- `GET /api/trips` - List all trips
- `GET /api/trips/:id` - Get trip with places
- `POST /api/trips` - Create trip
- `PATCH /api/trips/:id` - Update trip
- `DELETE /api/trips/:id` - Delete trip
- `POST /api/trips/:id/places` - Add place to trip
- `DELETE /api/trips/:id/places/:placeId` - Remove place from trip

## Environment Variables

### Backend (.env)

| Variable | Description |
|----------|-------------|
| DATABASE_URL | SQLite database path |
| JWT_SECRET | Secret for JWT signing |
| GOOGLE_CLIENT_ID | Google OAuth Client ID |
| PORT | Server port (default: 3000) |
| NODE_ENV | Environment (development/production) |
| CORS_ORIGIN | Allowed CORS origin (extension URL) |

## Tech Stack

- **Extension**: JavaScript, Chrome Extension Manifest V3
- **Backend**: Node.js, Express, TypeScript
- **Database**: SQLite with Prisma ORM
- **Authentication**: Google OAuth 2.0, JWT

## License

MIT
