import { db } from "@db";
import { 
  type User, type InsertUser,
  type Party, type InsertParty,
  type Person, type InsertPerson,
  type Agreement, type InsertAgreement,
  type Activity, type InsertActivity,
  type Document, type InsertDocument,
  type PartyRelationship, type InsertPartyRelationship,
  type CreditTransaction, type InsertCreditTransaction,
  type ContactPoint, type InsertContactPoint,
  type Address, type InsertAddress,
  type Engagement, type InsertEngagement,
  type EngagementMembership, type InsertEngagementMembership,
  type EngagementParty, type InsertEngagementParty,
  type EngagementAgreement, type InsertEngagementAgreement,
  type AuditLog, type InsertAuditLog,
  users, parties, persons, agreements, activities, documents, partyRelationships, creditTransactions,
  contactPoints, addresses, engagements, engagementMemberships, engagementParties, engagementAgreements, auditLogs
} from "@shared/schema";
import { eq, or, and, desc, sql, inArray } from "drizzle-orm";

export interface IStorage {
  // Users
  getUser(id: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  getAllUsers(): Promise<User[]>;
  deleteUser(id: string): Promise<void>;

  // Parties
  getAllParties(): Promise<Party[]>;
  getParty(id: string): Promise<Party | undefined>;
  createParty(party: InsertParty): Promise<Party>;
  updateParty(id: string, party: Partial<InsertParty>): Promise<Party | undefined>;
  deleteParty(id: string): Promise<void>;

  // Persons
  getAllPersons(): Promise<Person[]>;
  getPersonsByParty(partyId: string): Promise<Person[]>;
  createPerson(person: InsertPerson): Promise<Person>;

  // Agreements
  getAllAgreements(): Promise<Agreement[]>;
  getAgreement(id: string): Promise<Agreement | undefined>;
  createAgreement(agreement: InsertAgreement): Promise<Agreement>;
  updateAgreement(id: string, agreement: Partial<InsertAgreement>): Promise<Agreement | undefined>;
  deleteAgreement(id: string): Promise<void>;

  // Activities
  getAllActivities(): Promise<Activity[]>;
  getActivitiesByAgreement(agreementId: string): Promise<Activity[]>;
  createActivity(activity: InsertActivity): Promise<Activity>;
  deleteActivity(id: string): Promise<void>;

  // Documents
  getAllDocuments(): Promise<Document[]>;
  getDocumentsByAgreement(agreementId: string): Promise<Document[]>;
  createDocument(doc: InsertDocument): Promise<Document>;
  deleteDocument(id: string): Promise<void>;

  // Party Relationships
  getAllPartyRelationships(): Promise<PartyRelationship[]>;
  getPartyRelationshipsByParty(partyId: string): Promise<PartyRelationship[]>;
  createPartyRelationship(rel: InsertPartyRelationship): Promise<PartyRelationship>;
  deletePartyRelationship(id: string): Promise<void>;

  // Credits
  getUserCredits(userId: string): Promise<number>;
  addCredits(userId: string, amount: number, description: string, stripePaymentIntentId?: string): Promise<CreditTransaction>;
  deductCredits(userId: string, amount: number, description: string): Promise<CreditTransaction>;
  getCreditTransactions(userId: string): Promise<CreditTransaction[]>;
  updateUserStripeCustomerId(userId: string, stripeCustomerId: string): Promise<void>;

  // Contact Points
  getContactPointsByParty(partyId: string): Promise<ContactPoint[]>;
  getContactPointsByPerson(personId: string): Promise<ContactPoint[]>;
  createContactPoint(cp: InsertContactPoint): Promise<ContactPoint>;
  updateContactPoint(id: string, cp: Partial<InsertContactPoint>): Promise<ContactPoint | undefined>;
  deleteContactPoint(id: string): Promise<void>;

  // Addresses
  getAddressesByParty(partyId: string): Promise<Address[]>;
  getAddressesByPerson(personId: string): Promise<Address[]>;
  createAddress(addr: InsertAddress): Promise<Address>;
  updateAddress(id: string, addr: Partial<InsertAddress>): Promise<Address | undefined>;
  deleteAddress(id: string): Promise<void>;

  // Engagements
  getAllEngagements(): Promise<Engagement[]>;
  getEngagement(id: string): Promise<Engagement | undefined>;
  getEngagementsForUser(userId: string): Promise<Engagement[]>;
  createEngagement(engagement: InsertEngagement): Promise<Engagement>;
  updateEngagement(id: string, engagement: Partial<InsertEngagement>): Promise<Engagement | undefined>;
  deleteEngagement(id: string): Promise<void>;

  // Engagement Memberships
  getEngagementMemberships(engagementId: string): Promise<EngagementMembership[]>;
  getUserEngagementMembership(engagementId: string, userId: string): Promise<EngagementMembership | undefined>;
  createEngagementMembership(membership: InsertEngagementMembership): Promise<EngagementMembership>;
  updateEngagementMembership(id: string, membership: Partial<InsertEngagementMembership>): Promise<EngagementMembership | undefined>;
  deleteEngagementMembership(id: string): Promise<void>;

  // Engagement Parties (linking parties to engagements)
  getEngagementParties(engagementId: string): Promise<EngagementParty[]>;
  addPartyToEngagement(ep: InsertEngagementParty): Promise<EngagementParty>;
  removePartyFromEngagement(id: string): Promise<void>;

  // Engagement Agreements (linking agreements to engagements)
  getEngagementAgreements(engagementId: string): Promise<EngagementAgreement[]>;
  addAgreementToEngagement(ea: InsertEngagementAgreement): Promise<EngagementAgreement>;
  removeAgreementFromEngagement(id: string): Promise<void>;

  // Audit Logs
  createAuditLog(log: InsertAuditLog): Promise<AuditLog>;
  getAuditLogs(engagementId?: string): Promise<AuditLog[]>;
}

export class DbStorage implements IStorage {
  // Users
  async getUser(id: string): Promise<User | undefined> {
    const result = await db.select().from(users).where(eq(users.id, id));
    return result[0];
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const result = await db.select().from(users).where(eq(users.email, email));
    return result[0];
  }

