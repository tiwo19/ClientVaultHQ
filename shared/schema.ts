import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, real, boolean, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Users table for authentication
export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: text("email").notNull().unique(),
  name: text("name").notNull(),
  password: text("password").notNull(),
  role: text("role").notNull().default("User"),
  credits: integer("credits").notNull().default(0),
  stripeCustomerId: text("stripe_customer_id"),
});

export const insertUserSchema = createInsertSchema(users).omit({ id: true, credits: true, stripeCustomerId: true });
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

// Credit transactions table for tracking credit purchases and usage
export const creditTransactions = pgTable("credit_transactions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  type: text("type").notNull(), // "purchase", "usage", "refund", "bonus"
  amount: integer("amount").notNull(), // positive for credits added, negative for credits used
  description: text("description").notNull(),
  stripePaymentIntentId: text("stripe_payment_intent_id"), // For purchases
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertCreditTransactionSchema = createInsertSchema(creditTransactions).omit({ id: true, createdAt: true });
export type InsertCreditTransaction = z.infer<typeof insertCreditTransactionSchema>;
export type CreditTransaction = typeof creditTransactions.$inferSelect;

// Parties table
export const parties = pgTable("parties", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  type: text("type").notNull(), // Individual, Company, Trust, Bank, JVPartner, Fund
  email: text("email"),
  phone: text("phone"),
  address: text("address"),
  taxId: text("tax_id"),
  jurisdictionOfFormation: text("jurisdiction_of_formation"),
  notes: text("notes"),
});

export const insertPartySchema = createInsertSchema(parties).omit({ id: true });
export type InsertParty = z.infer<typeof insertPartySchema>;
export type Party = typeof parties.$inferSelect;

// Persons table
export const persons = pgTable("persons", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  partyId: varchar("party_id").notNull().references(() => parties.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  role: text("role").notNull(),
  email: text("email").notNull(),
  phone: text("phone").notNull(),
});

export const insertPersonSchema = createInsertSchema(persons).omit({ id: true });
export type InsertPerson = z.infer<typeof insertPersonSchema>;
export type Person = typeof persons.$inferSelect;

// Agreements table
export const agreements = pgTable("agreements", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  title: text("title").notNull(),
  partyId: varchar("party_id").notNull().references(() => parties.id, { onDelete: "cascade" }),
  type: text("type").notNull(), // LOI, Loan, JV, Lease, ServiceAgreement, etc
  principalAmount: real("principal_amount").notNull().default(0),
  interestRateAnnual: real("interest_rate_annual"),
  governingLaw: text("governing_law").notNull(),
  venueJurisdiction: text("venue_jurisdiction").notNull(),
  effectiveDate: text("effective_date").notNull(),
  maturityDate: text("maturity_date"),
  internalOwner: text("internal_owner").notNull(),
  counterpartyRiskRating: text("counterparty_risk_rating").notNull(), // Low, Medium, High
  performanceStatus: text("performance_status").notNull(), // Draft, Sent, Executed, Performing, etc
  enforcementStage: text("enforcement_stage").notNull().default("None"),
  isClientVisible: boolean("is_client_visible").notNull().default(false),
  isSecured: boolean("is_secured").notNull().default(false),
  isPersonalGuarantee: boolean("is_personal_guarantee").notNull().default(false),
  notes: text("notes"), // Internal notes/comments
});

export const insertAgreementSchema = createInsertSchema(agreements).omit({ id: true });
export type InsertAgreement = z.infer<typeof insertAgreementSchema>;
export type Agreement = typeof agreements.$inferSelect;

