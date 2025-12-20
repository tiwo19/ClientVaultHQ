import { storage } from "../storage";
import type { InsertFraudIndicator } from "@shared/schema";

const FRAUD_INDICATORS: InsertFraudIndicator[] = [
  {
    code: "MISREP_INDUCEMENT",
    category: "misrepresentation",
    description: "Material misrepresentation used to induce contract formation, investment, or payment",
    severityWeight: 8,
    requiredEvidenceTypes: JSON.stringify(["contract", "email", "marketing_material", "representation_document"])
  },
  {
    code: "WIRE_REDIRECT",
    category: "funds_flow",
    description: "Attempted or successful redirection of wire transfers or payment instructions to unauthorized accounts",
    severityWeight: 10,
    requiredEvidenceTypes: JSON.stringify(["wire_instruction", "email", "bank_statement", "communication"])
  },
  {
    code: "FAKE_AUTHORITY",
    category: "identity",
    description: "False claims of authority, credentials, licenses, or professional standing",
    severityWeight: 7,
    requiredEvidenceTypes: JSON.stringify(["credential_claim", "verification_record", "communication"])
  },
  {
    code: "INSURANCE_CLAIM",
    category: "insurance",
    description: "False or exaggerated insurance claims, policy misrepresentations, or benefit fraud indicators",
    severityWeight: 8,
    requiredEvidenceTypes: JSON.stringify(["policy_doc", "claim_form", "loss_documentation", "adjuster_report"])
  },
  {
    code: "OFFERING_SOLICITATION",
    category: "regulatory",
    description: "Potential unregistered securities offering or unlicensed investment solicitation",
    severityWeight: 9,
    requiredEvidenceTypes: JSON.stringify(["offering_document", "solicitation_material", "communication", "payment_record"])
  },
  {
    code: "DECEPTIVE_PRACTICE",
    category: "misrepresentation",
    description: "Pattern of deceptive trade practices, false advertising, or consumer protection violations",
    severityWeight: 6,
    requiredEvidenceTypes: JSON.stringify(["advertising_material", "communication", "contract", "consumer_complaint"])
  },
  {
    code: "PATTERN_MULTIPLE_VICTIMS",
    category: "pattern",
    description: "Evidence suggesting similar conduct affecting multiple parties or victims",
    severityWeight: 9,
    requiredEvidenceTypes: JSON.stringify(["victim_statement", "complaint", "public_record", "communication"])
  },
  {
    code: "IDENTITY_MISMATCH",
    category: "identity",
    description: "Discrepancies in identity documents, signatures, or personal identifying information",
    severityWeight: 7,
    requiredEvidenceTypes: JSON.stringify(["identity_document", "signature_sample", "verification_record"])
  },
  {
    code: "MAIL_WIRE_USAGE",
    category: "communications",
    description: "Use of mail or wire communications in furtherance of potentially fraudulent scheme",
    severityWeight: 5,
    requiredEvidenceTypes: JSON.stringify(["email", "letter", "wire_record", "communication"])
  },
  {
    code: "CONVERSION_MISAPPROPRIATION",
    category: "funds_flow",
    description: "Unauthorized conversion or misappropriation of funds, property, or assets",
    severityWeight: 9,
    requiredEvidenceTypes: JSON.stringify(["bank_statement", "ledger", "contract", "payment_record"])
  },
  {
    code: "FORGERY_ALTERATION",
    category: "identity",
    description: "Suspected forgery, document alteration, or false instrument creation",
    severityWeight: 8,
    requiredEvidenceTypes: JSON.stringify(["document", "original_document", "forensic_analysis"])
  },
  {
    code: "SHELL_ENTITY",
    category: "identity",
    description: "Use of shell companies, nominees, or opaque corporate structures to obscure beneficial ownership",
    severityWeight: 6,
    requiredEvidenceTypes: JSON.stringify(["corporate_record", "ownership_document", "formation_document"])
  },
  {
    code: "FALSE_STATEMENT",
    category: "misrepresentation",
    description: "Material false statements in applications, filings, or official documents",
    severityWeight: 7,
    requiredEvidenceTypes: JSON.stringify(["application", "filing", "statement", "verification_record"])
  },
  {
    code: "KICKBACK_COLLUSION",
    category: "funds_flow",
    description: "Evidence of kickbacks, undisclosed commissions, or collusive arrangements",
    severityWeight: 8,
    requiredEvidenceTypes: JSON.stringify(["payment_record", "communication", "contract", "account_statement"])
  },
  {
    code: "PONZI_INDICATORS",
    category: "regulatory",
    description: "Structural indicators of Ponzi or pyramid scheme operations",
    severityWeight: 10,
    requiredEvidenceTypes: JSON.stringify(["investor_record", "payment_pattern", "solicitation_material", "account_statement"])
  }
];

export async function seedFraudIndicators(): Promise<void> {
  console.log("Seeding fraud indicators catalog...");
  
  for (const indicator of FRAUD_INDICATORS) {
    try {
      await storage.upsertFraudIndicator(indicator);
    } catch (error) {
      console.error(`Failed to seed indicator ${indicator.code}:`, error);
    }
  }
  
  console.log(`Fraud indicators seed complete (${FRAUD_INDICATORS.length} indicators)`);
}