  async createUser(user: InsertUser): Promise<User> {
    const result = await db.insert(users).values(user).returning();
    return result[0];
  }

  async getAllUsers(): Promise<User[]> {
    return await db.select().from(users);
  }

  async deleteUser(id: string): Promise<void> {
    await db.delete(users).where(eq(users.id, id));
  }

  // Parties
  async getAllParties(): Promise<Party[]> {
    return await db.select().from(parties);
  }

  async getParty(id: string): Promise<Party | undefined> {
    const result = await db.select().from(parties).where(eq(parties.id, id));
    return result[0];
  }

  async createParty(party: InsertParty): Promise<Party> {
    const result = await db.insert(parties).values(party).returning();
    return result[0];
  }

  async updateParty(id: string, party: Partial<InsertParty>): Promise<Party | undefined> {
    const result = await db.update(parties).set(party).where(eq(parties.id, id)).returning();
    return result[0];
  }

  async deleteParty(id: string): Promise<void> {
    await db.delete(parties).where(eq(parties.id, id));
  }

  // Persons
  async getAllPersons(): Promise<Person[]> {
    return await db.select().from(persons);
  }

  async getPersonsByParty(partyId: string): Promise<Person[]> {
    return await db.select().from(persons).where(eq(persons.partyId, partyId));
  }

  async createPerson(person: InsertPerson): Promise<Person> {
    const result = await db.insert(persons).values(person).returning();
    return result[0];
  }

  async deletePerson(id: string): Promise<void> {
    await db.delete(persons).where(eq(persons.id, id));
  }

  // Agreements
  async getAllAgreements(): Promise<Agreement[]> {
    return await db.select().from(agreements);
  }

  async getAgreement(id: string): Promise<Agreement | undefined> {
    const result = await db.select().from(agreements).where(eq(agreements.id, id));
    return result[0];
  }

  async createAgreement(agreement: InsertAgreement): Promise<Agreement> {
    const result = await db.insert(agreements).values(agreement).returning();
    return result[0];
  }

  async updateAgreement(id: string, agreement: Partial<InsertAgreement>): Promise<Agreement | undefined> {
    const result = await db.update(agreements).set(agreement).where(eq(agreements.id, id)).returning();
    return result[0];
  }

  async deleteAgreement(id: string): Promise<void> {
    await db.delete(agreements).where(eq(agreements.id, id));
  }

  // Activities
  async getAllActivities(): Promise<Activity[]> {
    return await db.select().from(activities);
  }

  async getActivitiesByAgreement(agreementId: string): Promise<Activity[]> {
    return await db.select().from(activities).where(eq(activities.agreementId, agreementId));
  }

  async createActivity(activity: InsertActivity): Promise<Activity> {
    const result = await db.insert(activities).values(activity).returning();
    return result[0];
  }

  async deleteActivity(id: string): Promise<void> {
    await db.delete(activities).where(eq(activities.id, id));
  }

  // Documents
  async getAllDocuments(): Promise<Document[]> {
    return await db.select().from(documents);
  }

