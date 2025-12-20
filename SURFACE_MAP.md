# Work Digital Client Vault - Surface Map

Generated: 2024-12-20

## 1. Frontend Routes (Wouter)

| Route | Component | Auth Required | Description |
|-------|-----------|---------------|-------------|
| `/login` | Login | No | User authentication |
| `/` | Dashboard | Yes | Main dashboard with customizable widgets |
| `/agreements` | Agreements | Yes | Agreement list with Kanban board |
| `/agreements/:id` | AgreementDetail | Yes | Single agreement view with activities |
| `/enforcement` | Enforcement | Yes | Enforcement cases pipeline |
| `/enforcement/:id` | EnforcementCaseDetail | Yes | Case detail with 12+ tabs |
| `/parties` | Parties | Yes | Party directory |
| `/parties/:id` | PartyDetail | Yes | Party detail with persons, relationships |
| `/admin/users` | AdminUsers | Yes (Admin) | User management |
| `/ai-bucket` | AIBucket | Yes | AI document analysis |
| `/engagements` | Engagements | Yes | Engagement workspaces |
| `/engagements/:id` | EngagementDetail | Yes | Engagement command center |
| `*` | NotFound | No | 404 handler |

## 2. Major Page Components

### Dashboard.tsx
- Customizable widget layout with drag-and-drop (@hello-pangea/dnd)
- LocalStorage persistence for widget order/visibility
- Widgets: KPIs, Maturities, Expiring Docs, Status Chart, Party Chart, Agreement Types
- Charts: Recharts (PieChart, BarChart)

### Agreements.tsx
- Kanban board with drag-and-drop for status changes
- Bulk status update mode
- Create/Edit agreement forms

### EnforcementCaseDetail.tsx
- 12 tabs: Summary, Notices, Evidence, Responses, Timeline, Affidavits, Export, Deficiencies, Compliance, Professionals, Patterns, Contradictions, Fraud
- Notice generation (AI-powered)
- Fraud analysis panel with risk meter
- Contradiction analysis with scoring

### EngagementDetail.tsx
- 7 tabs: Details, Members, Parties, Agreements, Documents, Tasks, Timeline, Exports, AI Advisor
- RBAC with 6 roles
- AI Advisor chat interface (OpenAI GPT-4o)

### AIBucket.tsx
- Document upload and AI analysis
- Credit-based usage system

## 3. Backend API Routes

### Authentication
| Method | Route | Auth | Description |
|--------|-------|------|-------------|
| POST | `/api/auth/login` | No | User login |
| POST | `/api/auth/logout` | Yes | User logout |
| GET | `/api/auth/me` | Yes | Get current user |

### Users
| Method | Route | Auth | Description |
|--------|-------|------|-------------|
| GET | `/api/users` | Admin | List all users |
| POST | `/api/users` | Admin | Create user |
| DELETE | `/api/users/:id` | Admin | Delete user |
| POST | `/api/users/:id/credits` | Admin | Add credits |

### Parties
| Method | Route | Auth | Description |
|--------|-------|------|-------------|
| GET | `/api/parties` | Yes | List parties |
| POST | `/api/parties` | Yes | Create party |
| PUT | `/api/parties/:id` | Yes | Update party |
| DELETE | `/api/parties/:id` | Yes | Delete party |

### Persons
| Method | Route | Auth | Description |
|--------|-------|------|-------------|
| GET | `/api/persons` | Yes | List persons |
| POST | `/api/persons` | Yes | Create person |
| DELETE | `/api/persons/:id` | Yes | Delete person |

### Contact Points & Addresses
- GET/POST/PUT/DELETE for `/api/contact-points`
- GET/POST/PUT/DELETE for `/api/addresses`
- Polymorphic ownership (party or person)

### Agreements
| Method | Route | Auth | Description |
|--------|-------|------|-------------|
| GET | `/api/agreements` | Yes | List agreements |
| GET | `/api/agreements/:id` | Yes | Get agreement |
| POST | `/api/agreements` | Yes | Create agreement |
| PUT | `/api/agreements/:id` | Yes | Update agreement |
| DELETE | `/api/agreements/:id` | Yes | Delete agreement |

