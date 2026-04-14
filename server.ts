import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import admin from "firebase-admin";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/* ================================
   FIREBASE ADMIN INITIALIZATION
================================ */

let db: admin.firestore.Firestore | null = null;

try {
  admin.initializeApp({
  credential: admin.credential.cert(
    JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT as string)
  ),
});

  db = admin.firestore();
  console.log("🔥 Firebase Admin initialized successfully");
} catch (error) {
  console.error("❌ Firebase init failed:", error);
}

/* ================================
   INIT DEFAULT DATA
================================ */

async function initStations() {
  if (!db) return;

  const alijisRef = db.collection("stations").doc("Alijis");
  const doc = await alijisRef.get();

  if (!doc.exists) {
    await alijisRef.set({
      name: "Alijis",
      lat: 10.6386,
      lng: 122.9511,
      address: "Alijis Road, Bacolod City",
      plusCode: "8FVC+W2 Bacolod",
      hopperLevels: { cat: 85, dog: 92 },
      lastSeen: admin.firestore.FieldValue.serverTimestamp(),
    });
  }

  const assetsRef = db.collection("assets").doc("global");
  const assetsDoc = await assetsRef.get();

  if (!assetsDoc.exists) {
    await assetsRef.set({
      mission: "Providing automated feeding solutions for strays.",
      vision: "A world where every stray has food access.",
      systemStatus: "Operational",
    });
  }
}

/* ================================
   SERVER START
================================ */

async function startServer() {
  await initStations();

  const app = express();

  // ✅ FIX: Railway uses process.env.PORT
  const PORT: number = Number(process.env.PORT || 3006);

  app.use(express.json());

  /* ================================
     SIMPLE HEALTH CHECK (IMPORTANT)
  ================================= */
  app.get("/", (_, res) => {
    res.send("🔥 Pawfeeder API is running");
  });

  /* ================================
     DISPENSE API
  ================================= */
  app.post("/api/dispense", async (req, res) => {
    if (!db) {
      return res.status(500).json({ error: "Database not initialized" });
    }

    const { location, type, coins, catLevel, dogLevel, lat, lng } = req.body;

    if (!location || !type || typeof coins !== "number") {
      return res.status(400).json({ error: "Missing required fields" });
    }

    try {
      const logId = Math.random().toString(36).substring(7);
      const timestamp = admin.firestore.FieldValue.serverTimestamp();

      await db.collection("logs").doc(logId).set({
        location,
        type,
        coins,
        grams: coins * 2,
        timestamp,
      });

      const stationRef = db.collection("stations").doc(location);
      const stationDoc = await stationRef.get();

      let updateData: any = {
        lastSeen: timestamp,
      };

      if (stationDoc.exists) {
        const current = stationDoc.data()?.hopperLevels || { cat: 100, dog: 100 };

        updateData.hopperLevels = {
          cat:
            typeof catLevel === "number"
              ? catLevel
              : type === "Cat"
              ? Math.max(0, current.cat - coins)
              : current.cat,

          dog:
            typeof dogLevel === "number"
              ? dogLevel
              : type === "Dog"
              ? Math.max(0, current.dog - coins)
              : current.dog,
        };
      } else {
        updateData.name = location;
        updateData.hopperLevels = { cat: 100, dog: 100 };
      }

      if (typeof lat === "number" && typeof lng === "number") {
        updateData.lat = lat;
        updateData.lng = lng;
      }

      await stationRef.set(updateData, { merge: true });

      res.status(201).json({ success: true, id: logId });
    } catch (error) {
      console.error("Dispense Error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  /* ================================
     VITE (PRODUCTION SAFE)
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

  // ✅ FIXED LISTEN (NO TYPE ERROR)
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`🚀 Server running on port ${PORT}`);
  });
}

startServer();