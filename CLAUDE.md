# CLAUDE.md - AI Assistant Guidelines

This document provides context and guidelines for AI assistants working with this repository.

## Repository Overview

**Project**: Travel Planner Chrome Extension
**Repository**: testclaude
**Primary Languages**: TypeScript (Backend), JavaScript (Extension)
**Framework**: Express.js, Chrome Extension Manifest V3
**Database**: SQLite with Prisma ORM

A Chrome extension that extracts and organizes travel recommendations from any webpage, with a Node.js backend for data persistence and user authentication.

## Project Structure

```
travel-planner/
├── CLAUDE.md                 # AI assistant guidelines (this file)
├── README.md                 # Project documentation
├── package.json              # Monorepo root configuration
├── .gitignore                # Git ignore rules
│
├── extension/                # Chrome Extension (Manifest V3)
│   ├── manifest.json         # Extension configuration
│   ├── build.js              # Build script
│   ├── popup/                # Extension popup UI
│   │   ├── popup.html        # Main popup HTML
│   │   ├── popup.css         # Popup styles
│   │   └── popup.js          # Popup logic & state management
│   ├── content/              # Content script
│   │   └── content.js        # Page scanning & place extraction
│   ├── background/           # Service worker
│   │   └── background.js     # Auth, API calls, message handling
│   ├── styles/               # Injected styles
│   │   └── content.css       # Floating button & toast styles
│   └── icons/                # Extension icons (16, 48, 128px)
│
└── backend/                  # Node.js API Server
    ├── package.json          # Backend dependencies
    ├── tsconfig.json         # TypeScript configuration
    ├── .env.example          # Environment template
    ├── prisma/
    │   └── schema.prisma     # Database schema (User, Place, Trip)
    └── src/
        ├── index.ts          # Express server entry point
        ├── config/
        │   └── database.ts   # Prisma client singleton
        ├── routes/
        │   ├── auth.ts       # Google OAuth & JWT endpoints
        │   ├── places.ts     # CRUD for places
        │   └── trips.ts      # Trip management
        └── middleware/
            ├── auth.ts       # JWT authentication middleware
            └── errorHandler.ts # Global error handling
```

## Development Workflow

### Quick Start

```bash
# Install all dependencies
npm install

# Backend setup
cd backend
cp .env.example .env
# Edit .env with your credentials
npm run db:generate
npm run db:push
npm run dev

# Load extension in Chrome
# chrome://extensions > Developer mode > Load unpacked > select extension/
```

### Branch Strategy

- **Main branch**: Production-ready code
- **Feature branches**: Use `claude/` prefix for AI-assisted development
- Always create pull requests for code review before merging

### Commit Guidelines

1. Use conventional commit format:
   - `feat:` for new features
   - `fix:` for bug fixes
   - `docs:` for documentation changes
   - `refactor:` for code refactoring
   - `test:` for adding/modifying tests
2. Keep commits atomic and focused on single changes
3. Write clear messages explaining the "why"

## Code Conventions

### TypeScript (Backend)

- Use ES modules (`import`/`export`)
- Async/await for asynchronous code
- Zod for request validation
- Prisma for database operations
- Express middleware pattern for auth and error handling

### JavaScript (Extension)

- Chrome Extension Manifest V3 APIs
- Message passing between content script, background, and popup
- Chrome Storage API for local persistence
- Chrome Identity API for OAuth

### API Design

- RESTful endpoints under `/api/`
- JWT Bearer authentication
- Consistent error response format: `{ error: { message, code } }`
- Validation errors return 400 status

## AI Assistant Instructions

### When Working on This Repository

1. **Read before modifying**: Always read existing files before making changes
2. **Follow existing patterns**: Match the code style and patterns already established
3. **Keep changes minimal**: Only make changes directly related to the task
4. **Security first**: Never introduce vulnerabilities (XSS, SQL injection, etc.)
5. **Update CLAUDE.md**: When adding significant features, update this file

### Key Patterns to Follow

**Backend Route Pattern**:
```typescript
router.post('/', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const data = schema.parse(req.body);
    const result = await prisma.model.create({ data: { ...data, userId: req.userId! } });
    res.status(201).json(result);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return next(createError('Invalid data', 400, 'VALIDATION_ERROR'));
    }
    next(error);
  }
});
```

