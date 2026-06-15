/**
 * Seeds two test users (Passenger + Driver) into Firebase Auth + Firestore,
 * matching the schema expected by contexts/AuthContext.tsx.
 *
 * Run with: node scripts/seed-test-users.mjs
 *
 * Credentials created:
 *   Passenger:  passenger@test.com / Test1234   (studentId: B032110283)
 *   Driver:     driver@test.com    / Test1234   (studentId: B032110194)
 */

import 'dotenv/config';
import { initializeApp } from 'firebase/app';
import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
} from 'firebase/auth';
import {
  getFirestore,
  doc,
  setDoc,
  getDoc,
  serverTimestamp,
} from 'firebase/firestore';

const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
};

if (!firebaseConfig.apiKey) {
  console.error('Missing EXPO_PUBLIC_FIREBASE_* env vars. Did .env load?');
  process.exit(1);
}

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

const testUsers = [
  {
    email: 'passenger@test.com',
    password: 'Test1234',
    studentId: 'B032110283',
    name: 'Ahmad Danish',
    phone: '+60123456789',
    gender: 'Male',
    role: 'passenger',
    vehiclePlate: '',
    vehicleModel: '',
    vehicleColor: '',
  },
  {
    email: 'driver@test.com',
    password: 'Test1234',
    studentId: 'B032110194',
    name: 'Muhammad Hazim',
    phone: '+60198765432',
    gender: 'Male',
    role: 'driver',
    vehiclePlate: 'WKL 2847',
    vehicleModel: 'Perodua Myvi',
    vehicleColor: 'White',
  },
];

async function seedUser(u) {
  console.log(`\n[seed] ${u.email} (${u.role}) ...`);

  let uid;
  try {
    const cred = await createUserWithEmailAndPassword(auth, u.email, u.password);
    uid = cred.user.uid;
    console.log(`  - Auth user created (uid=${uid})`);
  } catch (err) {
    if (err.code === 'auth/email-already-in-use') {
      console.log('  - Auth user already exists, signing in to get UID...');
      const cred = await signInWithEmailAndPassword(auth, u.email, u.password);
      uid = cred.user.uid;
    } else {
      throw err;
    }
  }

  const userDocRef = doc(db, 'users', u.studentId);
  const existing = await getDoc(userDocRef);
  if (existing.exists()) {
    console.log('  - Firestore /users doc already exists, skipping write');
  } else {
    await setDoc(userDocRef, {
      firebaseUid: uid,
      name: u.name,
      email: u.email,
      phone: u.phone,
      gender: u.gender,
      role: u.role,
      is_verified: true,
      is_2FA_verified: true,
      vehiclePlate: u.vehiclePlate,
      vehicleModel: u.vehicleModel,
      vehicleColor: u.vehicleColor,
      encryptedDocs: '',
      created_at: serverTimestamp(),
      updated_at: serverTimestamp(),
    });
    console.log(`  - Firestore /users/${u.studentId} written`);
  }

  await setDoc(doc(db, 'uid_index', uid), { studentId: u.studentId });
  console.log(`  - Firestore /uid_index/${uid} written`);

  await setDoc(doc(db, 'user_documents', u.studentId), {
    user_id: u.studentId,
    matric_card_url: '',
    road_tax_url: u.role === 'driver' ? '' : '',
    ocr_extracted_lines: [],
    encrypted_sensitive_data: '',
    is_verified: true,
  });
  console.log(`  - Firestore /user_documents/${u.studentId} written`);

  console.log(`[done] ${u.email}`);
}

(async () => {
  try {
    for (const u of testUsers) {
      await seedUser(u);
    }
    console.log('\nAll test users seeded successfully.\n');
    console.log('Login credentials:');
    console.log('  Passenger:  passenger@test.com / Test1234');
    console.log('  Driver:     driver@test.com    / Test1234');
    process.exit(0);
  } catch (err) {
    console.error('\nSeed failed:', err.code || '', err.message || err);
    if (err.code === 'permission-denied') {
      console.error(
        '\nFirestore rules are blocking writes. In Firebase Console → Firestore → Rules,\n' +
        'temporarily set:\n\n' +
        '  rules_version = "2";\n' +
        '  service cloud.firestore {\n' +
        '    match /databases/{database}/documents {\n' +
        '      match /{document=**} {\n' +
        '        allow read, write: if true;\n' +
        '      }\n' +
        '    }\n' +
        '  }\n\n' +
        'Publish, then re-run this script. Tighten rules afterwards.'
      );
    }
    process.exit(1);
  }
})();
