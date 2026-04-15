import express from "express";
import admin from "firebase-admin";

/* ================================
   EXPRESS APP
================================ */

const app = express();
app.use(express.json());

/* ================================
   PORT (RAILWAY SAFE)
================================ */

const PORT = Number(process.env.PORT || 8080);

/* ================================
   FIREBASE INIT (SAFE)
================================ */

let db: admin.firestore.Firestore | null = null;

try {
  const serviceAccountEnv = process.env.FIREBASE_SERVICE_ACCOUNT;

  if (serviceAccountEnv) {
    const serviceAccount = JSON.parse(serviceAccountEnv);

    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });

    db = admin.firestore();

    console.log("🔥 Firebase Admin initialized successfully");
  } else {
    console.warn("⚠️ FIREBASE_SERVICE_ACCOUNT is missing");
  }
} catch (error) {
  console.error("❌ Firebase init failed:", error);
}

/* ================================
   HEALTH CHECK (REQUIRED FOR RAILWAY)
================================ */

app.get("/", (_, res) => {
  res.status(200).send("WORKING ✅");
});

app.get("/test", (_, res) => {
  res.json({ status: "API OK" });
});

/* ================================
   DISPENSE API
================================ */

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
  } catch (error) {
    console.error("❌ Dispense error:", error);
    res.status(500).json({ error: "Server error" });
  }
});

/* ================================
   START SERVER (RAILWAY CRITICAL)
================================ */

app.listen(PORT, "0.0.0.0", () => {
  console.log("🚀 SERVER STARTED");
  console.log("PORT:", PORT);
  console.log("HEALTH CHECK: /");
});