# Work Digital Client Vault

## Overview

Work Digital Client Vault is a private back-office contract and client management portal designed for internal legal operations. The system manages parties (companies, individuals, trusts, funds), agreements (contracts, loans, JVs), documents, and activities while tracking enforcement stages for collections and litigation preparation. Built with React, Express, and PostgreSQL, it provides Kanban-style workflows for agreement lifecycle management and enforcement tracking. Features Basel IV compliant contact management for positive party identification.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture

**Technology Stack:**
- React 18 with TypeScript for type-safe component development
- Vite as build tool and development server (port 5000)
- Wouter for client-side routing (lightweight alternative to React Router)
- TanStack Query (React Query) for server state management and caching
- Tailwind CSS v4 with custom design tokens for styling
- Radix UI primitives for accessible component foundation
- shadcn/ui component library (New York variant) for consistent UI patterns

**Design System:**
- Custom color palette with professional blue-tinted neutrals for legal/trust aesthetic
- Dual font system: Inter (UI text) and Merriweather (authoritative headers)
- CSS custom properties for theming with light/dark mode support
- Consistent spacing, shadows, and border radius through design tokens

**State Management:**
- React Query for all server data (parties, agreements, documents, persons, activities)
- React Context for authentication state (`AuthProvider`) and shared data operations (`DataProvider`)
- Session-based authentication with cookies
- Optimistic updates and cache invalidation patterns

**Key Features:**
- Kanban boards for agreement lifecycle with drag-and-drop (Draft → Performing → Settled)
- Bulk status updates with selection mode on Agreements board
- Enforcement pipeline visualization (Dunning → Suit Filed → Judgment)
- Searchable party directory with relationship mapping
- Party relationships management (Parent, Subsidiary, Guarantor, JV Partner, etc.)
- Document management with file upload/download and expiration tracking
- Document expiry alerts on Dashboard
- Agreement notes field for internal comments
- Maturity date alerts on Dashboard
- Global search across parties, agreements, documents, and activities
- Activity timeline tracking
- Role-based access (Admin vs User)

### Backend Architecture

**Technology Stack:**
- Node.js with Express for REST API
- TypeScript with ES modules throughout
- Drizzle ORM for type-safe database operations
- Neon serverless PostgreSQL driver with WebSocket support
- Session management with in-memory store (MemoryStore for development)
- bcrypt for password hashing
- Multer for file upload handling

**API Structure:**
- RESTful endpoints organized by resource (`/api/users`, `/api/parties`, `/api/agreements`, etc.)
- Session-based authentication with middleware protection
- File uploads stored in local `uploads/` directory
- Request/response logging with duration tracking
- Error handling with standardized JSON responses

**Database Schema:**
- `users` - Authentication and user management (email, name, password hash, role)
- `parties` - Companies, individuals, trusts, banks, JV partners
- `persons` - Contacts associated with parties (name, role, email, phone)
- `agreements` - Contracts with financial terms, dates, status tracking, notes
- `activities` - Timeline entries (emails, calls, meetings, notes)
- `documents` - File metadata with agreement/party associations, expiration dates
- `partyRelationships` - Links between parties (Parent, Subsidiary, Guarantor, etc.)

**Data Model Relationships:**
- Parties have many Persons (one-to-many via `partyId`)
- Parties have many Relationships (self-referential many-to-many via `partyRelationships`)
- Agreements belong to Parties (one-to-many via `partyId`)
- Documents link to Agreements and/or Parties (optional foreign keys)
- Activities track agreement history (one-to-many via `agreementId`)

**Build & Deployment:**
- esbuild bundles server code with selective dependency bundling (allowlist approach)
- Vite builds client static assets to `dist/public`
- Production server serves static files and API from single Express instance
- Development uses Vite middleware with HMR

### Data Storage Solutions

