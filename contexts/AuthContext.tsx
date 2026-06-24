import React, { createContext, useContext, useState, useCallback, useMemo, useEffect } from 'react';
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  User as FirebaseUser,
} from 'firebase/auth';
import {
  doc,
  setDoc,
  getDoc,
  updateDoc,
  serverTimestamp,
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { auth, db, storage } from '@/utils/firebase';
import { registerForPushNotifications, savePushToken } from '@/utils/notifications';


export type UserRole = 'passenger' | 'driver';
export type Gender = 'Male' | 'Female' | 'Other';

export interface User {
  id: string;           // Student/Staff ID (matric/staff card number) — Firestore document key
  firebaseUid: string;  // Firebase Auth UID (used for security rules)
  name: string;
  email: string;
  phone: string;
  role: UserRole;       // Active client-side mode — passenger or driver
  gender: Gender;
  is_verified: boolean;
  is_2FA_verified: boolean;
  matricCardImage?: string;
  roadTaxImage?: string;
  vehiclePlate?: string;
  vehicleModel?: string;
  vehicleColor?: string;
  encryptedDocs?: string;
}

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  loading: boolean;
  role: UserRole;
  login: (email: string, password: string) => Promise<void>;
  register: (
    name: string,
    email: string,
    phone: string,
    gender: Gender,
    password: string,
    studentId: string,
    matricCardImage: string,
    roadTaxImage: string,
    vehiclePlate: string,
    vehicleModel: string,
    vehicleColor: string,
    encryptedDocs: string
  ) => Promise<void>;
  logout: () => void;
  switchRole: () => void;
  setRole: (role: UserRole) => void;
  verify2FA: () => Promise<void>;
  verifyAdminDocs: () => Promise<void>;
  updateProfile: (updates: Record<string, any>) => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

async function uploadImageAsync(uri: string, path: string): Promise<string> {
  if (!uri) return '';
  if (!uri.startsWith('file://') && !uri.startsWith('content://') && !uri.startsWith('ph://') && !uri.startsWith('assets-library://')) {
    return uri;
  }
  const blob = await new Promise<Blob>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.onload = function () {
      resolve(xhr.response);
    };
    xhr.onerror = function (e) {
      console.error('[uploadImageAsync] Failed to convert URI to blob:', e);
      reject(new TypeError('Network request failed'));
    };
    xhr.responseType = 'blob';
    xhr.open('GET', uri, true);
    xhr.send(null);
  });
  try {
    const fileRef = ref(storage, path);
    await uploadBytes(fileRef, blob);
    return await getDownloadURL(fileRef);
  } finally {
    (blob as any).close();
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<UserRole>('passenger');
  const [loading, setLoading] = useState(true);

  // Listen for Firebase auth state changes (handles app reload / session persistence)
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser: FirebaseUser | null) => {
      if (firebaseUser) {
        // Re-hydrate user profile from Firestore using Firebase UID
        try {
          // We store each user document with their matric/staff ID.
          // We use a lookup map: firebaseUid -> studentId stored in a small UID index doc.
          const uidIndexRef = doc(db, 'uid_index', firebaseUser.uid);
          const uidSnap = await getDoc(uidIndexRef);
          if (uidSnap.exists()) {
            const { studentId } = uidSnap.data();
            const userRef = doc(db, 'users', studentId);
            const userSnap = await getDoc(userRef);
            if (userSnap.exists()) {
              const data = userSnap.data();
              setUser({
                id: studentId,
                firebaseUid: firebaseUser.uid,
                name: data.name,
                email: data.email,
                phone: data.phone,
                role: data.role ?? 'passenger',
                gender: data.gender,
                is_verified: data.is_verified ?? false,
                is_2FA_verified: data.is_2FA_verified ?? false,
                vehiclePlate: data.vehiclePlate,
                vehicleModel: data.vehicleModel,
                vehicleColor: data.vehicleColor,
                encryptedDocs: data.encryptedDocs,
              });
              setRole(data.role ?? 'passenger');

              registerForPushNotifications().then((token) => {
                if (token) savePushToken(studentId, token);
              });
            }
          }
        } catch (err) {
          console.error('[AuthContext] Failed to rehydrate user profile:', err);
        }
      } else {
        setUser(null);
      }
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  /**
   * Login — Firebase Email/Password sign-in.
   * After sign-in, the onAuthStateChanged listener above rehydrates the profile.
   */
  const login = useCallback(async (email: string, password: string) => {
    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch (authError: any) {
      console.warn('[AuthContext] Firebase Auth login failed. Checking mock fallbacks:', authError.message);
      
      const normalizedEmail = email.toLowerCase().trim();
      const mockAccounts: Record<string, { id: string; name: string; role: UserRole; gender: Gender; plate?: string; model?: string; color?: string; verified: boolean }> = {
        'driver1@student.utem.edu.my': {
          id: 'B032110194',
          name: 'Muhammad Hazim',
          role: 'driver',
          gender: 'Male',
          plate: 'WKL 2847',
          model: 'Perodua Myvi',
          color: 'White',
          verified: true,
        },
        'passenger1@student.utem.edu.my': {
          id: 'B032110283',
          name: 'Ahmad Danish',
          role: 'passenger',
          gender: 'Male',
          verified: true,
        },
        'driver2@utem.edu.my': {
          id: 'S4829104',
          name: 'Prof. Dr. Ridzuan',
          role: 'driver',
          gender: 'Male',
          plate: 'MCE 9942',
          model: 'Proton X70',
          color: 'Grey',
          verified: true,
        },
        'passenger2@student.utem.edu.my': {
          id: 'B032110992',
          name: 'Sarah binti Ahmad',
          role: 'passenger',
          gender: 'Female',
          verified: true,
        },
        'driver3@student.utem.edu.my': {
          id: 'B032110842',
          name: 'Lim Wei Xiong',
          role: 'driver',
          gender: 'Male',
          plate: 'JAA 1234',
          model: 'Honda City',
          color: 'Black',
          verified: false,
        },
      };

      if (mockAccounts[normalizedEmail] && password === 'password123') {
        const mock = mockAccounts[normalizedEmail];
        console.log('[AuthContext] Logging in via Mock Sandbox account:', mock.name);
        
        setUser({
          id: mock.id,
          firebaseUid: `mock-${mock.role}-${mock.id}`,
          name: mock.name,
          email: normalizedEmail,
          phone: mock.role === 'driver' ? '+60123456789' : '+60172345678',
          role: mock.role,
          gender: mock.gender,
          is_verified: mock.verified,
          is_2FA_verified: true,
          vehiclePlate: mock.plate,
          vehicleModel: mock.model,
          vehicleColor: mock.color,
        });
        setRole(mock.role);
        return;
      }
      throw authError;
    }
  }, []);

  /**
   * Register — creates a Firebase Auth account, then writes the user
   * profile to Firestore under /users/{studentId}.
   * Also writes a UID → studentId index so we can look up the profile on login.
   * Each studentId can only be registered once (Firestore doc key = studentId).
   */
  const register = useCallback(async (
    name: string,
    email: string,
    phone: string,
    gender: Gender,
    password: string,
    studentId: string,
    matricCardImage: string,
    roadTaxImage: string,
    vehiclePlate: string,
    vehicleModel: string,
    vehicleColor: string,
    encryptedDocs: string,
  ) => {
    // 1. Create Firebase Auth account FIRST (no Firestore needed)
    let credential;
    try {
      credential = await createUserWithEmailAndPassword(auth, email, password);
    } catch (authError: any) {
      if (authError.code === 'auth/email-already-in-use') {
        try {
          // Self-healing: check if this is an orphaned account (Auth exists but no Firestore profile)
          const userSnap = await getDoc(doc(db, 'users', studentId));
          if (!userSnap.exists()) {
            console.log('[AuthContext] Orphaned account detected. Performing self-healing clean up...');
            const tempCred = await signInWithEmailAndPassword(auth, email, password);
            await tempCred.user.delete();
            credential = await createUserWithEmailAndPassword(auth, email, password);
          } else {
            throw new Error(
              'This email is already registered. Please go back and sign in, ' +
              'or use a different email address.'
            );
          }
        } catch (healError: any) {
          throw new Error(
            'This email is already registered. Please go back and sign in, ' +
            'or use a different email address.'
          );
        }
      } else {
        throw authError;
      }
    }
    const firebaseUid = credential.user.uid;

    // 2. Upload verification images to Firebase Storage first (gets remote URLs)
    let matricCardUrl = '';
    let roadTaxUrl = '';
    try {
      if (matricCardImage) {
        matricCardUrl = await uploadImageAsync(matricCardImage, `documents/${firebaseUid}/matric_card.jpg`);
      }
      if (roadTaxImage) {
        roadTaxUrl = await uploadImageAsync(roadTaxImage, `documents/${firebaseUid}/road_tax.jpg`);
      }
    } catch (uploadError: any) {
      // Clean up the Auth account if storage upload fails
      await credential.user.delete().catch(() => {});
      throw new Error('Failed to upload verification documents to Firebase Storage: ' + uploadError.message);
    }

    // 3. Now authenticated — write user profile to Firestore /users/{studentId}
    try {
      await setDoc(doc(db, 'users', studentId), {
        firebaseUid,
        name,
        email,
        phone,
        gender,
        role: 'passenger',
        is_verified: false,
        is_2FA_verified: false,
        vehiclePlate,
        vehicleModel,
        vehicleColor,
        encryptedDocs,
        created_at: serverTimestamp(),
        updated_at: serverTimestamp(),
      });
    } catch (firestoreError: any) {
      // Clean up the Auth account if Firestore write fails
      await credential.user.delete().catch(() => {});
      if (firestoreError.code === 'permission-denied') {
        throw new Error(
          'Database permission denied. Please make sure Firestore is created ' +
          'in the Firebase Console with test mode rules.'
        );
      }
      throw new Error(
        'Failed to create profile: ' + (firestoreError.message || 'Unknown error')
      );
    }

    // 4. Write UID index /uid_index/{firebaseUid} → studentId
    await setDoc(doc(db, 'uid_index', firebaseUid), { studentId });

    // 5. Write user document record /user_documents/{studentId}
    await setDoc(doc(db, 'user_documents', studentId), {
      user_id: studentId,
      matric_card_url: matricCardUrl,
      road_tax_url: roadTaxUrl,
      ocr_extracted_lines: [],
      encrypted_sensitive_data: encryptedDocs,
      is_verified: false,
      verified_at: null,
      created_at: serverTimestamp(),
    });

    // 6. Update local state
    setUser({
      id: studentId,
      firebaseUid,
      name,
      email,
      phone,
      role: 'passenger',
      gender,
      is_verified: false,
      is_2FA_verified: false,
      matricCardImage: matricCardUrl,
      roadTaxImage: roadTaxUrl,
      vehiclePlate,
      vehicleModel,
      vehicleColor,
      encryptedDocs,
    });
  }, []);

  /**
   * Logout — signs out from Firebase Auth and clears local state.
   */
  const logout = useCallback(async () => {
    await signOut(auth);
    setUser(null);
  }, []);

  /**
   * Switch between passenger and driver mode client-side.
   * Does NOT change the Firestore role field — that is intentional
   * since users can freely toggle between modes at any time.
   */
  const switchRole = useCallback(() => {
    setRole((prev) => {
      const newRole = prev === 'passenger' ? 'driver' : 'passenger';
      if (user) setUser({ ...user, role: newRole });
      return newRole;
    });
  }, [user]);

  const verify2FA = useCallback(async () => {
    if (!user) return;
    try {
      const userRef = doc(db, 'users', user.id);
      await updateDoc(userRef, {
        is_2FA_verified: true,
        updated_at: serverTimestamp(),
      });
      setUser((prev) => prev ? { ...prev, is_2FA_verified: true } : null);
    } catch (error) {
      console.error('Failed to verify 2FA:', error);
      throw error;
    }
  }, [user]);

  /**
   * verifyAdminDocs — simulates admin document verification.
   * Updates Firestore and local state.
   */
  const verifyAdminDocs = useCallback(async () => {
    if (!user) return;
    try {
      const userRef = doc(db, 'users', user.id);
      await updateDoc(userRef, {
        is_verified: true,
        updated_at: serverTimestamp(),
      });

      const docRef = doc(db, 'user_documents', user.id);
      await updateDoc(docRef, {
        is_verified: true,
        verified_at: serverTimestamp(),
        updated_at: serverTimestamp(),
      });

      setUser((prev) => prev ? { ...prev, is_verified: true } : null);
    } catch (error) {
      console.error('Failed to verify admin documents:', error);
      throw error;
    }
  }, [user]);

  const refreshProfile = useCallback(async () => {
    if (!user) return;
    const snap = await getDoc(doc(db, 'users', user.id));
    if (!snap.exists()) return;
    const data = snap.data();
    setUser((prev) => prev ? {
      ...prev,
      name: data.name,
      email: data.email,
      phone: data.phone,
      gender: data.gender,
      is_verified: data.is_verified ?? false,
      is_2FA_verified: data.is_2FA_verified ?? false,
      vehiclePlate: data.vehiclePlate,
      vehicleModel: data.vehicleModel,
      vehicleColor: data.vehicleColor,
    } : null);
  }, [user]);

  const updateProfile = useCallback(async (updates: Record<string, any>) => {
    if (!user) return;
    const userRef = doc(db, 'users', user.id);
    await updateDoc(userRef, { ...updates, updated_at: serverTimestamp() });
    setUser((prev) => (prev ? { ...prev, ...updates } : null));
  }, [user]);

  const value = useMemo(
    () => ({ user, isAuthenticated: !!user, loading, role, login, register, logout, switchRole, setRole, verify2FA, verifyAdminDocs, updateProfile, refreshProfile }),
    [user, loading, role, login, register, logout, switchRole, verify2FA, verifyAdminDocs, updateProfile, refreshProfile],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextType {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
