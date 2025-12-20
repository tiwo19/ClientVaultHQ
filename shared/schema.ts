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
  "notice_generated",
  "notice_notarized",
  "notice_sent",
  "delivery_confirmed",
  "delivery_attempted",
  "delivery_returned",
  "deadline_started",
  "deadline_expired",
  "response_received",
  "response_classified",
  "default_declared",
  "estoppel_established",
  "affidavit_generated",
  "affidavit_notarized",
  "export_requested",
  "export_completed",
  "evidence_locked",
  "status_changed",
  "admin_override",
  "admin_note",
  "FraudAssessmentInitiated",
  "FraudFindingActivated",
  "FraudFindingDeactivated",
  "FraudScoreRecalculated",
  "ReferralPacketGenerated"
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

// Affidavit types
export const affidavitTypes = [
  "administrative_notice",
  "non_response",
  "estoppel_silence",
  "delivery_proof",
  "record_custodian"
] as const;
export type AffidavitType = typeof affidavitTypes[number];

// Affidavit statuses
export const affidavitStatuses = [
  "drafted",
  "notarized",
  "filed_ready"
] as const;
export type AffidavitStatus = typeof affidavitStatuses[number];

// Enforcement Affidavits table
export const enforcementAffidavits = pgTable("enforcement_affidavits", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  caseId: varchar("case_id").notNull().references(() => enforcementCases.id, { onDelete: "cascade" }),
  affidavitType: text("affidavit_type").notNull(), // administrative_notice, non_response, etc.
  version: integer("version").notNull().default(1),
  title: text("title").notNull(),
  // AI Generation fields
  aiModel: text("ai_model"),
  aiPromptVersion: text("ai_prompt_version"),
  aiInputSnapshot: text("ai_input_snapshot"), // JSON of the exact inputs used
  aiOutputText: text("ai_output_text"), // The generated sworn paragraphs
  // Rendered document
  renderedPdfPath: text("rendered_pdf_path"),
  renderedPdfHash: text("rendered_pdf_hash"),
  // Notarization
  notarizedPdfPath: text("notarized_pdf_path"),
  notarizedPdfHash: text("notarized_pdf_hash"),
  notarizedAt: timestamp("notarized_at"),
  notaryName: text("notary_name"),
  notaryCommission: text("notary_commission"),
  notaryJurisdiction: text("notary_jurisdiction"),
  notaryExpiration: text("notary_expiration"),
  // Status
  status: text("status").notNull().default("drafted"),
  isLocked: boolean("is_locked").notNull().default(false),
  lockedAt: timestamp("locked_at"),
  generatedById: varchar("generated_by_id").references(() => users.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertEnforcementAffidavitSchema = createInsertSchema(enforcementAffidavits).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertEnforcementAffidavit = z.infer<typeof insertEnforcementAffidavitSchema>;
export type EnforcementAffidavit = typeof enforcementAffidavits.$inferSelect;

// Delivery proof statuses
export const deliveryProofStatuses = [
  "sent",
  "in_transit",
  "delivered",
  "attempted",
  "returned",
  "unknown"
] as const;
export type DeliveryProofStatus = typeof deliveryProofStatuses[number];

// Enforcement Delivery Proofs table (detailed delivery tracking)
export const enforcementDeliveryProofs = pgTable("enforcement_delivery_proofs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  noticeId: varchar("notice_id").notNull().references(() => enforcementNotices.id, { onDelete: "cascade" }),
  method: text("method").notNull(), // certified_mail, email, courier, personal_service
  trackingNumber: text("tracking_number"),
  sentToAddress: text("sent_to_address"),
  sentToEmail: text("sent_to_email"),
  sentAt: timestamp("sent_at").notNull(),
  deliveryStatus: text("delivery_status").notNull().default("sent"),
  deliveredAt: timestamp("delivered_at"),
  // Proof document
  proofDocumentPath: text("proof_document_path"),
  proofDocumentHash: text("proof_document_hash"),
  proofDocumentName: text("proof_document_name"),
  // Metadata
  carrierName: text("carrier_name"),
  signedBy: text("signed_by"),
  attemptCount: integer("attempt_count").default(1),
  notes: text("notes"),
  uploadedById: varchar("uploaded_by_id").references(() => users.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertEnforcementDeliveryProofSchema = createInsertSchema(enforcementDeliveryProofs).omit({ id: true, createdAt: true });
export type InsertEnforcementDeliveryProof = z.infer<typeof insertEnforcementDeliveryProofSchema>;
export type EnforcementDeliveryProof = typeof enforcementDeliveryProofs.$inferSelect;

// Export statuses
export const exportStatuses = [
  "queued",
  "generating",
  "complete",
  "failed"
] as const;
export type ExportStatus = typeof exportStatuses[number];

// Evidence Exports table
export const evidenceExports = pgTable("evidence_exports", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  caseId: varchar("case_id").notNull().references(() => enforcementCases.id, { onDelete: "cascade" }),
  exportType: text("export_type").notNull().default("full"), // full, small_claims, circuit_court
  status: text("status").notNull().default("queued"),
  // Export artifacts
  pdfChronologyPath: text("pdf_chronology_path"),
  pdfChronologyHash: text("pdf_chronology_hash"),
  csvTimelinePath: text("csv_timeline_path"),
  csvTimelineHash: text("csv_timeline_hash"),
  zipBundlePath: text("zip_bundle_path"),
  zipBundleHash: text("zip_bundle_hash"),
  // Manifest with all file hashes
  manifestJson: text("manifest_json"),
  // Metadata
  totalDocuments: integer("total_documents").default(0),
  totalSizeBytes: integer("total_size_bytes").default(0),
  errorMessage: text("error_message"),
  requestedById: varchar("requested_by_id").references(() => users.id, { onDelete: "set null" }),
  completedAt: timestamp("completed_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertEvidenceExportSchema = createInsertSchema(evidenceExports).omit({ id: true, createdAt: true });
export type InsertEvidenceExport = z.infer<typeof insertEvidenceExportSchema>;
export type EvidenceExport = typeof evidenceExports.$inferSelect;

// Court path types
export const courtPathTypes = [
  "small_claims",
  "circuit_court",
  "collections",
  "lien_filing",
  "judgment_enforcement"
] as const;
export type CourtPathType = typeof courtPathTypes[number];

// AI Notice types for generation
export const aiNoticeTypes = [
  "notice_record",
  "notice_cure",
  "notice_default",
  "notice_estoppel",
  "affidavit_silence"
] as const;
export type AINoticeType = typeof aiNoticeTypes[number];

// ==========================================
// FRAUD & CRIMINAL INDICATORS ENGINE
// ==========================================

// Fraud indicator categories
export const fraudIndicatorCategories = [
  "identity",
  "misrepresentation",
  "funds_flow",
  "communications",
  "insurance",
  "regulatory",
  "pattern"
] as const;
export type FraudIndicatorCategory = typeof fraudIndicatorCategories[number];

// Fraud Indicators catalog (system-wide reference)
export const fraudIndicators = pgTable("fraud_indicators", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  code: text("code").notNull().unique(), // e.g., MISREP_INDUCEMENT, WIRE_REDIRECT
  category: text("category").notNull(), // identity, misrepresentation, funds_flow, etc.
  description: text("description").notNull(),
  severityWeight: integer("severity_weight").notNull().default(1),
  requiredEvidenceTypes: text("required_evidence_types"), // JSON array of evidence types
});

export const insertFraudIndicatorSchema = createInsertSchema(fraudIndicators).omit({ id: true });
export type InsertFraudIndicator = z.infer<typeof insertFraudIndicatorSchema>;
export type FraudIndicator = typeof fraudIndicators.$inferSelect;

// Fraud assessment statuses
export const fraudAssessmentStatuses = [
  "draft",
  "active",
  "escalated",
  "closed"
] as const;
export type FraudAssessmentStatus = typeof fraudAssessmentStatuses[number];

// Fraud threshold levels
export const fraudThresholdLevels = [
  "none",
  "watch",
  "elevated",
  "referral_ready"
] as const;
export type FraudThresholdLevel = typeof fraudThresholdLevels[number];

// Fraud Assessments (per enforcement case, versioned)
export const fraudAssessments = pgTable("fraud_assessments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  enforcementCaseId: varchar("enforcement_case_id").notNull().references(() => enforcementCases.id, { onDelete: "cascade" }),
  version: integer("version").notNull().default(1),
  status: text("status").notNull().default("draft"), // draft, active, escalated, closed
  scoreTotal: integer("score_total").notNull().default(0),
  thresholdLevel: text("threshold_level").notNull().default("none"), // none, watch, elevated, referral_ready
  createdByUserId: varchar("created_by_user_id").references(() => users.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertFraudAssessmentSchema = createInsertSchema(fraudAssessments).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertFraudAssessment = z.infer<typeof insertFraudAssessmentSchema>;
export type FraudAssessment = typeof fraudAssessments.$inferSelect;

// Fraud finding confidence levels
export const fraudFindingConfidenceLevels = [
  "low",
  "medium",
  "high"
] as const;
export type FraudFindingConfidence = typeof fraudFindingConfidenceLevels[number];

// Fraud Findings (case-specific findings)
export const fraudFindings = pgTable("fraud_findings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  fraudAssessmentId: varchar("fraud_assessment_id").notNull().references(() => fraudAssessments.id, { onDelete: "cascade" }),
  fraudIndicatorId: varchar("fraud_indicator_id").notNull().references(() => fraudIndicators.id, { onDelete: "cascade" }),
  confidence: text("confidence").notNull().default("low"), // low, medium, high
  summary: text("summary"),
  observedFacts: text("observed_facts"), // JSON array of bullet facts
  openQuestions: text("open_questions"), // JSON array of questions
  evidenceLinks: text("evidence_links"), // JSON array of {type, id}
  active: boolean("active").notNull().default(false),
  createdByUserId: varchar("created_by_user_id").references(() => users.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertFraudFindingSchema = createInsertSchema(fraudFindings).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertFraudFinding = z.infer<typeof insertFraudFindingSchema>;
export type FraudFinding = typeof fraudFindings.$inferSelect;

// Referral packet statuses
export const referralPacketStatuses = [
  "queued",
  "generating",
  "complete",
  "failed"
] as const;
export type ReferralPacketStatus = typeof referralPacketStatuses[number];

// Referral Packets
export const referralPackets = pgTable("referral_packets", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  enforcementCaseId: varchar("enforcement_case_id").notNull().references(() => enforcementCases.id, { onDelete: "cascade" }),
  fraudAssessmentId: varchar("fraud_assessment_id").references(() => fraudAssessments.id, { onDelete: "set null" }),
  status: text("status").notNull().default("queued"), // queued, generating, complete, failed
  packetPdfDocId: varchar("packet_pdf_doc_id").references(() => enforcementDocuments.id, { onDelete: "set null" }),
  packetZipDocId: varchar("packet_zip_doc_id").references(() => enforcementDocuments.id, { onDelete: "set null" }),
  manifestJson: text("manifest_json"), // JSON with hashes + exhibit index
  createdByUserId: varchar("created_by_user_id").references(() => users.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertReferralPacketSchema = createInsertSchema(referralPackets).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertReferralPacket = z.infer<typeof insertReferralPacketSchema>;
export type ReferralPacket = typeof referralPackets.$inferSelect;

// Entity graph relationship types (for pattern detection)
export const entityRelationshipTypes = [
  "shared_email",
  "shared_phone",
  "shared_domain",
  "shared_bank",
  "same_address",
  "same_signatory",
  "same_beneficiary",
  "corporate_affiliate"
] as const;
export type EntityRelationshipType = typeof entityRelationshipTypes[number];

// Entity types for graph
export const entityGraphTypes = [
  "party",
  "person",
  "email",
  "phone",
  "bank_account",
  "domain",
  "address"
] as const;
export type EntityGraphType = typeof entityGraphTypes[number];

// Entity Graph Edges (for pattern detection)
export const entityGraphEdges = pgTable("entity_graph_edges", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  entityTypeA: text("entity_type_a").notNull(), // party, person, email, phone, bank_account, domain
  entityIdA: varchar("entity_id_a").notNull(),
  entityTypeB: text("entity_type_b").notNull(),
  entityIdB: varchar("entity_id_b").notNull(),
  relationshipType: text("relationship_type").notNull(), // shared_email, shared_phone, etc.
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertEntityGraphEdgeSchema = createInsertSchema(entityGraphEdges).omit({ id: true, createdAt: true });
export type InsertEntityGraphEdge = z.infer<typeof insertEntityGraphEdgeSchema>;
export type EntityGraphEdge = typeof entityGraphEdges.$inferSelect;

// ==========================================
// PATTERN DETECTION LAYER (ENTITY GRAPH V2)
// ==========================================

// Expanded entity types for comprehensive pattern detection
export const patternEntityTypes = [
  "party",
  "person",
  "email",
  "phone",
  "address",
  "domain",
  "bank_account",
  "routing_number",
  "account_number",
  "wallet",
  "company_reg",
  "attorney_bar",
  "insurer_policy",
  "ip_address",
  "device_fingerprint"
] as const;
export type PatternEntityType = typeof patternEntityTypes[number];

// Entity link relationship types
export const entityLinkRelationshipTypes = [
  "belongs_to",
  "uses",
  "same_as",
  "shares_with",
  "paid_to",
  "paid_from",
  "signed_by",
  "represented_by",
  "contacted_via",
  "delivered_to",
  "insured_by",
  "hosted_on",
  "banked_with"
] as const;
export type EntityLinkRelationshipType = typeof entityLinkRelationshipTypes[number];

// Observation types
export const entityObservationTypes = [
  "extracted",
  "user_entered",
  "verified",
  "unverified",
  "disputed"
] as const;
export type EntityObservationType = typeof entityObservationTypes[number];

// Confidence levels
export const confidenceLevels = [
  "low",
  "medium",
  "high"
] as const;
export type ConfidenceLevel = typeof confidenceLevels[number];

// Source types for entity links and observations
export const entitySourceTypes = [
  "document",
  "timeline_event",
  "message",
  "call",
  "manual"
] as const;
export type EntitySourceType = typeof entitySourceTypes[number];

// Pattern cluster types
export const patternClusterTypes = [
  "shared_contact",
  "shared_bank",
  "shared_domain",
  "shared_address",
  "shared_identity",
  "multi_case_actor"
] as const;
export type PatternClusterType = typeof patternClusterTypes[number];

// Case pattern hit severity levels
export const casePatternHitSeverities = [
  "watch",
  "elevated",
  "critical"
] as const;
export type CasePatternHitSeverity = typeof casePatternHitSeverities[number];

// Entities table - normalized entity values
export const patternEntities = pgTable("pattern_entities", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  entityType: text("entity_type").notNull(),
  normalizedValue: text("normalized_value").notNull(),
  displayValue: text("display_value").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertPatternEntitySchema = createInsertSchema(patternEntities).omit({ id: true, createdAt: true });
export type InsertPatternEntity = z.infer<typeof insertPatternEntitySchema>;
export type PatternEntity = typeof patternEntities.$inferSelect;

// Entity Links table - relationships between entities
export const entityLinks = pgTable("entity_links", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  entityIdA: varchar("entity_id_a").notNull().references(() => patternEntities.id, { onDelete: "cascade" }),
  entityIdB: varchar("entity_id_b").notNull().references(() => patternEntities.id, { onDelete: "cascade" }),
  relationshipType: text("relationship_type").notNull(),
  sourceType: text("source_type").notNull(),
  sourceId: text("source_id"),
  confidence: text("confidence").notNull().default("medium"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertEntityLinkSchema = createInsertSchema(entityLinks).omit({ id: true, createdAt: true });
export type InsertEntityLink = z.infer<typeof insertEntityLinkSchema>;
export type EntityLink = typeof entityLinks.$inferSelect;

// Entity Observations table - observations about entities
export const entityObservations = pgTable("entity_observations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  entityId: varchar("entity_id").notNull().references(() => patternEntities.id, { onDelete: "cascade" }),
  observationType: text("observation_type").notNull(),
  sourceType: text("source_type").notNull(),
  sourceId: text("source_id"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertEntityObservationSchema = createInsertSchema(entityObservations).omit({ id: true, createdAt: true });
export type InsertEntityObservation = z.infer<typeof insertEntityObservationSchema>;
export type EntityObservation = typeof entityObservations.$inferSelect;

// Pattern Clusters table - groups of related entities across cases
export const patternClusters = pgTable("pattern_clusters", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  clusterKey: text("cluster_key").notNull(), // Hash for deduplication
  clusterType: text("cluster_type").notNull(),
  score: integer("score").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertPatternClusterSchema = createInsertSchema(patternClusters).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertPatternCluster = z.infer<typeof insertPatternClusterSchema>;
export type PatternCluster = typeof patternClusters.$inferSelect;

// Pattern Cluster Members table - entities in a cluster
export const patternClusterMembers = pgTable("pattern_cluster_members", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  clusterId: varchar("cluster_id").notNull().references(() => patternClusters.id, { onDelete: "cascade" }),
  entityId: varchar("entity_id").notNull().references(() => patternEntities.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertPatternClusterMemberSchema = createInsertSchema(patternClusterMembers).omit({ id: true, createdAt: true });
export type InsertPatternClusterMember = z.infer<typeof insertPatternClusterMemberSchema>;
export type PatternClusterMember = typeof patternClusterMembers.$inferSelect;

// Case Pattern Hits table - pattern alerts per enforcement case
export const casePatternHits = pgTable("case_pattern_hits", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  enforcementCaseId: varchar("enforcement_case_id").notNull().references(() => enforcementCases.id, { onDelete: "cascade" }),
  clusterId: varchar("cluster_id").notNull().references(() => patternClusters.id, { onDelete: "cascade" }),
  severity: text("severity").notNull().default("watch"),
  summary: text("summary"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertCasePatternHitSchema = createInsertSchema(casePatternHits).omit({ id: true, createdAt: true });
export type InsertCasePatternHit = z.infer<typeof insertCasePatternHitSchema>;
export type CasePatternHit = typeof casePatternHits.$inferSelect;

// ==========================================
// MISSING INFORMATION ENFORCEMENT (DEFICIENCY ENGINE)
// ==========================================

// Artifact applies-to categories
export const artifactAppliesToTypes = [
  "enforcement_case",
  "agreement",
  "party_role",
  "attorney_role"
] as const;
export type ArtifactAppliesToType = typeof artifactAppliesToTypes[number];

// Required Artifact Rules catalog
export const requiredArtifactRules = pgTable("required_artifact_rules", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  ruleCode: text("rule_code").notNull().unique(), // WIRE_RECEIPT, BANK_STATEMENT, etc.
  appliesTo: text("applies_to").notNull(), // enforcement_case, agreement, party_role, attorney_role
  description: text("description").notNull(),
  required: boolean("required").notNull().default(true),
  defaultDeadlineDays: integer("default_deadline_days").notNull().default(14),
  letterSectionTitle: text("letter_section_title"),
});

export const insertRequiredArtifactRuleSchema = createInsertSchema(requiredArtifactRules).omit({ id: true });
export type InsertRequiredArtifactRule = z.infer<typeof insertRequiredArtifactRuleSchema>;
export type RequiredArtifactRule = typeof requiredArtifactRules.$inferSelect;

// Case artifact requirement statuses
export const caseArtifactStatuses = [
  "required",
  "received",
  "waived",
  "not_applicable"
] as const;
export type CaseArtifactStatus = typeof caseArtifactStatuses[number];

// Case Artifact Requirements - per-case tracking
export const caseArtifactRequirements = pgTable("case_artifact_requirements", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  enforcementCaseId: varchar("enforcement_case_id").notNull().references(() => enforcementCases.id, { onDelete: "cascade" }),
  ruleId: varchar("rule_id").notNull().references(() => requiredArtifactRules.id, { onDelete: "cascade" }),
  status: text("status").notNull().default("required"),
  dueAt: timestamp("due_at"),
  satisfiedByDocId: varchar("satisfied_by_doc_id").references(() => enforcementDocuments.id, { onDelete: "set null" }),
  notes: text("notes"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertCaseArtifactRequirementSchema = createInsertSchema(caseArtifactRequirements).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertCaseArtifactRequirement = z.infer<typeof insertCaseArtifactRequirementSchema>;
export type CaseArtifactRequirement = typeof caseArtifactRequirements.$inferSelect;

// Deficiency letter types
export const deficiencyLetterTypes = [
  "missing_documents",
  "missing_party_info",
  "attorney_deficiency",
  "licensing_verification_request"
] as const;
export type DeficiencyLetterType = typeof deficiencyLetterTypes[number];

// Deficiency letter statuses
export const deficiencyLetterStatuses = [
  "drafted",
  "notarized",
  "sent",
  "deadline_expired",
  "cured"
] as const;
export type DeficiencyLetterStatus = typeof deficiencyLetterStatuses[number];

// Deficiency Letters table
export const deficiencyLetters = pgTable("deficiency_letters", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  enforcementCaseId: varchar("enforcement_case_id").notNull().references(() => enforcementCases.id, { onDelete: "cascade" }),
  letterType: text("letter_type").notNull(),
  version: integer("version").notNull().default(1),
  aiInputSnapshotJson: text("ai_input_snapshot_json"),
  aiOutputText: text("ai_output_text"),
  renderedPdfDocId: varchar("rendered_pdf_doc_id").references(() => enforcementDocuments.id, { onDelete: "set null" }),
  notarizedPdfDocId: varchar("notarized_pdf_doc_id").references(() => enforcementDocuments.id, { onDelete: "set null" }),
  responseDeadlineAt: timestamp("response_deadline_at"),
  status: text("status").notNull().default("drafted"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertDeficiencyLetterSchema = createInsertSchema(deficiencyLetters).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertDeficiencyLetter = z.infer<typeof insertDeficiencyLetterSchema>;
export type DeficiencyLetter = typeof deficiencyLetters.$inferSelect;

// ==========================================
// PARTY KYC/KYB COMPLIANCE
// ==========================================

// Compliance profile types
export const complianceProfileTypes = [
  "individual",
  "business"
] as const;
export type ComplianceProfileType = typeof complianceProfileTypes[number];

// Compliance profile statuses
export const complianceProfileStatuses = [
  "incomplete",
  "pending_review",
  "complete",
  "failed"
] as const;
export type ComplianceProfileStatus = typeof complianceProfileStatuses[number];

// Party Compliance Profiles table
export const partyComplianceProfiles = pgTable("party_compliance_profiles", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  partyId: varchar("party_id").notNull().references(() => parties.id, { onDelete: "cascade" }),
  profileType: text("profile_type").notNull(), // individual, business
  fieldsJson: text("fields_json"), // JSON blob of filled fields
  status: text("status").notNull().default("incomplete"),
  missingFieldsJson: text("missing_fields_json"), // JSON array of missing field names
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertPartyComplianceProfileSchema = createInsertSchema(partyComplianceProfiles).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertPartyComplianceProfile = z.infer<typeof insertPartyComplianceProfileSchema>;
export type PartyComplianceProfile = typeof partyComplianceProfiles.$inferSelect;

// Compliance request types
export const complianceRequestTypes = [
  "kyc_request",
  "kyb_request",
  "cis_update"
] as const;
export type ComplianceRequestType = typeof complianceRequestTypes[number];

// Compliance request statuses
export const complianceRequestStatuses = [
  "drafted",
  "sent",
  "satisfied",
  "expired"
] as const;
export type ComplianceRequestStatus = typeof complianceRequestStatuses[number];

// Party Compliance Requests table
export const partyComplianceRequests = pgTable("party_compliance_requests", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  partyId: varchar("party_id").notNull().references(() => parties.id, { onDelete: "cascade" }),
  enforcementCaseId: varchar("enforcement_case_id").references(() => enforcementCases.id, { onDelete: "set null" }),
  requestType: text("request_type").notNull(),
  deadlineAt: timestamp("deadline_at"),
  deficiencyLetterId: varchar("deficiency_letter_id").references(() => deficiencyLetters.id, { onDelete: "set null" }),
  status: text("status").notNull().default("drafted"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertPartyComplianceRequestSchema = createInsertSchema(partyComplianceRequests).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertPartyComplianceRequest = z.infer<typeof insertPartyComplianceRequestSchema>;
export type PartyComplianceRequest = typeof partyComplianceRequests.$inferSelect;

// ==========================================
// ATTORNEY / PAYMASTER ACCOUNTABILITY
// ==========================================

// Professional role types
export const professionalRoleTypes = [
  "attorney",
  "paymaster",
  "escrow_agent",
  "trustee",
  "broker",
  "agent"
] as const;
export type ProfessionalRoleType = typeof professionalRoleTypes[number];

// Professional role statuses
export const professionalRoleStatuses = [
  "active",
  "inactive",
  "unknown"
] as const;
export type ProfessionalRoleStatus = typeof professionalRoleStatuses[number];

// Professional Roles table
export const professionalRoles = pgTable("professional_roles", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  enforcementCaseId: varchar("enforcement_case_id").notNull().references(() => enforcementCases.id, { onDelete: "cascade" }),
  partyId: varchar("party_id").notNull().references(() => parties.id, { onDelete: "cascade" }),
  roleType: text("role_type").notNull(),
  licenseState: text("license_state"),
  licenseId: text("license_id"),
  contactJson: text("contact_json"), // JSON blob with name, firm, address, phone, email
  status: text("status").notNull().default("active"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertProfessionalRoleSchema = createInsertSchema(professionalRoles).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertProfessionalRole = z.infer<typeof insertProfessionalRoleSchema>;
export type ProfessionalRole = typeof professionalRoles.$inferSelect;

// Professional Deliverable Rules catalog
export const professionalDeliverableRules = pgTable("professional_deliverable_rules", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  roleType: text("role_type").notNull(),
  ruleCode: text("rule_code").notNull(), // ESCROW_LEDGER, DISBURSEMENT_RECEIPTS, etc.
  description: text("description").notNull(),
  defaultDeadlineDays: integer("default_deadline_days").notNull().default(14),
});

export const insertProfessionalDeliverableRuleSchema = createInsertSchema(professionalDeliverableRules).omit({ id: true });
export type InsertProfessionalDeliverableRule = z.infer<typeof insertProfessionalDeliverableRuleSchema>;
export type ProfessionalDeliverableRule = typeof professionalDeliverableRules.$inferSelect;

// Professional deliverable statuses
export const professionalDeliverableStatuses = [
  "required",
  "received",
  "waived",
  "not_applicable"
] as const;
export type ProfessionalDeliverableStatus = typeof professionalDeliverableStatuses[number];

// Professional Case Deliverables table
export const professionalCaseDeliverables = pgTable("professional_case_deliverables", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  professionalRoleId: varchar("professional_role_id").notNull().references(() => professionalRoles.id, { onDelete: "cascade" }),
  ruleId: varchar("rule_id").notNull().references(() => professionalDeliverableRules.id, { onDelete: "cascade" }),
  status: text("status").notNull().default("required"),
  dueAt: timestamp("due_at"),
  satisfiedByDocId: varchar("satisfied_by_doc_id").references(() => enforcementDocuments.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertProfessionalCaseDeliverableSchema = createInsertSchema(professionalCaseDeliverables).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertProfessionalCaseDeliverable = z.infer<typeof insertProfessionalCaseDeliverableSchema>;
export type ProfessionalCaseDeliverable = typeof professionalCaseDeliverables.$inferSelect;

// ==========================================
// LICENSURE FLAGS (INTERNAL ONLY)
// ==========================================

// Licensure concern categories
export const licensureConcernCategories = [
  "securities",
  "commodities",
  "broker",
  "investment_adviser",
  "insurance",
  "escrow",
  "other"
] as const;
export type LicensureConcernCategory = typeof licensureConcernCategories[number];

// Licensure flag statuses
export const licensureFlagStatuses = [
  "verify_needed",
  "verified",
  "unresolved"
] as const;
export type LicensureFlagStatus = typeof licensureFlagStatuses[number];

// Licensure Flags table (internal only)
export const licensureFlags = pgTable("licensure_flags", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  enforcementCaseId: varchar("enforcement_case_id").notNull().references(() => enforcementCases.id, { onDelete: "cascade" }),
  partyId: varchar("party_id").notNull().references(() => parties.id, { onDelete: "cascade" }),
  claimedRole: text("claimed_role").notNull(),
  concernCategory: text("concern_category").notNull(),
  evidenceLinks: text("evidence_links"), // JSON array of evidence references
  status: text("status").notNull().default("verify_needed"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertLicensureFlagSchema = createInsertSchema(licensureFlags).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertLicensureFlag = z.infer<typeof insertLicensureFlagSchema>;
export type LicensureFlag = typeof licensureFlags.$inferSelect;

// ==========================================
// CONTRADICTIONS ENGINE
// ==========================================

// Contradiction set statuses
export const contradictionSetStatuses = [
  "draft",
  "active",
  "escalated",
  "resolved",
  "dismissed"
] as const;
export type ContradictionSetStatus = typeof contradictionSetStatuses[number];

// Contradiction Sets table (per enforcement case)
export const contradictionSets = pgTable("contradiction_sets", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  enforcementCaseId: varchar("enforcement_case_id").notNull().references(() => enforcementCases.id, { onDelete: "cascade" }),
  status: text("status").notNull().default("draft"),
  scoreTotal: integer("score_total").notNull().default(0),
  createdByUserId: varchar("created_by_user_id").references(() => users.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertContradictionSetSchema = createInsertSchema(contradictionSets).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertContradictionSet = z.infer<typeof insertContradictionSetSchema>;
export type ContradictionSet = typeof contradictionSets.$inferSelect;

// Contradiction types
export const contradictionTypes = [
  "performance_commitment_vs_ledger",
  "delivery_promise_vs_missing_receipt",
  "escrow_claim_vs_no_statement",
  "insurance_backing_claim_vs_no_policy",
  "identity_role_claim_vs_corporate_record",
  "timeline_claim_vs_timestamped_message",
  "funds_destination_claim_vs_wire_receipt",
  "other"
] as const;
export type ContradictionType = typeof contradictionTypes[number];

// Contradiction item statuses
export const contradictionItemStatuses = [
  "candidate",
  "confirmed",
  "needs_more_evidence",
  "resolved",
  "dismissed"
] as const;
export type ContradictionItemStatus = typeof contradictionItemStatuses[number];

// Contradiction item severities
export const contradictionItemSeverities = [
  "minor",
  "material",
  "critical"
] as const;
export type ContradictionItemSeverity = typeof contradictionItemSeverities[number];

// Contradiction Items table
export const contradictionItems = pgTable("contradiction_items", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  contradictionSetId: varchar("contradiction_set_id").notNull().references(() => contradictionSets.id, { onDelete: "cascade" }),
  contradictionType: text("contradiction_type").notNull(),
  title: text("title").notNull(),
  explanation: text("explanation"), // Neutral, factual explanation
  confidence: text("confidence").notNull().default("low"),
  status: text("status").notNull().default("candidate"),
  severity: text("severity").notNull().default("minor"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertContradictionItemSchema = createInsertSchema(contradictionItems).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertContradictionItem = z.infer<typeof insertContradictionItemSchema>;
export type ContradictionItem = typeof contradictionItems.$inferSelect;

// Contradiction evidence sides
export const contradictionEvidenceSides = ["A", "B"] as const;
export type ContradictionEvidenceSide = typeof contradictionEvidenceSides[number];

// Contradiction evidence source types
export const contradictionEvidenceSourceTypes = [
  "document",
  "message",
  "call_transcript",
  "timeline_event",
  "delivery_proof",
  "ledger_entry"
] as const;
export type ContradictionEvidenceSourceType = typeof contradictionEvidenceSourceTypes[number];

// Contradiction Evidence Links table
export const contradictionEvidenceLinks = pgTable("contradiction_evidence_links", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  contradictionItemId: varchar("contradiction_item_id").notNull().references(() => contradictionItems.id, { onDelete: "cascade" }),
  side: text("side").notNull(), // A or B
  sourceType: text("source_type").notNull(),
  sourceId: text("source_id").notNull(),
  excerpt: text("excerpt"), // Short quote
  excerptStart: integer("excerpt_start"),
  excerptEnd: integer("excerpt_end"),
  occurredAt: timestamp("occurred_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertContradictionEvidenceLinkSchema = createInsertSchema(contradictionEvidenceLinks).omit({ id: true, createdAt: true });
export type InsertContradictionEvidenceLink = z.infer<typeof insertContradictionEvidenceLinkSchema>;
export type ContradictionEvidenceLink = typeof contradictionEvidenceLinks.$inferSelect;

// Required evidence types for contradiction questions
export const contradictionRequiredEvidenceTypes = [
  "document",
  "statement",
  "receipt",
  "ledger",
  "policy",
  "corporate_filing",
  "other"
] as const;
export type ContradictionRequiredEvidenceType = typeof contradictionRequiredEvidenceTypes[number];

// Contradiction question statuses
export const contradictionQuestionStatuses = [
  "open",
  "answered",
  "waived"
] as const;
export type ContradictionQuestionStatus = typeof contradictionQuestionStatuses[number];

// Contradiction Questions table
export const contradictionQuestions = pgTable("contradiction_questions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  contradictionItemId: varchar("contradiction_item_id").notNull().references(() => contradictionItems.id, { onDelete: "cascade" }),
  question: text("question").notNull(),
  requiredEvidenceType: text("required_evidence_type").notNull(),
  status: text("status").notNull().default("open"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertContradictionQuestionSchema = createInsertSchema(contradictionQuestions).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertContradictionQuestion = z.infer<typeof insertContradictionQuestionSchema>;
export type ContradictionQuestion = typeof contradictionQuestions.$inferSelect;

// Contradiction output types
export const contradictionOutputTypes = [
  "internal_memo",
  "clarification_request_letter"
] as const;
export type ContradictionOutputType = typeof contradictionOutputTypes[number];

// Contradiction output visibility
export const contradictionOutputVisibilities = [
  "internal_only",
  "shared"
] as const;
export type ContradictionOutputVisibility = typeof contradictionOutputVisibilities[number];

// Contradiction output statuses
export const contradictionOutputStatuses = [
  "drafted",
  "notarized",
  "sent",
  "closed"
] as const;
export type ContradictionOutputStatus = typeof contradictionOutputStatuses[number];

// Contradiction Outputs table
export const contradictionOutputs = pgTable("contradiction_outputs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  contradictionSetId: varchar("contradiction_set_id").notNull().references(() => contradictionSets.id, { onDelete: "cascade" }),
  outputType: text("output_type").notNull(),
  version: integer("version").notNull().default(1),
  aiInputSnapshotJson: text("ai_input_snapshot_json"),
  aiOutputText: text("ai_output_text"),
  renderedPdfDocId: varchar("rendered_pdf_doc_id").references(() => enforcementDocuments.id, { onDelete: "set null" }),
  notarizedPdfDocId: varchar("notarized_pdf_doc_id").references(() => enforcementDocuments.id, { onDelete: "set null" }),
  responseDeadlineAt: timestamp("response_deadline_at"),
  visibility: text("visibility").notNull().default("internal_only"),
  status: text("status").notNull().default("drafted"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertContradictionOutputSchema = createInsertSchema(contradictionOutputs).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertContradictionOutput = z.infer<typeof insertContradictionOutputSchema>;
export type ContradictionOutput = typeof contradictionOutputs.$inferSelect;

// Enhanced referral packet types
export const referralPacketTypes = [
  "state_ag",
  "regulator",
  "law_enforcement",
  "insurer_eo",
  "professional_conduct",
  "internal_counsel"
] as const;
export type ReferralPacketType = typeof referralPacketTypes[number];
