import { storage } from "../storage";
import crypto from "crypto";

interface EvidenceItem {
  type: string;
  id: string;
  name: string;
  sha256?: string;
  filePath?: string;
}

interface PacketManifest {
  generatedAt: string;
  generatedBy: string;
  caseId: string;
  caseNumber: string;
  partyName: string;
  agreementTitle: string;
  fraudScore: number;
  thresholdLevel: string;
  activeFindingsCount: number;
  exhibitCount: number;
  exhibits: EvidenceItem[];
  manifestHash: string;
}

interface PacketSummary {
  caseSummary: {
    caseId: string;
    caseNumber: string;
    status: string;
    createdAt: string;
    partyName: string;
    agreementTitle: string;
  };
  fraudAssessment: {
    scoreTotal: number;
    thresholdLevel: string;
    updatedAt: string | null;
    activeFindings: Array<{
      indicatorCode: string;
      category: string;
      confidence: string;
      summary: string | null;
      observedFacts: string[];
      evidenceLinks: Array<{ type: string; id: string }>;
    }>;
  };
  noticeHistory: Array<{
    tier: string;
    title: string;
    status: string;
    deliverySentAt: string | null;
    responseDeadlineDate: string | null;
  }>;
  responseHistory: Array<{
    receivedAt: string;
    classification: string | null;
    summary: string | null;
  }>;
  documentEvidence: Array<{
    id: string;
    name: string;
    category: string | null;
    fileHash: string | null;
  }>;
  disclaimer: string;
}

export async function generateReferralPacket(
  caseId: string,
  userId: string
): Promise<{ manifest: PacketManifest; summary: PacketSummary }> {
  const enfCase = await storage.getEnforcementCase(caseId);
  if (!enfCase) {
    throw new Error("Enforcement case not found");
  }

  if (!enfCase.agreementId) {
    throw new Error("No agreement linked to this enforcement case");
  }

  const agreement = await storage.getAgreement(enfCase.agreementId);
  if (!agreement) {
    throw new Error("Agreement not found");
  }

  const party = await storage.getParty(agreement.partyId);
  const user = await storage.getUser(userId);

  const assessment = await storage.getFraudAssessmentByCase(caseId);
  if (!assessment) {
    throw new Error("No fraud assessment found for this case");
  }

  const findings = await storage.getFraudFindingsByAssessment(assessment.id);
  const activeFindings = findings.filter(f => f.active);
  const indicators = await storage.getAllFraudIndicators();
  const indicatorMap = new Map(indicators.map(i => [i.id, i]));

  const notices = await storage.getEnforcementNotices(caseId);
  const responses = await storage.getEnforcementResponses(caseId);
  const documents = await storage.getEnforcementDocuments(caseId);

  const exhibits: EvidenceItem[] = [];

  for (const doc of documents) {
    exhibits.push({
      type: "document",
      id: doc.id,
      name: doc.name,
      sha256: doc.fileHash || undefined,
      filePath: doc.filePath || undefined
    });
  }

  for (const notice of notices.filter(n => n.status === "sent")) {
    exhibits.push({
      type: "notice",
      id: notice.id,
      name: notice.title,
      sha256: computeHash(JSON.stringify(notice))
    });
  }

  for (const response of responses) {
    exhibits.push({
      type: "response",
      id: response.id,
      name: `Response received ${new Date(response.receivedAt).toLocaleDateString()}`,
      sha256: computeHash(JSON.stringify(response))
    });
  }

  const summary: PacketSummary = {
    caseSummary: {
      caseId: enfCase.id,
      caseNumber: enfCase.caseNumber,
      status: enfCase.status,
      createdAt: enfCase.createdAt?.toISOString() || new Date().toISOString(),
      partyName: party?.name || "Unknown Party",
      agreementTitle: agreement.title
    },
    fraudAssessment: {
      scoreTotal: assessment.scoreTotal,
      thresholdLevel: assessment.thresholdLevel,
      updatedAt: assessment.updatedAt?.toISOString() || null,
      activeFindings: activeFindings.map(f => {
        const indicator = indicatorMap.get(f.fraudIndicatorId);
        return {
          indicatorCode: indicator?.code || "UNKNOWN",
          category: indicator?.category || "unknown",
          confidence: f.confidence,
          summary: f.summary,
          observedFacts: f.observedFacts ? JSON.parse(f.observedFacts) : [],
          evidenceLinks: f.evidenceLinks ? JSON.parse(f.evidenceLinks) : []
        };
      })
    },
    noticeHistory: notices.map(n => ({
      tier: n.tier,
      title: n.title,
      status: n.status,
      deliverySentAt: n.deliverySentAt?.toISOString() || null,
      responseDeadlineDate: n.responseDeadlineDate || null
    })),
    responseHistory: responses.map(r => ({
      receivedAt: r.receivedAt?.toISOString() || new Date().toISOString(),
      classification: r.classification,
      summary: r.summary
    })),
    documentEvidence: documents.map(d => ({
      id: d.id,
      name: d.name,
      category: d.category,
      fileHash: d.fileHash
    })),
    disclaimer: `IMPORTANT DISCLAIMER: This referral packet is prepared for informational purposes only and is intended to assist qualified law enforcement or regulatory authorities in evaluating potential indicators of fraudulent activity. The contents of this packet DO NOT constitute an accusation, legal finding, or determination of wrongdoing by any party. All information presented is based on patterns identified through administrative review and automated analysis. Any conclusions or actions taken based on this information should be made only after independent investigation by qualified professionals. The generating party makes no representations regarding the accuracy, completeness, or legal sufficiency of the information contained herein.`
  };

  const manifestData = {
    generatedAt: new Date().toISOString(),
    generatedBy: user?.name || user?.email || "System",
    caseId: enfCase.id,
    caseNumber: enfCase.caseNumber,
    partyName: party?.name || "Unknown Party",
    agreementTitle: agreement.title,
    fraudScore: assessment.scoreTotal,
    thresholdLevel: assessment.thresholdLevel,
    activeFindingsCount: activeFindings.length,
    exhibitCount: exhibits.length,
    exhibits
  };

  const manifestHash = computeHash(JSON.stringify(manifestData));

  const manifest: PacketManifest = {
    ...manifestData,
    manifestHash
  };

  return { manifest, summary };
}

function computeHash(data: string): string {
  return crypto.createHash("sha256").update(data).digest("hex");
}

export async function generatePacketAndStore(
  caseId: string,
  packetId: string,
  userId: string
): Promise<void> {
  try {
    const { manifest, summary } = await generateReferralPacket(caseId, userId);

    const combinedManifest = {
      ...manifest,
      summary
    };

    await storage.updateReferralPacket(packetId, {
      status: "complete",
      manifestJson: JSON.stringify(combinedManifest)
    });

    await storage.createEnforcementTimelineEvent({
      caseId,
      eventType: "ReferralPacketGenerated",
      description: `Referral packet generated with ${manifest.exhibitCount} exhibits. Manifest hash: ${manifest.manifestHash.substring(0, 16)}...`,
      createdById: userId
    });
  } catch (error: any) {
    await storage.updateReferralPacket(packetId, {
      status: "failed"
    });
    throw error;
  }
}