// Activity types for timeline
export const activityTypes = [
  "Call",
  "Email", 
  "LetterSent",
  "InternalNote",
  "Meeting",
  "CourtFiling",
  // Engagement-specific system events
  "MemberAdded",
  "MemberRemoved",
  "PartyLinked",
  "PartyUnlinked",
  "AgreementLinked",
  "AgreementUnlinked",
  "DocumentUploaded",
  "DocumentDeleted",
  "StatusChanged",
  "EngagementCreated",
  // Task events
  "TaskCreated",
  "TaskCompleted",
  "TaskDeleted",
  // AI events
  "AIAdvisorQuery",
  "AIGovernanceDecision"
] as const;
export type ActivityType = typeof activityTypes[number];

// Activities table
export const activities = pgTable("activities", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  agreementId: varchar("agreement_id").references(() => agreements.id, { onDelete: "cascade" }),
  partyId: varchar("party_id").references(() => parties.id, { onDelete: "cascade" }),
  engagementId: varchar("engagement_id"), // FK added via migration - references engagements.id
  type: text("type").notNull(), // Call, Email, LetterSent, InternalNote, Meeting, CourtFiling, system events
  content: text("content").notNull(),
  date: text("date").notNull(),
  user: text("user").notNull(),
  userId: varchar("user_id").references(() => users.id), // Link to actual user for system events
  imageUrl: text("image_url"), // Optional attached screenshot/image path
  metadata: text("metadata"), // JSON string for additional event data
});

export const insertActivitySchema = createInsertSchema(activities).omit({ id: true });
export type InsertActivity = z.infer<typeof insertActivitySchema>;
export type Activity = typeof activities.$inferSelect;

// Document categories for party documents
export const documentCategories = [
  // Identity Documents
  "Passport",
  "DriversLicense", 
  "StateID",
  "ProofOfAddress",
  "SSNCard",
  // Corporate Documents
  "EIN",
  "ArticlesOfIncorporation",
  "OperatingAgreement",
  "CertificateOfGoodStanding",
  "InsuranceBinder",
  "W9",
  "BankStatement",
  "FinancialStatement",
  // Agreement Documents
  "ExecutedAgreement",
  "Amendment",
  "SupportingDoc",
  // Other
  "Other"
] as const;

export type DocumentCategory = typeof documentCategories[number];

// Documents table
export const documents = pgTable("documents", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  agreementId: varchar("agreement_id").references(() => agreements.id, { onDelete: "cascade" }),
  partyId: varchar("party_id").references(() => parties.id, { onDelete: "cascade" }),
  engagementId: varchar("engagement_id").references(() => engagements.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  type: text("type").notNull(), // PDF, DOCX, Image
  category: text("category").notNull().default("Other"), // Document category
  dateUploaded: text("date_uploaded").notNull(),
  expirationDate: text("expiration_date"), // For documents that expire (licenses, insurance, etc.)
  notes: text("notes"), // Additional notes about the document
  filePath: text("file_path"), // Path to stored file
  // Versioning fields
  version: integer("version").notNull().default(1),
  parentDocumentId: varchar("parent_document_id"), // Links to original document for version chain
  uploadedById: varchar("uploaded_by_id").references(() => users.id, { onDelete: "set null" }),
});

export const insertDocumentSchema = createInsertSchema(documents).omit({ id: true, dateUploaded: true });
export type InsertDocument = z.infer<typeof insertDocumentSchema>;
export type Document = typeof documents.$inferSelect;

// Party Relationships table
export const partyRelationshipTypes = [
  "Parent",
  "Subsidiary", 
  "Affiliate",
  "Guarantor",
  "Beneficiary",
  "Trustee",
  "Manager",
  "Partner",
  "Investor",
  "Lender",
  "Borrower",
  "Other"
] as const;

export type PartyRelationshipType = typeof partyRelationshipTypes[number];

export const partyRelationships = pgTable("party_relationships", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  fromPartyId: varchar("from_party_id").notNull().references(() => parties.id, { onDelete: "cascade" }),
  toPartyId: varchar("to_party_id").notNull().references(() => parties.id, { onDelete: "cascade" }),
  relationshipType: text("relationship_type").notNull(), // Parent, Subsidiary, Guarantor, etc.
  notes: text("notes"),
});

