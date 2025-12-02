# LegalFlow - Project Summary & Features Document

## Overview

LegalFlow is a private back-office contract and client management portal designed for internal legal operations. The system manages parties (companies, individuals, trusts, funds), agreements (contracts, loans, JVs), documents, and activities while tracking enforcement stages for collections and litigation preparation.

### Key Capabilities
- Kanban-style workflow management for agreement lifecycle
- Document management with expiration tracking
- Party relationship mapping
- Activity timeline tracking
- Dashboard analytics and alerts
- Role-based access control

---

## Core Modules

### 1. Dashboard

The Dashboard provides an at-a-glance view of portfolio health and pending actions.

**Features:**
| Feature | Description |
|---------|-------------|
| Portfolio Overview | Total parties, agreements, and documents count |
| Agreement Status Distribution | Pie chart showing agreements by performance status |
| Agreement Types Breakdown | Bar chart showing distribution by type (Loan, Lease, JV, etc.) |
| Maturity Date Alerts | List of agreements approaching maturity within 30 days |
| Document Expiry Alerts | List of documents expiring within 30 days |
| Recent Activities | Timeline of latest logged activities |

---

### 2. Parties Module

Manages all counterparties, entities, and contacts in the system.

#### Party Types Supported
- Company
- Individual
- Trust
- Bank
- Fund
- JV Partner

#### Party Directory Operations

| Operation | Description |
|-----------|-------------|
| View All Parties | Searchable list with type filter |
| Create New Party | Add party with name, type, contact info, tax ID, jurisdiction |
| Edit Party | Update all party details including notes |
| Delete Party | Remove party (cascades to related persons) |
| Search/Filter | Filter by name, type, or other attributes |

#### Party Detail Page Features

