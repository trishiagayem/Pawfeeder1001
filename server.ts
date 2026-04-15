import express from "express";
import admin from "firebase-admin";
import path from "path";

const app = express();
app.use(express.json());

const PORT = Number(process.env.PORT || 8080);

/* ================= FIREBASE ================= */

let db: admin.firestore.Firestore | null = null;

try {
  const serviceAccountEnv = process.env.FIREBASE_SERVICE_ACCOUNT;

  if (serviceAccountEnv) {
    admin.initializeApp({
      credential: admin.credential.cert(JSON.parse(serviceAccountEnv)),
    });

    db = admin.firestore();
    console.log("🔥 Firebase connected");
  }
} catch (err) {
  console.error("Firebase error:", err);
}

/* ================= API ================= */

app.get("/test", (_, res) => {
  res.json({ ok: true });
});

app.post("/api/dispense", async (req, res) => {
  if (!db) return res.status(500).json({ error: "DB not ready" });

  try {
    const { location, type, coins, lat, lng } = req.body;

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
    res.status(500).json({ error: "server error" });
  }
});

/* ================= SERVE REACT BUILD ================= */

const distPath = path.join(process.cwd(), "dist");

app.use(express.static(distPath));

app.get("*", (_, res) => {
  res.sendFile(path.join(distPath, "index.html"));
});

/* ================= START ================= */

app.listen(PORT, "0.0.0.0", () => {
  console.log("🚀 Server running on", PORT);
});