export const insertPartyRelationshipSchema = createInsertSchema(partyRelationships).omit({ id: true });
export type InsertPartyRelationship = z.infer<typeof insertPartyRelationshipSchema>;
export type PartyRelationship = typeof partyRelationships.$inferSelect;

// Contact point types for due diligence
export const contactPointTypes = ["email", "phone"] as const;
export type ContactPointType = typeof contactPointTypes[number];

export const contactPointLabels = [
  "Work",
  "Mobile", 
  "Home",
  "Personal",
  "Fax",
  "Other"
] as const;
export type ContactPointLabel = typeof contactPointLabels[number];

// Contact Points table (emails and phone numbers)
export const contactPoints = pgTable("contact_points", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  ownerType: text("owner_type").notNull(), // "party" or "person"
  partyId: varchar("party_id").references(() => parties.id, { onDelete: "cascade" }),
  personId: varchar("person_id").references(() => persons.id, { onDelete: "cascade" }),
  type: text("type").notNull(), // "email" or "phone"
  value: text("value").notNull(),
  label: text("label").notNull().default("Work"), // Work, Mobile, Home, Personal, Fax, Other
  isPrimary: boolean("is_primary").notNull().default(false),
  isVerified: boolean("is_verified").notNull().default(false),
  notes: text("notes"),
});

export const insertContactPointSchema = createInsertSchema(contactPoints).omit({ id: true });
export type InsertContactPoint = z.infer<typeof insertContactPointSchema>;
export type ContactPoint = typeof contactPoints.$inferSelect;

// Address labels for due diligence
export const addressLabels = [
  "Primary",
  "Mailing",
  "Business",
  "Registered",
  "Previous",
  "Alternate",
  "Other"
] as const;
export type AddressLabel = typeof addressLabels[number];

// Addresses table (known addresses for due diligence)
export const addresses = pgTable("addresses", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  ownerType: text("owner_type").notNull(), // "party" or "person"
  partyId: varchar("party_id").references(() => parties.id, { onDelete: "cascade" }),
  personId: varchar("person_id").references(() => persons.id, { onDelete: "cascade" }),
  label: text("label").notNull().default("Primary"), // Primary, Mailing, Business, Registered, Previous, Alternate, Other
  street1: text("street1").notNull(),
  street2: text("street2"),
  city: text("city").notNull(),
  state: text("state"),
  postalCode: text("postal_code"),
  country: text("country").notNull().default("USA"),
  isPrimary: boolean("is_primary").notNull().default(false),
  isVerified: boolean("is_verified").notNull().default(false),
  notes: text("notes"),
});

export const insertAddressSchema = createInsertSchema(addresses).omit({ id: true });
export type InsertAddress = z.infer<typeof insertAddressSchema>;
export type Address = typeof addresses.$inferSelect;

// ==================== ENGAGEMENT SYSTEM ====================

// Engagement status enum
export const engagementStatuses = [
  "Active",
  "OnHold",
  "Closed",
  "Archived"
] as const;
export type EngagementStatus = typeof engagementStatuses[number];

// Engagement types
export const engagementTypes = [
  "Contract",
  "Loan",
  "JointVenture",
  "VendorAgreement",
  "Dispute",
  "Collection",
  "Litigation",
  "Advisory",
  "Other"
] as const;
export type EngagementType = typeof engagementTypes[number];

// Engagements table - top-level workspace/matter/project
export const engagements = pgTable("engagements", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  description: text("description"),
  type: text("type").notNull().default("Contract"), // Contract, Loan, JV, Dispute, Collection, etc.
  status: text("status").notNull().default("Active"), // Active, OnHold, Closed, Archived
  referenceNumber: text("reference_number"), // Internal reference/matter number
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
  createdBy: varchar("created_by").references(() => users.id),
});

