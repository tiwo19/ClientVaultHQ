import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertUserSchema, insertPartySchema, insertPersonSchema, insertAgreementSchema, insertActivitySchema, insertDocumentSchema, insertContactPointSchema, insertAddressSchema, insertEngagementSchema, insertEngagementMembershipSchema, insertEngagementPartySchema, insertEngagementAgreementSchema, engagementRoles, type EngagementRole, insertEnforcementCaseSchema, insertEnforcementNoticeSchema, insertEnforcementDocumentSchema, insertEnforcementResponseSchema, insertEnforcementTimelineSchema, insertEnforcementAffidavitSchema, insertEnforcementDeliveryProofSchema, insertEvidenceExportSchema, enforcementStatuses, noticeTiers } from "@shared/schema";
import { generateNoticeContent, validateNoticePrerequisites, mapNoticeTypeToTier, getNoticeTitleFromType, type AINoticeType } from "./enforcement/aiAuthor";
import { z } from "zod";
import bcrypt from "bcrypt";
import session from "express-session";
import createMemoryStore from "memorystore";
import multer from "multer";
import path from "path";
import fs from "fs";
import OpenAI from "openai";
import Stripe from "stripe";
import { prepareForAnalysis, isPreprocessingError } from "./services/documentPreprocessor";
import { uploadToS3, getSignedDownloadUrl, deleteFromS3, generateS3Key, isS3Configured } from "./services/s3Storage";
import { enforceGovernance, getEffectivePolicy, previewDecision } from "./middleware/enforceGovernance";
import { publishPolicy, listPolicyVersions, getPublishedPolicy, createPersona, getAllPersonas, getAIActionsForContext, createApprovalRequest, reviewApproval } from "./governance/registry";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "");

const CREDITS_PER_DOLLAR = 100;

// the newest OpenAI model is "gpt-5" which was released August 7, 2025. do not change this unless explicitly requested by the user
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const MemoryStore = createMemoryStore(session);

// Setup file upload - use memory storage for S3 uploads, fallback to disk for local
const uploadDir = path.join(process.cwd(), "uploads");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Memory storage for S3 uploads
const memoryUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 } // 50MB limit
});

// Disk storage for local fallback
const diskUpload = multer({
  storage: multer.diskStorage({
    destination: uploadDir,
    filename: (req, file, cb) => {
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
      cb(null, uniqueSuffix + '-' + file.originalname);
    }
  })
});

// Use memory upload if S3 is configured, otherwise disk
const upload = memoryUpload;

declare module "express-session" {
  interface SessionData {
    userId: string;
  }
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  
  // Trust proxy for production (Replit uses reverse proxy)
  if (process.env.NODE_ENV === 'production') {
    app.set('trust proxy', 1);
  }
  
  // Session middleware with memory store
  app.use(
    session({
      store: new MemoryStore({
        checkPeriod: 86400000 // prune expired entries every 24h
      }),
      secret: process.env.SESSION_SECRET || 'work-digital-secret-key-change-in-prod',
      resave: false,
      saveUninitialized: false,
      cookie: {
        maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
        secure: process.env.NODE_ENV === 'production',
        httpOnly: true,
        sameSite: 'lax',
      },
    })
  );

