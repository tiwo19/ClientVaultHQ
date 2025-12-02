import { db } from "@db";
import { 
  type User, type InsertUser,
  type Party, type InsertParty,
  type Person, type InsertPerson,
  type Agreement, type InsertAgreement,
  type Activity, type InsertActivity,
  type Document, type InsertDocument,
  users, parties, persons, agreements, activities, documents
} from "@shared/schema";
import { eq } from "drizzle-orm";

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
  deleteParty(id: string): Promise<void>;

  // Persons
  getAllPersons(): Promise<Person[]>;
  getPersonsByParty(partyId: string): Promise<Person[]>;
  createPerson(person: InsertPerson): Promise<Person>;

  // Agreements
  getAllAgreements(): Promise<Agreement[]>;
  getAgreement(id: string): Promise<Agreement | undefined>;
  createAgreement(agreement: InsertAgreement): Promise<Agreement>;
  deleteAgreement(id: string): Promise<void>;

  // Activities
  getAllActivities(): Promise<Activity[]>;
  getActivitiesByAgreement(agreementId: string): Promise<Activity[]>;
  createActivity(activity: InsertActivity): Promise<Activity>;

  // Documents
  getAllDocuments(): Promise<Document[]>;
  getDocumentsByAgreement(agreementId: string): Promise<Document[]>;
  createDocument(doc: InsertDocument): Promise<Document>;
  deleteDocument(id: string): Promise<void>;
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
}

export const storage = new DbStorage();