export const insertEngagementSchema = createInsertSchema(engagements).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertEngagement = z.infer<typeof insertEngagementSchema>;
export type Engagement = typeof engagements.$inferSelect;

// Engagement membership roles
export const engagementRoles = [
  "owner",           // Full control, can delete engagement
  "internal_admin",  // Full access except delete engagement
  "internal_user",   // View all, edit timeline/docs, no admin
  "external_partner", // Limited view - only sees what's shared
  "viewer",          // Read-only access
  "auditor"          // Read-only + export access
] as const;
export type EngagementRole = typeof engagementRoles[number];

// Engagement permissions (granular access control)
export const engagementPermissions = [
  "view_timeline",
  "edit_timeline",
  "upload_documents",
  "delete_documents",
  "view_financial_terms",
  "edit_financial_terms",
  "manage_members",
  "create_tasks",
  "export_evidence",
  "view_internal_notes"
] as const;
export type EngagementPermission = typeof engagementPermissions[number];

// Engagement memberships - who has access to each engagement
export const engagementMemberships = pgTable("engagement_memberships", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  engagementId: varchar("engagement_id").notNull().references(() => engagements.id, { onDelete: "cascade" }),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  role: text("role").notNull().default("viewer"), // owner, internal_admin, internal_user, external_partner, viewer, auditor
  permissions: text("permissions").array(), // Override permissions (if null, use role defaults)
  invitedBy: varchar("invited_by").references(() => users.id),
  invitedAt: timestamp("invited_at").notNull().defaultNow(),
  acceptedAt: timestamp("accepted_at"),
});

export const insertEngagementMembershipSchema = createInsertSchema(engagementMemberships).omit({ id: true, invitedAt: true, acceptedAt: true });
export type InsertEngagementMembership = z.infer<typeof insertEngagementMembershipSchema>;
export type EngagementMembership = typeof engagementMemberships.$inferSelect;

// Link parties to engagements (many-to-many)
export const engagementParties = pgTable("engagement_parties", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  engagementId: varchar("engagement_id").notNull().references(() => engagements.id, { onDelete: "cascade" }),
  partyId: varchar("party_id").notNull().references(() => parties.id, { onDelete: "cascade" }),
  roleInEngagement: text("role_in_engagement"), // Counterparty, Guarantor, Counsel, etc.
  addedAt: timestamp("added_at").notNull().defaultNow(),
});

export const insertEngagementPartySchema = createInsertSchema(engagementParties).omit({ id: true, addedAt: true });
export type InsertEngagementParty = z.infer<typeof insertEngagementPartySchema>;
export type EngagementParty = typeof engagementParties.$inferSelect;

// Link agreements to engagements (many-to-many)
export const engagementAgreements = pgTable("engagement_agreements", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  engagementId: varchar("engagement_id").notNull().references(() => engagements.id, { onDelete: "cascade" }),
  agreementId: varchar("agreement_id").notNull().references(() => agreements.id, { onDelete: "cascade" }),
  isPrimary: boolean("is_primary").notNull().default(false), // Is this the main agreement for this engagement?
  addedAt: timestamp("added_at").notNull().defaultNow(),
});

export const insertEngagementAgreementSchema = createInsertSchema(engagementAgreements).omit({ id: true, addedAt: true });
export type InsertEngagementAgreement = z.infer<typeof insertEngagementAgreementSchema>;
export type EngagementAgreement = typeof engagementAgreements.$inferSelect;

