import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import request from "supertest";
import express from "express";
import session from "express-session";
import createMemoryStore from "memorystore";
import bcrypt from "bcrypt";

const MemoryStore = createMemoryStore(session);

// Create a minimal test app
function createTestApp() {
  const app = express();
  app.use(express.json());
  
  app.use(
    session({
      store: new MemoryStore({ checkPeriod: 86400000 }),
      secret: "test-secret",
      resave: false,
      saveUninitialized: false,
      cookie: { secure: false },
    })
  );

  // Mock user store
  const users = new Map([
    ["admin@test.com", {
      id: "test-admin-id",
      email: "admin@test.com",
      name: "Test Admin",
      password: bcrypt.hashSync("password123", 10),
      role: "Admin",
      credits: 1000,
    }],
    ["user@test.com", {
      id: "test-user-id", 
      email: "user@test.com",
      name: "Test User",
      password: bcrypt.hashSync("password123", 10),
      role: "User",
      credits: 100,
    }],
  ]);

  // Auth routes
  app.post("/api/auth/login", async (req, res) => {
    const { email, password } = req.body;
    const user = users.get(email);
    
    if (!user) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    (req.session as any).userId = user.id;
    const { password: _, ...userWithoutPassword } = user;
    res.json({ user: userWithoutPassword });
  });

  app.post("/api/auth/logout", (req, res) => {
    req.session.destroy(() => {
      res.json({ success: true });
    });
  });

  app.get("/api/auth/me", async (req, res) => {
    if (!(req.session as any).userId) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    const user = Array.from(users.values()).find(u => u.id === (req.session as any).userId);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    const { password: _, ...userWithoutPassword } = user;
    res.json({ user: userWithoutPassword });
  });

  return app;
}

describe("Authentication API", () => {
  const app = createTestApp();

  describe("POST /api/auth/login", () => {
    it("should login with valid credentials", async () => {
      const res = await request(app)
        .post("/api/auth/login")
        .send({ email: "admin@test.com", password: "password123" })
        .expect(200);

      expect(res.body.user).toBeDefined();
      expect(res.body.user.email).toBe("admin@test.com");
      expect(res.body.user.role).toBe("Admin");
      expect(res.body.user.password).toBeUndefined();
    });

    it("should reject invalid email", async () => {
      const res = await request(app)
        .post("/api/auth/login")
        .send({ email: "invalid@test.com", password: "password123" })
        .expect(401);

      expect(res.body.error).toBe("Invalid credentials");
    });

    it("should reject invalid password", async () => {
      const res = await request(app)
        .post("/api/auth/login")
        .send({ email: "admin@test.com", password: "wrongpassword" })
        .expect(401);

      expect(res.body.error).toBe("Invalid credentials");
    });

    it("should reject missing credentials", async () => {
      const res = await request(app)
        .post("/api/auth/login")
        .send({})
        .expect(401);

      expect(res.body.error).toBe("Invalid credentials");
    });
  });

  describe("GET /api/auth/me", () => {
    it("should return 401 without session", async () => {
      const res = await request(app)
        .get("/api/auth/me")
        .expect(401);

      expect(res.body.error).toBe("Not authenticated");
    });

    it("should return user with valid session", async () => {
      const agent = request.agent(app);

      // Login first
      await agent
        .post("/api/auth/login")
        .send({ email: "user@test.com", password: "password123" })
        .expect(200);

      // Then check /me
      const res = await agent
        .get("/api/auth/me")
        .expect(200);

      expect(res.body.user).toBeDefined();
      expect(res.body.user.email).toBe("user@test.com");
      expect(res.body.user.password).toBeUndefined();
    });
  });

  describe("POST /api/auth/logout", () => {
    it("should clear session on logout", async () => {
      const agent = request.agent(app);

      // Login
      await agent
        .post("/api/auth/login")
        .send({ email: "admin@test.com", password: "password123" })
        .expect(200);

      // Logout
      const logoutRes = await agent
        .post("/api/auth/logout")
        .expect(200);

      expect(logoutRes.body.success).toBe(true);

      // Verify session is cleared
      const meRes = await agent
        .get("/api/auth/me")
        .expect(401);

      expect(meRes.body.error).toBe("Not authenticated");
    });
  });
});
