import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertUserSchema, insertPartySchema, insertPersonSchema, insertAgreementSchema, insertActivitySchema, insertDocumentSchema, insertContactPointSchema, insertAddressSchema, insertEngagementSchema, insertEngagementMembershipSchema, insertEngagementPartySchema, insertEngagementAgreementSchema, engagementRoles, type EngagementRole } from "@shared/schema";
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
        description: `Document "${document.name}" was uploaded`,
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
        details: { fileName: document.name, category: document.category }
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
        description: `Document "${document.name}" was deleted`,
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
        details: { fileName: document.name }
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

  return httpServer;
}
