import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

// Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyANs-yCKbcq7HkXdvnhQRyeKEyp9LTSvd0",
  authDomain: "pawfeeder1001.firebaseapp.com",
  databaseURL: "https://pawfeeder1001-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "pawfeeder1001",
  storageBucket: "pawfeeder1001.firebasestorage.app",
  messagingSenderId: "1012150186603",
  appId: "1:1012150186603:web:e541bfc4d2a3cd017e772e"
};

// Initialize Firebase (safe guard to prevent double init in dev hot reload)
const app = initializeApp(firebaseConfig);

// Services
export const auth = getAuth(app);
export const db = getFirestore(app);

export default app;

/* ================================
   TYPES
================================ */

export enum OperationType {
  CREATE = "create",
  UPDATE = "update",
  DELETE = "delete",
  LIST = "list",
  GET = "get",
  WRITE = "write",
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string;
    email?: string | null;
    emailVerified?: boolean;
    isAnonymous?: boolean;
    tenantId?: string | null;
    providerInfo: {
      providerId: string;
      displayName: string | null;
      email: string | null;
      photoUrl: string | null;
    }[];
  };
}

/* ================================
   ERROR HANDLER
================================ */

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): never {
  const user = auth.currentUser;

  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    operationType,
    path,
    authInfo: {
      userId: user?.uid,
      email: user?.email,
      emailVerified: user?.emailVerified,
      isAnonymous: user?.isAnonymous,
      tenantId: user?.tenantId,
      providerInfo: user?.providerData?.map((p) => ({
        providerId: p.providerId,
        displayName: p.displayName,
        email: p.email,
        photoUrl: p.photoURL,
      })) || [],
    },
  };

  console.error("Firestore Error:", errInfo);
  throw new Error(JSON.stringify(errInfo));
}