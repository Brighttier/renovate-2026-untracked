import { APIKey, APIScope } from '../types';
import { getFirebaseDb, collection, doc, getDoc, getDocs, setDoc, updateDoc, deleteDoc, query, where, orderBy, Timestamp } from './firebase';
import bcrypt from 'bcryptjs';

const COLLECTION = 'apiKeys';
const BCRYPT_ROUNDS = 10;

// Generate a secure API key
const generateAPIKey = (): string => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let key = 'rmsk_'; // Prefix for identification
  for (let i = 0; i < 48; i++) {
    key += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return key;
};

// Secure hash function using bcrypt
const hashKey = (key: string): string => {
  return bcrypt.hashSync(key, BCRYPT_ROUNDS);
};

// Verify a key against a bcrypt hash
const verifyKey = (key: string, hash: string): boolean => {
  return bcrypt.compareSync(key, hash);
};

// Create a new API key
export const createAPIKey = async (params: {
  name: string;
  userId: string;
  scopes: APIScope[];
  expiresAt?: string;
  createdBy: string;
}): Promise<{ apiKey: APIKey; rawKey: string }> => {
  const db = getFirebaseDb();
  if (!db) throw new Error('Firebase not initialized');

  const rawKey = generateAPIKey();
  const keyHash = hashKey(rawKey);
  const keyPrefix = rawKey.substring(0, 12);

  const apiKey: APIKey = {
    id: `key-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
    name: params.name,
    keyHash,
    keyPrefix,
    userId: params.userId,
    scopes: params.scopes,
    createdAt: new Date().toISOString(),
    expiresAt: params.expiresAt,
    isActive: true,
    createdBy: params.createdBy
  };

  const docRef = doc(db, COLLECTION, apiKey.id);
  await setDoc(docRef, apiKey);

  return { apiKey, rawKey };
};

// Get all API keys
export const getAllAPIKeys = async (): Promise<APIKey[]> => {
  const db = getFirebaseDb();
  if (!db) return [];

  const snapshot = await getDocs(collection(db, COLLECTION));
  return snapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  })) as APIKey[];
};

// Get API keys by agency
export const getAPIKeysByAgency = async (userId: string): Promise<APIKey[]> => {
  const db = getFirebaseDb();
  if (!db) return [];

  const q = query(
    collection(db, COLLECTION),
    where('userId', '==', userId),
    orderBy('createdAt', 'desc')
  );
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  })) as APIKey[];
};

// Get API key by ID
export const getAPIKeyById = async (keyId: string): Promise<APIKey | null> => {
  const db = getFirebaseDb();
  if (!db) return null;

  const docRef = doc(db, COLLECTION, keyId);
  const snapshot = await getDoc(docRef);

  if (!snapshot.exists()) return null;
  return { id: snapshot.id, ...snapshot.data() } as APIKey;
};

// Validate API key (returns key data if valid)
export const validateAPIKey = async (rawKey: string): Promise<APIKey | null> => {
  const db = getFirebaseDb();
  if (!db) return null;

  const keyPrefix = rawKey.substring(0, 12);

  const q = query(
    collection(db, COLLECTION),
    where('keyPrefix', '==', keyPrefix),
    where('isActive', '==', true)
  );
  const snapshot = await getDocs(q);

  for (const docSnapshot of snapshot.docs) {
    const key = docSnapshot.data() as APIKey;
    // Use bcrypt to verify the key against the stored hash
    if (verifyKey(rawKey, key.keyHash)) {
      // Check expiration
      if (key.expiresAt && new Date(key.expiresAt) < new Date()) {
        return null; // Expired
      }

      // Update last used
      await updateDoc(docSnapshot.ref, {
        lastUsedAt: new Date().toISOString()
      });

      return { id: docSnapshot.id, ...key };
    }
  }

  return null;
};

// Check if key has required scope
export const hasScope = (apiKey: APIKey, requiredScope: APIScope): boolean => {
  return apiKey.scopes.includes(requiredScope);
};

// Check if key has any of the required scopes
export const hasAnyScope = (apiKey: APIKey, requiredScopes: APIScope[]): boolean => {
  return requiredScopes.some(scope => apiKey.scopes.includes(scope));
};

// Revoke API key
export const revokeAPIKey = async (keyId: string): Promise<void> => {
  const db = getFirebaseDb();
  if (!db) throw new Error('Firebase not initialized');

  const docRef = doc(db, COLLECTION, keyId);
  await updateDoc(docRef, {
    isActive: false
  });
};

// Reactivate API key
export const reactivateAPIKey = async (keyId: string): Promise<void> => {
  const db = getFirebaseDb();
  if (!db) throw new Error('Firebase not initialized');

  const docRef = doc(db, COLLECTION, keyId);
  await updateDoc(docRef, {
    isActive: true
  });
};

// Update API key scopes
export const updateAPIKeyScopes = async (keyId: string, scopes: APIScope[]): Promise<void> => {
  const db = getFirebaseDb();
  if (!db) throw new Error('Firebase not initialized');

  const docRef = doc(db, COLLECTION, keyId);
  await updateDoc(docRef, {
    scopes
  });
};

// Delete API key permanently
export const deleteAPIKey = async (keyId: string): Promise<void> => {
  const db = getFirebaseDb();
  if (!db) throw new Error('Firebase not initialized');

  const docRef = doc(db, COLLECTION, keyId);
  await deleteDoc(docRef);
};

// Get active API keys count by agency
export const getActiveKeyCountByAgency = async (userId: string): Promise<number> => {
  const db = getFirebaseDb();
  if (!db) return 0;

  const q = query(
    collection(db, COLLECTION),
    where('userId', '==', userId),
    where('isActive', '==', true)
  );
  const snapshot = await getDocs(q);
  return snapshot.size;
};

// Rotate API key (revoke old, create new)
export const rotateAPIKey = async (keyId: string, createdBy: string): Promise<{ apiKey: APIKey; rawKey: string }> => {
  const oldKey = await getAPIKeyById(keyId);
  if (!oldKey) throw new Error('API key not found');

  // Revoke old key
  await revokeAPIKey(keyId);

  // Create new key with same properties
  return createAPIKey({
    name: `${oldKey.name} (rotated)`,
    userId: oldKey.userId,
    scopes: oldKey.scopes,
    expiresAt: oldKey.expiresAt,
    createdBy
  });
};