**Extension Message Pattern**:
```javascript
// Sending message
const response = await chrome.runtime.sendMessage({ action: 'actionName', data });

// Receiving in background.js
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  handleMessage(request, sender).then(sendResponse);
  return true; // Keep channel open for async
});
```

### Before Making Changes

- Understand the data flow: Content Script → Background → API → Database
- Check Prisma schema for data relationships
- Review existing routes for similar patterns
- Test OAuth flow requires real Google credentials

### After Making Changes

- Run TypeScript build: `npm run build` (backend)
- Reload extension in chrome://extensions
- Test API endpoints with curl or Postman
- Verify database changes with Prisma Studio: `npx prisma studio`

## Testing

```bash
# Backend type checking
cd backend && npm run build

# Database inspection
cd backend && npx prisma studio

# API health check
curl http://localhost:3000/health
```

## Build & Deployment

### Backend

```bash
cd backend
npm run build        # Compile TypeScript
npm run start        # Run production build
npm run db:migrate   # Run migrations (production)
```

### Extension

```bash
cd extension
npm run build        # Copy files to dist/
# Load dist/ folder in Chrome for testing
# Package as .crx for distribution
```

## Key Dependencies

### Backend
| Package | Purpose |
|---------|---------|
| express | Web framework |
| @prisma/client | Database ORM |
| jsonwebtoken | JWT authentication |
| google-auth-library | Google OAuth verification |
| zod | Request validation |
| cors | Cross-origin requests |

### Extension
| API | Purpose |
|-----|---------|
| chrome.storage | Local data persistence |
| chrome.identity | Google OAuth |
| chrome.tabs | Active tab queries |
| chrome.runtime | Message passing |

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| DATABASE_URL | Yes | SQLite file path |
| JWT_SECRET | Yes | Secret for signing JWTs |
| GOOGLE_CLIENT_ID | Yes | From Google Cloud Console |
| PORT | No | Server port (default: 3000) |
| CORS_ORIGIN | No | Chrome extension origin |

## Key Files Reference

| File | Purpose |
|------|---------|
| `backend/prisma/schema.prisma` | Database schema - User, Place, Trip models |
| `backend/src/routes/places.ts` | Core CRUD operations for places |
| `backend/src/middleware/auth.ts` | JWT verification and user context |
| `extension/content/content.js` | Page scanning and place extraction logic |
| `extension/background/background.js` | Service worker - API calls, auth handling |
| `extension/popup/popup.js` | UI state management and rendering |

## Common Tasks

### Adding a New API Endpoint

1. Define Zod schema for request validation
2. Add route handler in appropriate routes file
3. Use `authenticate` middleware if auth required
4. Follow existing error handling pattern
5. Update CLAUDE.md Key Files if significant

### Modifying Place Extraction

1. Edit `extension/content/content.js`
2. Update `CATEGORY_PATTERNS` for new keywords
3. Modify `extractPlaceFromLink()` or `extractPlaceFromHeading()`
4. Test on various travel blogs/sites

### Adding a New Place Category

1. Update `CATEGORY_PATTERNS` in content.js
2. Update Zod enum in `backend/src/routes/places.ts`
3. Add category styling in `extension/popup/popup.css`
4. Update `formatCategory()` in popup.js

### Debugging Chrome Extension

1. Open chrome://extensions
2. Click "Inspect views: service worker" for background logs
3. Right-click extension popup > Inspect for popup logs
4. Open DevTools on webpage for content script logs

## Architecture Notes

### Data Flow
```
[Web Page] → Content Script (extracts places)
     ↓
Background Script (API calls, auth)
     ↓
Backend API (validation, business logic)
     ↓
SQLite Database (Prisma)
```

### Authentication Flow
```
1. User clicks "Sign In" in popup
2. popup.js sends 'signIn' message to background.js
3. background.js calls chrome.identity.getAuthToken()
4. Google OAuth flow completes, returns access token
5. background.js sends token to POST /api/auth/google
6. Backend verifies with Google, creates/updates user
7. Backend returns JWT token
8. Extension stores JWT in chrome.storage.local
9. Subsequent API calls include JWT in Authorization header
```

## Notes for AI Assistants

- This is a functional Chrome extension with backend - maintain working state
- Place extraction uses heuristics - improvements may need real-world testing
- Google OAuth requires actual credentials to test fully
- Extension ID changes when loaded unpacked - affects CORS settings
- SQLite used for simplicity - consider PostgreSQL for production

---

*Last updated: January 2026*