  async getDocumentsByAgreement(agreementId: string): Promise<Document[]> {
    return await db.select().from(documents).where(eq(documents.agreementId, agreementId));
  }

  async createDocument(doc: InsertDocument): Promise<Document> {
    const docWithDate = {
      ...doc,
      dateUploaded: new Date().toISOString()
    };
    const result = await db.insert(documents).values(docWithDate).returning();
    return result[0];
  }

  async deleteDocument(id: string): Promise<void> {
    await db.delete(documents).where(eq(documents.id, id));
  }

  // Party Relationships
  async getAllPartyRelationships(): Promise<PartyRelationship[]> {
    return await db.select().from(partyRelationships);
  }

  async getPartyRelationshipsByParty(partyId: string): Promise<PartyRelationship[]> {
    return await db.select().from(partyRelationships).where(
      or(
        eq(partyRelationships.fromPartyId, partyId),
        eq(partyRelationships.toPartyId, partyId)
      )
    );
  }

  async createPartyRelationship(rel: InsertPartyRelationship): Promise<PartyRelationship> {
    const result = await db.insert(partyRelationships).values(rel).returning();
    return result[0];
  }

  async deletePartyRelationship(id: string): Promise<void> {
    await db.delete(partyRelationships).where(eq(partyRelationships.id, id));
  }

  // Credits
  async getUserCredits(userId: string): Promise<number> {
    const result = await db.select({ credits: users.credits }).from(users).where(eq(users.id, userId));
    return result[0]?.credits ?? 0;
  }

  async addCredits(userId: string, amount: number, description: string, stripePaymentIntentId?: string): Promise<CreditTransaction> {
    await db.update(users)
      .set({ credits: sql`${users.credits} + ${amount}` })
      .where(eq(users.id, userId));

    const transaction: InsertCreditTransaction = {
      userId,
      type: "purchase",
      amount,
      description,
      stripePaymentIntentId,
    };
    const result = await db.insert(creditTransactions).values(transaction).returning();
    return result[0];
  }

  async deductCredits(userId: string, amount: number, description: string): Promise<CreditTransaction> {
    await db.update(users)
      .set({ credits: sql`${users.credits} - ${amount}` })
      .where(eq(users.id, userId));

    const transaction: InsertCreditTransaction = {
      userId,
      type: "usage",
      amount: -amount,
      description,
    };
    const result = await db.insert(creditTransactions).values(transaction).returning();
    return result[0];
  }

  async getCreditTransactions(userId: string): Promise<CreditTransaction[]> {
    return await db.select()
      .from(creditTransactions)
      .where(eq(creditTransactions.userId, userId))
      .orderBy(desc(creditTransactions.createdAt));
  }

  async updateUserStripeCustomerId(userId: string, stripeCustomerId: string): Promise<void> {
    await db.update(users)
      .set({ stripeCustomerId })
      .where(eq(users.id, userId));
  }

  // Contact Points
  async getContactPointsByParty(partyId: string): Promise<ContactPoint[]> {
    return await db.select().from(contactPoints).where(
      and(eq(contactPoints.ownerType, "party"), eq(contactPoints.partyId, partyId))
    );
  }

  async getContactPointsByPerson(personId: string): Promise<ContactPoint[]> {
    return await db.select().from(contactPoints).where(
      and(eq(contactPoints.ownerType, "person"), eq(contactPoints.personId, personId))
    );
  }

  async createContactPoint(cp: InsertContactPoint): Promise<ContactPoint> {
    const result = await db.insert(contactPoints).values(cp).returning();
    return result[0];
  }

  async updateContactPoint(id: string, cp: Partial<InsertContactPoint>): Promise<ContactPoint | undefined> {
    const result = await db.update(contactPoints).set(cp).where(eq(contactPoints.id, id)).returning();
    return result[0];
  }

  async deleteContactPoint(id: string): Promise<void> {
    await db.delete(contactPoints).where(eq(contactPoints.id, id));
  }

  // Addresses
  async getAddressesByParty(partyId: string): Promise<Address[]> {
    return await db.select().from(addresses).where(
      and(eq(addresses.ownerType, "party"), eq(addresses.partyId, partyId))
    );
  }

  async getAddressesByPerson(personId: string): Promise<Address[]> {
    return await db.select().from(addresses).where(
      and(eq(addresses.ownerType, "person"), eq(addresses.personId, personId))
    );
  }

  async createAddress(addr: InsertAddress): Promise<Address> {
    const result = await db.insert(addresses).values(addr).returning();
    return result[0];
  }

