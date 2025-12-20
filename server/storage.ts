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
  type Task, type InsertTask,
  type EnforcementCase, type InsertEnforcementCase,
  type EnforcementNotice, type InsertEnforcementNotice,
  type EnforcementDocument, type InsertEnforcementDocument,
  type EnforcementResponse, type InsertEnforcementResponse,
  type EnforcementTimeline, type InsertEnforcementTimeline,
  type EnforcementAffidavit, type InsertEnforcementAffidavit,
  type EnforcementDeliveryProof, type InsertEnforcementDeliveryProof,
  type EvidenceExport, type InsertEvidenceExport,
  type FraudIndicator, type InsertFraudIndicator,
  type FraudAssessment, type InsertFraudAssessment,
  type FraudFinding, type InsertFraudFinding,
  type ReferralPacket, type InsertReferralPacket,
  type EntityGraphEdge, type InsertEntityGraphEdge,
  type PatternEntity, type InsertPatternEntity,
  type EntityLink, type InsertEntityLink,
  type EntityObservation, type InsertEntityObservation,
  type PatternCluster, type InsertPatternCluster,
  type PatternClusterMember, type InsertPatternClusterMember,
  type CasePatternHit, type InsertCasePatternHit,
  type RequiredArtifactRule, type InsertRequiredArtifactRule,
  type CaseArtifactRequirement, type InsertCaseArtifactRequirement,
  type DeficiencyLetter, type InsertDeficiencyLetter,
  type PartyComplianceProfile, type InsertPartyComplianceProfile,
  type PartyComplianceRequest, type InsertPartyComplianceRequest,
  type ProfessionalRole, type InsertProfessionalRole,
  type ProfessionalDeliverableRule, type InsertProfessionalDeliverableRule,
  type ProfessionalCaseDeliverable, type InsertProfessionalCaseDeliverable,
  type LicensureFlag, type InsertLicensureFlag,
  type ContradictionSet, type InsertContradictionSet,
  type ContradictionItem, type InsertContradictionItem,
  type ContradictionEvidenceLink, type InsertContradictionEvidenceLink,
  type ContradictionQuestion, type InsertContradictionQuestion,
  type ContradictionOutput, type InsertContradictionOutput,
  users, parties, persons, agreements, activities, documents, partyRelationships, creditTransactions,
  contactPoints, addresses, engagements, engagementMemberships, engagementParties, engagementAgreements, auditLogs, tasks,
  enforcementCases, enforcementNotices, enforcementDocuments, enforcementResponses, enforcementTimeline,
  enforcementAffidavits, enforcementDeliveryProofs, evidenceExports,
  fraudIndicators, fraudAssessments, fraudFindings, referralPackets, entityGraphEdges,
  patternEntities, entityLinks, entityObservations, patternClusters, patternClusterMembers, casePatternHits,
  requiredArtifactRules, caseArtifactRequirements, deficiencyLetters,
  partyComplianceProfiles, partyComplianceRequests,
  professionalRoles, professionalDeliverableRules, professionalCaseDeliverables, licensureFlags,
  contradictionSets, contradictionItems, contradictionEvidenceLinks, contradictionQuestions, contradictionOutputs
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
  getActivitiesByEngagement(engagementId: string, filters?: { type?: string; startDate?: string; endDate?: string }): Promise<Activity[]>;
  createActivity(activity: InsertActivity): Promise<Activity>;
  deleteActivity(id: string): Promise<void>;

  // Documents
  getAllDocuments(): Promise<Document[]>;
  getDocument(id: string): Promise<Document | undefined>;
  getDocumentsByAgreement(agreementId: string): Promise<Document[]>;
  getDocumentsByEngagement(engagementId: string): Promise<Document[]>;
  getDocumentVersions(parentDocumentId: string): Promise<Document[]>;
  searchDocuments(filters: { query?: string; category?: string; excludeEngagementId?: string }): Promise<Document[]>;
  createDocument(doc: InsertDocument): Promise<Document>;
  createDocumentVersion(parentDocumentId: string, doc: InsertDocument): Promise<Document>;
  deleteDocument(id: string): Promise<void>;
  linkDocumentToEngagement(documentId: string, engagementId: string): Promise<Document | undefined>;

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

  // Tasks
  getTasksByEngagement(engagementId: string): Promise<Task[]>;
  getTask(id: string): Promise<Task | undefined>;
  createTask(task: InsertTask): Promise<Task>;
  updateTask(id: string, task: Partial<InsertTask>): Promise<Task | undefined>;
  deleteTask(id: string): Promise<void>;

  // Enforcement Cases
  getAllEnforcementCases(): Promise<EnforcementCase[]>;
  getEnforcementCase(id: string): Promise<EnforcementCase | undefined>;
  getEnforcementCasesByEngagement(engagementId: string): Promise<EnforcementCase[]>;
  getEnforcementCasesByAgreement(agreementId: string): Promise<EnforcementCase[]>;
  createEnforcementCase(enfCase: InsertEnforcementCase): Promise<EnforcementCase>;
  updateEnforcementCase(id: string, enfCase: Partial<InsertEnforcementCase>): Promise<EnforcementCase | undefined>;

  // Enforcement Notices
  getEnforcementNotices(caseId: string): Promise<EnforcementNotice[]>;
  getEnforcementNotice(id: string): Promise<EnforcementNotice | undefined>;
  createEnforcementNotice(notice: InsertEnforcementNotice): Promise<EnforcementNotice>;
  updateEnforcementNotice(id: string, notice: Partial<InsertEnforcementNotice>): Promise<EnforcementNotice | undefined>;

  // Enforcement Documents
  getEnforcementDocuments(caseId: string): Promise<EnforcementDocument[]>;
  createEnforcementDocument(doc: InsertEnforcementDocument): Promise<EnforcementDocument>;
  updateEnforcementDocument(id: string, doc: Partial<InsertEnforcementDocument>): Promise<EnforcementDocument | undefined>;

  // Enforcement Responses
  getEnforcementResponses(caseId: string): Promise<EnforcementResponse[]>;
  createEnforcementResponse(response: InsertEnforcementResponse): Promise<EnforcementResponse>;
  updateEnforcementResponse(id: string, response: Partial<InsertEnforcementResponse>): Promise<EnforcementResponse | undefined>;

  // Enforcement Timeline
  getEnforcementTimeline(caseId: string): Promise<EnforcementTimeline[]>;
  createEnforcementTimelineEvent(event: InsertEnforcementTimeline): Promise<EnforcementTimeline>;

  // Enforcement Affidavits
  getEnforcementAffidavits(caseId: string): Promise<EnforcementAffidavit[]>;
  getEnforcementAffidavit(id: string): Promise<EnforcementAffidavit | undefined>;
  createEnforcementAffidavit(affidavit: InsertEnforcementAffidavit): Promise<EnforcementAffidavit>;
  updateEnforcementAffidavit(id: string, affidavit: Partial<InsertEnforcementAffidavit>): Promise<EnforcementAffidavit | undefined>;

  // Enforcement Delivery Proofs
  getEnforcementDeliveryProofs(noticeId: string): Promise<EnforcementDeliveryProof[]>;
  getEnforcementDeliveryProofsByCase(caseId: string): Promise<EnforcementDeliveryProof[]>;
  createEnforcementDeliveryProof(proof: InsertEnforcementDeliveryProof): Promise<EnforcementDeliveryProof>;
  updateEnforcementDeliveryProof(id: string, proof: Partial<InsertEnforcementDeliveryProof>): Promise<EnforcementDeliveryProof | undefined>;

  // Evidence Exports
  getEvidenceExports(caseId: string): Promise<EvidenceExport[]>;
  getEvidenceExport(id: string): Promise<EvidenceExport | undefined>;
  createEvidenceExport(exp: InsertEvidenceExport): Promise<EvidenceExport>;
  updateEvidenceExport(id: string, exp: Partial<InsertEvidenceExport>): Promise<EvidenceExport | undefined>;
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

  async getActivitiesByEngagement(engagementId: string, filters?: { type?: string; startDate?: string; endDate?: string }): Promise<Activity[]> {
    const conditions = [eq(activities.engagementId, engagementId)];
    
    // Note: Type and date filtering would require additional SQL conditions
    // For now, we'll filter in-memory for simplicity
    const results = await db.select().from(activities)
      .where(eq(activities.engagementId, engagementId))
      .orderBy(desc(activities.date));
    
    let filtered = results;
    if (filters?.type) {
      filtered = filtered.filter(a => a.type === filters.type);
    }
    if (filters?.startDate) {
      filtered = filtered.filter(a => a.date >= filters.startDate!);
    }
    if (filters?.endDate) {
      filtered = filtered.filter(a => a.date <= filters.endDate!);
    }
    
    return filtered;
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

  async getDocument(id: string): Promise<Document | undefined> {
    const result = await db.select().from(documents).where(eq(documents.id, id));
    return result[0];
  }

  async getDocumentsByAgreement(agreementId: string): Promise<Document[]> {
    return await db.select().from(documents).where(eq(documents.agreementId, agreementId));
  }

  async getDocumentsByEngagement(engagementId: string): Promise<Document[]> {
    return await db.select().from(documents).where(eq(documents.engagementId, engagementId));
  }

  async getDocumentVersions(parentDocumentId: string): Promise<Document[]> {
    // Get all versions of a document (including the original)
    const versions = await db.select().from(documents)
      .where(
        or(
          eq(documents.id, parentDocumentId),
          eq(documents.parentDocumentId, parentDocumentId)
        )
      )
      .orderBy(desc(documents.version));
    return versions;
  }

  async createDocument(doc: InsertDocument): Promise<Document> {
    const docWithDate = {
      ...doc,
      dateUploaded: new Date().toISOString(),
      version: 1,
      parentDocumentId: null
    };
    const result = await db.insert(documents).values(docWithDate).returning();
    return result[0];
  }

  async createDocumentVersion(parentDocumentId: string, doc: InsertDocument): Promise<Document> {
    // Get the current max version
    const versions = await this.getDocumentVersions(parentDocumentId);
    const maxVersion = Math.max(...versions.map(v => v.version), 0);
    
    const docWithVersion = {
      ...doc,
      dateUploaded: new Date().toISOString(),
      version: maxVersion + 1,
      parentDocumentId
    };
    const result = await db.insert(documents).values(docWithVersion).returning();
    return result[0];
  }

  async deleteDocument(id: string): Promise<void> {
    await db.delete(documents).where(eq(documents.id, id));
  }

  async searchDocuments(filters: { query?: string; category?: string; excludeEngagementId?: string }): Promise<Document[]> {
    let results = await db.select().from(documents).orderBy(desc(documents.dateUploaded));
    
    if (filters.query) {
      const q = filters.query.toLowerCase();
      results = results.filter(d => 
        d.name.toLowerCase().includes(q) || 
        (d.notes && d.notes.toLowerCase().includes(q)) ||
        d.type.toLowerCase().includes(q)
      );
    }
    if (filters.category) {
      results = results.filter(d => d.category === filters.category);
    }
    if (filters.excludeEngagementId) {
      results = results.filter(d => d.engagementId !== filters.excludeEngagementId);
    }
    return results.slice(0, 50);
  }

  async linkDocumentToEngagement(documentId: string, engagementId: string): Promise<Document | undefined> {
    const result = await db.update(documents)
      .set({ engagementId })
      .where(eq(documents.id, documentId))
      .returning();
    return result[0];
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

  // Tasks
  async getTasksByEngagement(engagementId: string): Promise<Task[]> {
    return await db.select().from(tasks)
      .where(eq(tasks.engagementId, engagementId))
      .orderBy(desc(tasks.createdAt));
  }

  async getTask(id: string): Promise<Task | undefined> {
    const result = await db.select().from(tasks).where(eq(tasks.id, id));
    return result[0];
  }

  async createTask(task: InsertTask): Promise<Task> {
    const result = await db.insert(tasks).values(task).returning();
    return result[0];
  }

  async updateTask(id: string, task: Partial<InsertTask>): Promise<Task | undefined> {
    const result = await db.update(tasks).set(task).where(eq(tasks.id, id)).returning();
    return result[0];
  }

  async deleteTask(id: string): Promise<void> {
    await db.delete(tasks).where(eq(tasks.id, id));
  }

  // ==================== ENFORCEMENT ENGINE ====================

  // Enforcement Cases
  async getAllEnforcementCases(): Promise<EnforcementCase[]> {
    return await db.select().from(enforcementCases).orderBy(desc(enforcementCases.createdAt));
  }

  async getEnforcementCase(id: string): Promise<EnforcementCase | undefined> {
    const result = await db.select().from(enforcementCases).where(eq(enforcementCases.id, id));
    return result[0];
  }

  async getEnforcementCasesByEngagement(engagementId: string): Promise<EnforcementCase[]> {
    return await db.select().from(enforcementCases)
      .where(eq(enforcementCases.engagementId, engagementId))
      .orderBy(desc(enforcementCases.createdAt));
  }

  async getEnforcementCasesByAgreement(agreementId: string): Promise<EnforcementCase[]> {
    return await db.select().from(enforcementCases)
      .where(eq(enforcementCases.agreementId, agreementId))
      .orderBy(desc(enforcementCases.createdAt));
  }

  async createEnforcementCase(enfCase: InsertEnforcementCase): Promise<EnforcementCase> {
    const result = await db.insert(enforcementCases).values(enfCase).returning();
    return result[0];
  }

  async updateEnforcementCase(id: string, enfCase: Partial<InsertEnforcementCase>): Promise<EnforcementCase | undefined> {
    const result = await db.update(enforcementCases)
      .set({ ...enfCase, updatedAt: new Date() })
      .where(eq(enforcementCases.id, id))
      .returning();
    return result[0];
  }

  // Enforcement Notices
  async getEnforcementNotices(caseId: string): Promise<EnforcementNotice[]> {
    return await db.select().from(enforcementNotices)
      .where(eq(enforcementNotices.caseId, caseId))
      .orderBy(enforcementNotices.tier);
  }

  async getEnforcementNotice(id: string): Promise<EnforcementNotice | undefined> {
    const result = await db.select().from(enforcementNotices).where(eq(enforcementNotices.id, id));
    return result[0];
  }

  async createEnforcementNotice(notice: InsertEnforcementNotice): Promise<EnforcementNotice> {
    const result = await db.insert(enforcementNotices).values(notice).returning();
    return result[0];
  }

  async updateEnforcementNotice(id: string, notice: Partial<InsertEnforcementNotice>): Promise<EnforcementNotice | undefined> {
    const result = await db.update(enforcementNotices)
      .set({ ...notice, updatedAt: new Date() })
      .where(eq(enforcementNotices.id, id))
      .returning();
    return result[0];
  }

  // Enforcement Documents
  async getEnforcementDocuments(caseId: string): Promise<EnforcementDocument[]> {
    return await db.select().from(enforcementDocuments)
      .where(eq(enforcementDocuments.caseId, caseId))
      .orderBy(desc(enforcementDocuments.createdAt));
  }

  async createEnforcementDocument(doc: InsertEnforcementDocument): Promise<EnforcementDocument> {
    const result = await db.insert(enforcementDocuments).values(doc).returning();
    return result[0];
  }

  async updateEnforcementDocument(id: string, doc: Partial<InsertEnforcementDocument>): Promise<EnforcementDocument | undefined> {
    const result = await db.update(enforcementDocuments)
      .set(doc)
      .where(eq(enforcementDocuments.id, id))
      .returning();
    return result[0];
  }

  // Enforcement Responses
  async getEnforcementResponses(caseId: string): Promise<EnforcementResponse[]> {
    return await db.select().from(enforcementResponses)
      .where(eq(enforcementResponses.caseId, caseId))
      .orderBy(desc(enforcementResponses.receivedAt));
  }

  async createEnforcementResponse(response: InsertEnforcementResponse): Promise<EnforcementResponse> {
    const result = await db.insert(enforcementResponses).values(response).returning();
    return result[0];
  }

  async updateEnforcementResponse(id: string, response: Partial<InsertEnforcementResponse>): Promise<EnforcementResponse | undefined> {
    const result = await db.update(enforcementResponses)
      .set(response)
      .where(eq(enforcementResponses.id, id))
      .returning();
    return result[0];
  }

  // Enforcement Timeline
  async getEnforcementTimeline(caseId: string): Promise<EnforcementTimeline[]> {
    return await db.select().from(enforcementTimeline)
      .where(eq(enforcementTimeline.caseId, caseId))
      .orderBy(desc(enforcementTimeline.occurredAt));
  }

  async createEnforcementTimelineEvent(event: InsertEnforcementTimeline): Promise<EnforcementTimeline> {
    const result = await db.insert(enforcementTimeline).values(event).returning();
    return result[0];
  }

  // Enforcement Affidavits
  async getEnforcementAffidavits(caseId: string): Promise<EnforcementAffidavit[]> {
    return await db.select().from(enforcementAffidavits)
      .where(eq(enforcementAffidavits.caseId, caseId))
      .orderBy(desc(enforcementAffidavits.createdAt));
  }

  async getEnforcementAffidavit(id: string): Promise<EnforcementAffidavit | undefined> {
    const result = await db.select().from(enforcementAffidavits).where(eq(enforcementAffidavits.id, id));
    return result[0];
  }

  async createEnforcementAffidavit(affidavit: InsertEnforcementAffidavit): Promise<EnforcementAffidavit> {
    const result = await db.insert(enforcementAffidavits).values(affidavit).returning();
    return result[0];
  }

  async updateEnforcementAffidavit(id: string, affidavit: Partial<InsertEnforcementAffidavit>): Promise<EnforcementAffidavit | undefined> {
    const result = await db.update(enforcementAffidavits)
      .set({ ...affidavit, updatedAt: new Date() })
      .where(eq(enforcementAffidavits.id, id))
      .returning();
    return result[0];
  }

  // Enforcement Delivery Proofs
  async getEnforcementDeliveryProofs(noticeId: string): Promise<EnforcementDeliveryProof[]> {
    return await db.select().from(enforcementDeliveryProofs)
      .where(eq(enforcementDeliveryProofs.noticeId, noticeId))
      .orderBy(desc(enforcementDeliveryProofs.sentAt));
  }

  async getEnforcementDeliveryProofsByCase(caseId: string): Promise<EnforcementDeliveryProof[]> {
    const notices = await db.select().from(enforcementNotices)
      .where(eq(enforcementNotices.caseId, caseId));
    const noticeIds = notices.map(n => n.id);
    if (noticeIds.length === 0) return [];
    return await db.select().from(enforcementDeliveryProofs)
      .where(inArray(enforcementDeliveryProofs.noticeId, noticeIds))
      .orderBy(desc(enforcementDeliveryProofs.sentAt));
  }

  async createEnforcementDeliveryProof(proof: InsertEnforcementDeliveryProof): Promise<EnforcementDeliveryProof> {
    const result = await db.insert(enforcementDeliveryProofs).values(proof).returning();
    return result[0];
  }

  async updateEnforcementDeliveryProof(id: string, proof: Partial<InsertEnforcementDeliveryProof>): Promise<EnforcementDeliveryProof | undefined> {
    const result = await db.update(enforcementDeliveryProofs)
      .set(proof)
      .where(eq(enforcementDeliveryProofs.id, id))
      .returning();
    return result[0];
  }

  // Evidence Exports
  async getEvidenceExports(caseId: string): Promise<EvidenceExport[]> {
    return await db.select().from(evidenceExports)
      .where(eq(evidenceExports.caseId, caseId))
      .orderBy(desc(evidenceExports.createdAt));
  }

  async getEvidenceExport(id: string): Promise<EvidenceExport | undefined> {
    const result = await db.select().from(evidenceExports).where(eq(evidenceExports.id, id));
    return result[0];
  }

  async createEvidenceExport(exp: InsertEvidenceExport): Promise<EvidenceExport> {
    const result = await db.insert(evidenceExports).values(exp).returning();
    return result[0];
  }

  async updateEvidenceExport(id: string, exp: Partial<InsertEvidenceExport>): Promise<EvidenceExport | undefined> {
    const result = await db.update(evidenceExports)
      .set(exp)
      .where(eq(evidenceExports.id, id))
      .returning();
    return result[0];
  }

  // ==========================================
  // FRAUD & CRIMINAL INDICATORS ENGINE
  // ==========================================

  // Fraud Indicators (catalog)
  async getAllFraudIndicators(): Promise<FraudIndicator[]> {
    return await db.select().from(fraudIndicators);
  }

  async getFraudIndicator(id: string): Promise<FraudIndicator | undefined> {
    const result = await db.select().from(fraudIndicators).where(eq(fraudIndicators.id, id));
    return result[0];
  }

  async getFraudIndicatorByCode(code: string): Promise<FraudIndicator | undefined> {
    const result = await db.select().from(fraudIndicators).where(eq(fraudIndicators.code, code));
    return result[0];
  }

  async createFraudIndicator(indicator: InsertFraudIndicator): Promise<FraudIndicator> {
    const result = await db.insert(fraudIndicators).values(indicator).returning();
    return result[0];
  }

  async upsertFraudIndicator(indicator: InsertFraudIndicator): Promise<FraudIndicator> {
    const existing = await this.getFraudIndicatorByCode(indicator.code);
    if (existing) {
      const result = await db.update(fraudIndicators)
        .set(indicator)
        .where(eq(fraudIndicators.id, existing.id))
        .returning();
      return result[0];
    }
    return this.createFraudIndicator(indicator);
  }

  // Fraud Assessments
  async getFraudAssessment(id: string): Promise<FraudAssessment | undefined> {
    const result = await db.select().from(fraudAssessments).where(eq(fraudAssessments.id, id));
    return result[0];
  }

  async getFraudAssessmentByCase(caseId: string): Promise<FraudAssessment | undefined> {
    const result = await db.select().from(fraudAssessments)
      .where(eq(fraudAssessments.enforcementCaseId, caseId))
      .orderBy(desc(fraudAssessments.version))
      .limit(1);
    return result[0];
  }

  async createFraudAssessment(assessment: InsertFraudAssessment): Promise<FraudAssessment> {
    const result = await db.insert(fraudAssessments).values(assessment).returning();
    return result[0];
  }

  async updateFraudAssessment(id: string, assessment: Partial<InsertFraudAssessment>): Promise<FraudAssessment | undefined> {
    const result = await db.update(fraudAssessments)
      .set({ ...assessment, updatedAt: new Date() })
      .where(eq(fraudAssessments.id, id))
      .returning();
    return result[0];
  }

  // Fraud Findings
  async getFraudFindingsByAssessment(assessmentId: string): Promise<FraudFinding[]> {
    return await db.select().from(fraudFindings)
      .where(eq(fraudFindings.fraudAssessmentId, assessmentId))
      .orderBy(desc(fraudFindings.createdAt));
  }

  async getFraudFinding(id: string): Promise<FraudFinding | undefined> {
    const result = await db.select().from(fraudFindings).where(eq(fraudFindings.id, id));
    return result[0];
  }

  async createFraudFinding(finding: InsertFraudFinding): Promise<FraudFinding> {
    const result = await db.insert(fraudFindings).values(finding).returning();
    return result[0];
  }

  async updateFraudFinding(id: string, finding: Partial<InsertFraudFinding>): Promise<FraudFinding | undefined> {
    const result = await db.update(fraudFindings)
      .set({ ...finding, updatedAt: new Date() })
      .where(eq(fraudFindings.id, id))
      .returning();
    return result[0];
  }

  async deleteFraudFinding(id: string): Promise<void> {
    await db.delete(fraudFindings).where(eq(fraudFindings.id, id));
  }

  async getActiveFraudFindings(assessmentId: string): Promise<FraudFinding[]> {
    return await db.select().from(fraudFindings)
      .where(and(
        eq(fraudFindings.fraudAssessmentId, assessmentId),
        eq(fraudFindings.active, true)
      ));
  }

  // Referral Packets
  async getReferralPacketsByCase(caseId: string): Promise<ReferralPacket[]> {
    return await db.select().from(referralPackets)
      .where(eq(referralPackets.enforcementCaseId, caseId))
      .orderBy(desc(referralPackets.createdAt));
  }

  async getReferralPacket(id: string): Promise<ReferralPacket | undefined> {
    const result = await db.select().from(referralPackets).where(eq(referralPackets.id, id));
    return result[0];
  }

  async createReferralPacket(packet: InsertReferralPacket): Promise<ReferralPacket> {
    const result = await db.insert(referralPackets).values(packet).returning();
    return result[0];
  }

  async updateReferralPacket(id: string, packet: Partial<InsertReferralPacket>): Promise<ReferralPacket | undefined> {
    const result = await db.update(referralPackets)
      .set({ ...packet, updatedAt: new Date() })
      .where(eq(referralPackets.id, id))
      .returning();
    return result[0];
  }

  // Entity Graph Edges (for pattern detection)
  async getEntityGraphEdges(entityType: string, entityId: string): Promise<EntityGraphEdge[]> {
    return await db.select().from(entityGraphEdges)
      .where(or(
        and(eq(entityGraphEdges.entityTypeA, entityType), eq(entityGraphEdges.entityIdA, entityId)),
        and(eq(entityGraphEdges.entityTypeB, entityType), eq(entityGraphEdges.entityIdB, entityId))
      ));
  }

  async createEntityGraphEdge(edge: InsertEntityGraphEdge): Promise<EntityGraphEdge> {
    const result = await db.insert(entityGraphEdges).values(edge).returning();
    return result[0];
  }

  async deleteEntityGraphEdge(id: string): Promise<void> {
    await db.delete(entityGraphEdges).where(eq(entityGraphEdges.id, id));
  }

  // ==========================================
  // PATTERN DETECTION
  // ==========================================

  // Pattern Entities
  async getPatternEntity(id: string): Promise<PatternEntity | undefined> {
    const result = await db.select().from(patternEntities).where(eq(patternEntities.id, id));
    return result[0];
  }

  async getPatternEntityByNormalized(entityType: string, normalizedValue: string): Promise<PatternEntity | undefined> {
    const result = await db.select().from(patternEntities)
      .where(and(
        eq(patternEntities.entityType, entityType),
        eq(patternEntities.normalizedValue, normalizedValue)
      ));
    return result[0];
  }

  async getAllPatternEntities(): Promise<PatternEntity[]> {
    return await db.select().from(patternEntities).orderBy(desc(patternEntities.createdAt));
  }

  async createPatternEntity(entity: InsertPatternEntity): Promise<PatternEntity> {
    const result = await db.insert(patternEntities).values(entity).returning();
    return result[0];
  }

  async upsertPatternEntity(entity: InsertPatternEntity): Promise<PatternEntity> {
    const existing = await this.getPatternEntityByNormalized(entity.entityType, entity.normalizedValue);
    if (existing) return existing;
    return this.createPatternEntity(entity);
  }

  // Entity Links
  async getEntityLinksByEntity(entityId: string): Promise<EntityLink[]> {
    return await db.select().from(entityLinks)
      .where(or(
        eq(entityLinks.entityIdA, entityId),
        eq(entityLinks.entityIdB, entityId)
      ));
  }

  async createEntityLink(link: InsertEntityLink): Promise<EntityLink> {
    const result = await db.insert(entityLinks).values(link).returning();
    return result[0];
  }

  async deleteEntityLink(id: string): Promise<void> {
    await db.delete(entityLinks).where(eq(entityLinks.id, id));
  }

  // Entity Observations
  async getEntityObservations(entityId: string): Promise<EntityObservation[]> {
    return await db.select().from(entityObservations)
      .where(eq(entityObservations.entityId, entityId));
  }

  async createEntityObservation(observation: InsertEntityObservation): Promise<EntityObservation> {
    const result = await db.insert(entityObservations).values(observation).returning();
    return result[0];
  }

  // Pattern Clusters
  async getPatternCluster(id: string): Promise<PatternCluster | undefined> {
    const result = await db.select().from(patternClusters).where(eq(patternClusters.id, id));
    return result[0];
  }

  async getPatternClusterByKey(clusterKey: string): Promise<PatternCluster | undefined> {
    const result = await db.select().from(patternClusters).where(eq(patternClusters.clusterKey, clusterKey));
    return result[0];
  }

  async getAllPatternClusters(): Promise<PatternCluster[]> {
    return await db.select().from(patternClusters).orderBy(desc(patternClusters.score));
  }

  async createPatternCluster(cluster: InsertPatternCluster): Promise<PatternCluster> {
    const result = await db.insert(patternClusters).values(cluster).returning();
    return result[0];
  }

  async updatePatternCluster(id: string, cluster: Partial<InsertPatternCluster>): Promise<PatternCluster | undefined> {
    const result = await db.update(patternClusters)
      .set({ ...cluster, updatedAt: new Date() })
      .where(eq(patternClusters.id, id))
      .returning();
    return result[0];
  }

  // Pattern Cluster Members
  async getPatternClusterMembers(clusterId: string): Promise<PatternClusterMember[]> {
    return await db.select().from(patternClusterMembers)
      .where(eq(patternClusterMembers.clusterId, clusterId));
  }

  async createPatternClusterMember(member: InsertPatternClusterMember): Promise<PatternClusterMember> {
    const result = await db.insert(patternClusterMembers).values(member).returning();
    return result[0];
  }

  async deletePatternClusterMember(id: string): Promise<void> {
    await db.delete(patternClusterMembers).where(eq(patternClusterMembers.id, id));
  }

  // Case Pattern Hits
  async getCasePatternHits(caseId: string): Promise<CasePatternHit[]> {
    return await db.select().from(casePatternHits)
      .where(eq(casePatternHits.enforcementCaseId, caseId))
      .orderBy(desc(casePatternHits.createdAt));
  }

  async createCasePatternHit(hit: InsertCasePatternHit): Promise<CasePatternHit> {
    const result = await db.insert(casePatternHits).values(hit).returning();
    return result[0];
  }

  async deleteCasePatternHit(id: string): Promise<void> {
    await db.delete(casePatternHits).where(eq(casePatternHits.id, id));
  }

  // ==========================================
  // DEFICIENCY ENGINE
  // ==========================================

  // Required Artifact Rules
  async getAllRequiredArtifactRules(): Promise<RequiredArtifactRule[]> {
    return await db.select().from(requiredArtifactRules);
  }

  async getRequiredArtifactRuleByCode(ruleCode: string): Promise<RequiredArtifactRule | undefined> {
    const result = await db.select().from(requiredArtifactRules)
      .where(eq(requiredArtifactRules.ruleCode, ruleCode));
    return result[0];
  }

  async createRequiredArtifactRule(rule: InsertRequiredArtifactRule): Promise<RequiredArtifactRule> {
    const result = await db.insert(requiredArtifactRules).values(rule).returning();
    return result[0];
  }

  async upsertRequiredArtifactRule(rule: InsertRequiredArtifactRule): Promise<RequiredArtifactRule> {
    const existing = await this.getRequiredArtifactRuleByCode(rule.ruleCode);
    if (existing) return existing;
    return this.createRequiredArtifactRule(rule);
  }

  // Case Artifact Requirements
  async getCaseArtifactRequirements(caseId: string): Promise<CaseArtifactRequirement[]> {
    return await db.select().from(caseArtifactRequirements)
      .where(eq(caseArtifactRequirements.enforcementCaseId, caseId));
  }

  async getCaseArtifactRequirement(id: string): Promise<CaseArtifactRequirement | undefined> {
    const result = await db.select().from(caseArtifactRequirements).where(eq(caseArtifactRequirements.id, id));
    return result[0];
  }

  async createCaseArtifactRequirement(req: InsertCaseArtifactRequirement): Promise<CaseArtifactRequirement> {
    const result = await db.insert(caseArtifactRequirements).values(req).returning();
    return result[0];
  }

  async updateCaseArtifactRequirement(id: string, req: Partial<InsertCaseArtifactRequirement>): Promise<CaseArtifactRequirement | undefined> {
    const result = await db.update(caseArtifactRequirements)
      .set({ ...req, updatedAt: new Date() })
      .where(eq(caseArtifactRequirements.id, id))
      .returning();
    return result[0];
  }

  async getMissingArtifactRequirements(caseId: string): Promise<CaseArtifactRequirement[]> {
    return await db.select().from(caseArtifactRequirements)
      .where(and(
        eq(caseArtifactRequirements.enforcementCaseId, caseId),
        eq(caseArtifactRequirements.status, "required")
      ));
  }

  // Deficiency Letters
  async getDeficiencyLetters(caseId: string): Promise<DeficiencyLetter[]> {
    return await db.select().from(deficiencyLetters)
      .where(eq(deficiencyLetters.enforcementCaseId, caseId))
      .orderBy(desc(deficiencyLetters.createdAt));
  }

  async getDeficiencyLetter(id: string): Promise<DeficiencyLetter | undefined> {
    const result = await db.select().from(deficiencyLetters).where(eq(deficiencyLetters.id, id));
    return result[0];
  }

  async createDeficiencyLetter(letter: InsertDeficiencyLetter): Promise<DeficiencyLetter> {
    const result = await db.insert(deficiencyLetters).values(letter).returning();
    return result[0];
  }

  async updateDeficiencyLetter(id: string, letter: Partial<InsertDeficiencyLetter>): Promise<DeficiencyLetter | undefined> {
    const result = await db.update(deficiencyLetters)
      .set({ ...letter, updatedAt: new Date() })
      .where(eq(deficiencyLetters.id, id))
      .returning();
    return result[0];
  }

  // ==========================================
  // PARTY COMPLIANCE
  // ==========================================

  // Party Compliance Profiles
  async getPartyComplianceProfile(partyId: string): Promise<PartyComplianceProfile | undefined> {
    const result = await db.select().from(partyComplianceProfiles)
      .where(eq(partyComplianceProfiles.partyId, partyId));
    return result[0];
  }

  async createPartyComplianceProfile(profile: InsertPartyComplianceProfile): Promise<PartyComplianceProfile> {
    const result = await db.insert(partyComplianceProfiles).values(profile).returning();
    return result[0];
  }

  async updatePartyComplianceProfile(id: string, profile: Partial<InsertPartyComplianceProfile>): Promise<PartyComplianceProfile | undefined> {
    const result = await db.update(partyComplianceProfiles)
      .set({ ...profile, updatedAt: new Date() })
      .where(eq(partyComplianceProfiles.id, id))
      .returning();
    return result[0];
  }

  async upsertPartyComplianceProfile(profile: InsertPartyComplianceProfile): Promise<PartyComplianceProfile> {
    const existing = await this.getPartyComplianceProfile(profile.partyId);
    if (existing) {
      return (await this.updatePartyComplianceProfile(existing.id, profile))!;
    }
    return this.createPartyComplianceProfile(profile);
  }

  // Party Compliance Requests
  async getPartyComplianceRequests(partyId: string): Promise<PartyComplianceRequest[]> {
    return await db.select().from(partyComplianceRequests)
      .where(eq(partyComplianceRequests.partyId, partyId))
      .orderBy(desc(partyComplianceRequests.createdAt));
  }

  async getPartyComplianceRequestsByCase(caseId: string): Promise<PartyComplianceRequest[]> {
    return await db.select().from(partyComplianceRequests)
      .where(eq(partyComplianceRequests.enforcementCaseId, caseId));
  }

  async createPartyComplianceRequest(request: InsertPartyComplianceRequest): Promise<PartyComplianceRequest> {
    const result = await db.insert(partyComplianceRequests).values(request).returning();
    return result[0];
  }

  async updatePartyComplianceRequest(id: string, request: Partial<InsertPartyComplianceRequest>): Promise<PartyComplianceRequest | undefined> {
    const result = await db.update(partyComplianceRequests)
      .set({ ...request, updatedAt: new Date() })
      .where(eq(partyComplianceRequests.id, id))
      .returning();
    return result[0];
  }

  // ==========================================
  // PROFESSIONAL ROLES
  // ==========================================

  // Professional Roles
  async getProfessionalRoles(caseId: string): Promise<ProfessionalRole[]> {
    return await db.select().from(professionalRoles)
      .where(eq(professionalRoles.enforcementCaseId, caseId));
  }

  async getProfessionalRole(id: string): Promise<ProfessionalRole | undefined> {
    const result = await db.select().from(professionalRoles).where(eq(professionalRoles.id, id));
    return result[0];
  }

  async createProfessionalRole(role: InsertProfessionalRole): Promise<ProfessionalRole> {
    const result = await db.insert(professionalRoles).values(role).returning();
    return result[0];
  }

  async updateProfessionalRole(id: string, role: Partial<InsertProfessionalRole>): Promise<ProfessionalRole | undefined> {
    const result = await db.update(professionalRoles)
      .set({ ...role, updatedAt: new Date() })
      .where(eq(professionalRoles.id, id))
      .returning();
    return result[0];
  }

  async deleteProfessionalRole(id: string): Promise<void> {
    await db.delete(professionalRoles).where(eq(professionalRoles.id, id));
  }

  // Professional Deliverable Rules
  async getAllProfessionalDeliverableRules(): Promise<ProfessionalDeliverableRule[]> {
    return await db.select().from(professionalDeliverableRules);
  }

  async getProfessionalDeliverableRulesByType(roleType: string): Promise<ProfessionalDeliverableRule[]> {
    return await db.select().from(professionalDeliverableRules)
      .where(eq(professionalDeliverableRules.roleType, roleType));
  }

  async createProfessionalDeliverableRule(rule: InsertProfessionalDeliverableRule): Promise<ProfessionalDeliverableRule> {
    const result = await db.insert(professionalDeliverableRules).values(rule).returning();
    return result[0];
  }

  // Professional Case Deliverables
  async getProfessionalCaseDeliverables(professionalRoleId: string): Promise<ProfessionalCaseDeliverable[]> {
    return await db.select().from(professionalCaseDeliverables)
      .where(eq(professionalCaseDeliverables.professionalRoleId, professionalRoleId));
  }

  async createProfessionalCaseDeliverable(deliverable: InsertProfessionalCaseDeliverable): Promise<ProfessionalCaseDeliverable> {
    const result = await db.insert(professionalCaseDeliverables).values(deliverable).returning();
    return result[0];
  }

  async updateProfessionalCaseDeliverable(id: string, deliverable: Partial<InsertProfessionalCaseDeliverable>): Promise<ProfessionalCaseDeliverable | undefined> {
    const result = await db.update(professionalCaseDeliverables)
      .set({ ...deliverable, updatedAt: new Date() })
      .where(eq(professionalCaseDeliverables.id, id))
      .returning();
    return result[0];
  }

  // ==========================================
  // LICENSURE FLAGS
  // ==========================================

  async getLicensureFlags(caseId: string): Promise<LicensureFlag[]> {
    return await db.select().from(licensureFlags)
      .where(eq(licensureFlags.enforcementCaseId, caseId));
  }

  async getLicensureFlag(id: string): Promise<LicensureFlag | undefined> {
    const result = await db.select().from(licensureFlags).where(eq(licensureFlags.id, id));
    return result[0];
  }

  async createLicensureFlag(flag: InsertLicensureFlag): Promise<LicensureFlag> {
    const result = await db.insert(licensureFlags).values(flag).returning();
    return result[0];
  }

  async updateLicensureFlag(id: string, flag: Partial<InsertLicensureFlag>): Promise<LicensureFlag | undefined> {
    const result = await db.update(licensureFlags)
      .set({ ...flag, updatedAt: new Date() })
      .where(eq(licensureFlags.id, id))
      .returning();
    return result[0];
  }

  async deleteLicensureFlag(id: string): Promise<void> {
    await db.delete(licensureFlags).where(eq(licensureFlags.id, id));
  }

  // ==========================================
  // CONTRADICTIONS ENGINE
  // ==========================================

  // Contradiction Sets
  async getContradictionSet(caseId: string): Promise<ContradictionSet | undefined> {
    const result = await db.select().from(contradictionSets)
      .where(eq(contradictionSets.enforcementCaseId, caseId))
      .orderBy(desc(contradictionSets.createdAt))
      .limit(1);
    return result[0];
  }

  async getContradictionSetById(id: string): Promise<ContradictionSet | undefined> {
    const result = await db.select().from(contradictionSets).where(eq(contradictionSets.id, id));
    return result[0];
  }

  async createContradictionSet(set: InsertContradictionSet): Promise<ContradictionSet> {
    const result = await db.insert(contradictionSets).values(set).returning();
    return result[0];
  }

  async updateContradictionSet(id: string, set: Partial<InsertContradictionSet>): Promise<ContradictionSet | undefined> {
    const result = await db.update(contradictionSets)
      .set({ ...set, updatedAt: new Date() })
      .where(eq(contradictionSets.id, id))
      .returning();
    return result[0];
  }

  // Contradiction Items
  async getContradictionItems(setId: string): Promise<ContradictionItem[]> {
    return await db.select().from(contradictionItems)
      .where(eq(contradictionItems.contradictionSetId, setId))
      .orderBy(desc(contradictionItems.createdAt));
  }

  async getContradictionItem(id: string): Promise<ContradictionItem | undefined> {
    const result = await db.select().from(contradictionItems).where(eq(contradictionItems.id, id));
    return result[0];
  }

  async createContradictionItem(item: InsertContradictionItem): Promise<ContradictionItem> {
    const result = await db.insert(contradictionItems).values(item).returning();
    return result[0];
  }

  async updateContradictionItem(id: string, item: Partial<InsertContradictionItem>): Promise<ContradictionItem | undefined> {
    const result = await db.update(contradictionItems)
      .set({ ...item, updatedAt: new Date() })
      .where(eq(contradictionItems.id, id))
      .returning();
    return result[0];
  }

  async deleteContradictionItem(id: string): Promise<void> {
    await db.delete(contradictionItems).where(eq(contradictionItems.id, id));
  }

  async getConfirmedContradictionItems(setId: string): Promise<ContradictionItem[]> {
    return await db.select().from(contradictionItems)
      .where(and(
        eq(contradictionItems.contradictionSetId, setId),
        eq(contradictionItems.status, "confirmed")
      ));
  }

  // Contradiction Evidence Links
  async getContradictionEvidenceLinks(itemId: string): Promise<ContradictionEvidenceLink[]> {
    return await db.select().from(contradictionEvidenceLinks)
      .where(eq(contradictionEvidenceLinks.contradictionItemId, itemId));
  }

  async createContradictionEvidenceLink(link: InsertContradictionEvidenceLink): Promise<ContradictionEvidenceLink> {
    const result = await db.insert(contradictionEvidenceLinks).values(link).returning();
    return result[0];
  }

  async deleteContradictionEvidenceLink(id: string): Promise<void> {
    await db.delete(contradictionEvidenceLinks).where(eq(contradictionEvidenceLinks.id, id));
  }

  // Contradiction Questions
  async getContradictionQuestions(itemId: string): Promise<ContradictionQuestion[]> {
    return await db.select().from(contradictionQuestions)
      .where(eq(contradictionQuestions.contradictionItemId, itemId));
  }

  async createContradictionQuestion(question: InsertContradictionQuestion): Promise<ContradictionQuestion> {
    const result = await db.insert(contradictionQuestions).values(question).returning();
    return result[0];
  }

  async updateContradictionQuestion(id: string, question: Partial<InsertContradictionQuestion>): Promise<ContradictionQuestion | undefined> {
    const result = await db.update(contradictionQuestions)
      .set({ ...question, updatedAt: new Date() })
      .where(eq(contradictionQuestions.id, id))
      .returning();
    return result[0];
  }

  // Contradiction Outputs
  async getContradictionOutputs(setId: string): Promise<ContradictionOutput[]> {
    return await db.select().from(contradictionOutputs)
      .where(eq(contradictionOutputs.contradictionSetId, setId))
      .orderBy(desc(contradictionOutputs.createdAt));
  }

  async getContradictionOutput(id: string): Promise<ContradictionOutput | undefined> {
    const result = await db.select().from(contradictionOutputs).where(eq(contradictionOutputs.id, id));
    return result[0];
  }

  async createContradictionOutput(output: InsertContradictionOutput): Promise<ContradictionOutput> {
    const result = await db.insert(contradictionOutputs).values(output).returning();
    return result[0];
  }

  async updateContradictionOutput(id: string, output: Partial<InsertContradictionOutput>): Promise<ContradictionOutput | undefined> {
    const result = await db.update(contradictionOutputs)
      .set({ ...output, updatedAt: new Date() })
      .where(eq(contradictionOutputs.id, id))
      .returning();
    return result[0];
  }
}

export const storage = new DbStorage();
