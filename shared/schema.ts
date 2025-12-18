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
  "StatusChanged",
  "EngagementCreated"
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
