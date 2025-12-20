export const testUsers = {
  admin: {
    id: "test-admin-id",
    email: "admin@test.com",
    name: "Test Admin",
    password: "hashedPassword123",
    role: "Admin",
    credits: 1000,
  },
  user: {
    id: "test-user-id",
    email: "user@test.com",
    name: "Test User",
    password: "hashedPassword123",
    role: "User",
    credits: 100,
  },
};

export const testParties = {
  company: {
    id: "test-party-company",
    name: "Test Company LLC",
    type: "Company",
    email: "contact@testcompany.com",
    phone: "555-0100",
    address: "123 Test St, Test City, TS 12345",
    taxId: "12-3456789",
    jurisdictionOfFormation: "Delaware",
    notes: "Test company for testing",
  },
  individual: {
    id: "test-party-individual",
    name: "John Doe",
    type: "Individual",
    email: "john@test.com",
    phone: "555-0101",
    address: "456 Main St, Test City, TS 12345",
    taxId: "123-45-6789",
    jurisdictionOfFormation: null,
    notes: null,
  },
};

export const testAgreements = {
  loan: {
    id: "test-agreement-loan",
    title: "Test Loan Agreement",
    partyId: "test-party-company",
    type: "Loan",
    principalAmount: 100000,
    interestRateAnnual: 5.5,
    governingLaw: "Delaware",
    venueJurisdiction: "New Castle County",
    effectiveDate: "2024-01-01",
    maturityDate: "2025-01-01",
    internalOwner: "Test Admin",
    counterpartyRiskRating: "Medium",
    performanceStatus: "Performing",
    enforcementStage: "None",
    isClientVisible: false,
    isSecured: true,
    isPersonalGuarantee: false,
    notes: "Test loan agreement",
  },
};

export const testEngagements = {
  active: {
    id: "test-engagement-1",
    name: "Test Engagement",
    description: "Test engagement for testing",
    type: "Litigation",
    referenceNumber: "ENG-2024-001",
    status: "active",
    priority: "high",
    createdById: "test-admin-id",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
};
