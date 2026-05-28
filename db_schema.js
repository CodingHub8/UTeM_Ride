/**
 * ============================================================
 * FIRESTORE DATA MODEL — UTeM Ride
 * ============================================================
 * Firebase Firestore is a NoSQL document database.
 * There are no tables — data is organised into COLLECTIONS
 * (like folders) containing DOCUMENTS (like JSON objects).
 *
 * This file describes the Firestore collection structure,
 * document field definitions, and security assumptions.
 *
 * ENCRYPTION NOTES:
 * - Sensitive fields (encrypted_sensitive_data, encrypted_payment_details)
 *   are encrypted CLIENT-SIDE before writing to Firestore using utils/encryption.ts.
 * - Firebase Security Rules enforce that each user can only
 *   read/write their own documents.
 * ============================================================
 */

// ─────────────────────────────────────────────────────────────
// COLLECTION: users
// Path: /users/{userId}
// userId = Student/Staff ID (matric number or staff ID)
//          e.g. 'B032110123', 'D00412'
// Each student/staff can only register ONCE (ID is the document key).
// ─────────────────────────────────────────────────────────────
const userDocument = {
  id: 'B032110123',               // String — Student/Staff ID (Document ID)
  name: 'Ahmad bin Ali',          // String
  email: 'b032110123@student.utem.edu.my', // String — must end in @student.utem.edu.my or @utem.edu.my
  phone: '+60123456789',          // String
  gender: 'Male',                 // String — 'Male' | 'Female'
  profile_picture_url: '',        // String — Firebase Storage URL or empty
  is_verified: false,             // Boolean — true after document upload is verified
  created_at: 'Timestamp',        // Firestore Timestamp
  updated_at: 'Timestamp',        // Firestore Timestamp
};

// ─────────────────────────────────────────────────────────────
// COLLECTION: user_documents
// Path: /user_documents/{userId}
// One document per user. userId matches users/{userId}.
// Sensitive fields are encrypted using utils/encryption.ts.
// ─────────────────────────────────────────────────────────────
const userDocumentRecord = {
  user_id: 'B032110123',           // String — reference to users/{userId}

  // Firebase Storage URLs for uploaded images
  matric_card_url: '',             // String — Firebase Storage URL
  road_tax_url: '',                // String — Firebase Storage URL

  // Raw lines extracted by OCR (array of strings)
  ocr_extracted_lines: ['LINE 1', 'LINE 2'],

  // AES/XOR encrypted blob. Decryptable only by the owner's key.
  // Plaintext contains: { student_id, full_name, road_tax_number, vehicle_plate }
  encrypted_sensitive_data: '',   // String — encrypted, see utils/encryption.ts

  is_verified: false,             // Boolean
  verified_at: null,              // Firestore Timestamp or null
  created_at: 'Timestamp',        // Firestore Timestamp
};

// ─────────────────────────────────────────────────────────────
// COLLECTION: vehicles
// Path: /vehicles/{vehicleId}
// vehicleId = auto-generated Firestore document ID
// ─────────────────────────────────────────────────────────────
const vehicleDocument = {
  id: 'auto-id',                  // String — Firestore auto-generated ID
  user_id: 'B032110123',          // String — reference to users/{userId}
  model: 'Perodua Myvi',          // String
  plate_number: 'WKL 2847',       // String — unique
  color: 'White',                 // String
  road_tax_expiry: '2025-12-31',  // String — ISO date (YYYY-MM-DD)
  created_at: 'Timestamp',        // Firestore Timestamp
};

// ─────────────────────────────────────────────────────────────
// COLLECTION: rides
// Path: /rides/{rideId}
// rideId = Firestore auto-generated document ID
// ─────────────────────────────────────────────────────────────
const rideDocument = {
  id: 'auto-id',                  // String — Firestore auto-generated ID
  passenger_id: 'B032110123',     // String — reference to users/{userId}
  driver_id: null,                // String | null — null until a driver accepts

  pickup_address: 'Kolej Kediaman 1, UTeM',
  pickup_latitude: 2.3123,        // Number
  pickup_longitude: 102.3211,     // Number

  destination_address: 'Ayer Keroh, Melaka',
  destination_latitude: 2.2811,   // Number
  destination_longitude: 102.2544,// Number

  distance_km: 4.5,               // Number
  duration_min: 12,               // Number
  fare_amount: 3.50,              // Number

  // Payment method chosen by the passenger
  payment_method: 'fpx',          // String — 'cash' | 'fpx' | 'duitnow_qr' | 'card'

  // Ride lifecycle status
  status: 'requested',            // String — 'requested' | 'accepted' | 'arrived' | 'in_progress' | 'completed' | 'cancelled'

  scheduled_time: null,           // Firestore Timestamp | null (null = immediate ride)
  created_at: 'Timestamp',        // Firestore Timestamp
};

