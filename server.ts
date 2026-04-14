import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import admin from "firebase-admin";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/* ================================
   FIREBASE INIT (SAFE)
================================ */

let db: admin.firestore.Firestore | null = null;

try {
  const serviceAccountEnv = process.env.FIREBASE_SERVICE_ACCOUNT;

  if (serviceAccountEnv) {
    admin.initializeApp({
      credential: admin.credential.cert(JSON.parse(serviceAccountEnv)),
    });

    db = admin.firestore();
    console.log("🔥 Firebase Admin initialized successfully");
  } else {
    console.warn("⚠️ Firebase env not found, running without DB");
  }
} catch (error) {
  console.error("❌ Firebase init failed:", error);
}

/* ================================
   INIT DATA
================================ */

async function initStations() {
  if (!db) return;

  try {
    const ref = db.collection("stations").doc("Alijis");
    const doc = await ref.get();

    if (!doc.exists) {
      await ref.set({
        name: "Alijis",
        lat: 10.6386,
        lng: 122.9511,
        address: "Alijis Road, Bacolod City",
        hopperLevels: { cat: 85, dog: 92 },
        lastSeen: admin.firestore.FieldValue.serverTimestamp(),
      });
    }
  } catch (err) {
    console.error("Init error:", err);
  }
}

/* ================================
   START SERVER
================================ */

async function startServer() {
  const app = express();

  const PORT = Number(process.env.PORT || 8080);

  app.use(express.json());

  /* ================================
     TEST ROUTE (IMPORTANT)
  ================================= */
  app.get("/", (_, res) => {
    res.send("WORKING");
  });

  /* ================================
     API ROUTE
  ================================= */
  app.post("/api/dispense", async (req, res) => {
    if (!db) return res.status(500).json({ error: "DB not ready" });

    try {
      const { location, type, coins, lat, lng } = req.body;

      if (!location || !type || typeof coins !== "number") {
        return res.status(400).json({ error: "Missing fields" });
      }

      const id = Math.random().toString(36).substring(7);

      await db.collection("logs").doc(id).set({
        location,
        type,
        coins,
        grams: coins * 2,
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
      });

      await db.collection("stations").doc(location).set(
        {
          name: location,
          hopperLevels: {
            cat: type === "Cat" ? 100 - coins : 100,
            dog: type === "Dog" ? 100 - coins : 100,
          },
          lat,
          lng,
          lastSeen: admin.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true }
      );

      res.json({ success: true, id });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Server error" });
    }
  });

  /* ================================
     VITE (FRONTEND)
  ================================= */
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });

    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");

    app.use(express.static(distPath));

    app.get("*", (_, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  /* ================================
     START LISTENING (RAILWAY SAFE)
  ================================= */
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`🚀 Server running on port ${PORT}`);
  });

  initStations();
}

startServer();