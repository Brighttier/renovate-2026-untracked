import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithEmailAndPassword, createUserWithEmailAndPassword, signInWithPopup, signOut, onAuthStateChanged, User } from 'firebase/auth';
import { getFirestore, collection, doc, getDoc, getDocs, setDoc, updateDoc, deleteDoc, query, where, orderBy, limit, Timestamp, onSnapshot, QueryConstraint } from 'firebase/firestore';
import { getStorage, ref, uploadString, getDownloadURL, deleteObject } from 'firebase/storage';

// Firebase configuration - loaded from environment variables
const firebaseConfig = {
  apiKey: process.env.FIREBASE_API_KEY || '',
  authDomain: process.env.FIREBASE_AUTH_DOMAIN || '',
  projectId: process.env.FIREBASE_PROJECT_ID || '',
  storageBucket: process.env.FIREBASE_STORAGE_BUCKET || '',
  messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID || '',
  appId: process.env.FIREBASE_APP_ID || ''
};

// Initialize Firebase only if config is present
let app: ReturnType<typeof initializeApp> | null = null;
let auth: ReturnType<typeof getAuth> | null = null;
let db: ReturnType<typeof getFirestore> | null = null;
let storage: ReturnType<typeof getStorage> | null = null;

const initializeFirebase = () => {
  if (!app && firebaseConfig.apiKey) {
    app = initializeApp(firebaseConfig);
    auth = getAuth(app);
    db = getFirestore(app);
    storage = getStorage(app);
  }
  return { app, auth, db, storage };
};

// Lazy getters
export const getFirebaseAuth = () => {
  initializeFirebase();
  return auth;
};

export const getFirebaseDb = () => {
  initializeFirebase();
  return db;
};

export const getFirebaseStorage = () => {
  initializeFirebase();
  return storage;
};

// Auth helpers
export const googleProvider = new GoogleAuthProvider();

export const adminSignIn = async (email: string, password: string) => {
  const auth = getFirebaseAuth();
  if (!auth) throw new Error('Firebase not initialized');
  return signInWithEmailAndPassword(auth, email, password);
};

export const adminSignUp = async (email: string, password: string) => {
  const auth = getFirebaseAuth();
  if (!auth) throw new Error('Firebase not initialized');
  return createUserWithEmailAndPassword(auth, email, password);
};

export const adminSignInWithGoogle = async () => {
  const auth = getFirebaseAuth();
  if (!auth) throw new Error('Firebase not initialized');
  return signInWithPopup(auth, googleProvider);
};

export const adminSignOut = async () => {
  const auth = getFirebaseAuth();
  if (!auth) throw new Error('Firebase not initialized');
  return signOut(auth);
};

export const onAdminAuthStateChanged = (callback: (user: User | null) => void) => {
  const auth = getFirebaseAuth();
  if (!auth) return () => {};
  return onAuthStateChanged(auth, callback);
};

// Firestore helpers
export {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  limit,
  Timestamp,
  onSnapshot
};

// Storage helpers
export {
  ref,
  uploadString,
  getDownloadURL,
  deleteObject
};

export type { QueryConstraint, User };
