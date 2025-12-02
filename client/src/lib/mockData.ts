import { format, subDays, addDays } from "date-fns";

export type PartyType = "Individual" | "Company" | "Trust" | "Bank" | "JVPartner";
export type AgreementType = "LOI" | "Loan" | "JV" | "Lease" | "ServiceAgreement" | "SecurityAgreement" | "Guarantee" | "Other";
export type PerformanceStatus = "Draft" | "Sent" | "Executed" | "Performing" | "InGracePeriod" | "InDefault" | "Settled" | "WrittenOff";
export type EnforcementStage = "None" | "FriendlyReminder" | "Dunning1" | "Dunning2" | "DemandLetter" | "AttorneyReview" | "SuitFiled" | "Judgment" | "PostJudgmentCollection";
export type CounterpartyRisk = "Low" | "Medium" | "High";

export interface Party {
  id: string;
  name: string;
  type: PartyType;
  email: string;
  phone: string;
  address: string;
}

export interface Person {
  id: string;
  partyId: string; // Belongs to a party
  name: string;
  role: string; // Owner, Signer, Attorney
  email: string;
  phone: string;
}

export interface Agreement {
  id: string;
  title: string;
  partyId: string;
  type: AgreementType;
  principalAmount: number;
  interestRateAnnual: number | null;
  governingLaw: string;
  venueJurisdiction: string;
  effectiveDate: string;
  maturityDate: string | null;
  internalOwner: string;
  counterpartyRiskRating: CounterpartyRisk;
  
  // Status Fields
  performanceStatus: PerformanceStatus;
  enforcementStage: EnforcementStage;
  
  // Visibility
  isClientVisible: boolean;
  isSecured: boolean;
  isPersonalGuarantee: boolean;
}

export interface Activity {
  id: string;
  agreementId?: string;
  partyId?: string;
  type: "Call" | "Email" | "LetterSent" | "InternalNote" | "Meeting" | "CourtFiling";
  content: string;
  date: string;
  user: string;
}

export interface Document {
  id: string;
  agreementId?: string;
  partyId?: string;
  name: string;
  type: "PDF" | "DOCX" | "Image";
  dateUploaded: string;
}

// MOCK DATA STORE

export const parties: Party[] = [
  { id: "p1", name: "Apex Capital Holdings", type: "Company", email: "contact@apexcap.com", phone: "+1 212 555 0123", address: "101 Wall St, NY" },
  { id: "p2", name: "John Smith Family Trust", type: "Trust", email: "trustee@smithfamily.com", phone: "+1 310 555 9999", address: "456 Beverly Dr, CA" },
  { id: "p3", name: "Greenfield Ventures JV", type: "JVPartner", email: "partners@greenfield.com", phone: "+1 415 555 8888", address: "789 Tech Way, SF" },
  { id: "p4", name: "Robert Chen", type: "Individual", email: "r.chen@gmail.com", phone: "+1 646 555 1111", address: "12 Park Ave, NY" },
  { id: "p5", name: "Silver Lake Logistics LLC", type: "Company", email: "ops@silverlakellc.com", phone: "+1 702 555 2222", address: "88 Industrial Blvd, NV" },
];

export const persons: Person[] = [
  { id: "ps1", partyId: "p1", name: "Sarah Connor", role: "CEO", email: "sarah@apexcap.com", phone: "555-0001" },
  { id: "ps2", partyId: "p1", name: "Kyle Reese", role: "General Counsel", email: "legal@apexcap.com", phone: "555-0002" },
  { id: "ps3", partyId: "p4", name: "Robert Chen", role: "Individual", email: "r.chen@gmail.com", phone: "555-0003" },
];