// Audit log for tracking important actions
export const auditLogs = pgTable("audit_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id),
  action: text("action").notNull(), // create, update, delete, export, invite, etc.
  entityType: text("entity_type").notNull(), // engagement, document, membership, etc.
  entityId: varchar("entity_id"),
  engagementId: varchar("engagement_id").references(() => engagements.id, { onDelete: "set null" }),
  metadata: text("metadata"), // JSON string with additional context
  ipAddress: text("ip_address"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertAuditLogSchema = createInsertSchema(auditLogs).omit({ id: true, createdAt: true });
export type InsertAuditLog = z.infer<typeof insertAuditLogSchema>;
export type AuditLog = typeof auditLogs.$inferSelect;

// ==================== TASK MANAGEMENT ====================

// Task priorities
export const taskPriorities = ["Low", "Medium", "High", "Urgent"] as const;
export type TaskPriority = typeof taskPriorities[number];

// Task statuses
export const taskStatuses = ["Open", "InProgress", "Completed", "Cancelled"] as const;
export type TaskStatus = typeof taskStatuses[number];

// Tasks table - action items within engagements
export const tasks = pgTable("tasks", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  engagementId: varchar("engagement_id").notNull().references(() => engagements.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  description: text("description"),
  priority: text("priority").notNull().default("Medium"), // Low, Medium, High, Urgent
  status: text("status").notNull().default("Open"), // Open, InProgress, Completed, Cancelled
  dueDate: text("due_date"), // ISO date string
  assigneeId: varchar("assignee_id").references(() => users.id, { onDelete: "set null" }),
  createdById: varchar("created_by_id").references(() => users.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  completedAt: timestamp("completed_at"),
});

export const insertTaskSchema = createInsertSchema(tasks).omit({ id: true, createdAt: true, completedAt: true });
export type InsertTask = z.infer<typeof insertTaskSchema>;
export type Task = typeof tasks.$inferSelect;

// ==================== AI GOVERNANCE ====================

// Governance policy scope types
export const governanceScopeTypes = ["GLOBAL", "CLIENT", "PROJECT", "ARTIFACT"] as const;
export type GovernanceScopeType = typeof governanceScopeTypes[number];

// Governance policy statuses
export const governancePolicyStatuses = ["DRAFT", "PUBLISHED", "ARCHIVED"] as const;
export type GovernancePolicyStatus = typeof governancePolicyStatuses[number];

// Actor types for AI actions
export const actorTypes = ["HUMAN", "AI", "HYBRID"] as const;
export type ActorType = typeof actorTypes[number];

// AI action decision types
export const aiDecisionTypes = ["ALLOW", "DENY"] as const;
export type AIDecisionType = typeof aiDecisionTypes[number];

// AI action types
export const aiActionTypes = [
  "AI_SUMMARIZE",
  "AI_REWRITE", 
  "AI_LEGAL_DRAFT",
  "AI_EXPORT",
  "AI_ANALYZE",
  "AI_ADVISOR"
] as const;
export type AIActionType = typeof aiActionTypes[number];

// Governance policies table
export const governancePolicies = pgTable("governance_policies", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  scopeType: text("scope_type").notNull(), // GLOBAL, CLIENT, PROJECT, ARTIFACT
  scopeId: varchar("scope_id"), // null only for GLOBAL
  version: integer("version").notNull().default(1),
  status: text("status").notNull().default("DRAFT"), // DRAFT, PUBLISHED, ARCHIVED
  policyJson: text("policy_json").notNull(), // JSON stringified policy object
  createdBy: varchar("created_by").references(() => users.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  publishedAt: timestamp("published_at"),
  hash: text("hash").notNull(), // sha256 hash of canonical JSON for audit
});

export const insertGovernancePolicySchema = createInsertSchema(governancePolicies).omit({ id: true, createdAt: true });
export type InsertGovernancePolicy = z.infer<typeof insertGovernancePolicySchema>;
export type GovernancePolicy = typeof governancePolicies.$inferSelect;

// AI Personas table
export const aiPersonas = pgTable("ai_personas", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  key: text("key").notNull().unique(), // e.g., DDIE, VAULT_SUMMARIZER
  name: text("name").notNull(),
  description: text("description"),
  capabilities: text("capabilities"), // JSON stringified capability set
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertAIPersonaSchema = createInsertSchema(aiPersonas).omit({ id: true, createdAt: true });
export type InsertAIPersona = z.infer<typeof insertAIPersonaSchema>;
export type AIPersona = typeof aiPersonas.$inferSelect;

// AI Actions Log table (append-only audit trail)
export const aiActionsLog = pgTable("ai_actions_log", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  clientId: varchar("client_id"), // party ID acting as client
  projectId: varchar("project_id"), // engagement ID acting as project
  artifactId: varchar("artifact_id"), // document ID
  actorType: text("actor_type").notNull(), // HUMAN, AI, HYBRID
  actorId: varchar("actor_id").references(() => users.id, { onDelete: "set null" }),
  personaId: varchar("persona_id").references(() => aiPersonas.id, { onDelete: "set null" }),
  actionType: text("action_type").notNull(), // AI_SUMMARIZE, AI_REWRITE, etc.
  requestContext: text("request_context"), // JSON stringified context
  decision: text("decision").notNull(), // ALLOW, DENY
  reasons: text("reasons"), // JSON stringified reasons array
  requiresSupervisor: boolean("requires_supervisor").notNull().default(false),
  supervisorActorId: varchar("supervisor_actor_id").references(() => users.id, { onDelete: "set null" }),
  supervisorDecisionId: varchar("supervisor_decision_id"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  hash: text("hash").notNull(), // sha256 over canonical log row
});

export const insertAIActionsLogSchema = createInsertSchema(aiActionsLog).omit({ id: true, createdAt: true });
export type InsertAIActionsLog = z.infer<typeof insertAIActionsLogSchema>;
export type AIActionsLog = typeof aiActionsLog.$inferSelect;

// Governance approvals table
export const governanceApprovals = pgTable("governance_approvals", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  aiActionsLogId: varchar("ai_actions_log_id").references(() => aiActionsLog.id, { onDelete: "cascade" }),
  requestedBy: varchar("requested_by").references(() => users.id, { onDelete: "set null" }),
  status: text("status").notNull().default("PENDING"), // PENDING, APPROVED, REJECTED
  reviewedBy: varchar("reviewed_by").references(() => users.id, { onDelete: "set null" }),
  reviewedAt: timestamp("reviewed_at"),
  notes: text("notes"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertGovernanceApprovalSchema = createInsertSchema(governanceApprovals).omit({ id: true, createdAt: true });
export type InsertGovernanceApproval = z.infer<typeof insertGovernanceApprovalSchema>;
export type GovernanceApproval = typeof governanceApprovals.$inferSelect;

// ==================== ENFORCEMENT ENGINE ====================

// Enforcement case statuses (lifecycle)
export const enforcementStatuses = [
  "monitoring",
  "notice_phase",
  "default_declared",
  "estoppel_established",
  "litigation_ready",
  "resolved"
] as const;
export type EnforcementStatus = typeof enforcementStatuses[number];

// Notice tier levels (mandatory sequence)
export const noticeTiers = [
  "tier1_administrative",    // Administrative Notice of Record
  "tier2_opportunity",       // Notice of Opportunity to Cure
  "tier3_default",          // Notice of Default & Demand
  "tier4_estoppel"          // Notice of Estoppel & Administrative Determination
] as const;
export type NoticeTier = typeof noticeTiers[number];

// Notice status
export const noticeStatuses = [
  "draft",
  "pending_notarization",
  "notarized",
  "sent",
  "delivered",
  "deadline_active",
  "deadline_expired",
  "superseded"
] as const;
export type NoticeStatus = typeof noticeStatuses[number];

// Delivery methods
export const deliveryMethods = [
  "certified_mail",
  "registered_mail",
  "email",
  "courier",
  "personal_service",
  "publication"
] as const;
export type DeliveryMethod = typeof deliveryMethods[number];

// Response classification
export const responseClassifications = [
  "admission",
  "partial_performance",
  "objection",
  "unsupported_denial",
  "cure_proposal",
  "silence"
] as const;
export type ResponseClassification = typeof responseClassifications[number];

// Response sufficiency determination
export const responseSufficiencyTypes = [
  "sufficient",
  "insufficient",
  "non_responsive",
  "pending_review"
] as const;
export type ResponseSufficiency = typeof responseSufficiencyTypes[number];

// Enforcement Cases table
export const enforcementCases = pgTable("enforcement_cases", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  engagementId: varchar("engagement_id").references(() => engagements.id, { onDelete: "cascade" }),
  agreementId: varchar("agreement_id").references(() => agreements.id, { onDelete: "cascade" }),
  counterpartyId: varchar("counterparty_id").references(() => parties.id, { onDelete: "set null" }),
  caseNumber: text("case_number").notNull(), // Internal reference number
  governingLaw: text("governing_law").notNull(), // State law
  venue: text("venue").notNull(), // County/Court
  status: text("status").notNull().default("monitoring"),
  currentNoticeTier: text("current_notice_tier"), // Current notice tier in ladder
  cureDeadlineDate: text("cure_deadline_date"),
  finalDefaultDate: text("final_default_date"),
  evidenceLock: boolean("evidence_lock").notNull().default(false),
  createdById: varchar("created_by_id").references(() => users.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
  notes: text("notes"),
});

export const insertEnforcementCaseSchema = createInsertSchema(enforcementCases).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertEnforcementCase = z.infer<typeof insertEnforcementCaseSchema>;
export type EnforcementCase = typeof enforcementCases.$inferSelect;

// Enforcement Notices table (the notice ladder)
export const enforcementNotices = pgTable("enforcement_notices", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  caseId: varchar("case_id").notNull().references(() => enforcementCases.id, { onDelete: "cascade" }),
  tier: text("tier").notNull(), // tier1_administrative, tier2_opportunity, etc.
  status: text("status").notNull().default("draft"),
  title: text("title").notNull(),
  content: text("content"), // Notice body text
  // Notarization fields
  notaryName: text("notary_name"),
  notaryCommission: text("notary_commission"),
  notaryJurisdiction: text("notary_jurisdiction"),
  notaryExpiration: text("notary_expiration"),
  notarizedAt: timestamp("notarized_at"),
  // Delivery fields
  deliveryMethod: text("delivery_method"),
  deliverySentAt: timestamp("delivery_sent_at"),
  deliveryConfirmedAt: timestamp("delivery_confirmed_at"),
  trackingNumber: text("tracking_number"),
  recipientAddress: text("recipient_address"),
  // Deadline fields
  responseDeadlineDays: integer("response_deadline_days").default(15),
  responseDeadlineDate: text("response_deadline_date"),
  // Document hash for immutability
  documentHash: text("document_hash"), // SHA-256
  documentPath: text("document_path"), // S3 or local path
  isLocked: boolean("is_locked").notNull().default(false),
  createdById: varchar("created_by_id").references(() => users.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertEnforcementNoticeSchema = createInsertSchema(enforcementNotices).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertEnforcementNotice = z.infer<typeof insertEnforcementNoticeSchema>;
export type EnforcementNotice = typeof enforcementNotices.$inferSelect;

// Enforcement Supporting Documents (evidence)
export const enforcementDocuments = pgTable("enforcement_documents", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  caseId: varchar("case_id").notNull().references(() => enforcementCases.id, { onDelete: "cascade" }),
  noticeId: varchar("notice_id").references(() => enforcementNotices.id, { onDelete: "set null" }),
  name: text("name").notNull(),
  type: text("type").notNull(), // PDF, Image, Receipt, etc.
  category: text("category").notNull(), // proof_of_delivery, notary_stamp, contract_copy, etc.
  filePath: text("file_path").notNull(),
  fileHash: text("file_hash").notNull(), // SHA-256 for integrity
  isLocked: boolean("is_locked").notNull().default(false),
  lockedAt: timestamp("locked_at"),
  uploadedById: varchar("uploaded_by_id").references(() => users.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  notes: text("notes"),
});

export const insertEnforcementDocumentSchema = createInsertSchema(enforcementDocuments).omit({ id: true, createdAt: true });
export type InsertEnforcementDocument = z.infer<typeof insertEnforcementDocumentSchema>;
export type EnforcementDocument = typeof enforcementDocuments.$inferSelect;

// Counterparty Responses
export const enforcementResponses = pgTable("enforcement_responses", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  caseId: varchar("case_id").notNull().references(() => enforcementCases.id, { onDelete: "cascade" }),
  noticeId: varchar("notice_id").references(() => enforcementNotices.id, { onDelete: "set null" }),
  receivedAt: timestamp("received_at").notNull(),
  receivedVia: text("received_via").notNull(), // email, mail, phone, in_person
  classification: text("classification"), // admin classification
  sufficiency: text("sufficiency").default("pending_review"),
  summary: text("summary"),
  fullContent: text("full_content"),
  documentPath: text("document_path"), // Attached response document
  documentHash: text("document_hash"),
  classifiedById: varchar("classified_by_id").references(() => users.id, { onDelete: "set null" }),
  classifiedAt: timestamp("classified_at"),
  resetsDeadline: boolean("resets_deadline").notNull().default(false),
  createdById: varchar("created_by_id").references(() => users.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertEnforcementResponseSchema = createInsertSchema(enforcementResponses).omit({ id: true, createdAt: true });
export type InsertEnforcementResponse = z.infer<typeof insertEnforcementResponseSchema>;
export type EnforcementResponse = typeof enforcementResponses.$inferSelect;

// Enforcement Timeline Events (separate from main activities for audit purity)
export const enforcementTimelineEventTypes = [
  "case_created",
  "notice_drafted",
  "notice_notarized",
  "notice_sent",
  "delivery_confirmed",
  "deadline_started",
  "deadline_expired",
  "response_received",
  "response_classified",
  "default_declared",
  "estoppel_established",
  "evidence_locked",
  "status_changed",
  "admin_note"
] as const;
export type EnforcementTimelineEventType = typeof enforcementTimelineEventTypes[number];

export const enforcementTimeline = pgTable("enforcement_timeline", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  caseId: varchar("case_id").notNull().references(() => enforcementCases.id, { onDelete: "cascade" }),
  noticeId: varchar("notice_id").references(() => enforcementNotices.id, { onDelete: "set null" }),
  eventType: text("event_type").notNull(),
  occurredAt: timestamp("occurred_at").notNull().defaultNow(),
  description: text("description").notNull(),
  // Proof fields
  sentVia: text("sent_via"),
  proofOfDelivery: text("proof_of_delivery"), // Reference to document
  notaryReference: text("notary_reference"),
  // Response tracking
  counterpartyResponseId: varchar("counterparty_response_id").references(() => enforcementResponses.id, { onDelete: "set null" }),
  counterpartyResponseStatus: text("counterparty_response_status"), // received, absent, insufficient
  // Metadata
  metadata: text("metadata"), // JSON for additional structured data
  createdById: varchar("created_by_id").references(() => users.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertEnforcementTimelineSchema = createInsertSchema(enforcementTimeline).omit({ id: true, createdAt: true });
export type InsertEnforcementTimeline = z.infer<typeof insertEnforcementTimelineSchema>;
export type EnforcementTimeline = typeof enforcementTimeline.$inferSelect;

// Enforcement document categories for evidence classification
export const enforcementDocumentCategories = [
  "original_contract",
  "proof_of_delivery",
  "notary_stamp",
  "mailing_receipt",
  "email_confirmation",
  "courier_receipt",
  "response_document",
  "payment_ledger",
  "performance_log",
  "correspondence",
  "court_filing",
  "other"
] as const;
export type EnforcementDocumentCategory = typeof enforcementDocumentCategories[number];
