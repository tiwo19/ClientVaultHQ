# LegalFlow - Private Back Office Client

This is a React-based frontend prototype for a private back-office client/contract management portal.

## Setup & Running

This project is configured for Replit.

1.  **Install Dependencies**:
    The environment should auto-install, but if not:
    ```bash
    npm install
    ```

2.  **Run Development Server**:
    ```bash
    npm run dev
    ```
    This starts the Vite server on port 5000.

## Environment Variables

Since this is a frontend-only mockup, no actual Supabase connection is active. However, in a real deployment, you would set:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

## Implemented Features

- [x] **Renamed Domain Concepts**:
    - Companies -> **Parties**
    - Contacts -> **Persons**
    - Deals -> **Agreements**
- [x] **Extended Data Model**:
    - Added fields for `principalAmount`, `interestRate`, `dates`, `enforcementStage`, etc.
- [x] **Pipelines**:
    - **Active Agreements**: Kanban view by `performanceStatus` (Draft -> Performing -> Settled).
    - **Enforcement**: Kanban view by `enforcementStage` (Dunning -> Suit Filed -> Judgment).
- [x] **Agreement Detail View**:
    - Financial summary.
    - Tabbed interface for Details, Timeline (Activities), and Documents.
- [x] **Parties List**: Searchable directory of all entities.
- [x] **Mock Data**: Robust set of sample data to demonstrate all views.

## SQL / Schema Notes

If connecting to Supabase later, you will need to create tables for:
- `parties` (id, name, type, details)
- `persons` (id, party_id, name, role, contact)
- `agreements` (id, party_id, status, financial_terms, enforcement_stage)
- `activities` (id, agreement_id, type, content, date)
- `documents` (id, agreement_id, file_path, type)

The frontend currently uses `client/src/lib/mockData.ts` as the source of truth.
