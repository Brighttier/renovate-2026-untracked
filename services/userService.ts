import { User, AccountStatus, UserStats, Lead } from '../types';
import { getFirebaseDb, collection, doc, getDoc, getDocs, setDoc, updateDoc, deleteDoc, query, where, orderBy, Timestamp } from './firebase';

const COLLECTION = 'users';

// Get all users
export const getAllUsers = async (): Promise<User[]> => {
  const db = getFirebaseDb();
  if (!db) throw new Error('Firebase not initialized');

  const snapshot = await getDocs(collection(db, COLLECTION));
  return snapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  })) as User[];
};

// Get user by ID
export const getUserById = async (userId: string): Promise<User | null> => {
  const db = getFirebaseDb();
  if (!db) throw new Error('Firebase not initialized');

  const docRef = doc(db, COLLECTION, userId);
  const snapshot = await getDoc(docRef);

  if (!snapshot.exists()) return null;
  return { id: snapshot.id, ...snapshot.data() } as User;
};

// Get users by status
export const getUsersByStatus = async (status: AccountStatus): Promise<User[]> => {
  const db = getFirebaseDb();
  if (!db) throw new Error('Firebase not initialized');

  const q = query(
    collection(db, COLLECTION),
    where('status', '==', status),
    orderBy('createdAt', 'desc')
  );
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  })) as User[];
};

// Get users by plan
export const getUsersByPlan = async (planId: string): Promise<User[]> => {
  const db = getFirebaseDb();
  if (!db) throw new Error('Firebase not initialized');

  const q = query(
    collection(db, COLLECTION),
    where('planId', '==', planId),
    orderBy('createdAt', 'desc')
  );
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  })) as User[];
};

// Update user status
export const updateUserStatus = async (userId: string, status: AccountStatus): Promise<void> => {
  const db = getFirebaseDb();
  if (!db) throw new Error('Firebase not initialized');

  const docRef = doc(db, COLLECTION, userId);
  await updateDoc(docRef, {
    status,
    updatedAt: new Date().toISOString()
  });
};

// Update user plan
export const updateUserPlan = async (userId: string, planId: string): Promise<void> => {
  const db = getFirebaseDb();
  if (!db) throw new Error('Firebase not initialized');

  const docRef = doc(db, COLLECTION, userId);
  await updateDoc(docRef, {
    planId,
    updatedAt: new Date().toISOString()
  });
};

// Update user stats
export const updateUserStats = async (userId: string, stats: Partial<UserStats>): Promise<void> => {
  const db = getFirebaseDb();
  if (!db) throw new Error('Firebase not initialized');

  const docRef = doc(db, COLLECTION, userId);
  const currentDoc = await getDoc(docRef);

  if (!currentDoc.exists()) throw new Error('User not found');

  const currentStats = currentDoc.data().stats || {};
  await updateDoc(docRef, {
    stats: { ...currentStats, ...stats },
    updatedAt: new Date().toISOString()
  });
};

// Suspend user
export const suspendUser = async (userId: string, reason?: string): Promise<void> => {
  const db = getFirebaseDb();
  if (!db) throw new Error('Firebase not initialized');

  const docRef = doc(db, COLLECTION, userId);
  await updateDoc(docRef, {
    status: AccountStatus.SUSPENDED,
    'settings.suspensionReason': reason || 'Suspended by admin',
    updatedAt: new Date().toISOString()
  });
};

// Activate user
export const activateUser = async (userId: string): Promise<void> => {
  const db = getFirebaseDb();
  if (!db) throw new Error('Firebase not initialized');

  const docRef = doc(db, COLLECTION, userId);
  await updateDoc(docRef, {
    status: AccountStatus.ACTIVE,
    updatedAt: new Date().toISOString()
  });
};

// Delete user (soft delete)
export const deleteUser = async (userId: string): Promise<void> => {
  const db = getFirebaseDb();
  if (!db) throw new Error('Firebase not initialized');

  const docRef = doc(db, COLLECTION, userId);
  await updateDoc(docRef, {
    status: AccountStatus.DELETED,
    updatedAt: new Date().toISOString()
  });
};

// Get user leads
export const getUserLeads = async (userId: string): Promise<Lead[]> => {
  const db = getFirebaseDb();
  if (!db) throw new Error('Firebase not initialized');

  const q = query(
    collection(db, `${COLLECTION}/${userId}/leads`),
    orderBy('date', 'desc')
  );
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  })) as Lead[];
};

// Calculate aggregate platform stats
export const getPlatformStats = async (): Promise<{
  totalUsers: number;
  activeUsers: number;
  suspendedUsers: number;
  totalRevenue: number;
  totalMRR: number;
  totalSites: number;
  totalLeads: number;
}> => {
  const users = await getAllUsers();

  return {
    totalUsers: users.length,
    activeUsers: users.filter(u => u.status === AccountStatus.ACTIVE).length,
    suspendedUsers: users.filter(u => u.status === AccountStatus.SUSPENDED).length,
    totalRevenue: users.reduce((sum, u) => sum + (u.stats?.totalRevenue || 0), 0),
    totalMRR: users.reduce((sum, u) => sum + (u.stats?.monthlyRecurring || 0), 0),
    totalSites: users.reduce((sum, u) => sum + (u.stats?.totalSites || 0), 0),
    totalLeads: users.reduce((sum, u) => sum + (u.stats?.totalLeads || 0), 0)
  };
};

// Search users
export const searchUsers = async (searchTerm: string): Promise<User[]> => {
  const users = await getAllUsers();
  const term = searchTerm.toLowerCase();

  return users.filter(u =>
    u.name.toLowerCase().includes(term) ||
    u.ownerEmail.toLowerCase().includes(term)
  );
};
