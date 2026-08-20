import admin from "firebase-admin"

// FIX (critical — account takeover): server-side verification of Firebase ID
// tokens for Google sign-in. This closes the gap where googleAuth previously
// trusted whatever `email` a client sent in the request body with no proof they
// actually own that Google account — see the comment in auth.controllers.js for
// the full explanation.
//
// SETUP REQUIRED — this needs a Firebase service account for the SAME Firebase
// project referenced in firebase.js (project ID "MealHub-food-delivery" per that
// file). Generate one from:
//   Firebase Console -> Project Settings -> Service Accounts -> Generate new
//   private key
// That download is a JSON file with three fields you need as backend env vars:
//   FIREBASE_PROJECT_ID    = project_id
//   FIREBASE_CLIENT_EMAIL  = client_email
//   FIREBASE_PRIVATE_KEY   = private_key   (see the newline note below)
//
// This is a DIFFERENT credential from the frontend's VITE_FIREBASE_APIKEY. The
// frontend key is a public, client-side identifier — it was never a secret and
// was never the actual security boundary. The service account key below IS a
// secret: it must only ever live in the backend's .env, never committed to git,
// never sent to the frontend.
let initialized = false

const getAdminApp = () => {
    if (initialized) return admin.app()

    const projectId = process.env.FIREBASE_PROJECT_ID
    const clientEmail = process.env.FIREBASE_CLIENT_EMAIL
    // Most .env loaders/hosting dashboards collapse the private key's real
    // newlines into the literal two-character sequence "\n" when you paste it in
    // as a single-line env var — this restores actual newlines, without which
    // Firebase Admin's PEM parsing fails.
    const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n")

    if (!projectId || !clientEmail || !privateKey) {
        throw new Error(
            "Firebase Admin is not configured. Set FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, and FIREBASE_PRIVATE_KEY in your backend .env (Firebase Console -> Project Settings -> Service Accounts -> Generate new private key)."
        )
    }

    admin.initializeApp({
        credential: admin.credential.cert({ projectId, clientEmail, privateKey })
    })
    initialized = true
    return admin.app()
}

// Verifies a Firebase ID token and returns its decoded claims (email,
// email_verified, name, uid, ...). Throws if the token is missing, expired,
// tampered with, or was issued for a different Firebase project — callers should
// treat any throw here as "reject the request," never fall back to trusting
// anything else the client sent.
export const verifyFirebaseIdToken = async (idToken) => {
    const app = getAdminApp()
    return admin.auth(app).verifyIdToken(idToken)
}