  async updateAddress(id: string, addr: Partial<InsertAddress>): Promise<Address | undefined> {
    const result = await db.update(addresses).set(addr).where(eq(addresses.id, id)).returning();
    return result[0];
  }

  async deleteAddress(id: string): Promise<void> {
    await db.delete(addresses).where(eq(addresses.id, id));
  }

  // Engagements
  async getAllEngagements(): Promise<Engagement[]> {
    return await db.select().from(engagements).orderBy(desc(engagements.createdAt));
  }

  async getEngagement(id: string): Promise<Engagement | undefined> {
    const result = await db.select().from(engagements).where(eq(engagements.id, id));
    return result[0];
  }

  async getEngagementsForUser(userId: string): Promise<Engagement[]> {
    const membershipResults = await db.select({ engagementId: engagementMemberships.engagementId })
      .from(engagementMemberships)
      .where(eq(engagementMemberships.userId, userId));
    
    if (membershipResults.length === 0) {
      return [];
    }

    const engagementIds = membershipResults.map(m => m.engagementId);
    return await db.select().from(engagements)
      .where(inArray(engagements.id, engagementIds))
      .orderBy(desc(engagements.createdAt));
  }

  async createEngagement(engagement: InsertEngagement): Promise<Engagement> {
    const result = await db.insert(engagements).values(engagement).returning();
    return result[0];
  }

  async updateEngagement(id: string, engagement: Partial<InsertEngagement>): Promise<Engagement | undefined> {
    const result = await db.update(engagements)
      .set({ ...engagement, updatedAt: new Date() })
      .where(eq(engagements.id, id))
      .returning();
    return result[0];
  }

  async deleteEngagement(id: string): Promise<void> {
    await db.delete(engagements).where(eq(engagements.id, id));
  }

  // Engagement Memberships
  async getEngagementMemberships(engagementId: string): Promise<EngagementMembership[]> {
    return await db.select().from(engagementMemberships)
      .where(eq(engagementMemberships.engagementId, engagementId));
  }

  async getUserEngagementMembership(engagementId: string, userId: string): Promise<EngagementMembership | undefined> {
    const result = await db.select().from(engagementMemberships)
      .where(and(
        eq(engagementMemberships.engagementId, engagementId),
        eq(engagementMemberships.userId, userId)
      ));
    return result[0];
  }

  async createEngagementMembership(membership: InsertEngagementMembership): Promise<EngagementMembership> {
    const result = await db.insert(engagementMemberships).values(membership).returning();
    return result[0];
  }

  async updateEngagementMembership(id: string, membership: Partial<InsertEngagementMembership>): Promise<EngagementMembership | undefined> {
    const result = await db.update(engagementMemberships)
      .set(membership)
      .where(eq(engagementMemberships.id, id))
      .returning();
    return result[0];
  }

  async deleteEngagementMembership(id: string): Promise<void> {
    await db.delete(engagementMemberships).where(eq(engagementMemberships.id, id));
  }

  // Engagement Parties
  async getEngagementParties(engagementId: string): Promise<EngagementParty[]> {
    return await db.select().from(engagementParties)
      .where(eq(engagementParties.engagementId, engagementId));
  }

  async addPartyToEngagement(ep: InsertEngagementParty): Promise<EngagementParty> {
    const result = await db.insert(engagementParties).values(ep).returning();
    return result[0];
  }

  async removePartyFromEngagement(id: string): Promise<void> {
    await db.delete(engagementParties).where(eq(engagementParties.id, id));
  }

  // Engagement Agreements
  async getEngagementAgreements(engagementId: string): Promise<EngagementAgreement[]> {
    return await db.select().from(engagementAgreements)
      .where(eq(engagementAgreements.engagementId, engagementId));
  }

  async addAgreementToEngagement(ea: InsertEngagementAgreement): Promise<EngagementAgreement> {
    const result = await db.insert(engagementAgreements).values(ea).returning();
    return result[0];
  }

  async removeAgreementFromEngagement(id: string): Promise<void> {
    await db.delete(engagementAgreements).where(eq(engagementAgreements.id, id));
  }

  // Audit Logs
  async createAuditLog(log: InsertAuditLog): Promise<AuditLog> {
    const result = await db.insert(auditLogs).values(log).returning();
    return result[0];
  }

  async getAuditLogs(engagementId?: string): Promise<AuditLog[]> {
    if (engagementId) {
      return await db.select().from(auditLogs)
        .where(eq(auditLogs.engagementId, engagementId))
        .orderBy(desc(auditLogs.createdAt));
    }
    return await db.select().from(auditLogs).orderBy(desc(auditLogs.createdAt));
  }
}

export const storage = new DbStorage();