// ─────────────────────────────────────────────────────────────
// COLLECTION: carpool_slots
// Path: /carpool_slots/{slotId}
// Published by drivers for scheduled carpooling.
// ─────────────────────────────────────────────────────────────
const carpoolSlotDocument = {
  id: 'auto-id',                  // String — Firestore auto-generated ID
  driver_id: 'B032110123',        // String — reference to users/{userId}
  destination: 'Mahkamah Melaka', // String
  date_time: 'Timestamp',         // Firestore Timestamp
  seats_total: 3,                 // Number
  seats_booked: 0,                // Number — increment on each booking
  price_per_seat: 2.00,           // Number
  gender_matching: false,         // Boolean — true = same gender passengers only
  created_at: 'Timestamp',        // Firestore Timestamp
};

// ─────────────────────────────────────────────────────────────
// SUB-COLLECTION: carpool_bookings
// Path: /carpool_slots/{slotId}/bookings/{bookingId}
// Stored as a sub-collection under each carpool slot.
// ─────────────────────────────────────────────────────────────
const carpoolBookingDocument = {
  id: 'auto-id',                  // String — Firestore auto-generated ID
  passenger_id: 'B032110123',     // String — reference to users/{userId}
  seats_booked: 1,                // Number
  payment_method: 'cash',         // String — 'cash' | 'fpx' | 'duitnow_qr' | 'card'
  status: 'pending',              // String — 'pending' | 'confirmed' | 'cancelled'
  created_at: 'Timestamp',        // Firestore Timestamp
};

// ─────────────────────────────────────────────────────────────
// COLLECTION: transactions
// Path: /transactions/{transactionId}
// All financial flows: fare payments, wallet top-ups, payouts.
// Sensitive payment details are encrypted before writing.
// ─────────────────────────────────────────────────────────────
const transactionDocument = {
  id: 'auto-id',                  // String — Firestore auto-generated or gateway ref
  user_id: 'B032110123',          // String — reference to users/{userId}
  ride_id: 'auto-id',             // String | null — linked ride (if applicable)
  amount: 3.50,                   // Number — positive = topup/earning, negative = deduction

  payment_method: 'fpx',          // String — 'cash' | 'fpx' | 'duitnow_qr' | 'card'
  transaction_type: 'fare_payment', // String — 'fare_payment' | 'wallet_topup' | 'withdrawal' | 'payout'
  status: 'pending',              // String — 'pending' | 'completed' | 'failed'

  // Encrypted payment metadata (e.g. last4 card digits, gateway payload, bank ref).
  // Encrypted client-side using utils/encryption.ts before writing.
  encrypted_payment_details: '',  // String — encrypted

  created_at: 'Timestamp',        // Firestore Timestamp
};

// ─────────────────────────────────────────────────────────────
// FIRESTORE SECURITY RULES OUTLINE
// Deploy these via Firebase Console > Firestore > Rules
// ─────────────────────────────────────────────────────────────
const firestoreRulesOutline = `
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    // Users can only read/write their own profile
    match /users/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }

    // Documents are only accessible by the owner
    match /user_documents/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }

    // Vehicles owned by the user
    match /vehicles/{vehicleId} {
      allow read, write: if request.auth != null
        && resource.data.user_id == request.auth.uid;
      allow create: if request.auth != null
        && request.resource.data.user_id == request.auth.uid;
    }

    // Rides — passenger or driver can read; only passenger can create
    match /rides/{rideId} {
      allow read: if request.auth != null
        && (resource.data.passenger_id == request.auth.uid
            || resource.data.driver_id == request.auth.uid);
      allow create: if request.auth != null;
      allow update: if request.auth != null
        && (resource.data.passenger_id == request.auth.uid
            || resource.data.driver_id == request.auth.uid);
    }

    // Carpool slots — public read, driver-only write
    match /carpool_slots/{slotId} {
      allow read: if request.auth != null;
      allow write: if request.auth != null
        && resource.data.driver_id == request.auth.uid;
      allow create: if request.auth != null;

      // Bookings sub-collection
      match /bookings/{bookingId} {
        allow read, write: if request.auth != null
          && (resource.data.passenger_id == request.auth.uid
              || get(/databases/$(database)/documents/carpool_slots/$(slotId)).data.driver_id == request.auth.uid);
        allow create: if request.auth != null;
      }
    }

    // Transactions — owner only
    match /transactions/{transactionId} {
      allow read, write: if request.auth != null
        && resource.data.user_id == request.auth.uid;
      allow create: if request.auth != null;
    }
  }
}
`;

module.exports = {
  userDocument,
  userDocumentRecord,
  vehicleDocument,
  rideDocument,
  carpoolSlotDocument,
  carpoolBookingDocument,
  transactionDocument,
  firestoreRulesOutline,
};