  // Auth middleware
  const requireAuth = (req: any, res: any, next: any) => {
    if (!req.session.userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    next();
  };

  // Admin middleware - requires user to be authenticated AND have Admin role
  const requireAdmin = async (req: any, res: any, next: any) => {
    if (!req.session.userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    const user = await storage.getUser(req.session.userId);
    if (!user || user.role !== "Admin") {
      return res.status(403).json({ error: "Forbidden: Admin access required" });
    }
    next();
  };

  // ==================== AUTH ROUTES ====================
  
  app.post("/api/auth/login", async (req, res) => {
    try {
      const { email, password } = req.body;
      const user = await storage.getUserByEmail(email);
      
      if (!user) {
        return res.status(401).json({ error: "Invalid credentials" });
      }

      const validPassword = await bcrypt.compare(password, user.password);
      if (!validPassword) {
        return res.status(401).json({ error: "Invalid credentials" });
      }

      req.session.userId = user.id;
      const { password: _, ...userWithoutPassword } = user;
      res.json({ user: userWithoutPassword });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/auth/logout", (req, res) => {
    req.session.destroy(() => {
      res.json({ success: true });
    });
  });

  app.get("/api/auth/me", async (req, res) => {
    if (!req.session.userId) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    const user = await storage.getUser(req.session.userId);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    const { password: _, ...userWithoutPassword } = user;
    res.json({ user: userWithoutPassword });
  });

  // ==================== USER ROUTES ====================
  
  app.get("/api/users", requireAdmin, async (req, res) => {
    try {
      const users = await storage.getAllUsers();
      const usersWithoutPasswords = users.map(({ password, ...user }) => user);
      res.json(usersWithoutPasswords);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/users", requireAdmin, async (req, res) => {
    try {
      const userData = insertUserSchema.parse(req.body);
      const hashedPassword = await bcrypt.hash(userData.password, 10);
      const user = await storage.createUser({ ...userData, password: hashedPassword });
      const { password: _, ...userWithoutPassword } = user;
      res.json(userWithoutPassword);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors });
      }
      res.status(500).json({ error: error.message });
    }
  });

  app.delete("/api/users/:id", requireAdmin, async (req, res) => {
    try {
      await storage.deleteUser(req.params.id);
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/users/:id/credits", requireAdmin, async (req, res) => {
    try {
      const { amount, description } = req.body;
      const numAmount = Number(amount);
      
      if (!Number.isInteger(numAmount) || numAmount < 1 || numAmount > 1000000) {
        return res.status(400).json({ error: "Amount must be a whole number between 1 and 1,000,000" });
      }
      
      const targetUser = await storage.getUser(req.params.id);
      if (!targetUser) {
        return res.status(404).json({ error: "User not found" });
      }
      
      await storage.addCredits(
        req.params.id,
        numAmount,
        description || `Admin credit adjustment by ${req.session.userId}`,
        undefined
      );
      
      const newBalance = await storage.getUserCredits(req.params.id);
      res.json({ success: true, credits: newBalance });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // ==================== PARTY ROUTES ====================
  
  app.get("/api/parties", requireAuth, async (req, res) => {
    try {
      const parties = await storage.getAllParties();
      res.json(parties);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/parties", requireAuth, async (req, res) => {
    try {
      const partyData = insertPartySchema.parse(req.body);
      const party = await storage.createParty(partyData);
      res.json(party);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors });
      }
      res.status(500).json({ error: error.message });
    }
  });

  app.put("/api/parties/:id", requireAuth, async (req, res) => {
    try {
      const updateData = req.body;
      const updated = await storage.updateParty(req.params.id, updateData);
      if (!updated) {
        return res.status(404).json({ error: "Party not found" });
      }
      res.json(updated);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.delete("/api/parties/:id", requireAdmin, async (req, res) => {
    try {
      await storage.deleteParty(req.params.id);
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // ==================== PERSON ROUTES ====================
  
  app.get("/api/persons", requireAuth, async (req, res) => {
    try {
      const persons = await storage.getAllPersons();
      res.json(persons);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/persons", requireAuth, async (req, res) => {
    try {
      const personData = insertPersonSchema.parse(req.body);
      const person = await storage.createPerson(personData);
      res.json(person);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors });
      }
      res.status(500).json({ error: error.message });
    }
  });

  app.delete("/api/persons/:id", requireAuth, async (req, res) => {
    try {
      await storage.deletePerson(req.params.id);
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // ==================== CONTACT POINTS ROUTES ====================

  app.get("/api/parties/:partyId/contact-points", requireAuth, async (req, res) => {
    try {
      const contactPoints = await storage.getContactPointsByParty(req.params.partyId);
      res.json(contactPoints);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/persons/:personId/contact-points", requireAuth, async (req, res) => {
    try {
      const contactPoints = await storage.getContactPointsByPerson(req.params.personId);
      res.json(contactPoints);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/contact-points", requireAuth, async (req, res) => {
    try {
      const cpData = insertContactPointSchema.parse(req.body);
      
      if (cpData.ownerType === "party" && !cpData.partyId) {
        return res.status(400).json({ error: "partyId is required when ownerType is 'party'" });
      }
      if (cpData.ownerType === "person" && !cpData.personId) {
        return res.status(400).json({ error: "personId is required when ownerType is 'person'" });
      }
      if (!cpData.value || !cpData.value.trim()) {
        return res.status(400).json({ error: "Contact point value is required" });
      }
      if (cpData.type === "email" && !cpData.value.includes("@")) {
        return res.status(400).json({ error: "Invalid email address format" });
      }
      
      const cp = await storage.createContactPoint({
        ...cpData,
        value: cpData.value.trim()
      });
      res.json(cp);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors });
      }
      res.status(500).json({ error: error.message });
    }
  });

  app.put("/api/contact-points/:id", requireAuth, async (req, res) => {
    try {
      const updated = await storage.updateContactPoint(req.params.id, req.body);
      if (!updated) {
        return res.status(404).json({ error: "Contact point not found" });
      }
      res.json(updated);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.delete("/api/contact-points/:id", requireAuth, async (req, res) => {
    try {
      await storage.deleteContactPoint(req.params.id);
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // ==================== ADDRESSES ROUTES ====================

  app.get("/api/parties/:partyId/addresses", requireAuth, async (req, res) => {
    try {
      const addresses = await storage.getAddressesByParty(req.params.partyId);
      res.json(addresses);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/persons/:personId/addresses", requireAuth, async (req, res) => {
    try {
      const addresses = await storage.getAddressesByPerson(req.params.personId);
      res.json(addresses);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/addresses", requireAuth, async (req, res) => {
    try {
      const addrData = insertAddressSchema.parse(req.body);
      
      if (addrData.ownerType === "party" && !addrData.partyId) {
        return res.status(400).json({ error: "partyId is required when ownerType is 'party'" });
      }
      if (addrData.ownerType === "person" && !addrData.personId) {
        return res.status(400).json({ error: "personId is required when ownerType is 'person'" });
      }
      if (!addrData.street1 || !addrData.street1.trim()) {
        return res.status(400).json({ error: "Street address is required" });
      }
      if (!addrData.city || !addrData.city.trim()) {
        return res.status(400).json({ error: "City is required" });
      }
      
      const addr = await storage.createAddress({
        ...addrData,
        street1: addrData.street1.trim(),
        street2: addrData.street2?.trim() || undefined,
        city: addrData.city.trim(),
        state: addrData.state?.trim() || undefined,
        postalCode: addrData.postalCode?.trim() || undefined
      });
      res.json(addr);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors });
      }
      res.status(500).json({ error: error.message });
    }
  });

  app.put("/api/addresses/:id", requireAuth, async (req, res) => {
    try {
      const updated = await storage.updateAddress(req.params.id, req.body);
      if (!updated) {
        return res.status(404).json({ error: "Address not found" });
      }
      res.json(updated);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.delete("/api/addresses/:id", requireAuth, async (req, res) => {
    try {
      await storage.deleteAddress(req.params.id);
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // ==================== AGREEMENT ROUTES ====================
  
  app.get("/api/agreements", requireAuth, async (req, res) => {
    try {
      const agreements = await storage.getAllAgreements();
      res.json(agreements);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/agreements/:id", requireAuth, async (req, res) => {
    try {
      const agreement = await storage.getAgreement(req.params.id);
      if (!agreement) {
        return res.status(404).json({ error: "Agreement not found" });
      }
      res.json(agreement);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/agreements", requireAuth, async (req, res) => {
    try {
      const agreementData = insertAgreementSchema.parse(req.body);
      const agreement = await storage.createAgreement(agreementData);
      res.json(agreement);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors });
      }
      res.status(500).json({ error: error.message });
    }
  });

  app.put("/api/agreements/:id", requireAuth, async (req, res) => {
    try {
      const updateData = req.body;
      const updated = await storage.updateAgreement(req.params.id, updateData);
      if (!updated) {
        return res.status(404).json({ error: "Agreement not found" });
      }
      res.json(updated);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.delete("/api/agreements/:id", requireAdmin, async (req, res) => {
    try {
      await storage.deleteAgreement(req.params.id);
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // ==================== ACTIVITY ROUTES ====================
  
  app.get("/api/activities", requireAuth, async (req, res) => {
    try {
      const activities = await storage.getAllActivities();
      res.json(activities);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/activities", requireAuth, async (req, res) => {
    try {
      const sessionUser = await storage.getUser(req.session.userId!);
      const userName = sessionUser?.name || "Unknown User";
      
      const activityData = insertActivitySchema.parse({
        ...req.body,
        user: userName
      });
      const activity = await storage.createActivity(activityData);
      res.json(activity);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors });
      }
      res.status(500).json({ error: error.message });
    }
  });

  app.delete("/api/activities/:id", requireAuth, async (req, res) => {
    try {
      await storage.deleteActivity(req.params.id);
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // ==================== DOCUMENT ROUTES ====================
  
  app.get("/api/documents", requireAuth, async (req, res) => {
    try {
      const documents = await storage.getAllDocuments();
      res.json(documents);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Document search endpoint for linking documents to engagements
  app.get("/api/documents/search", requireAuth, async (req, res) => {
    try {
      const { q, category, excludeEngagementId } = req.query;
      const documents = await storage.searchDocuments({
        query: q as string,
        category: category as string,
        excludeEngagementId: excludeEngagementId as string
      });
      res.json(documents);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Link existing document to engagement
  app.post("/api/documents/:id/link", requireAuth, async (req, res) => {
    try {
      const { engagementId } = req.body;
      if (!engagementId) {
        return res.status(400).json({ error: "engagementId is required" });
      }
      const document = await storage.linkDocumentToEngagement(req.params.id, engagementId);
      if (!document) {
        return res.status(404).json({ error: "Document not found" });
      }
      
      // Log to timeline
      const user = await storage.getUser(req.session.userId!);
      await storage.createActivity({
        engagementId,
        type: "DocumentLinked",
        date: new Date().toISOString(),
        content: `Document "${document.name}" linked to engagement`,
        user: user?.name || "System"
      });
      
      res.json(document);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/documents/upload", requireAuth, upload.single('file'), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "No file uploaded" });
      }

      const { agreementId, partyId, engagementId, type, category, expirationDate, notes } = req.body;
      let filePath: string;

      // Upload to S3 if configured, otherwise save locally
      if (isS3Configured()) {
        const s3Key = generateS3Key(req.file.originalname);
        await uploadToS3(req.file.buffer, s3Key, req.file.mimetype);
        filePath = `s3://${s3Key}`;
      } else {
        // Fallback to local storage - save buffer to disk
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const fileName = uniqueSuffix + '-' + req.file.originalname;
        filePath = path.join(uploadDir, fileName);
        fs.writeFileSync(filePath, req.file.buffer);
      }

      const docData = {
        agreementId: agreementId || null,
        partyId: partyId || null,
        engagementId: engagementId || null,
        name: req.file.originalname,
        type: type || "PDF",
        category: category || "Other",
        expirationDate: expirationDate || null,
        notes: notes || null,
        filePath,
        uploadedById: req.session.userId || null
      };

      const document = await storage.createDocument(docData);
      res.json(document);
    } catch (error: any) {
      console.error("Document upload error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/documents/:id/download", requireAuth, async (req, res) => {
    try {
      const documents = await storage.getAllDocuments();
      const document = documents.find(d => d.id === req.params.id);
      
      if (!document || !document.filePath) {
        return res.status(404).json({ error: "Document not found" });
      }

      // Check if document is stored in S3
      if (document.filePath.startsWith("s3://")) {
        const s3Key = document.filePath.replace("s3://", "");
        const signedUrl = await getSignedDownloadUrl(s3Key);
        return res.redirect(signedUrl);
      }

      // Fallback to local file download
      if (!fs.existsSync(document.filePath)) {
        return res.status(404).json({ error: "File not found on disk" });
      }
      res.download(document.filePath, document.name);
    } catch (error: any) {
      console.error("Document download error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.delete("/api/documents/:id", requireAuth, async (req, res) => {
    try {
      const documents = await storage.getAllDocuments();
      const document = documents.find(d => d.id === req.params.id);
      
      if (document?.filePath) {
        // Delete from S3 if stored there
        if (document.filePath.startsWith("s3://")) {
          const s3Key = document.filePath.replace("s3://", "");
          try {
            await deleteFromS3(s3Key);
          } catch (err) {
            console.error("Failed to delete from S3:", err);
          }
        } else if (fs.existsSync(document.filePath)) {
          // Delete local file
          fs.unlinkSync(document.filePath);
        }
      }

      await storage.deleteDocument(req.params.id);
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Get single document
  app.get("/api/documents/:id", requireAuth, async (req, res) => {
    try {
      const document = await storage.getDocument(req.params.id);
      if (!document) {
        return res.status(404).json({ error: "Document not found" });
      }
      res.json(document);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Get document versions
  app.get("/api/documents/:id/versions", requireAuth, async (req, res) => {
    try {
      const versions = await storage.getDocumentVersions(req.params.id);
      res.json(versions);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Upload new version of document
  app.post("/api/documents/:id/versions", requireAuth, upload.single('file'), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "No file uploaded" });
      }

      const parentDoc = await storage.getDocument(req.params.id);
      if (!parentDoc) {
        return res.status(404).json({ error: "Parent document not found" });
      }

      // Use the original document's ID as parent (for version chains)
      const parentId = parentDoc.parentDocumentId || parentDoc.id;

      let filePath: string;
      if (isS3Configured()) {
        const s3Key = generateS3Key(req.file.originalname);
        await uploadToS3(req.file.buffer, s3Key, req.file.mimetype);
        filePath = `s3://${s3Key}`;
      } else {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const fileName = uniqueSuffix + '-' + req.file.originalname;
        filePath = path.join(uploadDir, fileName);
        fs.writeFileSync(filePath, req.file.buffer);
      }

      const docData = {
        agreementId: parentDoc.agreementId,
        partyId: parentDoc.partyId,
        engagementId: parentDoc.engagementId,
        name: req.file.originalname,
        type: parentDoc.type,
        category: parentDoc.category,
        expirationDate: req.body.expirationDate || parentDoc.expirationDate,
        notes: req.body.notes || parentDoc.notes,
        filePath,
        uploadedById: req.session.userId || null
      };

      const newVersion = await storage.createDocumentVersion(parentId, docData);
      res.json(newVersion);
    } catch (error: any) {
      console.error("Document version upload error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // ==================== PARTY RELATIONSHIP ROUTES ====================

  app.get("/api/party-relationships", requireAuth, async (req, res) => {
    try {
      const relationships = await storage.getAllPartyRelationships();
      res.json(relationships);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/party-relationships/party/:partyId", requireAuth, async (req, res) => {
    try {
      const relationships = await storage.getPartyRelationshipsByParty(req.params.partyId);
      res.json(relationships);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/party-relationships", requireAuth, async (req, res) => {
    try {
      const relationship = await storage.createPartyRelationship(req.body);
      res.json(relationship);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.delete("/api/party-relationships/:id", requireAuth, async (req, res) => {
    try {
      await storage.deletePartyRelationship(req.params.id);
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // ==================== AI BUCKET ROUTES ====================

  app.post("/api/ai-bucket/analyze", requireAuth, upload.single("file"), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "No file uploaded" });
      }

      // Save buffer to temp file for preprocessing (preprocessor needs file path)
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
      const tempFileName = uniqueSuffix + '-' + req.file.originalname;
      const tempFilePath = path.join(uploadDir, tempFileName);
      fs.writeFileSync(tempFilePath, req.file.buffer);

      // Preprocess the file based on its type
      let artifact;
      try {
        artifact = await prepareForAnalysis(tempFilePath, req.file.originalname);
      } catch (error) {
        // Clean up temp file on error
        if (fs.existsSync(tempFilePath)) fs.unlinkSync(tempFilePath);
        if (isPreprocessingError(error)) {
          return res.status(400).json({ error: error.message, code: error.code });
        }
        throw error;
      }

      // Get all parties for matching
      const allParties = await storage.getAllParties();
      const partyNames = allParties.map(p => `${p.name} (ID: ${p.id}, Type: ${p.type})`).join("\n");

      const systemPrompt = `You are an assistant analyzing business documents and communications (emails, screenshots, letters, contracts) for a legal/financial management system.

Your task is to:
1. Identify which client/party this document relates to from the list provided
2. Extract the date of the communication or document (if visible)
3. Determine the type of activity (Email, Call, Meeting, LetterSent, InternalNote, CourtFiling)
4. Write a brief summary of the content
5. If no confident match is found, extract any party/company information you can find in the document

Here are the existing parties in the system:
${partyNames}

Respond with JSON in this exact format:
{
  "matchedPartyId": "the UUID of the matched party, or null if no match",
  "matchedPartyName": "name of the matched party for display, or null",
  "confidence": 0.0 to 1.0,
  "date": "YYYY-MM-DD format if found, or null",
  "activityType": "Email|Call|Meeting|LetterSent|InternalNote|CourtFiling",
  "summary": "brief summary of the document content",
  "reasoning": "brief explanation of how you matched the party or why no match was found",
  "extractedPartyInfo": {
    "name": "company or person name if found in document, or null",
    "type": "Company|Individual|Trust|Bank|JVPartner - best guess based on context, or null",
    "email": "email address if found, or null",
    "phone": "phone number if found, or null",
    "address": "address if found, or null"
  }
}

IMPORTANT: The extractedPartyInfo field should contain any party/company information you can extract from the document itself, regardless of whether a match was found. This helps users create new parties if needed.`;

      let messages: any[];
      
      if (artifact.extractedText && !artifact.imageDataUrl) {
        messages = [
          { role: "system", content: systemPrompt },
          {
            role: "user",
            content: `Analyze this ${artifact.fileType.toUpperCase()} document and extract the relevant information for our client management system.\n\n--- DOCUMENT TEXT ---\n${artifact.extractedText}`
          }
        ];
      } else if (artifact.imageDataUrl) {
        messages = [
          { role: "system", content: systemPrompt },
          {
            role: "user",
            content: [
              {
                type: "text",
                text: artifact.extractedText 
                  ? `Analyze this document and extract the relevant information for our client management system.\n\nExtracted text (may be incomplete):\n${artifact.extractedText}`
                  : "Analyze this document/image and extract the relevant information for our client management system."
              },
              {
                type: "image_url",
                image_url: { url: artifact.imageDataUrl }
              }
            ]
          }
        ];
      } else {
        return res.status(400).json({ error: "Could not extract content from file" });
      }

      const analysisResponse = await openai.chat.completions.create({
        model: "gpt-5",
        messages,
        response_format: { type: "json_object" },
        max_completion_tokens: 2048
      });

      const analysisText = analysisResponse.choices[0].message.content;
      const analysis = JSON.parse(analysisText || "{}");

      res.json({
        analysis,
        file: {
          id: tempFileName,
          path: tempFilePath,
          originalName: req.file.originalname,
          mimeType: artifact.mimeType,
          fileType: artifact.fileType
        }
      });
    } catch (error: any) {
      console.error("AI Bucket analysis error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/ai-bucket/confirm", requireAuth, async (req, res) => {
    try {
      const { partyId, date, activityType, summary, filePath, originalName } = req.body;
      
      if (!partyId || !date || !activityType || !summary) {
        return res.status(400).json({ error: "Missing required fields" });
      }

      // Validate partyId exists
      const party = await storage.getParty(partyId);
      if (!party) {
        return res.status(400).json({ error: "Invalid party" });
      }

      // Get current user
      const user = await storage.getUser(req.session.userId!);
      if (!user) {
        return res.status(401).json({ error: "User not found" });
      }

      let imageUrl: string | null = null;

      // If there's a file, validate and upload to S3 or keep locally
      if (filePath && originalName) {
        // Security: Validate the file path is within uploads directory
        const normalizedPath = path.normalize(filePath);
        const uploadsDir = path.normalize(uploadDir);
        
        if (!normalizedPath.startsWith(uploadsDir)) {
          return res.status(400).json({ error: "Invalid file path" });
        }
        
        // Verify the file exists
        if (!fs.existsSync(normalizedPath)) {
          return res.status(400).json({ error: "File not found" });
        }

        let finalFilePath: string;

        // Upload to S3 if configured
        if (isS3Configured()) {
          const fileBuffer = fs.readFileSync(normalizedPath);
          const ext = path.extname(originalName).toLowerCase();
          const mimeType = ext === '.pdf' ? 'application/pdf' : 
                          ext === '.docx' ? 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' :
                          `image/${ext.replace('.', '')}`;
          const s3Key = generateS3Key(originalName);
          await uploadToS3(fileBuffer, s3Key, mimeType);
          finalFilePath = `s3://${s3Key}`;
          // Clean up temp file after S3 upload
          fs.unlinkSync(normalizedPath);
        } else {
          finalFilePath = normalizedPath;
        }

        const doc = await storage.createDocument({
          partyId,
          agreementId: null,
          name: originalName,
          type: "Image",
          category: "Other",
          filePath: finalFilePath,
          expirationDate: null,
          notes: "Uploaded via AI Bucket"
        });
        imageUrl = `/api/documents/${doc.id}/download`;
      }

      // Create the activity
      const activity = await storage.createActivity({
        partyId,
        agreementId: null,
        type: activityType,
        content: summary,
        date,
        user: user.name,
        imageUrl
      });

      res.json({ success: true, activity });
    } catch (error: any) {
      console.error("AI Bucket confirm error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // ==================== ENGAGEMENT ROUTES ====================

  // Helper function to check engagement access
  const getEngagementAccess = async (engagementId: string, userId: string): Promise<{ hasAccess: boolean; role: EngagementRole | null; membership: any | null }> => {
    const membership = await storage.getUserEngagementMembership(engagementId, userId);
    if (!membership) {
      // Check if user is admin - admins have access to all engagements
      const user = await storage.getUser(userId);
      if (user?.role === "Admin") {
        return { hasAccess: true, role: "internal_admin" as EngagementRole, membership: null };
      }
      return { hasAccess: false, role: null, membership: null };
    }
    return { hasAccess: true, role: membership.role as EngagementRole, membership };
  };

  // Get all engagements (admin sees all, users see their memberships)
  app.get("/api/engagements", requireAuth, async (req, res) => {
    try {
      const user = await storage.getUser(req.session.userId!);
      if (!user) return res.status(401).json({ error: "User not found" });

      let engagementList;
      if (user.role === "Admin") {
        engagementList = await storage.getAllEngagements();
      } else {
        engagementList = await storage.getEngagementsForUser(user.id);
      }
      res.json(engagementList);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Get single engagement
  app.get("/api/engagements/:id", requireAuth, async (req, res) => {
    try {
      const { hasAccess } = await getEngagementAccess(req.params.id, req.session.userId!);
      if (!hasAccess) {
        return res.status(403).json({ error: "Access denied to this engagement" });
      }

      const engagement = await storage.getEngagement(req.params.id);
      if (!engagement) {
        return res.status(404).json({ error: "Engagement not found" });
      }
      res.json(engagement);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Create engagement
  app.post("/api/engagements", requireAuth, async (req, res) => {
    try {
      const engagementData = insertEngagementSchema.parse({
        ...req.body,
        createdBy: req.session.userId
      });
      const engagement = await storage.createEngagement(engagementData);

      // Automatically add creator as owner
      await storage.createEngagementMembership({
        engagementId: engagement.id,
        userId: req.session.userId!,
        role: "owner",
        invitedBy: req.session.userId
      });

      // Log the creation
      await storage.createAuditLog({
        userId: req.session.userId,
        action: "create",
        entityType: "engagement",
        entityId: engagement.id,
        engagementId: engagement.id,
        metadata: JSON.stringify({ name: engagement.name })
      });

      // Auto-create timeline entry for engagement creation
      const creatorUser = await storage.getUser(req.session.userId!);
      await storage.createActivity({
        engagementId: engagement.id,
        type: "EngagementCreated",
        content: `Engagement "${engagement.name}" was created`,
        date: new Date().toISOString().split('T')[0],
        user: creatorUser?.name || "System",
        userId: req.session.userId
      });

      res.json(engagement);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors });
      }
      res.status(500).json({ error: error.message });
    }
  });

  // Update engagement
  app.put("/api/engagements/:id", requireAuth, async (req, res) => {
    try {
      const { hasAccess, role } = await getEngagementAccess(req.params.id, req.session.userId!);
      if (!hasAccess) {
        return res.status(403).json({ error: "Access denied" });
      }
      // Only owner and internal_admin can update
      if (role !== "owner" && role !== "internal_admin") {
        return res.status(403).json({ error: "Insufficient permissions to update engagement" });
      }

      // Get old engagement to detect status change
      const oldEngagement = await storage.getEngagement(req.params.id);
      
      const engagement = await storage.updateEngagement(req.params.id, req.body);
      if (!engagement) {
        return res.status(404).json({ error: "Engagement not found" });
      }

      await storage.createAuditLog({
        userId: req.session.userId,
        action: "update",
        entityType: "engagement",
        entityId: engagement.id,
        engagementId: engagement.id,
        metadata: JSON.stringify(req.body)
      });

      // Auto-create timeline entry for status change
      if (oldEngagement && req.body.status && oldEngagement.status !== req.body.status) {
        const actingUser = await storage.getUser(req.session.userId!);
        await storage.createActivity({
          engagementId: engagement.id,
          type: "StatusChanged",
          content: `Status changed from "${oldEngagement.status}" to "${req.body.status}"`,
          date: new Date().toISOString().split('T')[0],
          user: actingUser?.name || "System",
          userId: req.session.userId
        });
      }

      res.json(engagement);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Delete engagement (owner only)
  app.delete("/api/engagements/:id", requireAuth, async (req, res) => {
    try {
      const { hasAccess, role } = await getEngagementAccess(req.params.id, req.session.userId!);
      if (!hasAccess || role !== "owner") {
        return res.status(403).json({ error: "Only the owner can delete an engagement" });
      }

      await storage.createAuditLog({
        userId: req.session.userId,
        action: "delete",
        entityType: "engagement",
        entityId: req.params.id,
        metadata: JSON.stringify({ deletedAt: new Date().toISOString() })
      });

      await storage.deleteEngagement(req.params.id);
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // ==================== ENGAGEMENT MEMBERSHIP ROUTES ====================

  // Get available users for adding to engagement (owner/admin of engagement can see all users)
  app.get("/api/engagements/:id/available-users", requireAuth, async (req, res) => {
    try {
      const { hasAccess, role } = await getEngagementAccess(req.params.id, req.session.userId!);
      if (!hasAccess) {
        return res.status(403).json({ error: "Access denied" });
      }
      // Only owner and internal_admin can see available users
      if (role !== "owner" && role !== "internal_admin") {
        return res.status(403).json({ error: "Insufficient permissions" });
      }

      const allUsers = await storage.getAllUsers();
      const existingMemberships = await storage.getEngagementMemberships(req.params.id);
      const existingUserIds = existingMemberships.map(m => m.userId);
      
      // Filter out users already in engagement, return without passwords
      const availableUsers = allUsers
        .filter(u => !existingUserIds.includes(u.id))
        .map(({ password, ...user }) => user);
      
      res.json(availableUsers);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Get memberships for an engagement
  app.get("/api/engagements/:id/members", requireAuth, async (req, res) => {
    try {
      const { hasAccess } = await getEngagementAccess(req.params.id, req.session.userId!);
      if (!hasAccess) {
        return res.status(403).json({ error: "Access denied" });
      }

      const memberships = await storage.getEngagementMemberships(req.params.id);
      // Enrich with user info
      const enrichedMemberships = await Promise.all(
        memberships.map(async (m) => {
          const user = await storage.getUser(m.userId);
          return {
            ...m,
            user: user ? { id: user.id, name: user.name, email: user.email } : null
          };
        })
      );
      res.json(enrichedMemberships);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Add member to engagement
  app.post("/api/engagements/:id/members", requireAuth, async (req, res) => {
    try {
      const { hasAccess, role } = await getEngagementAccess(req.params.id, req.session.userId!);
      if (!hasAccess) {
        return res.status(403).json({ error: "Access denied" });
      }
      // Only owner and internal_admin can add members
      if (role !== "owner" && role !== "internal_admin") {
        return res.status(403).json({ error: "Insufficient permissions to add members" });
      }

      const membershipData = insertEngagementMembershipSchema.parse({
        ...req.body,
        engagementId: req.params.id,
        invitedBy: req.session.userId
      });

      // Check if user is already a member
      const existing = await storage.getUserEngagementMembership(req.params.id, membershipData.userId);
      if (existing) {
        return res.status(400).json({ error: "User is already a member of this engagement" });
      }

      const membership = await storage.createEngagementMembership(membershipData);

      // Audit log
      await storage.createAuditLog({
        userId: req.session.userId,
        action: "invite",
        entityType: "engagement_membership",
        entityId: membership.id,
        engagementId: req.params.id,
        metadata: JSON.stringify({ invitedUserId: membershipData.userId, role: membershipData.role })
      });

      // Auto-create timeline entry
      const invitedUser = await storage.getUser(membershipData.userId);
      const actingUser = await storage.getUser(req.session.userId!);
      await storage.createActivity({
        engagementId: req.params.id,
        type: "MemberAdded",
        content: `${invitedUser?.name || "User"} was added as ${membershipData.role}`,
        date: new Date().toISOString().split('T')[0],
        user: actingUser?.name || "System",
        userId: req.session.userId
      });

      res.json(membership);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors });
      }
      res.status(500).json({ error: error.message });
    }
  });

  // Update membership role
  app.put("/api/engagements/:engagementId/members/:membershipId", requireAuth, async (req, res) => {
    try {
      const { hasAccess, role } = await getEngagementAccess(req.params.engagementId, req.session.userId!);
      if (!hasAccess) {
        return res.status(403).json({ error: "Access denied" });
      }
      if (role !== "owner" && role !== "internal_admin") {
        return res.status(403).json({ error: "Insufficient permissions" });
      }

      const membership = await storage.updateEngagementMembership(req.params.membershipId, req.body);
      res.json(membership);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Remove member from engagement
  app.delete("/api/engagements/:engagementId/members/:membershipId", requireAuth, async (req, res) => {
    try {
      const { hasAccess, role } = await getEngagementAccess(req.params.engagementId, req.session.userId!);
      if (!hasAccess) {
        return res.status(403).json({ error: "Access denied" });
      }
      if (role !== "owner" && role !== "internal_admin") {
        return res.status(403).json({ error: "Insufficient permissions" });
      }

      // Get member info before deletion for timeline
      const memberships = await storage.getEngagementMemberships(req.params.engagementId);
      const membership = memberships.find((m: any) => m.id === req.params.membershipId);
      const removedUser = membership ? await storage.getUser(membership.userId) : null;

      await storage.createAuditLog({
        userId: req.session.userId,
        action: "remove_member",
        entityType: "engagement_membership",
        entityId: req.params.membershipId,
        engagementId: req.params.engagementId
      });

      await storage.deleteEngagementMembership(req.params.membershipId);

      // Auto-create timeline entry
      const actingUser = await storage.getUser(req.session.userId!);
      await storage.createActivity({
        engagementId: req.params.engagementId,
        type: "MemberRemoved",
        content: `${removedUser?.name || "User"} was removed from the engagement`,
        date: new Date().toISOString().split('T')[0],
        user: actingUser?.name || "System",
        userId: req.session.userId
      });

      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // ==================== ENGAGEMENT PARTIES ROUTES ====================

  // Get parties linked to an engagement
  app.get("/api/engagements/:id/parties", requireAuth, async (req, res) => {
    try {
      const { hasAccess } = await getEngagementAccess(req.params.id, req.session.userId!);
      if (!hasAccess) {
        return res.status(403).json({ error: "Access denied" });
      }

      const engagementPartyLinks = await storage.getEngagementParties(req.params.id);
      // Enrich with party details
      const enriched = await Promise.all(
        engagementPartyLinks.map(async (ep) => {
          const party = await storage.getParty(ep.partyId);
          return { ...ep, party };
        })
      );
      res.json(enriched);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Add party to engagement
  app.post("/api/engagements/:id/parties", requireAuth, async (req, res) => {
    try {
      const { hasAccess, role } = await getEngagementAccess(req.params.id, req.session.userId!);
      if (!hasAccess) {
        return res.status(403).json({ error: "Access denied" });
      }
      if (!["owner", "internal_admin", "internal_user"].includes(role || "")) {
        return res.status(403).json({ error: "Insufficient permissions" });
      }

      const data = insertEngagementPartySchema.parse({
        ...req.body,
        engagementId: req.params.id
      });
      const link = await storage.addPartyToEngagement(data);

      // Auto-create timeline entry
      const party = await storage.getParty(data.partyId);
      const actingUser = await storage.getUser(req.session.userId!);
      await storage.createActivity({
        engagementId: req.params.id,
        type: "PartyLinked",
        content: `Party "${party?.name || "Unknown"}" was linked to the engagement${data.roleInEngagement ? ` as ${data.roleInEngagement}` : ""}`,
        date: new Date().toISOString().split('T')[0],
        user: actingUser?.name || "System",
        userId: req.session.userId
      });

      res.json(link);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors });
      }
      res.status(500).json({ error: error.message });
    }
  });

  // Remove party from engagement
  app.delete("/api/engagements/:engagementId/parties/:linkId", requireAuth, async (req, res) => {
    try {
      const { hasAccess, role } = await getEngagementAccess(req.params.engagementId, req.session.userId!);
      if (!hasAccess) {
        return res.status(403).json({ error: "Access denied" });
      }
      if (!["owner", "internal_admin", "internal_user"].includes(role || "")) {
        return res.status(403).json({ error: "Insufficient permissions" });
      }

      // Get party info before deletion for timeline
      const engagementParties = await storage.getEngagementParties(req.params.engagementId);
      const partyLink = engagementParties.find((ep: any) => ep.id === req.params.linkId);
      const party = partyLink ? await storage.getParty(partyLink.partyId) : null;

      await storage.removePartyFromEngagement(req.params.linkId);

      // Auto-create timeline entry
      const actingUser = await storage.getUser(req.session.userId!);
      await storage.createActivity({
        engagementId: req.params.engagementId,
        type: "PartyUnlinked",
        content: `Party "${party?.name || "Unknown"}" was removed from the engagement`,
        date: new Date().toISOString().split('T')[0],
        user: actingUser?.name || "System",
        userId: req.session.userId
      });

      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // ==================== ENGAGEMENT AGREEMENTS ROUTES ====================

  // Get agreements linked to an engagement
  app.get("/api/engagements/:id/agreements", requireAuth, async (req, res) => {
    try {
      const { hasAccess } = await getEngagementAccess(req.params.id, req.session.userId!);
      if (!hasAccess) {
        return res.status(403).json({ error: "Access denied" });
      }

      const engagementAgreementLinks = await storage.getEngagementAgreements(req.params.id);
      // Enrich with agreement details
      const enriched = await Promise.all(
        engagementAgreementLinks.map(async (ea) => {
          const agreement = await storage.getAgreement(ea.agreementId);
          return { ...ea, agreement };
        })
      );
      res.json(enriched);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Add agreement to engagement
  app.post("/api/engagements/:id/agreements", requireAuth, async (req, res) => {
    try {
      const { hasAccess, role } = await getEngagementAccess(req.params.id, req.session.userId!);
      if (!hasAccess) {
        return res.status(403).json({ error: "Access denied" });
      }
      if (!["owner", "internal_admin", "internal_user"].includes(role || "")) {
        return res.status(403).json({ error: "Insufficient permissions" });
      }

      const data = insertEngagementAgreementSchema.parse({
        ...req.body,
        engagementId: req.params.id
      });
      const link = await storage.addAgreementToEngagement(data);

      // Auto-create timeline entry
      const agreement = await storage.getAgreement(data.agreementId);
      const actingUser = await storage.getUser(req.session.userId!);
      await storage.createActivity({
        engagementId: req.params.id,
        type: "AgreementLinked",
        content: `Agreement "${agreement?.title || "Unknown"}" was linked to the engagement`,
        date: new Date().toISOString().split('T')[0],
        user: actingUser?.name || "System",
        userId: req.session.userId
      });

      res.json(link);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors });
      }
      res.status(500).json({ error: error.message });
    }
  });

  // Remove agreement from engagement
  app.delete("/api/engagements/:engagementId/agreements/:linkId", requireAuth, async (req, res) => {
    try {
      const { hasAccess, role } = await getEngagementAccess(req.params.engagementId, req.session.userId!);
      if (!hasAccess) {
        return res.status(403).json({ error: "Access denied" });
      }
      if (!["owner", "internal_admin", "internal_user"].includes(role || "")) {
        return res.status(403).json({ error: "Insufficient permissions" });
      }

      // Get agreement info before deletion for timeline
      const engagementAgreements = await storage.getEngagementAgreements(req.params.engagementId);
      const agreementLink = engagementAgreements.find((ea: any) => ea.id === req.params.linkId);
      const agreement = agreementLink ? await storage.getAgreement(agreementLink.agreementId) : null;

      await storage.removeAgreementFromEngagement(req.params.linkId);

      // Auto-create timeline entry
      const actingUser = await storage.getUser(req.session.userId!);
      await storage.createActivity({
        engagementId: req.params.engagementId,
        type: "AgreementUnlinked",
        content: `Agreement "${agreement?.title || "Unknown"}" was removed from the engagement`,
        date: new Date().toISOString().split('T')[0],
        user: actingUser?.name || "System",
        userId: req.session.userId
      });

      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // ==================== ENGAGEMENT DOCUMENTS ROUTES ====================

  // Get documents for an engagement
  app.get("/api/engagements/:id/documents", requireAuth, async (req, res) => {
    try {
      const { hasAccess } = await getEngagementAccess(req.params.id, req.session.userId!);
      if (!hasAccess) {
        return res.status(403).json({ error: "Access denied" });
      }

      const docs = await storage.getDocumentsByEngagement(req.params.id);
      res.json(docs);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Upload document to engagement
  app.post("/api/engagements/:id/documents", requireAuth, upload.single('file'), async (req, res) => {
    try {
      const { hasAccess, role } = await getEngagementAccess(req.params.id, req.session.userId!);
      if (!hasAccess) {
        return res.status(403).json({ error: "Access denied" });
      }
      // Only owner, internal_admin, internal_user, external_partner can upload documents
      if (!["owner", "internal_admin", "internal_user", "external_partner"].includes(role || "")) {
        return res.status(403).json({ error: "Insufficient permissions to upload documents" });
      }

      if (!req.file) {
        return res.status(400).json({ error: "No file uploaded" });
      }

      const { type, category, expirationDate, notes } = req.body;
      let filePath: string;

      if (isS3Configured()) {
        const s3Key = generateS3Key(req.file.originalname);
        await uploadToS3(req.file.buffer, s3Key, req.file.mimetype);
        filePath = `s3://${s3Key}`;
      } else {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const fileName = uniqueSuffix + '-' + req.file.originalname;
        filePath = path.join(uploadDir, fileName);
        fs.writeFileSync(filePath, req.file.buffer);
      }

      const docData = {
        engagementId: req.params.id,
        name: req.file.originalname,
        type: type || "PDF",
        category: category || "Other",
        expirationDate: expirationDate || null,
        notes: notes || null,
        filePath,
        uploadedById: req.session.userId || null
      };

      const document = await storage.createDocument(docData);

      // Auto-create timeline entry for document upload
      const user = await storage.getUser(req.session.userId!);
      await storage.createActivity({
        engagementId: req.params.id,
        type: "DocumentUploaded",
        content: `Document "${document.name}" was uploaded`,
        user: user?.name || "Unknown",
        userId: req.session.userId,
        date: new Date().toISOString().split('T')[0]
      });

      // Create audit log
      await storage.createAuditLog({
        userId: req.session.userId!,
        engagementId: req.params.id,
        action: "document_uploaded",
        entityType: "document",
        entityId: document.id,
        metadata: JSON.stringify({ fileName: document.name, category: document.category })
      });

      res.json(document);
    } catch (error: any) {
      console.error("Engagement document upload error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Delete document from engagement
  app.delete("/api/engagements/:engagementId/documents/:documentId", requireAuth, async (req, res) => {
    try {
      const { hasAccess, role } = await getEngagementAccess(req.params.engagementId, req.session.userId!);
      if (!hasAccess) {
        return res.status(403).json({ error: "Access denied" });
      }
      // Only owner, internal_admin can delete documents
      if (!["owner", "internal_admin"].includes(role || "")) {
        return res.status(403).json({ error: "Insufficient permissions to delete documents" });
      }

      const document = await storage.getDocument(req.params.documentId);
      if (!document) {
        return res.status(404).json({ error: "Document not found" });
      }

      // Delete file from storage
      if (document.filePath) {
        if (document.filePath.startsWith("s3://")) {
          const s3Key = document.filePath.replace("s3://", "");
          try {
            await deleteFromS3(s3Key);
          } catch (err) {
            console.error("Failed to delete from S3:", err);
          }
        } else if (fs.existsSync(document.filePath)) {
          fs.unlinkSync(document.filePath);
        }
      }

      await storage.deleteDocument(req.params.documentId);

      // Auto-create timeline entry for document deletion
      const user = await storage.getUser(req.session.userId!);
      await storage.createActivity({
        engagementId: req.params.engagementId,
        type: "DocumentDeleted",
        content: `Document "${document.name}" was deleted`,
        user: user?.name || "Unknown",
        userId: req.session.userId,
        date: new Date().toISOString().split('T')[0]
      });

      // Create audit log
      await storage.createAuditLog({
        userId: req.session.userId!,
        engagementId: req.params.engagementId,
        action: "document_deleted",
        entityType: "document",
        entityId: req.params.documentId,
        metadata: JSON.stringify({ fileName: document.name })
      });

      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // ==================== ENGAGEMENT TIMELINE ROUTES ====================

  // Get engagement timeline (activities)
  app.get("/api/engagements/:id/timeline", requireAuth, async (req, res) => {
    try {
      const { hasAccess, role } = await getEngagementAccess(req.params.id, req.session.userId!);
      if (!hasAccess) {
        return res.status(403).json({ error: "Access denied" });
      }
      // All roles can view timeline
      if (!["owner", "internal_admin", "internal_user", "external_partner", "viewer", "auditor"].includes(role || "")) {
        return res.status(403).json({ error: "Insufficient permissions" });
      }

      const { type, startDate, endDate } = req.query;
      const filters: { type?: string; startDate?: string; endDate?: string } = {};
      if (type) filters.type = type as string;
      if (startDate) filters.startDate = startDate as string;
      if (endDate) filters.endDate = endDate as string;

      const activities = await storage.getActivitiesByEngagement(req.params.id, filters);
      res.json(activities);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Create engagement timeline entry
  app.post("/api/engagements/:id/timeline", requireAuth, async (req, res) => {
    try {
      const { hasAccess, role } = await getEngagementAccess(req.params.id, req.session.userId!);
      if (!hasAccess) {
        return res.status(403).json({ error: "Access denied" });
      }
      // Only owner, internal_admin, internal_user can add timeline entries
      if (!["owner", "internal_admin", "internal_user"].includes(role || "")) {
        return res.status(403).json({ error: "Insufficient permissions" });
      }

      const user = await storage.getUser(req.session.userId!);
      const activity = await storage.createActivity({
        ...req.body,
        engagementId: req.params.id,
        userId: req.session.userId,
        user: user?.name || "Unknown",
        date: req.body.date || new Date().toISOString().split('T')[0],
      });

      // Create audit log entry
      await storage.createAuditLog({
        userId: req.session.userId!,
        engagementId: req.params.id,
        action: "timeline_entry_added",
        entityType: "activity",
        entityId: activity.id,
        metadata: JSON.stringify({ type: activity.type, content: activity.content.substring(0, 100) }),
      });

      res.json(activity);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors });
      }
      res.status(500).json({ error: error.message });
    }
  });

  // Delete engagement timeline entry
  app.delete("/api/engagements/:engagementId/timeline/:activityId", requireAuth, async (req, res) => {
    try {
      const { hasAccess, role } = await getEngagementAccess(req.params.engagementId, req.session.userId!);
      if (!hasAccess) {
        return res.status(403).json({ error: "Access denied" });
      }
      if (!["owner", "internal_admin"].includes(role || "")) {
        return res.status(403).json({ error: "Insufficient permissions" });
      }

      await storage.deleteActivity(req.params.activityId);

      // Create audit log entry
      await storage.createAuditLog({
        userId: req.session.userId!,
        engagementId: req.params.engagementId,
        action: "timeline_entry_deleted",
        entityType: "activity",
        entityId: req.params.activityId,
      });

      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // ==================== ENGAGEMENT TASKS ROUTES ====================

  // Get tasks for an engagement
  app.get("/api/engagements/:id/tasks", requireAuth, async (req, res) => {
    try {
      const { hasAccess } = await getEngagementAccess(req.params.id, req.session.userId!);
      if (!hasAccess) {
        return res.status(403).json({ error: "Access denied" });
      }
      const taskList = await storage.getTasksByEngagement(req.params.id);
      res.json(taskList);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Create task in engagement
  app.post("/api/engagements/:id/tasks", requireAuth, async (req, res) => {
    try {
      const { hasAccess, role } = await getEngagementAccess(req.params.id, req.session.userId!);
      if (!hasAccess) {
        return res.status(403).json({ error: "Access denied" });
      }
      // Only owner, internal_admin, internal_user can create tasks
      if (!["owner", "internal_admin", "internal_user"].includes(role || "")) {
        return res.status(403).json({ error: "Insufficient permissions to create tasks" });
      }

      const task = await storage.createTask({
        ...req.body,
        engagementId: req.params.id,
        createdById: req.session.userId,
      });

      // Auto-create timeline entry for task creation
      const user = await storage.getUser(req.session.userId!);
      await storage.createActivity({
        engagementId: req.params.id,
        type: "TaskCreated",
        content: `Task "${task.title}" was created`,
        userId: req.session.userId,
        user: user?.name || "Unknown",
        date: new Date().toISOString().split('T')[0],
      });

      res.json(task);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Update task
  app.put("/api/engagements/:engagementId/tasks/:taskId", requireAuth, async (req, res) => {
    try {
      const { hasAccess, role } = await getEngagementAccess(req.params.engagementId, req.session.userId!);
      if (!hasAccess) {
        return res.status(403).json({ error: "Access denied" });
      }
      if (!["owner", "internal_admin", "internal_user"].includes(role || "")) {
        return res.status(403).json({ error: "Insufficient permissions" });
      }

      const oldTask = await storage.getTask(req.params.taskId);
      const updateData: any = { ...req.body };
      
      // Set completedAt if transitioning to Completed status
      if (req.body.status === "Completed" && oldTask?.status !== "Completed") {
        updateData.completedAt = new Date();
      }
      // Clear completedAt if transitioning away from Completed
      if (req.body.status && req.body.status !== "Completed" && oldTask?.status === "Completed") {
        updateData.completedAt = null;
      }

      const task = await storage.updateTask(req.params.taskId, updateData);
      if (!task) {
        return res.status(404).json({ error: "Task not found" });
      }

      // Auto-create timeline entry for task completion
      if (req.body.status === "Completed" && oldTask?.status !== "Completed") {
        const user = await storage.getUser(req.session.userId!);
        await storage.createActivity({
          engagementId: req.params.engagementId,
          type: "TaskCompleted",
          content: `Task "${task.title}" was completed`,
          userId: req.session.userId,
          user: user?.name || "Unknown",
          date: new Date().toISOString().split('T')[0],
        });
      }

      res.json(task);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Delete task
  app.delete("/api/engagements/:engagementId/tasks/:taskId", requireAuth, async (req, res) => {
    try {
      const { hasAccess, role } = await getEngagementAccess(req.params.engagementId, req.session.userId!);
      if (!hasAccess) {
        return res.status(403).json({ error: "Access denied" });
      }
      if (!["owner", "internal_admin"].includes(role || "")) {
        return res.status(403).json({ error: "Insufficient permissions" });
      }

      const task = await storage.getTask(req.params.taskId);
      await storage.deleteTask(req.params.taskId);

      // Auto-create timeline entry
      if (task) {
        const user = await storage.getUser(req.session.userId!);
        await storage.createActivity({
          engagementId: req.params.engagementId,
          type: "TaskDeleted",
          content: `Task "${task.title}" was deleted`,
          userId: req.session.userId,
          user: user?.name || "Unknown",
          date: new Date().toISOString().split('T')[0],
        });
      }

      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // ==================== AUDIT LOG ROUTES ====================

  // Get audit logs (admin only for global, or engagement-scoped for members)
  app.get("/api/audit-logs", requireAuth, async (req, res) => {
    try {
      const { engagementId } = req.query;
      
      if (engagementId) {
        const { hasAccess, role } = await getEngagementAccess(engagementId as string, req.session.userId!);
        if (!hasAccess) {
          return res.status(403).json({ error: "Access denied" });
        }
        // Only owner, admin, auditor can see audit logs
        if (!["owner", "internal_admin", "auditor"].includes(role || "")) {
          return res.status(403).json({ error: "Insufficient permissions to view audit logs" });
        }
        const logs = await storage.getAuditLogs(engagementId as string);
        return res.json(logs);
      }

      // Global audit logs - admin only
      const user = await storage.getUser(req.session.userId!);
      if (user?.role !== "Admin") {
        return res.status(403).json({ error: "Admin access required for global audit logs" });
      }
      const logs = await storage.getAuditLogs();
      res.json(logs);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // ==================== ENGAGEMENT EXPORTS ROUTES ====================

  // Export engagement timeline as CSV
  app.get("/api/engagements/:id/export/timeline", requireAuth, async (req, res) => {
    try {
      const { hasAccess, role } = await getEngagementAccess(req.params.id, req.session.userId!);
      if (!hasAccess) {
        return res.status(403).json({ error: "Access denied" });
      }
      // Only owner, internal_admin, auditor can export
      if (!["owner", "internal_admin", "auditor"].includes(role || "")) {
        return res.status(403).json({ error: "Insufficient permissions to export" });
      }

      const activities = await storage.getActivitiesByEngagement(req.params.id, {});
      const engagement = await storage.getEngagement(req.params.id);
      
      // Generate CSV
      const csvHeader = "Date,Type,User,Content\n";
      const csvRows = activities.map((a: any) => {
        const date = a.date || "";
        const type = a.type || "";
        const user = a.user || "";
        const content = (a.content || "").replace(/"/g, '""').replace(/\n/g, " ");
        return `"${date}","${type}","${user}","${content}"`;
      }).join("\n");
      
      const csv = csvHeader + csvRows;
      const filename = `${engagement?.name || "engagement"}_timeline_${new Date().toISOString().split('T')[0]}.csv`;
      
      res.setHeader("Content-Type", "text/csv");
      res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
      res.send(csv);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Export engagement documents list as CSV
  app.get("/api/engagements/:id/export/documents", requireAuth, async (req, res) => {
    try {
      const { hasAccess, role } = await getEngagementAccess(req.params.id, req.session.userId!);
      if (!hasAccess) {
        return res.status(403).json({ error: "Access denied" });
      }
      if (!["owner", "internal_admin", "auditor"].includes(role || "")) {
        return res.status(403).json({ error: "Insufficient permissions to export" });
      }

      const documents = await storage.getDocumentsByEngagement(req.params.id);
      const engagement = await storage.getEngagement(req.params.id);
      
      const csvHeader = "Name,Type,Category,Version,Date Uploaded,Expiration Date,Notes\n";
      const csvRows = documents.map((d: any) => {
        const name = (d.name || "").replace(/"/g, '""');
        const type = d.type || "";
        const category = d.category || "";
        const version = d.version || 1;
        const dateUploaded = d.dateUploaded || "";
        const expirationDate = d.expirationDate || "";
        const notes = (d.notes || "").replace(/"/g, '""').replace(/\n/g, " ");
        return `"${name}","${type}","${category}","${version}","${dateUploaded}","${expirationDate}","${notes}"`;
      }).join("\n");
      
      const csv = csvHeader + csvRows;
      const filename = `${engagement?.name || "engagement"}_documents_${new Date().toISOString().split('T')[0]}.csv`;
      
      res.setHeader("Content-Type", "text/csv");
      res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
      res.send(csv);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Export engagement tasks as CSV
  app.get("/api/engagements/:id/export/tasks", requireAuth, async (req, res) => {
    try {
      const { hasAccess, role } = await getEngagementAccess(req.params.id, req.session.userId!);
      if (!hasAccess) {
        return res.status(403).json({ error: "Access denied" });
      }
      if (!["owner", "internal_admin", "auditor"].includes(role || "")) {
        return res.status(403).json({ error: "Insufficient permissions to export" });
      }

      const taskList = await storage.getTasksByEngagement(req.params.id);
      const engagement = await storage.getEngagement(req.params.id);
      const allUsers = await storage.getAllUsers();
      
      const csvHeader = "Title,Description,Priority,Status,Due Date,Assignee,Created At,Completed At\n";
      const csvRows = taskList.map((t: any) => {
        const title = (t.title || "").replace(/"/g, '""');
        const description = (t.description || "").replace(/"/g, '""').replace(/\n/g, " ");
        const priority = t.priority || "";
        const status = t.status || "";
        const dueDate = t.dueDate || "";
        const assignee = allUsers.find((u: any) => u.id === t.assigneeId)?.name || "";
        const createdAt = t.createdAt ? new Date(t.createdAt).toISOString().split('T')[0] : "";
        const completedAt = t.completedAt ? new Date(t.completedAt).toISOString().split('T')[0] : "";
        return `"${title}","${description}","${priority}","${status}","${dueDate}","${assignee}","${createdAt}","${completedAt}"`;
      }).join("\n");
      
      const csv = csvHeader + csvRows;
      const filename = `${engagement?.name || "engagement"}_tasks_${new Date().toISOString().split('T')[0]}.csv`;
      
      res.setHeader("Content-Type", "text/csv");
      res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
      res.send(csv);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Export engagement summary as JSON (can be used for reports)
  app.get("/api/engagements/:id/export/summary", requireAuth, async (req, res) => {
    try {
      const { hasAccess, role } = await getEngagementAccess(req.params.id, req.session.userId!);
      if (!hasAccess) {
        return res.status(403).json({ error: "Access denied" });
      }
      if (!["owner", "internal_admin", "auditor"].includes(role || "")) {
        return res.status(403).json({ error: "Insufficient permissions to export" });
      }

      const engagement = await storage.getEngagement(req.params.id);
      const members = await storage.getEngagementMemberships(req.params.id);
      const parties = await storage.getEngagementParties(req.params.id);
      const agreements = await storage.getEngagementAgreements(req.params.id);
      const documents = await storage.getDocumentsByEngagement(req.params.id);
      const tasks = await storage.getTasksByEngagement(req.params.id);
      const timeline = await storage.getActivitiesByEngagement(req.params.id, {});
      
      const summary = {
        engagement,
        statistics: {
          memberCount: members.length,
          partyCount: parties.length,
          agreementCount: agreements.length,
          documentCount: documents.length,
          taskCount: tasks.length,
          openTasks: tasks.filter((t: any) => t.status === "Open" || t.status === "InProgress").length,
          completedTasks: tasks.filter((t: any) => t.status === "Completed").length,
          timelineEntries: timeline.length
        },
        exportedAt: new Date().toISOString(),
        exportedBy: req.session.userId
      };
      
      const filename = `${engagement?.name || "engagement"}_summary_${new Date().toISOString().split('T')[0]}.json`;
      
      res.setHeader("Content-Type", "application/json");
      res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
      res.json(summary);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // ==================== GOVERNANCE ROUTES ====================

  // Get effective governance policy for a context
  app.get("/api/governance/effective", requireAuth, async (req, res) => {
    try {
      const { clientId, projectId, artifactId, personaKey } = req.query;
      
      const result = await getEffectivePolicy(
        clientId as string,
        projectId as string,
        artifactId as string
      );

      res.json(result);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Preview governance decision without side effects
  app.post("/api/governance/preview", requireAuth, async (req, res) => {
    try {
      const { clientId, projectId, artifactId, personaKey, actionType } = req.body;
      
      if (!actionType) {
        return res.status(400).json({ error: "actionType is required" });
      }

      const result = await previewDecision(
        clientId,
        projectId,
        artifactId,
        personaKey,
        actionType,
        req.session.userId
      );

      res.json({
        allow: result.allow,
        requiresSupervisor: result.requiresSupervisor,
        reasons: result.reasons
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Publish a governance policy
  app.post("/api/governance/policies", requireAuth, async (req, res) => {
    try {
      const user = await storage.getUser(req.session.userId!);
      if (user?.role !== "Admin") {
        return res.status(403).json({ error: "Admin access required" });
      }

      const { scopeType, scopeId, policyJson } = req.body;
      
      if (!scopeType || !policyJson) {
        return res.status(400).json({ error: "scopeType and policyJson are required" });
      }

      const result = await publishPolicy(
        scopeType,
        scopeId || null,
        policyJson,
        req.session.userId!
      );

      res.json(result);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // List policy versions for a scope
  app.get("/api/governance/policies", requireAuth, async (req, res) => {
    try {
      const { scopeType, scopeId } = req.query;
      
      if (!scopeType) {
        return res.status(400).json({ error: "scopeType is required" });
      }

      const versions = await listPolicyVersions(
        scopeType as string,
        scopeId as string || null
      );

      res.json(versions);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Get AI personas
  app.get("/api/governance/personas", requireAuth, async (req, res) => {
    try {
      const personas = await getAllPersonas();
      res.json(personas);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Create AI persona (admin only)
  app.post("/api/governance/personas", requireAuth, async (req, res) => {
    try {
      const user = await storage.getUser(req.session.userId!);
      if (user?.role !== "Admin") {
        return res.status(403).json({ error: "Admin access required" });
      }

      const { key, name, description, capabilities } = req.body;
      
      if (!key || !name) {
        return res.status(400).json({ error: "key and name are required" });
      }

      const persona = await createPersona({
        key,
        name,
        description,
        capabilities: capabilities ? JSON.stringify(capabilities) : undefined
      });

      res.json(persona);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Get AI actions log
  app.get("/api/ai/actions", requireAuth, async (req, res) => {
    try {
      const { clientId, projectId, artifactId } = req.query;
      
      const actions = await getAIActionsForContext(
        clientId as string,
        projectId as string,
        artifactId as string
      );

      res.json(actions);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Request supervisor approval
  app.post("/api/governance/approvals", requireAuth, async (req, res) => {
    try {
      const { aiActionsLogId } = req.body;
      
      if (!aiActionsLogId) {
        return res.status(400).json({ error: "aiActionsLogId is required" });
      }

      const approval = await createApprovalRequest(aiActionsLogId, req.session.userId!);
      res.json(approval);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Review approval (admin/supervisor only)
  app.patch("/api/governance/approvals/:id", requireAuth, async (req, res) => {
    try {
      const user = await storage.getUser(req.session.userId!);
      if (user?.role !== "Admin") {
        return res.status(403).json({ error: "Admin/Supervisor access required" });
      }

      const { status, notes } = req.body;
      
      if (!status || !["APPROVED", "REJECTED"].includes(status)) {
        return res.status(400).json({ error: "Valid status (APPROVED/REJECTED) is required" });
      }

      const approval = await reviewApproval(req.params.id, req.session.userId!, status, notes);
      res.json(approval);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // ==================== AI ADVISOR ROUTES ====================

  // AI Advisor - analyze engagement and answer questions
  app.post("/api/engagements/:id/ai-advisor", requireAuth, async (req, res) => {
    try {
      const { hasAccess, role } = await getEngagementAccess(req.params.id, req.session.userId!);
      if (!hasAccess) {
        return res.status(403).json({ error: "Access denied" });
      }
      // Only owner, internal_admin, internal_user can use AI advisor
      if (!["owner", "internal_admin", "internal_user"].includes(role || "")) {
        return res.status(403).json({ error: "Insufficient permissions to use AI Advisor" });
      }

      const { question } = req.body;
      if (!question || typeof question !== "string") {
        return res.status(400).json({ error: "Question is required" });
      }

      // Gather engagement context
      const engagement = await storage.getEngagement(req.params.id);
      const parties = await storage.getEngagementParties(req.params.id);
      const agreements = await storage.getEngagementAgreements(req.params.id);
      const documents = await storage.getDocumentsByEngagement(req.params.id);
      const tasks = await storage.getTasksByEngagement(req.params.id);
      const recentTimeline = (await storage.getActivitiesByEngagement(req.params.id, {})).slice(0, 20);

      // Get party and agreement details
      const partyDetails = await Promise.all(
        parties.map(async (ep: any) => {
          const party = await storage.getParty(ep.partyId);
          return { ...ep, party };
        })
      );
      
      const agreementDetails = await Promise.all(
        agreements.map(async (ea: any) => {
          const agreement = await storage.getAgreement(ea.agreementId);
          return { ...ea, agreement };
        })
      );

      // Build context for AI
      const context = `
You are a legal and business advisor helping analyze an engagement/matter. Here is the context:

ENGAGEMENT:
- Name: ${engagement?.name}
- Type: ${engagement?.type}
- Status: ${engagement?.status}
- Description: ${engagement?.description || "None"}
- Reference Number: ${engagement?.referenceNumber || "None"}

PARTIES INVOLVED (${partyDetails.length}):
${partyDetails.map((p: any) => `- ${p.party?.name} (${p.party?.type}) - Role: ${p.roleInEngagement || "Not specified"}`).join("\n")}

AGREEMENTS (${agreementDetails.length}):
${agreementDetails.map((a: any) => `- ${a.agreement?.title} (${a.agreement?.type}) - Status: ${a.agreement?.status}, Value: ${a.agreement?.currency || ""} ${a.agreement?.amount || "N/A"}`).join("\n")}

DOCUMENTS (${documents.length}):
${documents.slice(0, 10).map((d: any) => `- ${d.name} (${d.category})`).join("\n")}
${documents.length > 10 ? `... and ${documents.length - 10} more documents` : ""}

TASKS (${tasks.length}):
${tasks.map((t: any) => `- [${t.status}] ${t.title} (Priority: ${t.priority}${t.dueDate ? `, Due: ${t.dueDate}` : ""})`).join("\n")}

RECENT TIMELINE (last 20 entries):
${recentTimeline.map((a: any) => `- ${a.date}: [${a.type}] ${a.content}`).join("\n")}
`;

      // Call OpenAI
      const OpenAI = (await import("openai")).default;
      const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

      const completion = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          {
            role: "system",
            content: `You are a helpful legal and business advisor for a contract management system. Provide clear, actionable insights based on the engagement data. Be concise but thorough. If asked about risks, deadlines, or recommendations, provide specific and practical advice. Format your response in a readable way using markdown.`
          },
          {
            role: "user",
            content: `${context}\n\nUSER QUESTION: ${question}`
          }
        ],
        max_tokens: 1000,
        temperature: 0.7
      });

      const answer = completion.choices[0]?.message?.content || "I couldn't generate a response. Please try again.";

      // Log AI advisor usage
      await storage.createActivity({
        engagementId: req.params.id,
        type: "AIAdvisorQuery",
        content: `AI Advisor was consulted: "${question.substring(0, 100)}${question.length > 100 ? "..." : ""}"`,
        userId: req.session.userId,
        user: (await storage.getUser(req.session.userId!))?.name || "Unknown",
        date: new Date().toISOString().split('T')[0]
      });

      res.json({ answer });
    } catch (error: any) {
      console.error("AI Advisor error:", error);
      res.status(500).json({ error: "Failed to get AI advisor response. Please try again." });
    }
  });

  // ==================== CREDITS & STRIPE ROUTES ====================

  app.get("/api/credits", requireAuth, async (req, res) => {
    try {
      const credits = await storage.getUserCredits(req.session.userId!);
      res.json({ credits });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/credits/transactions", requireAuth, async (req, res) => {
    try {
      const transactions = await storage.getCreditTransactions(req.session.userId!);
      res.json(transactions);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/stripe/create-checkout-session", requireAuth, async (req, res) => {
    try {
      const { amount } = req.body;
      
      const numAmount = Number(amount);
      if (!Number.isInteger(numAmount) || numAmount < 5 || numAmount > 1000) {
        return res.status(400).json({ error: "Amount must be a whole number between $5 and $1000" });
      }

      const user = await storage.getUser(req.session.userId!);
      if (!user) {
        return res.status(401).json({ error: "User not found" });
      }

      const creditsToAdd = numAmount * CREDITS_PER_DOLLAR;
      const baseUrl = `${req.protocol}://${req.get('host')}`;

      const session = await stripe.checkout.sessions.create({
        payment_method_types: ["card"],
        line_items: [
          {
            price_data: {
              currency: "usd",
              product_data: {
                name: `${creditsToAdd} Credits`,
                description: `Purchase ${creditsToAdd} credits for LegalFlow ($1 = ${CREDITS_PER_DOLLAR} credits)`,
              },
              unit_amount: numAmount * 100,
            },
            quantity: 1,
          },
        ],
        mode: "payment",
        success_url: `${baseUrl}/credits?success=true&session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${baseUrl}/credits?canceled=true`,
        customer_email: user.email,
        metadata: {
          userId: user.id,
          creditsToAdd: creditsToAdd.toString(),
        },
      });

      res.json({ url: session.url });
    } catch (error: any) {
      console.error("Stripe checkout error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/stripe/webhook", async (req: Request, res: Response) => {
    const sig = req.headers["stripe-signature"] as string;
    const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;

    let event: Stripe.Event;

    try {
      if (endpointSecret) {
        event = stripe.webhooks.constructEvent(
          (req as any).rawBody,
          sig,
          endpointSecret
        );
      } else {
        event = req.body as Stripe.Event;
      }
    } catch (err: any) {
      console.error("Webhook signature verification failed:", err.message);
      return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;
      
      const userId = session.metadata?.userId;
      const creditsToAdd = parseInt(session.metadata?.creditsToAdd || "0", 10);

      if (userId && creditsToAdd > 0) {
        try {
          await storage.addCredits(
            userId,
            creditsToAdd,
            `Purchased ${creditsToAdd} credits`,
            session.payment_intent as string
          );
          console.log(`Added ${creditsToAdd} credits to user ${userId}`);
        } catch (error) {
          console.error("Error adding credits:", error);
        }
      }
    }

    res.json({ received: true });
  });

  app.get("/api/stripe/verify-session/:sessionId", requireAuth, async (req, res) => {
    try {
      const session = await stripe.checkout.sessions.retrieve(req.params.sessionId);
      
      if (session.payment_status === "paid") {
        const userId = session.metadata?.userId;
        const creditsToAdd = parseInt(session.metadata?.creditsToAdd || "0", 10);
        
        if (userId && userId === req.session.userId && creditsToAdd > 0) {
          const currentCredits = await storage.getUserCredits(userId);
          res.json({ 
            success: true, 
            credits: currentCredits,
            added: creditsToAdd 
          });
        } else {
          res.json({ success: false, error: "Session mismatch" });
        }
      } else {
        res.json({ success: false, error: "Payment not completed" });
      }
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // ==================== ENFORCEMENT ENGINE ROUTES ====================

  // Get all enforcement cases
  app.get("/api/enforcement/cases", requireAuth, async (req, res) => {
    try {
      const cases = await storage.getAllEnforcementCases();
      res.json(cases);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Get enforcement case by ID with related data
  app.get("/api/enforcement/cases/:id", requireAuth, async (req, res) => {
    try {
      const enfCase = await storage.getEnforcementCase(req.params.id);
      if (!enfCase) {
        return res.status(404).json({ error: "Enforcement case not found" });
      }
      
      const [notices, documents, responses, timeline] = await Promise.all([
        storage.getEnforcementNotices(req.params.id),
        storage.getEnforcementDocuments(req.params.id),
        storage.getEnforcementResponses(req.params.id),
        storage.getEnforcementTimeline(req.params.id)
      ]);
      
      res.json({ ...enfCase, notices, documents, responses, timeline });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Get enforcement cases by engagement
  app.get("/api/engagements/:engagementId/enforcement/cases", requireAuth, async (req, res) => {
    try {
      const cases = await storage.getEnforcementCasesByEngagement(req.params.engagementId);
      res.json(cases);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Get enforcement cases by agreement
  app.get("/api/agreements/:agreementId/enforcement/cases", requireAuth, async (req, res) => {
    try {
      const cases = await storage.getEnforcementCasesByAgreement(req.params.agreementId);
      res.json(cases);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Create enforcement case
  app.post("/api/enforcement/cases", requireAuth, async (req, res) => {
    try {
      const parsed = insertEnforcementCaseSchema.parse(req.body);
      const enfCase = await storage.createEnforcementCase({
        ...parsed,
        createdById: req.session.userId!
      });
      
      // Create initial timeline event
      await storage.createEnforcementTimelineEvent({
        caseId: enfCase.id,
        eventType: "case_created",
        description: `Enforcement case opened: ${parsed.caseNumber}`,
        createdById: req.session.userId!
      });
      
      res.status(201).json(enfCase);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  // Update enforcement case status
  app.patch("/api/enforcement/cases/:id", requireAuth, async (req, res) => {
    try {
      const { status, ...updates } = req.body;
      
      const existingCase = await storage.getEnforcementCase(req.params.id);
      if (!existingCase) {
        return res.status(404).json({ error: "Enforcement case not found" });
      }
      
      // Validate status transition if status is being changed
      if (status && status !== existingCase.status) {
        const validTransitions: Record<string, string[]> = {
          monitoring: ["notice_phase", "resolved"],
          notice_phase: ["default_declared", "resolved"],
          default_declared: ["estoppel_established", "resolved"],
          estoppel_established: ["litigation_ready", "resolved"],
          litigation_ready: ["resolved"],
          resolved: []
        };
        
        if (!validTransitions[existingCase.status]?.includes(status)) {
          return res.status(400).json({ 
            error: `Invalid status transition from ${existingCase.status} to ${status}` 
          });
        }
      }
      
      const updated = await storage.updateEnforcementCase(req.params.id, { status, ...updates });
      
      // Log status change
      if (status && status !== existingCase.status) {
        await storage.createEnforcementTimelineEvent({
          caseId: req.params.id,
          eventType: "status_changed",
          description: `Case status updated from ${existingCase.status} to ${status}`,
          createdById: req.session.userId!
        });
      }
      
      res.json(updated);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  // Get notices for a case
  app.get("/api/enforcement/cases/:caseId/notices", requireAuth, async (req, res) => {
    try {
      const notices = await storage.getEnforcementNotices(req.params.caseId);
      res.json(notices);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Create enforcement notice (enforces tier sequence)
  app.post("/api/enforcement/cases/:caseId/notices", requireAuth, async (req, res) => {
    try {
      const parsed = insertEnforcementNoticeSchema.parse({
        ...req.body,
        caseId: req.params.caseId
      });
      
      // Check tier sequence - tiers are text like tier1_administrative, tier2_opportunity, etc.
      const existingNotices = await storage.getEnforcementNotices(req.params.caseId);
      const tierOrder = ["tier1_administrative", "tier2_opportunity", "tier3_default", "tier4_estoppel"];
      const existingTierIndices = existingNotices.map(n => tierOrder.indexOf(n.tier)).filter(i => i >= 0);
      const maxTierIndex = existingTierIndices.length > 0 ? Math.max(...existingTierIndices) : -1;
      const expectedTierIndex = maxTierIndex + 1;
      const newTierIndex = tierOrder.indexOf(parsed.tier);
      
      if (newTierIndex !== expectedTierIndex && expectedTierIndex < tierOrder.length) {
        return res.status(400).json({ 
          error: `Invalid tier sequence. Expected ${tierOrder[expectedTierIndex]}, got ${parsed.tier}. Notices must be sent in order.`
        });
      }
      
      const notice = await storage.createEnforcementNotice({
        ...parsed,
        createdById: req.session.userId!
      });
      
      // Update case status to notice_phase if this is the first notice
      const enfCase = await storage.getEnforcementCase(req.params.caseId);
      if (enfCase?.status === "monitoring") {
        await storage.updateEnforcementCase(req.params.caseId, { status: "notice_phase" });
      }
      
      const tierNames: Record<string, string> = {
        tier1_administrative: "Administrative Notice",
        tier2_opportunity: "Opportunity to Cure",
        tier3_default: "Notice of Default",
        tier4_estoppel: "Notice of Estoppel"
      };
      await storage.createEnforcementTimelineEvent({
        caseId: req.params.caseId,
        eventType: "notice_drafted",
        noticeId: notice.id,
        description: `${tierNames[parsed.tier] || parsed.tier} created${parsed.responseDeadlineDate ? ` with deadline ${parsed.responseDeadlineDate}` : ''}`,
        createdById: req.session.userId!
      });
      
      res.status(201).json(notice);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  // Update notice (e.g., mark as sent, notarized)
  app.patch("/api/enforcement/notices/:id", requireAuth, async (req, res) => {
    try {
      const notice = await storage.getEnforcementNotice(req.params.id);
      if (!notice) {
        return res.status(404).json({ error: "Notice not found" });
      }
      
      const updates = req.body;
      
      // If marking as sent, record sent date
      if (updates.status === "sent" && notice.status === "draft") {
        updates.deliverySentAt = new Date();
      }
      
      const updated = await storage.updateEnforcementNotice(req.params.id, updates);
      
      // Log significant events
      if (updates.status === "sent") {
        await storage.createEnforcementTimelineEvent({
          caseId: notice.caseId,
          eventType: "notice_sent",
          noticeId: notice.id,
          description: `${notice.tier.replace('_', ' ')} sent to counterparty`,
          createdById: req.session.userId!
        });
      }
      
      if (updates.notarizedAt) {
        await storage.createEnforcementTimelineEvent({
          caseId: notice.caseId,
          eventType: "notice_notarized",
          noticeId: notice.id,
          description: `${notice.tier.replace('_', ' ')} has been notarized`,
          createdById: req.session.userId!
        });
      }
      
      res.json(updated);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  // Get enforcement documents
  app.get("/api/enforcement/cases/:caseId/documents", requireAuth, async (req, res) => {
    try {
      const documents = await storage.getEnforcementDocuments(req.params.caseId);
      res.json(documents);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Add document to enforcement case
  app.post("/api/enforcement/cases/:caseId/documents", requireAuth, async (req, res) => {
    try {
      const parsed = insertEnforcementDocumentSchema.parse({
        ...req.body,
        caseId: req.params.caseId
      });
      
      const doc = await storage.createEnforcementDocument({
        ...parsed,
        uploadedById: req.session.userId!
      });
      
      await storage.createEnforcementTimelineEvent({
        caseId: req.params.caseId,
        eventType: "evidence_locked",
        description: `Evidence document added: ${parsed.type} - ${parsed.name}`,
        createdById: req.session.userId!
      });
      
      res.status(201).json(doc);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  // Lock document (for court-ready evidence)
  app.post("/api/enforcement/documents/:id/lock", requireAuth, async (req, res) => {
    try {
      const doc = await storage.updateEnforcementDocument(req.params.id, {
        isLocked: true,
        lockedAt: new Date()
      });
      
      if (doc) {
        await storage.createEnforcementTimelineEvent({
          caseId: doc.caseId,
          eventType: "evidence_locked",
          description: `Document locked for evidence preservation: ${doc.name}`,
          createdById: req.session.userId!
        });
      }
      
      res.json(doc);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  // Get enforcement responses
  app.get("/api/enforcement/cases/:caseId/responses", requireAuth, async (req, res) => {
    try {
      const responses = await storage.getEnforcementResponses(req.params.caseId);
      res.json(responses);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Record counterparty response
  app.post("/api/enforcement/cases/:caseId/responses", requireAuth, async (req, res) => {
    try {
      const parsed = insertEnforcementResponseSchema.parse({
        ...req.body,
        caseId: req.params.caseId
      });
      
      const response = await storage.createEnforcementResponse({
        ...parsed,
        createdById: req.session.userId!
      });
      
      await storage.createEnforcementTimelineEvent({
        caseId: req.params.caseId,
        eventType: "response_received",
        description: `Counterparty response received via ${parsed.receivedVia}${parsed.classification ? `: ${parsed.classification}` : ''}`,
        counterpartyResponseId: response.id,
        createdById: req.session.userId!
      });
      
      res.status(201).json(response);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  // Get enforcement timeline
  app.get("/api/enforcement/cases/:caseId/timeline", requireAuth, async (req, res) => {
    try {
      const timeline = await storage.getEnforcementTimeline(req.params.caseId);
      res.json(timeline);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Add manual timeline event (e.g., notes, meetings)
  app.post("/api/enforcement/cases/:caseId/timeline", requireAuth, async (req, res) => {
    try {
      const parsed = insertEnforcementTimelineSchema.parse({
        ...req.body,
        caseId: req.params.caseId
      });
      
      const event = await storage.createEnforcementTimelineEvent({
        ...parsed,
        createdById: req.session.userId!
      });
      
      res.status(201).json(event);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  // ==================== AI NOTICE GENERATION ====================

  // Generate AI notice/affidavit
  app.post("/api/enforcement/cases/:caseId/generate", requireAuth, async (req, res) => {
    try {
      const { noticeType, deadlineDays = 15, overridePrerequisites = false } = req.body;
      
      if (!noticeType || !["notice_record", "notice_cure", "notice_default", "notice_estoppel", "affidavit_silence"].includes(noticeType)) {
        return res.status(400).json({ error: "Invalid notice type" });
      }

      const enfCase = await storage.getEnforcementCase(req.params.caseId);
      if (!enfCase) {
        return res.status(404).json({ error: "Enforcement case not found" });
      }

      // Check prerequisites
      const existingNotices = await storage.getEnforcementNotices(req.params.caseId);
      const prereqCheck = validateNoticePrerequisites(noticeType as AINoticeType, existingNotices);
      
      if (!prereqCheck.valid && !overridePrerequisites) {
        return res.status(400).json({ 
          error: prereqCheck.error,
          requiresOverride: true
        });
      }

      // Generate using AI
      const result = await generateNoticeContent(noticeType as AINoticeType, req.params.caseId, deadlineDays);
      
      if (!result.success) {
        return res.status(500).json({ error: result.error || "AI generation failed" });
      }

      // Create notice or affidavit record
      if (noticeType === "affidavit_silence") {
        const affidavit = await storage.createEnforcementAffidavit({
          caseId: req.params.caseId,
          affidavitType: "estoppel_silence",
          title: getNoticeTitleFromType(noticeType as AINoticeType),
          aiModel: result.model,
          aiPromptVersion: result.promptVersion,
          aiInputSnapshot: JSON.stringify(result.inputSnapshot),
          aiOutputText: result.content,
          status: "drafted",
          generatedById: req.session.userId!
        });

        await storage.createEnforcementTimelineEvent({
          caseId: req.params.caseId,
          eventType: "affidavit_generated",
          description: `Affidavit of Non-Response and Estoppel generated via AI`,
          createdById: req.session.userId!
        });

        return res.status(201).json({ type: "affidavit", data: affidavit, content: result.content });
      } else {
        const tier = mapNoticeTypeToTier(noticeType as AINoticeType);
        const title = getNoticeTitleFromType(noticeType as AINoticeType);
        
        const notice = await storage.createEnforcementNotice({
          caseId: req.params.caseId,
          tier,
          title,
          content: result.content,
          status: "draft",
          responseDeadlineDays: deadlineDays,
          createdById: req.session.userId!
        });

        await storage.createEnforcementTimelineEvent({
          caseId: req.params.caseId,
          eventType: "notice_generated",
          noticeId: notice.id,
          description: `${title} generated via AI (${tier})`,
          createdById: req.session.userId!
        });

        // Log if prerequisites were overridden
        if (!prereqCheck.valid && overridePrerequisites) {
          await storage.createEnforcementTimelineEvent({
            caseId: req.params.caseId,
            eventType: "admin_override",
            noticeId: notice.id,
            description: `Admin override: ${prereqCheck.error}`,
            createdById: req.session.userId!
          });
        }

        return res.status(201).json({ 
          type: "notice", 
          data: notice, 
          content: result.content,
          inputSnapshot: result.inputSnapshot
        });
      }
    } catch (error: any) {
      console.error("AI generation error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // ==================== AFFIDAVITS ====================

  // Get affidavits for a case
  app.get("/api/enforcement/cases/:caseId/affidavits", requireAuth, async (req, res) => {
    try {
      const affidavits = await storage.getEnforcementAffidavits(req.params.caseId);
      res.json(affidavits);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Update affidavit (notarization)
  app.patch("/api/enforcement/affidavits/:id", requireAuth, async (req, res) => {
    try {
      const affidavit = await storage.getEnforcementAffidavit(req.params.id);
      if (!affidavit) {
        return res.status(404).json({ error: "Affidavit not found" });
      }

      // If marking as notarized, lock the document
      if (req.body.status === "notarized" && affidavit.status !== "notarized") {
        req.body.isLocked = true;
        req.body.lockedAt = new Date();
        req.body.notarizedAt = new Date();
      }

      const updated = await storage.updateEnforcementAffidavit(req.params.id, req.body);

      if (req.body.status === "notarized" && affidavit.status !== "notarized") {
        await storage.createEnforcementTimelineEvent({
          caseId: affidavit.caseId,
          eventType: "affidavit_notarized",
          description: `Affidavit notarized by ${req.body.notaryName || 'notary'}`,
          createdById: req.session.userId!
        });
      }

      res.json(updated);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  // ==================== DELIVERY PROOFS ====================

  // Get delivery proofs for a notice
  app.get("/api/enforcement/notices/:noticeId/delivery-proofs", requireAuth, async (req, res) => {
    try {
      const proofs = await storage.getEnforcementDeliveryProofs(req.params.noticeId);
      res.json(proofs);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Get all delivery proofs for a case
  app.get("/api/enforcement/cases/:caseId/delivery-proofs", requireAuth, async (req, res) => {
    try {
      const proofs = await storage.getEnforcementDeliveryProofsByCase(req.params.caseId);
      res.json(proofs);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Add delivery proof
  app.post("/api/enforcement/notices/:noticeId/delivery-proofs", requireAuth, async (req, res) => {
    try {
      const notice = await storage.getEnforcementNotice(req.params.noticeId);
      if (!notice) {
        return res.status(404).json({ error: "Notice not found" });
      }

      const parsed = insertEnforcementDeliveryProofSchema.parse({
        ...req.body,
        noticeId: req.params.noticeId
      });

      const proof = await storage.createEnforcementDeliveryProof({
        ...parsed,
        uploadedById: req.session.userId!
      });

      // Update notice status to sent if not already
      if (notice.status === "draft" || notice.status === "notarized") {
        await storage.updateEnforcementNotice(notice.id, { 
          status: "sent",
          deliverySentAt: parsed.sentAt,
          deliveryMethod: parsed.method,
          trackingNumber: parsed.trackingNumber,
          recipientAddress: parsed.sentToAddress || parsed.sentToEmail
        });
      }

      await storage.createEnforcementTimelineEvent({
        caseId: notice.caseId,
        eventType: "notice_sent",
        noticeId: notice.id,
        description: `Notice sent via ${parsed.method}${parsed.trackingNumber ? ` (tracking: ${parsed.trackingNumber})` : ''}`,
        sentVia: parsed.method,
        createdById: req.session.userId!
      });

      res.status(201).json(proof);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  // Update delivery proof status
  app.patch("/api/enforcement/delivery-proofs/:id", requireAuth, async (req, res) => {
    try {
      const proof = await storage.updateEnforcementDeliveryProof(req.params.id, req.body);
      
      if (proof && req.body.deliveryStatus === "delivered") {
        const notice = await storage.getEnforcementNotice(proof.noticeId);
        if (notice) {
          await storage.updateEnforcementNotice(notice.id, {
            deliveryConfirmedAt: req.body.deliveredAt || new Date()
          });

          await storage.createEnforcementTimelineEvent({
            caseId: notice.caseId,
            eventType: "delivery_confirmed",
            noticeId: notice.id,
            description: `Delivery confirmed${req.body.signedBy ? ` - signed by ${req.body.signedBy}` : ''}`,
            createdById: req.session.userId!
          });
        }
      }

      res.json(proof);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  // ==================== RESPONSE CLASSIFICATION ====================

  // Classify a response
  app.patch("/api/enforcement/responses/:id/classify", requireAuth, async (req, res) => {
    try {
      const { classification, sufficiency } = req.body;
      
      const updated = await storage.updateEnforcementResponse(req.params.id, {
        classification,
        sufficiency,
        classifiedById: req.session.userId!,
        classifiedAt: new Date()
      });

      if (updated) {
        await storage.createEnforcementTimelineEvent({
          caseId: updated.caseId,
          eventType: "response_classified",
          counterpartyResponseId: updated.id,
          description: `Response classified as ${classification} (${sufficiency})`,
          createdById: req.session.userId!
        });
      }

      res.json(updated);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  // ==================== EVIDENCE EXPORTS ====================

  // Get exports for a case
  app.get("/api/enforcement/cases/:caseId/exports", requireAuth, async (req, res) => {
    try {
      const exports = await storage.getEvidenceExports(req.params.caseId);
      res.json(exports);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Request evidence binder export
  app.post("/api/enforcement/cases/:caseId/exports", requireAuth, async (req, res) => {
    try {
      const { exportType = "full" } = req.body;

      const enfCase = await storage.getEnforcementCase(req.params.caseId);
      if (!enfCase) {
        return res.status(404).json({ error: "Enforcement case not found" });
      }

      const exportRecord = await storage.createEvidenceExport({
        caseId: req.params.caseId,
        exportType,
        status: "queued",
        requestedById: req.session.userId!
      });

      await storage.createEnforcementTimelineEvent({
        caseId: req.params.caseId,
        eventType: "export_requested",
        description: `Evidence binder export requested (${exportType})`,
        createdById: req.session.userId!
      });

      // TODO: In a real implementation, this would trigger an async job
      // For now, we'll mark it as generating
      await storage.updateEvidenceExport(exportRecord.id, { status: "generating" });

      res.status(201).json(exportRecord);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  // ==================== DECLARE DEFAULT / ESTOPPEL (HUMAN IN LOOP) ====================

  // Declare default (requires confirmation)
  app.post("/api/enforcement/cases/:caseId/declare-default", requireAuth, async (req, res) => {
    try {
      const { confirmed, justification } = req.body;
      
      if (!confirmed) {
        return res.status(400).json({ 
          error: "Default declaration requires explicit confirmation",
          requiresConfirmation: true
        });
      }

      const enfCase = await storage.getEnforcementCase(req.params.caseId);
      if (!enfCase) {
        return res.status(404).json({ error: "Enforcement case not found" });
      }

      // Validate prerequisites
      if (enfCase.status !== "notice_phase") {
        return res.status(400).json({ 
          error: `Cannot declare default from status: ${enfCase.status}. Must be in notice_phase.`
        });
      }

      // Check if there's a tier3_default notice sent
      const notices = await storage.getEnforcementNotices(req.params.caseId);
      const defaultNotice = notices.find(n => n.tier === "tier3_default" && n.status === "sent");
      
      if (!defaultNotice) {
        return res.status(400).json({ 
          error: "Cannot declare default. A Tier 3 Default Notice must be sent first."
        });
      }

      const updated = await storage.updateEnforcementCase(req.params.caseId, {
        status: "default_declared",
        finalDefaultDate: new Date().toISOString().split('T')[0]
      });

      await storage.createEnforcementTimelineEvent({
        caseId: req.params.caseId,
        eventType: "default_declared",
        description: `Default formally declared${justification ? `: ${justification}` : ''}`,
        createdById: req.session.userId!
      });

      // Create audit log
      await storage.createAuditLog({
        userId: req.session.userId!,
        action: "declare_default",
        entityType: "enforcement_case",
        entityId: req.params.caseId,
        metadata: JSON.stringify({ justification, previousStatus: enfCase.status })
      });

      res.json(updated);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  // Establish estoppel (requires confirmation)
  app.post("/api/enforcement/cases/:caseId/establish-estoppel", requireAuth, async (req, res) => {
    try {
      const { confirmed, justification } = req.body;
      
      if (!confirmed) {
        return res.status(400).json({ 
          error: "Estoppel establishment requires explicit confirmation",
          requiresConfirmation: true
        });
      }

      const enfCase = await storage.getEnforcementCase(req.params.caseId);
      if (!enfCase) {
        return res.status(404).json({ error: "Enforcement case not found" });
      }

      if (enfCase.status !== "default_declared") {
        return res.status(400).json({ 
          error: `Cannot establish estoppel from status: ${enfCase.status}. Must be in default_declared.`
        });
      }

      // Check if there's a tier4_estoppel notice sent
      const notices = await storage.getEnforcementNotices(req.params.caseId);
      const estoppelNotice = notices.find(n => n.tier === "tier4_estoppel" && n.status === "sent");
      
      if (!estoppelNotice) {
        return res.status(400).json({ 
          error: "Cannot establish estoppel. A Tier 4 Estoppel Notice must be sent first."
        });
      }

      const updated = await storage.updateEnforcementCase(req.params.caseId, {
        status: "estoppel_established"
      });

      await storage.createEnforcementTimelineEvent({
        caseId: req.params.caseId,
        eventType: "estoppel_established",
        description: `Estoppel by silence formally established${justification ? `: ${justification}` : ''}`,
        createdById: req.session.userId!
      });

      await storage.createAuditLog({
        userId: req.session.userId!,
        action: "establish_estoppel",
        entityType: "enforcement_case",
        entityId: req.params.caseId,
        metadata: JSON.stringify({ justification, previousStatus: enfCase.status })
      });

      res.json(updated);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  // Lock evidence (make case court-ready)
  app.post("/api/enforcement/cases/:caseId/lock-evidence", requireAuth, async (req, res) => {
    try {
      const enfCase = await storage.getEnforcementCase(req.params.caseId);
      if (!enfCase) {
        return res.status(404).json({ error: "Enforcement case not found" });
      }

      const updated = await storage.updateEnforcementCase(req.params.caseId, {
        evidenceLock: true,
        status: "litigation_ready"
      });

      await storage.createEnforcementTimelineEvent({
        caseId: req.params.caseId,
        eventType: "evidence_locked",
        description: "Evidence record locked for litigation - no further modifications allowed",
        createdById: req.session.userId!
      });

      await storage.createAuditLog({
        userId: req.session.userId!,
        action: "lock_evidence",
        entityType: "enforcement_case",
        entityId: req.params.caseId,
        metadata: JSON.stringify({ previousStatus: enfCase.status })
      });

      res.json(updated);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  return httpServer;
}
