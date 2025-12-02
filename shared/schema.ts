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
});

export const insertUserSchema = createInsertSchema(users).omit({ id: true });
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

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