### Documents
| Method | Route | Auth | Description |
|--------|-------|------|-------------|
| GET | `/api/documents` | Yes | List documents |
| POST | `/api/documents/upload` | Yes | Upload document (Multer → S3) |
| GET | `/api/documents/:id/download` | Yes | Download (presigned URL) |
| DELETE | `/api/documents/:id` | Yes | Delete document |
| GET | `/api/documents/:id/versions` | Yes | Get version history |
| POST | `/api/documents/:id/versions` | Yes | Create new version |

### Activities
- GET/POST/DELETE for `/api/activities`

### Party Relationships
- GET/POST/DELETE for `/api/party-relationships`

### AI Bucket
| Method | Route | Auth | Description |
|--------|-------|------|-------------|
| POST | `/api/ai-bucket/analyze` | Yes | Analyze document (OpenAI) |
| POST | `/api/ai-bucket/confirm` | Yes | Confirm analysis and deduct credits |

### Engagements (Full CRUD + Members, Parties, Agreements, Timeline, Tasks)
- Full workspace management with RBAC
- AI Advisor: POST `/api/engagements/:id/ai-advisor`
- Exports: GET `/api/engagements/:id/export/{timeline,documents,tasks,summary}`

### Governance (AI Control Plane)
| Method | Route | Auth | Description |
|--------|-------|------|-------------|
| GET | `/api/governance/effective` | Yes | Get effective policies |
| POST | `/api/governance/policies` | Yes | Create policy |
| GET | `/api/governance/personas` | Yes | List AI personas |
| POST | `/api/governance/approvals` | Yes | Request approval |
| PATCH | `/api/governance/approvals/:id` | Yes | Approve/reject |

### Enforcement Engine
- Cases: CRUD + notices, documents, responses, timeline, affidavits
- AI Notice Generation: POST `/api/enforcement/cases/:caseId/generate`
- Actions: declare-default, establish-estoppel, lock-evidence

### Fraud Engine
| Method | Route | Auth | Description |
|--------|-------|------|-------------|
| GET | `/api/fraud/indicators` | Yes | List fraud indicators |
| POST | `/api/enforcement/:caseId/fraud/init` | Yes | Initialize assessment |
| GET | `/api/enforcement/:caseId/fraud` | Yes | Get assessment + findings |
| POST | `/api/fraud/findings` | Yes | Create/update finding |
| POST | `/api/enforcement/:caseId/fraud/recalc` | Yes | Recalculate score |
| POST | `/api/enforcement/:caseId/referral/export` | Yes | Generate referral packet |

### Pattern Detection
- Clusters, entities, entity graph edges
- Case pattern hits

### Deficiency Engine
- Required artifact rules
- Case artifact requirements
- Deficiency letters

### Party Compliance (KYC/KYB)
- Compliance profiles
- Compliance requests

### Professional Roles
- Professional roles per case
- Deliverables and licensure flags

### Contradictions Engine
- Contradiction sets, items, evidence links
- Questions and outputs
- Score recalculation

### Credits & Stripe
| Method | Route | Auth | Description |
|--------|-------|------|-------------|
| GET | `/api/credits` | Yes | Get user credits |
| GET | `/api/credits/transactions` | Yes | Get transactions |
| POST | `/api/stripe/create-checkout-session` | Yes | Create Stripe session |
| POST | `/api/stripe/webhook` | No | Stripe webhook handler |
| GET | `/api/stripe/verify-session/:sessionId` | Yes | Verify payment |

## 4. Database Tables (Drizzle + PostgreSQL)

### Core Entities
- `users` - Authentication, roles, credits
- `credit_transactions` - Credit purchase/usage log
- `parties` - Companies, individuals, trusts, banks
- `persons` - Contacts associated with parties
- `agreements` - Contracts with financial terms
- `activities` - Timeline entries
- `documents` - File metadata with versioning
- `party_relationships` - Links between parties
- `contact_points` - Phone/email for parties/persons
- `addresses` - Physical addresses

### Engagements
- `engagements` - Workspace containers
- `engagement_memberships` - User roles in engagements
- `engagement_parties` - Linked parties
- `engagement_agreements` - Linked agreements
- `audit_logs` - System audit trail
- `tasks` - Task management