| Tab/Section | Operations Available |
|-------------|---------------------|
| **Timeline** | View chronological activity history, log new activities (Call, Email, Meeting, Letter, Internal Note, Court Filing) |
| **Identity Documents** | Upload/download identity documents (Passport, Driver's License, State ID, Proof of Address, SSN Card) |
| **Corporate Documents** | Upload/download corporate documents (EIN, Articles of Incorporation, Operating Agreement, Certificate of Good Standing, Insurance Binder, W-9, Bank Statement, Financial Statement) |
| **Other Documents** | Upload/download miscellaneous documents |
| **Relationships** | Add/remove relationships to other parties with directional indicators (→ outgoing, ← incoming). Types: Parent, Subsidiary, Affiliate, Guarantor, JV Partner, Lender, Borrower, Agent, Trustee, Beneficiary |
| **Key Contacts** | Add/remove contact persons with name, role, email, phone |
| **Related Agreements** | View linked agreements with quick navigation |

#### Document Features
- Categorization by type
- Expiration date tracking
- Expiry status indicators (Expired, Expiring Soon)
- Download functionality
- Notes field for each document

---

### 3. Agreements Module

Manages all contracts, loans, leases, and other legal agreements.

#### Agreement Types Supported
- Loan
- LOI (Letter of Intent)
- JV (Joint Venture)
- Lease
- Other

#### Kanban Board Operations

| Operation | Description |
|-----------|-------------|
| Drag-and-Drop | Move agreements between status columns |
| Create Agreement | Add new agreement with title, counterparty, type, amount, date |
| Filter/Search | Search agreements by title, type, or counterparty |
| **Bulk Selection Mode** | Select multiple agreements using checkboxes |
| **Select All in Column** | Toggle select/deselect all agreements in a status column |
| **Bulk Status Update** | Move multiple selected agreements to a new status at once |

#### Agreement Lifecycle Statuses
1. Draft
2. Sent
3. Executed
4. Performing
5. In Grace Period
6. In Default
7. Settled

#### Enforcement Pipeline Stages
1. None
2. Dunning
3. Pre-Suit
4. Suit Filed
5. Judgment
6. Garnishment
7. Closed

#### Agreement Detail Page Features

| Section | Operations Available |
|---------|---------------------|
| **Header** | View title, status badges, counterparty link, edit button |
| **Financial Summary** | Principal amount, interest rate, maturity date |
| **Details Tab** | Effective date, governing law, venue/jurisdiction, internal owner |
| **Security & Risk** | Secured status, personal guarantee status, counterparty risk rating, enforcement stage |
| **Internal Notes** | View/edit internal comments about the agreement |
| **Timeline Tab** | View/add activities (calls, emails, meetings, notes) |
| **Documents Tab** | View/upload/download related documents |

#### Agreement Edit Operations
- Title
- Type
- Principal Amount
- Interest Rate
- Effective Date
- Maturity Date
- Performance Status
- Enforcement Stage
- Governing Law
- Venue/Jurisdiction
- Internal Owner
- Risk Rating
- Secured Status
- Personal Guarantee Status
- Internal Notes

---

### 4. Documents Module

Documents are managed within the context of Parties and Agreements rather than as a standalone module.

#### Document Operations (via Party/Agreement Detail Pages)

| Operation | Description |
|-----------|-------------|
| Upload Document | Add document with category, expiration date, notes |
| Download Document | Download original file |
| Delete Document | Remove document from party/agreement |
| View by Category | Documents organized by Identity, Corporate, Other tabs |

#### Document Categories
**Identity Documents:**
- Passport
- Driver's License
- State ID
- Proof of Address
- SSN Card

**Corporate Documents:**
- EIN / Tax ID
- Articles of Incorporation
- Operating Agreement
- Certificate of Good Standing
- Insurance Binder
- W-9 Form
- Bank Statement
- Financial Statement

**Other:** Miscellaneous documents

#### Document Expiration Tracking
- Set expiration dates on upload
- Visual indicators for expired documents
- "Expiring Soon" alerts (within 30 days)
- Dashboard widget for expiring documents

---

### 5. Activities Module

Tracks all interactions and events related to parties and agreements. Activities are viewed within the context of Party and Agreement detail pages.

#### Activity Types
| Type | Icon | Description |
|------|------|-------------|
| Call | Phone | Logged phone calls |
| Email | Mail | Email correspondence |
| Meeting | Video | In-person or virtual meetings |
| Letter Sent | Send | Physical mail sent |
| Internal Note | Message | Internal team notes |
| Court Filing | Gavel | Legal filings |

#### Activity Operations (via Party/Agreement Detail Pages)

| Operation | Description |
|-----------|-------------|
| View Timeline | Chronological list of activities on detail pages |
| Log Activity | Add new activity with type, date, and content |

#### Activity Association
- Activities can be linked to a Party
- Activities can be linked to an Agreement
- Activities appear in Party timeline (includes agreement-related activities)
- Activities appear in Agreement timeline

---

### 6. User Management & Authentication

#### Authentication Features
| Feature | Description |
|---------|-------------|
| Login | Email and password authentication |
| Session Management | Cookie-based session persistence |
| Logout | End session and return to login |

#### User Roles
| Role | Capabilities |
|------|-------------|
| Admin | Full access including user management (/admin/users) |
| User | Standard access to all modules (admin pages hidden) |

*Note: Role-based access is enforced via frontend navigation. Admin-only routes are hidden from non-admin users.*

#### Admin User Management (/admin/users)
| Operation | Description |
|-----------|-------------|
| View All Users | List of all system users |
| Create User | Add new user with name, email, password, role |
| Edit User | Update user details and role |
| Delete User | Remove user from system |

---

### 7. Global Features

#### Global Search
- Command palette interface (keyboard shortcut)
- Search across all parties, agreements, documents, and activities
- Quick navigation to results

#### Navigation
- Sidebar navigation to all modules
- Breadcrumb navigation on detail pages
- Quick links between related entities

#### Data Relationships
```
Parties
  ├── Persons (Contacts)
  ├── Party Relationships (to other Parties)
  ├── Documents
  ├── Activities
  └── Agreements
        ├── Documents
        └── Activities
```

---

## Technical Specifications

### Default Admin Account
- Email: jking@workdigital.com
- Password: Rhin3land3r!

### Data Storage
- PostgreSQL database for all data
- Local filesystem for uploaded documents

### Supported Browsers
- Chrome (recommended)
- Firefox
- Safari
- Edge

---

## Quick Reference: All Operations

### Create Operations
- Create Party
- Create Agreement
- Upload Document
- Log Activity
- Add Contact Person
- Add Party Relationship
- Create User (Admin only)

### Read Operations
- View Dashboard
- View Party Directory
- View Party Details
- View Agreements Board
- View Agreement Details
- View Documents List
- View Activities Timeline
- View Users (Admin only)

### Update Operations
- Edit Party
- Edit Agreement
- Bulk Update Agreement Status
- Edit User (Admin only)

### Delete Operations
- Delete Party
- Delete Document
- Remove Contact Person
- Remove Party Relationship
- Delete User (Admin only)

---

*Document Version: 1.0*  
*Last Updated: December 2024*
