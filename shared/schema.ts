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

// Activities table
export const activities = pgTable("activities", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  agreementId: varchar("agreement_id").references(() => agreements.id, { onDelete: "cascade" }),
  partyId: varchar("party_id").references(() => parties.id, { onDelete: "cascade" }),
  type: text("type").notNull(), // Call, Email, LetterSent, InternalNote, Meeting, CourtFiling
  content: text("content").notNull(),
  date: text("date").notNull(),
  user: text("user").notNull(),
  imageUrl: text("image_url"), // Optional attached screenshot/image path
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
  name: text("name").notNull(),
  type: text("type").notNull(), // PDF, DOCX, Image
  category: text("category").notNull().default("Other"), // Document category
  dateUploaded: text("date_uploaded").notNull(),
  expirationDate: text("expiration_date"), // For documents that expire (licenses, insurance, etc.)
  notes: text("notes"), // Additional notes about the document
  filePath: text("file_path"), // Path to stored file
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
