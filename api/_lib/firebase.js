import admin from "firebase-admin";

function getFirebaseCredential() {
  const rawServiceAccount = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!rawServiceAccount) return null;

  try {
    return admin.credential.cert(JSON.parse(rawServiceAccount));
  } catch (error) {
    throw new Error("Variavel de ambiente FIREBASE_SERVICE_ACCOUNT invalida");
  }
}

const firebaseCredential = getFirebaseCredential();

if (!admin.apps.length) {
  if (firebaseCredential) {
    admin.initializeApp({
      credential: firebaseCredential,
    });
  } else {
    admin.initializeApp();
  }
}

const db = admin.firestore();

async function verifyRequest(req) {
  const authHeader = req.headers.authorization || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice("Bearer ".length) : null;

  if (!token) {
    throw new Error("Unauthorized");
  }

  let decoded;
  try {
    decoded = await admin.auth().verifyIdToken(token);
  } catch (error) {
    throw new Error("Invalid token");
  }
  const userDoc = await db.collection("users").doc(decoded.uid).get();
  const userData = userDoc.exists ? userDoc.data() : null;

  return {
    uid: decoded.uid,
    decoded,
    user: userData,
    familyId: userData && userData.familyId ? userData.familyId : null,
  };
}

function resolveFamilyId(req, context) {
  if (req.method === "GET") {
    return req.query.familyId || context.familyId || null;
  }

  const body = req.body || {};
  return body.familyId || context.familyId || null;
}

export { admin, db, firebaseCredential, resolveFamilyId, verifyRequest };