### Governance
- `governance_policies` - AI action policies
- `ai_personas` - AI persona definitions
- `ai_actions_log` - Append-only AI action log
- `governance_approvals` - Supervisor approvals

### Enforcement
- `enforcement_cases` - Case containers
- `enforcement_notices` - Notice ladder (4 tiers)
- `enforcement_documents` - Case evidence
- `enforcement_responses` - Counterparty responses
- `enforcement_timeline` - Case timeline
- `enforcement_affidavits` - Generated affidavits
- `enforcement_delivery_proofs` - Proof of service
- `evidence_exports` - Export packages

### Fraud Engine
- `fraud_indicators` - Catalog of 15 indicator codes
- `fraud_assessments` - Case-level assessments
- `fraud_findings` - Individual findings
- `referral_packets` - Law enforcement referrals

### Pattern Detection
- `entity_graph_edges` - Entity relationships
- `pattern_entities` - Extracted entities
- `entity_links` - Entity linkages
- `entity_observations` - Entity observations
- `pattern_clusters` - Detected clusters
- `pattern_cluster_members` - Cluster membership
- `case_pattern_hits` - Case-level pattern matches

### Deficiency Engine
- `required_artifact_rules` - Required document rules
- `case_artifact_requirements` - Case-specific requirements
- `deficiency_letters` - Generated deficiency notices

### Compliance
- `party_compliance_profiles` - KYC/KYB profiles
- `party_compliance_requests` - Verification requests

### Professionals
- `professional_roles` - Case professional assignments
- `professional_deliverable_rules` - Required deliverables
- `professional_case_deliverables` - Case-specific deliverables
- `licensure_flags` - License verification flags

### Contradictions
- `contradiction_sets` - Case-level sets
- `contradiction_items` - Individual contradictions
- `contradiction_evidence_links` - Evidence references
- `contradiction_questions` - Clarification questions
- `contradiction_outputs` - AI analysis outputs

## 5. Integrations

### AWS S3 (Document Storage)
- **Files**: `server/services/s3Storage.ts`, `server/routes.ts`
- **Env Vars**: `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_S3_BUCKET`, `AWS_REGION`
- **Features**: Upload, presigned download URLs, delete
- **Fallback**: Local filesystem if S3 not configured

### OpenAI (GPT-4o)
- **Files**: `server/routes.ts`, `server/enforcement/aiAuthor.ts`, `server/fraud/aiAnalyst.ts`
- **Env Vars**: `OPENAI_API_KEY`
- **Features**: 
  - Document analysis (AI Bucket)
  - Notice generation (Enforcement)
  - Fraud pattern analysis
  - Engagement AI Advisor

### Stripe (Payments)
- **Files**: `server/routes.ts`, `server/storage.ts`
- **Env Vars**: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`
- **Features**: Credit purchases via checkout sessions, webhook handling

## 6. Session/Auth Configuration

- **Strategy**: express-session with MemoryStore
- **Session Secret**: `SESSION_SECRET` env var (default fallback exists)
- **Cookie Settings**: 
  - `resave: false`
  - `saveUninitialized: false`
  - Check period: 24 hours for pruning
- **Auth Check**: `requireAuth` middleware checks `req.session.userId`
- **Admin Check**: `requireAdmin` middleware checks user role

## 7. Existing Tests/Scripts

**Current State**: NO existing tests found
- No `.test.ts` or `.spec.ts` files
- No `tests/` directory
- No test scripts in package.json

**Existing Scripts**:
- `dev` - Development server
- `build` - Production build
- `start` - Production server
- `check` - TypeScript typecheck
- `db:push` - Drizzle schema push

## 8. Background Jobs

No background jobs identified. All operations are request/response based.

## 9. DnD (Drag-and-Drop) Flows

1. **Dashboard Widgets** - Reorder widgets, persist to localStorage
2. **Agreements Kanban** - Move agreements between status columns
3. **Potential**: Engagement tasks (if implemented)

## 10. Forms (Create/Edit)

- Login form
- Party create/edit
- Person create/edit
- Agreement create/edit
- Document upload
- Engagement create/edit
- Task create/edit
- Enforcement notice generation
- User create (admin)
