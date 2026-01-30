/**
 * Lazy Firebase Admin initialization helper
 * Use this instead of calling admin.firestore() at module level
 */
import * as admin from 'firebase-admin';

let _db: admin.firestore.Firestore | null = null;
let _storage: admin.storage.Storage | null = null;

export function getDb(): admin.firestore.Firestore {
  if (!_db) {
    _db = admin.firestore();
  }
  return _db;
}

export function getStorage(): admin.storage.Storage {
  if (!_storage) {
    _storage = admin.storage();
  }
  return _storage;
}
