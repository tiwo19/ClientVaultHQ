import { db } from "@db";
import { users, parties, persons, agreements, activities, documents } from "@shared/schema";
import bcrypt from "bcrypt";
import { subDays } from "date-fns";

async function seed() {
  console.log("Seeding database...");

  // Check if admin user exists
  const existingAdmin = await db.select().from(users).limit(1);
  
  if (existingAdmin.length > 0) {
    console.log("Database already seeded, skipping...");
    return;
  }

  // Create default admin user
  const hashedPassword = await bcrypt.hash("Rhin3land3r!", 10);
  const [admin] = await db.insert(users).values({
    email: "jking@workdigital.com",
    name: "J. King",
    password: hashedPassword,
    role: "Admin"
  }).returning();

  console.log("Created admin user:", admin.email);

  // Seed parties
  const partyData = [
    { name: "Apex Capital Holdings", type: "Company", email: "contact@apexcap.com", phone: "+1 212 555 0123", address: "101 Wall St, NY" },
    { name: "John Smith Family Trust", type: "Trust", email: "trustee@smithfamily.com", phone: "+1 310 555 9999", address: "456 Beverly Dr, CA" },
    { name: "Greenfield Ventures JV", type: "JVPartner", email: "partners@greenfield.com", phone: "+1 415 555 8888", address: "789 Tech Way, SF" },
    { name: "Robert Chen", type: "Individual", email: "r.chen@gmail.com", phone: "+1 646 555 1111", address: "12 Park Ave, NY" },
    { name: "Silver Lake Logistics LLC", type: "Company", email: "ops@silverlakellc.com", phone: "+1 702 555 2222", address: "88 Industrial Blvd, NV" },
  ];

  const createdParties = await db.insert(parties).values(partyData).returning();
  console.log(`Created ${createdParties.length} parties`);

  // Seed persons
  const personData = [
    { partyId: createdParties[0].id, name: "Sarah Connor", role: "CEO", email: "sarah@apexcap.com", phone: "555-0001" },
    { partyId: createdParties[0].id, name: "Kyle Reese", role: "General Counsel", email: "legal@apexcap.com", phone: "555-0002" },
    { partyId: createdParties[3].id, name: "Robert Chen", role: "Individual", email: "r.chen@gmail.com", phone: "555-0003" },
  ];

  const createdPersons = await db.insert(persons).values(personData).returning();
  console.log(`Created ${createdPersons.length} persons`);

  // Seed agreements
  const agreementData = [
    {
      title: "Series A Investment Note",
      partyId: createdParties[0].id,
      type: "Loan",
      principalAmount: 1500000,
      interestRateAnnual: 8.5,
      governingLaw: "NY",
      venueJurisdiction: "NY",
      effectiveDate: "2023-01-15",
      maturityDate: "2025-01-15",
      internalOwner: "Alice Admin",
      counterpartyRiskRating: "Low",
      performanceStatus: "Performing",
      enforcementStage: "None",
      isClientVisible: true,
      isSecured: true,
      isPersonalGuarantee: false
    },
    {
      title: "Bridge Loan 2024",
      partyId: createdParties[2].id,
      type: "Loan",
      principalAmount: 500000,
      interestRateAnnual: 12.0,
      governingLaw: "DE",
      venueJurisdiction: "DE",
      effectiveDate: "2024-02-01",
      maturityDate: "2024-08-01",
      internalOwner: "Bob Broker",
      counterpartyRiskRating: "Medium",
      performanceStatus: "Sent",
      enforcementStage: "None",
      isClientVisible: false,
      isSecured: true,
      isPersonalGuarantee: true
    },
    {
      title: "Operating Agreement Amendment",
      partyId: createdParties[2].id,
      type: "JV",
      principalAmount: 0,
      interestRateAnnual: null,
      governingLaw: "DE",
      venueJurisdiction: "DE",
      effectiveDate: "2024-03-01",
      maturityDate: null,
      internalOwner: "Alice Admin",
      counterpartyRiskRating: "Low",
      performanceStatus: "Draft",
      enforcementStage: "None",
      isClientVisible: true,
      isSecured: false,
      isPersonalGuarantee: false
    },
    {
      title: "Equipment Lease #992",
      partyId: createdParties[4].id,
      type: "Lease",
      principalAmount: 75000,
      interestRateAnnual: 5.0,
      governingLaw: "NV",
      venueJurisdiction: "NV",
      effectiveDate: "2022-06-01",
      maturityDate: "2024-06-01",
      internalOwner: "Charlie Collections",
      counterpartyRiskRating: "High",
      performanceStatus: "InDefault",
      enforcementStage: "Dunning2",
      isClientVisible: false,
      isSecured: true,
      isPersonalGuarantee: true
    },
    {
      title: "Personal Loan - R. Chen",
      partyId: createdParties[3].id,
      type: "Loan",
      principalAmount: 25000,
      interestRateAnnual: 10.0,
      governingLaw: "NY",
      venueJurisdiction: "NY",
      effectiveDate: "2023-09-01",
      maturityDate: "2024-09-01",
      internalOwner: "Charlie Collections",
      counterpartyRiskRating: "High",
      performanceStatus: "InDefault",
      enforcementStage: "DemandLetter",
      isClientVisible: false,
      isSecured: false,
      isPersonalGuarantee: true
    },
    {
      title: "Failed Venture Note",
      partyId: createdParties[1].id,
      type: "Loan",
      principalAmount: 200000,
      interestRateAnnual: 7.0,
      governingLaw: "CA",
      venueJurisdiction: "CA",
      effectiveDate: "2021-01-01",
      maturityDate: "2023-01-01",
      internalOwner: "Bob Broker",
      counterpartyRiskRating: "High",
      performanceStatus: "WrittenOff",
      enforcementStage: "PostJudgmentCollection",
      isClientVisible: false,
      isSecured: false,
      isPersonalGuarantee: false
    }
  ];

  const createdAgreements = await db.insert(agreements).values(agreementData).returning();
  console.log(`Created ${createdAgreements.length} agreements`);

  // Seed activities
  const activityData = [
    {
      agreementId: createdAgreements[3].id,
      partyId: null,
      type: "Email",
      content: "Sent overdue notice #1 to CFO.",
      date: subDays(new Date(), 15).toISOString(),
      user: "Charlie Collections"
    },
    {
      agreementId: createdAgreements[3].id,
      partyId: null,
      type: "Call",
      content: "Left voicemail for Accounts Payable.",
      date: subDays(new Date(), 10).toISOString(),
      user: "Charlie Collections"
    },
    {
      agreementId: createdAgreements[3].id,
      partyId: null,
      type: "LetterSent",
      content: "Formal Dunning Letter 2 sent via Certified Mail.",
      date: subDays(new Date(), 2).toISOString(),
      user: "Charlie Collections"
    },
    {
      agreementId: createdAgreements[0].id,
      partyId: null,
      type: "Meeting",
      content: "Quarterly performance review with founders.",
      date: subDays(new Date(), 30).toISOString(),
      user: "Alice Admin"
    }
  ];

  const createdActivities = await db.insert(activities).values(activityData).returning();
  console.log(`Created ${createdActivities.length} activities`);

  // Seed documents (mock - no actual files)
  const documentData = [
    {
      agreementId: createdAgreements[0].id,
      partyId: null,
      name: "Executed_Note_vFinal.pdf",
      type: "PDF",
      dateUploaded: "2023-01-15",
      filePath: null
    },
    {
      agreementId: createdAgreements[3].id,
      partyId: null,
      name: "Lease_Agreement_Signed.pdf",
      type: "PDF",
      dateUploaded: "2022-06-01",
      filePath: null
    },
    {
      agreementId: createdAgreements[3].id,
      partyId: null,
      name: "Dunning_Letter_1.pdf",
      type: "PDF",
      dateUploaded: subDays(new Date(), 15).toISOString(),
      filePath: null
    }
  ];

  const createdDocuments = await db.insert(documents).values(documentData).returning();
  console.log(`Created ${createdDocuments.length} documents`);

  console.log("✅ Database seeded successfully!");
}

seed()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Error seeding database:", error);
    process.exit(1);
  });