export const agreements: Agreement[] = [
  // Active Pipeline
  {
    id: "a1", title: "Series A Investment Note", partyId: "p1", type: "Loan",
    principalAmount: 1500000, interestRateAnnual: 8.5, governingLaw: "NY", venueJurisdiction: "NY",
    effectiveDate: "2023-01-15", maturityDate: "2025-01-15", internalOwner: "Alice Admin",
    counterpartyRiskRating: "Low", performanceStatus: "Performing", enforcementStage: "None",
    isClientVisible: true, isSecured: true, isPersonalGuarantee: false
  },
  {
    id: "a2", title: "Bridge Loan 2024", partyId: "p3", type: "Loan",
    principalAmount: 500000, interestRateAnnual: 12.0, governingLaw: "DE", venueJurisdiction: "DE",
    effectiveDate: "2024-02-01", maturityDate: "2024-08-01", internalOwner: "Bob Broker",
    counterpartyRiskRating: "Medium", performanceStatus: "Sent", enforcementStage: "None",
    isClientVisible: false, isSecured: true, isPersonalGuarantee: true
  },
  {
    id: "a3", title: "Operating Agreement Amendment", partyId: "p3", type: "JV",
    principalAmount: 0, interestRateAnnual: null, governingLaw: "DE", venueJurisdiction: "DE",
    effectiveDate: "2024-03-01", maturityDate: null, internalOwner: "Alice Admin",
    counterpartyRiskRating: "Low", performanceStatus: "Draft", enforcementStage: "None",
    isClientVisible: true, isSecured: false, isPersonalGuarantee: false
  },
  
  // Enforcement Pipeline
  {
    id: "a4", title: "Equipment Lease #992", partyId: "p5", type: "Lease",
    principalAmount: 75000, interestRateAnnual: 5.0, governingLaw: "NV", venueJurisdiction: "NV",
    effectiveDate: "2022-06-01", maturityDate: "2024-06-01", internalOwner: "Charlie Collections",
    counterpartyRiskRating: "High", performanceStatus: "InDefault", enforcementStage: "Dunning2",
    isClientVisible: false, isSecured: true, isPersonalGuarantee: true
  },
  {
    id: "a5", title: "Personal Loan - R. Chen", partyId: "p4", type: "Loan",
    principalAmount: 25000, interestRateAnnual: 10.0, governingLaw: "NY", venueJurisdiction: "NY",
    effectiveDate: "2023-09-01", maturityDate: "2024-09-01", internalOwner: "Charlie Collections",
    counterpartyRiskRating: "High", performanceStatus: "InDefault", enforcementStage: "DemandLetter",
    isClientVisible: false, isSecured: false, isPersonalGuarantee: true
  },
  {
    id: "a6", title: "Failed Venture Note", partyId: "p2", type: "Loan",
    principalAmount: 200000, interestRateAnnual: 7.0, governingLaw: "CA", venueJurisdiction: "CA",
    effectiveDate: "2021-01-01", maturityDate: "2023-01-01", internalOwner: "Bob Broker",
    counterpartyRiskRating: "High", performanceStatus: "WrittenOff", enforcementStage: "PostJudgmentCollection",
    isClientVisible: false, isSecured: false, isPersonalGuarantee: false
  }
];

export const activities: Activity[] = [
  { id: "act1", agreementId: "a4", type: "Email", content: "Sent overdue notice #1 to CFO.", date: subDays(new Date(), 15).toISOString(), user: "Charlie Collections" },
  { id: "act2", agreementId: "a4", type: "Call", content: "Left voicemail for Accounts Payable.", date: subDays(new Date(), 10).toISOString(), user: "Charlie Collections" },
  { id: "act3", agreementId: "a4", type: "LetterSent", content: "Formal Dunning Letter 2 sent via Certified Mail.", date: subDays(new Date(), 2).toISOString(), user: "Charlie Collections" },
  { id: "act4", agreementId: "a1", type: "Meeting", content: "Quarterly performance review with founders.", date: subDays(new Date(), 30).toISOString(), user: "Alice Admin" },
];

export const documents: Document[] = [
  { id: "d1", agreementId: "a1", name: "Executed_Note_vFinal.pdf", type: "PDF", dateUploaded: "2023-01-15" },
  { id: "d2", agreementId: "a4", name: "Lease_Agreement_Signed.pdf", type: "PDF", dateUploaded: "2022-06-01" },
  { id: "d3", agreementId: "a4", name: "Dunning_Letter_1.pdf", type: "PDF", dateUploaded: subDays(new Date(), 15).toISOString() },
];
