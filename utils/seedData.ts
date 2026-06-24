import {
  collection,
  doc,
  setDoc,
  getDocs,
  query,
  limit,
  serverTimestamp,
  Timestamp,
} from 'firebase/firestore';
import { db } from './firebase';

export async function seedDatabaseIfEmpty() {
  try {
    // Check if the database has any users
    const usersQuery = query(collection(db, 'users'), limit(1));
    const querySnapshot = await getDocs(usersQuery);
    if (!querySnapshot.empty) {
      console.log('[Seeder] Database already has data. Skipping seeding.');
      return;
    }

    console.log('[Seeder] Seeding database with sandbox mock data...');

    // 1. Seed Users
    const users = [
      {
        id: 'B032110194',
        firebaseUid: 'mock-driver-1',
        name: 'Muhammad Hazim',
        email: 'driver1@student.utem.edu.my',
        phone: '+60123456789',
        role: 'driver',
        gender: 'Male',
        is_verified: true,
        is_2FA_verified: true,
        vehiclePlate: 'WKL 2847',
        vehicleModel: 'Perodua Myvi',
        vehicleColor: 'White',
      },
      {
        id: 'B032110283',
        firebaseUid: 'mock-passenger-1',
        name: 'Ahmad Danish',
        email: 'passenger1@student.utem.edu.my',
        phone: '+60187654321',
        role: 'passenger',
        gender: 'Male',
        is_verified: true,
        is_2FA_verified: true,
      },
      {
        id: 'S4829104',
        firebaseUid: 'mock-driver-2',
        name: 'Prof. Dr. Ridzuan',
        email: 'driver2@utem.edu.my',
        phone: '+60133456789',
        role: 'driver',
        gender: 'Male',
        is_verified: true,
        is_2FA_verified: true,
        vehiclePlate: 'MCE 9942',
        vehicleModel: 'Proton X70',
        vehicleColor: 'Grey',
      },
      {
        id: 'B032110992',
        firebaseUid: 'mock-passenger-2',
        name: 'Sarah binti Ahmad',
        email: 'passenger2@student.utem.edu.my',
        phone: '+60172345678',
        role: 'passenger',
        gender: 'Female',
        is_verified: true,
        is_2FA_verified: true,
      },
      {
        id: 'B032110842',
        firebaseUid: 'mock-driver-3',
        name: 'Lim Wei Xiong',
        email: 'driver3@student.utem.edu.my',
        phone: '+60198765432',
        role: 'driver',
        gender: 'Male',
        is_verified: false,
        is_2FA_verified: true,
        vehiclePlate: 'JAA 1234',
        vehicleModel: 'Honda City',
        vehicleColor: 'Black',
      },
    ];

    for (const u of users) {
      await setDoc(doc(db, 'users', u.id), {
        ...u,
        created_at: serverTimestamp(),
        updated_at: serverTimestamp(),
      });

      // Write UID index: firebaseUid -> studentId
      await setDoc(doc(db, 'uid_index', u.firebaseUid), {
        studentId: u.id,
      });

      // Write user document verification record
      await setDoc(doc(db, 'user_documents', u.id), {
        user_id: u.id,
        matric_card_url: 'https://images.unsplash.com/photo-1544717305-2782549b5136?w=200',
        road_tax_url: u.vehiclePlate ? 'https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?w=200' : '',
        is_verified: u.is_verified,
        created_at: serverTimestamp(),
      });

      // Seed Vehicle if driver
      if (u.vehiclePlate) {
        await setDoc(doc(db, 'vehicles', u.id), {
          user_id: u.id,
          model: u.vehicleModel,
          plate_number: u.vehiclePlate,
          color: u.vehicleColor,
          road_tax_expiry: '2027-12-31',
          created_at: serverTimestamp(),
        });
      }
    }

    // 2. Seed Rides History
    const now = Date.now();
    const day = 24 * 3600 * 1000;
    const rides = [
      {
        id: 'mock-ride-1',
        passenger_id: 'B032110283',
        passenger_name: 'Ahmad Danish',
        passenger_phone: '+60187654321',
        driver_id: 'S4829104',
        driver_name: 'Prof. Dr. Ridzuan',
        driver_vehicle: 'Proton X70 (Grey)',
        driver_plate: 'MCE 9942',
        driver_phone: '+60133456789',
        pickup_address: 'Kolej Kediaman Lestari, UTeM',
        destination_address: 'Mydin MITC, Ayer Keroh',
        fare: 'RM 8.50',
        distance: '6.2 km',
        duration: '12 mins',
        payment_method: 'fpx',
        payment_label: 'FPX (Bank Islam)',
        payment_status: 'completed',
        status: 'completed',
        timestamp: now - 2 * day,
      },
      {
        id: 'mock-ride-2',
        passenger_id: 'B032110992',
        passenger_name: 'Sarah binti Ahmad',
        passenger_phone: '+60172345678',
        driver_id: 'B032110194',
        driver_name: 'Muhammad Hazim',
        driver_vehicle: 'Perodua Myvi (White)',
        driver_plate: 'WKL 2847',
        driver_phone: '+60123456789',
        pickup_address: 'FTMK, UTeM Main Campus',
        destination_address: 'Melaka Sentral',
        fare: 'RM 12.00',
        distance: '14.5 km',
        duration: '25 mins',
        payment_method: 'card',
        payment_label: 'Card (*9010)',
        payment_status: 'completed',
        status: 'completed',
        timestamp: now - day,
      },
      {
        id: 'mock-ride-3',
        passenger_id: 'B032110992',
        passenger_name: 'Sarah binti Ahmad',
        passenger_phone: '+60172345678',
        driver_id: 'B032110194',
        driver_name: 'Muhammad Hazim',
        driver_vehicle: 'Perodua Myvi (White)',
        driver_plate: 'WKL 2847',
        driver_phone: '+60123456789',
        pickup_address: 'UTeM Kampus Induk, Durian Tunggal',
        destination_address: 'Ayer Keroh, Melaka',
        fare: 'RM 5.50',
        distance: '4.2 km',
        duration: '10 mins',
        payment_method: 'cash',
        payment_label: 'Cash',
        payment_status: 'completed',
        status: 'completed',
        timestamp: now - 3 * 3600 * 1000,
      },
    ];

    for (const r of rides) {
      await setDoc(doc(db, 'rides', r.id), {
        ...r,
        created_at: Timestamp.fromMillis(r.timestamp),
      });
    }

    // 3. Seed Carpool Slots & Bookings
    const tomorrow = new Date(now + day);
    tomorrow.setHours(9, 0, 0, 0);
    const dayAfter = new Date(now + 2 * day);
    dayAfter.setHours(14, 30, 0, 0);

    const poolSlots = [
      {
        id: 'mock-pool-1',
        driver_id: 'S4829104',
        driver_name: 'Prof. Dr. Ridzuan',
        driver_vehicle: 'Proton X70 (Grey)',
        driver_plate: 'MCE 9942',
        driver_gender: 'Male',
        pickup: 'UTeM Kampus Induk, Durian Tunggal',
        pickup_coords: { latitude: 2.3135, longitude: 102.3211 },
        destination: 'Mahkamah Melaka, Ayer Keroh',
        destination_coords: { latitude: 2.2744, longitude: 102.2983 },
        date_time: Timestamp.fromDate(tomorrow),
        seats_total: 4,
        seats_booked: 2,
        price_per_seat: 3.50,
        gender_matching: false,
        status: 'open',
      },
      {
        id: 'mock-pool-2',
        driver_id: 'B032110194',
        driver_name: 'Muhammad Hazim',
        driver_vehicle: 'Perodua Myvi (White)',
        driver_plate: 'WKL 2847',
        driver_gender: 'Male',
        pickup: 'Kolej Kediaman Lestari, UTeM',
        pickup_coords: { latitude: 2.3086, longitude: 102.3197 },
        destination: 'AEON Bandaraya Melaka',
        destination_coords: { latitude: 2.2274, longitude: 102.2492 },
        date_time: Timestamp.fromDate(dayAfter),
        seats_total: 3,
        seats_booked: 0,
        price_per_seat: 5.00,
        gender_matching: false,
        status: 'open',
      },
      {
        id: 'mock-pool-3',
        driver_id: 'B032110842',
        driver_name: 'Lim Wei Xiong',
        driver_vehicle: 'Honda City (Black)',
        driver_plate: 'JAA 1234',
        driver_gender: 'Male',
        pickup: 'UTeM Main Gate',
        pickup_coords: { latitude: 2.3150, longitude: 102.3200 },
        destination: 'Mydin MITC, Ayer Keroh',
        destination_coords: { latitude: 2.2721, longitude: 102.2854 },
        date_time: Timestamp.fromDate(new Date(now + 1.5 * day)),
        seats_total: 4,
        seats_booked: 0,
        price_per_seat: 2.00,
        gender_matching: false,
        status: 'open',
      },
    ];

    for (const p of poolSlots) {
      await setDoc(doc(db, 'carpool_slots', p.id), {
        ...p,
        created_at: serverTimestamp(),
      });
    }

    // Add Bookings to mock-pool-1
    const bookings = [
      {
        id: 'B032110283', // Ahmad Danish
        passenger_id: 'B032110283',
        passenger_name: 'Ahmad Danish',
        passenger_phone: '+60187654321',
        seats_booked: 1,
        payment_method: 'cash',
        payment_status: 'completed',
        status: 'confirmed',
        created_at: serverTimestamp(),
      },
      {
        id: 'B032110992', // Sarah
        passenger_id: 'B032110992',
        passenger_name: 'Sarah binti Ahmad',
        passenger_phone: '+60172345678',
        seats_booked: 1,
        payment_method: 'fpx',
        payment_status: 'completed',
        status: 'confirmed',
        created_at: serverTimestamp(),
      },
    ];

    for (const b of bookings) {
      await setDoc(doc(db, 'carpool_slots', 'mock-pool-1', 'bookings', b.id), b);
    }

    // Add Bookings to mock-pool-2 (pending request)
    const pendingBooking = {
      id: 'B032110992', // Sarah
      passenger_id: 'B032110992',
      passenger_name: 'Sarah binti Ahmad',
      passenger_phone: '+60172345678',
      seats_booked: 1,
      payment_method: 'card',
      payment_status: 'completed',
      status: 'pending',
      pickup_address: 'FKE, UTeM Kampus Induk',
      created_at: serverTimestamp(),
    };
    await setDoc(doc(db, 'carpool_slots', 'mock-pool-2', 'bookings', pendingBooking.id), pendingBooking);

    // 4. Seed Transactions
    const txs = [
      // S4829104 (Prof Ridzuan) transactions
      {
        user_id: 'S4829104',
        ride_id: 'mock-ride-1',
        amount: 8.50,
        payment_method: 'fpx',
        transaction_type: 'fare_payment',
        label: 'Trip payment from Ahmad Danish',
        role: 'driver',
        status: 'completed',
        route: { pickup: 'Kolej Kediaman Lestari, UTeM', destination: 'Mydin MITC, Ayer Keroh' },
        created_at: Timestamp.fromMillis(now - 2 * day),
      },
      {
        user_id: 'S4829104',
        ride_id: 'mock-ride-1',
        amount: -0.85,
        payment_method: 'fpx',
        transaction_type: 'service_fee',
        label: 'System commission fee (10%)',
        role: 'driver',
        status: 'completed',
        created_at: Timestamp.fromMillis(now - 2 * day + 1000),
      },
      // Ahmad Danish transactions
      {
        user_id: 'B032110283',
        ride_id: 'mock-ride-1',
        amount: -8.50,
        payment_method: 'fpx',
        transaction_type: 'fare_payment',
        label: 'Ride fare paid',
        role: 'passenger',
        status: 'completed',
        route: { pickup: 'Kolej Kediaman Lestari, UTeM', destination: 'Mydin MITC, Ayer Keroh' },
        created_at: Timestamp.fromMillis(now - 2 * day),
      },
      // B032110194 (Muhammad Hazim) transactions
      {
        user_id: 'B032110194',
        ride_id: 'mock-ride-2',
        amount: 12.00,
        payment_method: 'card',
        transaction_type: 'fare_payment',
        label: 'Trip payment from Sarah',
        role: 'driver',
        status: 'completed',
        route: { pickup: 'FTMK, UTeM Main Campus', destination: 'Melaka Sentral' },
        created_at: Timestamp.fromMillis(now - day),
      },
      {
        user_id: 'B032110194',
        ride_id: 'mock-ride-2',
        amount: -1.20,
        payment_method: 'card',
        transaction_type: 'service_fee',
        label: 'System commission fee (10%)',
        role: 'driver',
        status: 'completed',
        created_at: Timestamp.fromMillis(now - day + 1000),
      },
      {
        user_id: 'B032110194',
        ride_id: 'mock-ride-3',
        amount: 0,
        cash_amount: 5.50,
        payment_method: 'cash',
        transaction_type: 'fare_payment',
        label: 'Trip payment from Sarah (Cash)',
        role: 'driver',
        status: 'completed',
        route: { pickup: 'UTeM Kampus Induk, Durian Tunggal', destination: 'Ayer Keroh, Melaka' },
        created_at: Timestamp.fromMillis(now - 3 * 3600 * 1000),
      },
      {
        user_id: 'B032110194',
        ride_id: 'mock-ride-3',
        amount: 0,
        cash_amount: 0.55,
        payment_method: 'cash',
        transaction_type: 'service_fee',
        label: 'System commission fee (Cash - 0%)',
        role: 'driver',
        status: 'completed',
        created_at: Timestamp.fromMillis(now - 3 * 3600 * 1000 + 1000),
      },
      {
        user_id: 'B032110194',
        amount: -10.00,
        payment_method: 'fpx',
        transaction_type: 'withdrawal',
        label: 'Withdrawal to Maybank2u',
        role: 'driver',
        status: 'completed',
        created_at: Timestamp.fromMillis(now - 2 * 3600 * 1000),
      },
      // Sarah transactions
      {
        user_id: 'B032110992',
        ride_id: 'mock-ride-2',
        amount: -12.00,
        payment_method: 'card',
        transaction_type: 'fare_payment',
        label: 'Ride fare paid',
        role: 'passenger',
        status: 'completed',
        route: { pickup: 'FTMK, UTeM Main Campus', destination: 'Melaka Sentral' },
        created_at: Timestamp.fromMillis(now - day),
      },
      {
        user_id: 'B032110992',
        ride_id: 'mock-ride-3',
        amount: 0,
        cash_amount: 5.50,
        payment_method: 'cash',
        transaction_type: 'fare_payment',
        label: 'Ride fare paid (Cash)',
        role: 'passenger',
        status: 'completed',
        route: { pickup: 'UTeM Kampus Induk, Durian Tunggal', destination: 'Ayer Keroh, Melaka' },
        created_at: Timestamp.fromMillis(now - 3 * 3600 * 1000),
      },
      {
        user_id: 'B032110992',
        amount: 6.00,
        payment_method: 'card',
        transaction_type: 'refund',
        label: 'Refund for cancelled ride request',
        role: 'passenger',
        status: 'completed',
        created_at: Timestamp.fromMillis(now - 1 * 3600 * 1000),
      },
    ];

    for (let i = 0; i < txs.length; i++) {
      await setDoc(doc(db, 'transactions', `mock-tx-${i}`), txs[i]);
    }

    console.log('[Seeder] Seeding completed successfully.');
  } catch (error) {
    console.error('[Seeder] Error seeding database:', error);
  }
}