**Database:**
- PostgreSQL (via Neon serverless) as primary data store
- Drizzle ORM with schema-first approach (`shared/schema.ts`)
- UUID primary keys generated via `gen_random_uuid()`
- Cascade deletes for relational integrity (e.g., persons when party deleted)

**File Storage:**
- Local filesystem storage in `uploads/` directory
- Multer handles multipart form data with unique filename generation
- Download endpoint serves files with proper content disposition headers

**Session Storage:**
- In-memory session store for development (MemoryStore)
- Session secret configurable via environment variable
- Cookie-based session management with `express-session`

### Authentication & Authorization

**Authentication Flow:**
- Login endpoint (`/api/auth/login`) validates credentials against hashed passwords
- Successful login creates server-side session and returns user object
- Session cookie sent with all subsequent requests
- Current user retrieved via `/api/auth/me` endpoint
- Logout destroys session

**Authorization:**
- Two roles: "Admin" and "User"
- Admin users can manage other users (`/admin/users` route)
- Protected routes check session existence on frontend
- Backend routes should validate session and role (implementation ready for enhancement)

**Security Considerations:**
- Passwords hashed with bcrypt (10 rounds)
- Session secret should be set via environment variable in production
- CORS and CSRF protection not explicitly configured (add for production)
- File upload validation needed (file type, size limits)

## External Dependencies

**Database:**
- Neon Serverless PostgreSQL (requires `DATABASE_URL` environment variable)
- Connection pooling via `@neondatabase/serverless` with WebSocket transport

**Development Tools:**
- Replit-specific plugins for dev experience (runtime error modal, cartographer, dev banner)
- Vite plugin for meta image tag updates based on Replit deployment domain

**Third-Party Libraries:**
- `date-fns` for date formatting and manipulation
- `nanoid` for generating unique identifiers
- `zod` for schema validation (used with Drizzle)
- `clsx` and `tailwind-merge` for className utilities

**UI Component Dependencies:**
- All Radix UI primitives (dialog, dropdown, tabs, etc.)
- Lucide React for icons
- `cmdk` for command palette patterns
- `react-day-picker` for calendar component

**Build Dependencies:**
- esbuild for server bundling
- Vite for client bundling
- tsx for TypeScript execution in development

**Environment Variables Required:**
- `DATABASE_URL` - PostgreSQL connection string (Neon)
- `SESSION_SECRET` - Secret key for session signing (optional, has default)
- `NODE_ENV` - Environment mode (development/production)

**AWS S3 Storage (December 2024):**
- Documents now stored in AWS S3 bucket for durability and scalability
- S3 service module at `server/services/s3Storage.ts`
- Automatic fallback to local storage if S3 credentials not configured
- Uses presigned URLs for secure document downloads
- Environment variables required: `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_S3_BUCKET`, `AWS_REGION`
- Documents stored with `s3://` prefix in database `filePath` field

**Document Versioning (December 2024):**
- Documents support version history with version numbers and parent document chains
- Schema includes: version (integer), parentDocumentId (for version chains), uploadedById
- Storage methods: getDocumentVersions(), createDocumentVersion() for version management
- API endpoints: GET /documents/:id/versions, POST /documents/:id/versions
- Engagement-scoped document operations with RBAC enforcement
- Automatic timeline entries for DocumentUploaded/DocumentDeleted events
- UI features category selection on upload and version history dialog

**Engagement Command Center (December 2024):**
- Phase 1: Engagement workspaces with 6-role RBAC (owner, internal_admin, internal_user, external_partner, viewer, auditor)
- Phase 2: Unified timeline with type and date filtering, auto-logged system events
- Phase 3: Document hardening with versioning, RBAC-enforced operations, audit logging
- Phase 4: Search + Tasks
  - Task management within engagements (title, description, priority, status, due date, assignee)
  - Tasks schema with fields: engagementId, title, description, priority (Low/Medium/High/Urgent), status (Open/InProgress/Completed/Cancelled), dueDate, assigneeId, createdById, completedAt
  - API endpoints: GET/POST /engagements/:id/tasks, PUT/DELETE /engagements/:engagementId/tasks/:taskId
  - RBAC enforcement: create/update requires owner/internal_admin/internal_user, delete requires owner/internal_admin
  - Timeline auto-logging for TaskCreated, TaskCompleted, TaskDeleted events
  - Tasks tab in EngagementDetail with task list, status toggle, create/delete actions
  - Global search enhanced to include engagements (by name, description, type, reference number)
