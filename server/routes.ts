import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertUserSchema, insertPartySchema, insertPersonSchema, insertAgreementSchema, insertActivitySchema, insertDocumentSchema } from "@shared/schema";
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

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "");

const CREDITS_PER_DOLLAR = 100;

// the newest OpenAI model is "gpt-5" which was released August 7, 2025. do not change this unless explicitly requested by the user
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const MemoryStore = createMemoryStore(session);

// Setup file upload
const uploadDir = path.join(process.cwd(), "uploads");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const upload = multer({
  storage: multer.diskStorage({
    destination: uploadDir,
    filename: (req, file, cb) => {
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
      cb(null, uniqueSuffix + '-' + file.originalname);
    }
  })
});

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

      const { agreementId, partyId, type, category, expirationDate, notes } = req.body;
      const docData = {
        agreementId: agreementId || null,
        partyId: partyId || null,
        name: req.file.originalname,
        type: type || "PDF",
        category: category || "Other",
        expirationDate: expirationDate || null,
        notes: notes || null,
        filePath: req.file.path
      };

      const document = await storage.createDocument(docData);
      res.json(document);
    } catch (error: any) {
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

      res.download(document.filePath, document.name);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.delete("/api/documents/:id", requireAuth, async (req, res) => {
    try {
      const documents = await storage.getAllDocuments();
      const document = documents.find(d => d.id === req.params.id);
      
      if (document?.filePath && fs.existsSync(document.filePath)) {
        fs.unlinkSync(document.filePath);
      }

      await storage.deleteDocument(req.params.id);
      res.json({ success: true });
    } catch (error: any) {
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

      // Preprocess the file based on its type
      let artifact;
      try {
        artifact = await prepareForAnalysis(req.file.path, req.file.originalname);
      } catch (error) {
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
  "reasoning": "brief explanation of how you matched the party"
}`;

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
          id: req.file.filename,
          path: req.file.path,
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

      // If there's a file, validate it's in our uploads directory and create a document
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

        const doc = await storage.createDocument({
          partyId,
          agreementId: null,
          name: originalName,
          type: "Image",
          category: "Other",
          filePath: normalizedPath,
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
