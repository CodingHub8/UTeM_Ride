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
import { auth, db } from '@/utils/firebase';

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
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

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
    await signInWithEmailAndPassword(auth, email, password);
    // Profile is loaded by the onAuthStateChanged listener
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
        throw new Error(
          'This email is already registered. Please go back and sign in, ' +
          'or use a different email address.'
        );
      }
      throw authError;
    }
    const firebaseUid = credential.user.uid;

    // 2. Now authenticated — write user profile to Firestore /users/{studentId}
    //    Use setDoc with merge: false so it fails if the doc already exists
    //    (prevents duplicate student ID registration)
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

    // 3. Write UID index /uid_index/{firebaseUid} → studentId
    await setDoc(doc(db, 'uid_index', firebaseUid), { studentId });

    // 4. Write user document record /user_documents/{studentId}
    await setDoc(doc(db, 'user_documents', studentId), {
      user_id: studentId,
      matric_card_url: matricCardImage,
      road_tax_url: roadTaxImage,
      ocr_extracted_lines: [],
      encrypted_sensitive_data: encryptedDocs,
      is_verified: false,
      verified_at: null,
      created_at: serverTimestamp(),
    });

    // 5. Update local state
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
      matricCardImage,
      roadTaxImage,
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

  /**
   * verify2FA — simulates clicking the verification link sent via email/SMS.
   * Updates Firestore and local state.
   */
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

  const value = useMemo(
    () => ({ user, isAuthenticated: !!user, loading, role, login, register, logout, switchRole, setRole, verify2FA, verifyAdminDocs }),
    [user, loading, role, login, register, logout, switchRole, verify2FA, verifyAdminDocs],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextType {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