- Phase 5: Exports + AI Advisor
  - Export endpoints: GET /engagements/:id/export/timeline, /documents, /tasks (CSV), /summary (JSON)
  - RBAC enforcement: export requires owner/internal_admin/auditor role
  - AI Advisor endpoint: POST /engagements/:id/ai-advisor using OpenAI GPT-4o
  - AI context includes: engagement details, parties, agreements, documents, tasks, recent timeline
  - RBAC enforcement: AI advisor requires owner/internal_admin/internal_user role
  - Timeline auto-logging for AIAdvisorQuery events
  - Frontend: Export tab with download buttons, AI Advisor tab with chat interface

**AI Governance Control Plane (December 2024):**
- Hierarchical policy system: GLOBAL → CLIENT → PROJECT → ARTIFACT scopes
- Database tables: governance_policies, ai_personas, ai_actions_log, governance_approvals
- AI action types: AI_SUMMARIZE, AI_ANALYZE, AI_ADVISOR, AI_REWRITE, AI_LEGAL_DRAFT, AI_EXPORT
- Classification rules: blocks AI on ATTORNEY_PRIVILEGED, RESTRICTED artifacts
- Policy merging: most restrictive wins across scope hierarchy
- Server modules: server/governance/ (types, schema, registry, merge, evaluator, hash, seed)
- enforceGovernance middleware for backend AI action enforcement
- useGovernance React hook for frontend UI gating with can() method
- Seed data: 3 AI personas (DDIE, VAULT_SUMMARIZER, LEGAL_DRAFTER), global policy allowing summarize/analyze/advisor
- Default policy requires supervisor approval for AI_REWRITE, AI_LEGAL_DRAFT, AI_EXPORT
- AI actions logged to append-only ai_actions_log with SHA256 hash for audit integrity
- UI shows "Requires Approval" badge for supervisor-needed actions, disables blocked actions

**Fraud & Criminal Indicators Engine (December 2024):**
- AI-powered fraud pattern detection for enforcement cases
- Database tables: fraud_indicators (catalog of 15 indicator codes), fraud_assessments, fraud_findings, referral_packets, entity_graph_edges
- Indicator categories: identity, misrepresentation, funds_flow, communications, insurance, regulatory, pattern
- Scoring system: severity weight (1-10) × confidence multiplier (low=1, medium=2, high=3)
- Threshold levels: none (0-9), watch (10-24), elevated (25-44), referral_ready (45+)
- Server modules: server/fraud/ (seed.ts, aiAnalyst.ts, referralPacketGenerator.ts)
- AI Analyst uses GPT-4o with strict guardrails - identifies evidence-based patterns, never accuses
- Workflow gates: Declare Default and Establish Estoppel actions blocked with warning when fraud threshold is elevated/referral_ready
- Findings require human activation with evidence links before counting toward score
- Referral packet generation creates JSON manifest with SHA-256 hashes for evidence integrity
- UI: Fraud tab in EnforcementCaseDetail with risk meter, active findings list, AI suggestions, and referral packet generation button
- Timeline auto-logging: FraudAssessmentInitiated, FraudFindingActivated, FraudFindingDeactivated, FraudScoreRecalculated, ReferralPacketGenerated

**Future Considerations:**
- Session store should use PostgreSQL (connect-pg-simple) or Redis in production
- Email notifications (nodemailer dependency present but unused)
- Governance admin UI for managing policies and approvals
- Supervisor approval workflow UI for pending approvals
- Referral packet PDF/ZIP generation (currently JSON manifest only)