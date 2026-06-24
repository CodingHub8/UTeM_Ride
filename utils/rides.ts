import {
    collection,
  doc,
  addDoc,
  updateDoc,
  getDoc,
  serverTimestamp,
  query,
  where,
  getDocs,
  writeBatch,
} from 'firebase/firestore';
import { db } from '@/utils/firebase';
import { stripUndefined } from '@/utils/firestoreHelpers';
import { notifyUser } from '@/utils/notifications';

async function notifyPassengerOfRide(
  rideId: string,
  event: 'accepted' | 'arrived' | 'in_progress' | 'completed'
) {
  try {
    const snap = await getDoc(doc(db, 'rides', rideId));
    if (snap.exists()) {
      const passengerId = snap.data().passenger_id;
      if (passengerId) await notifyUser(passengerId, event, { rideId });
    }
  } catch (e) {
    console.warn('notifyPassengerOfRide error:', e);
  }
}

export type RideStatus =
  | 'requested'
  | 'accepted'
  | 'arrived'
  | 'in_progress'
  | 'completed'
  | 'cancelled';

export interface Coords {
  latitude: number;
  longitude: number;
}

export interface CreateRideInput {
  passenger_id: string;
  passenger_name: string;
  passenger_phone?: string;
  pickup_address: string;
  pickup_coords: Coords;
  destination_address: string;
  destination_coords: Coords;
  fare: string;
  distance?: string;
  duration?: string;
  route_polyline?: Coords[];
  payment_method: string;
  payment_label: string;
  payment_id?: string | null;
  hitpay_id?: string | null;
  payment_status?: string;
  scheduled_time?: string | null;
}

export async function createRide(input: CreateRideInput) {
  const ref = await addDoc(collection(db, 'rides'), stripUndefined({
    ...input,
    driver_id: null,
    driver_name: null,
    driver_vehicle: null,
    driver_plate: null,
    driver_phone: null,
    driver_location: null,
    status: 'requested' as RideStatus,
    timestamp: Date.now(),
    created_at: serverTimestamp(),
  }));
  return ref.id;
}

export interface AcceptRideInput {
  rideId: string;
  driver_id: string;
  driver_name: string;
  driver_vehicle: string;
  driver_plate: string;
  driver_phone?: string;
  driver_location: Coords | null;
}

export async function acceptRide(input: AcceptRideInput) {
  const ref = doc(db, 'rides', input.rideId);
  await updateDoc(ref, {
    driver_id: input.driver_id,
    driver_name: input.driver_name,
    driver_vehicle: input.driver_vehicle,
    driver_plate: input.driver_plate,
    driver_phone: input.driver_phone || null,
    driver_location: input.driver_location || null,
    status: 'accepted' as RideStatus,
    accepted_at: serverTimestamp(),
  });
  notifyPassengerOfRide(input.rideId, 'accepted');
}

export async function publishDriverLocation(
  rideId: string,
  coords: Coords,
  heading?: number | null
) {
  const ref = doc(db, 'rides', rideId);
  await updateDoc(ref, {
    driver_location: {
      latitude: coords.latitude,
      longitude: coords.longitude,
      heading: heading ?? null,
      updated_at: Date.now(),
    },
  });
}

export async function markArrived(rideId: string) {
  const ref = doc(db, 'rides', rideId);
  await updateDoc(ref, {
    status: 'arrived' as RideStatus,
    arrived_at: serverTimestamp(),
  });
  notifyPassengerOfRide(rideId, 'arrived');
}

export async function startTrip(rideId: string) {
  const ref = doc(db, 'rides', rideId);
  await updateDoc(ref, {
    status: 'in_progress' as RideStatus,
    started_at: serverTimestamp(),
  });
  notifyPassengerOfRide(rideId, 'in_progress');
}

export async function completeTrip(rideId: string) {
  const ref = doc(db, 'rides', rideId);
  await updateDoc(ref, {
    status: 'completed' as RideStatus,
    completed_at: serverTimestamp(),
  });
  notifyPassengerOfRide(rideId, 'completed');
}

export async function cancelRide(rideId: string) {
  const ref = doc(db, 'rides', rideId);
  await updateDoc(ref, {
    status: 'cancelled' as RideStatus,
    cancelled_at: serverTimestamp(),
  });
}

export async function cancelAndRefundRide(
  rideId: string,
  passengerId: string,
  fareAmount: number,
  paymentMethod: string,
  paymentLabel?: string
) {
  const ref = doc(db, 'rides', rideId);
  await updateDoc(ref, {
    status: 'cancelled' as RideStatus,
    cancelled_at: serverTimestamp(),
  });

  if (paymentMethod !== 'cash') {
    const q = query(
      collection(db, 'transactions'),
      where('ride_id', '==', rideId),
      where('user_id', '==', passengerId),
      where('status', '==', 'held')
    );
    const snap = await getDocs(q);
    const batch = writeBatch(db);
    let hasHeld = false;

    snap.forEach((d) => {
      batch.update(d.ref, { status: 'refunded' });
      hasHeld = true;
    });

    if (hasHeld) {
      const refundRef = doc(collection(db, 'transactions'));
      batch.set(refundRef, {
        user_id: passengerId,
        ride_id: rideId,
        amount: fareAmount, // credit refund
        payment_method: paymentMethod,
        transaction_type: 'refund',
        label: `Refund: Ride cancelled (${paymentLabel || paymentMethod})`,
        role: 'passenger',
        status: 'completed',
        created_at: serverTimestamp(),
      });
    }
    await batch.commit();
  }
}

export function parseFare(fareString: string | undefined | null): number {
  if (!fareString) return 0;
  const cleaned = fareString.toString().replace(/[^\d.]/g, '');
  const value = parseFloat(cleaned);
  return isNaN(value) ? 0 : value;
}

export const COMMISSION_RATE = 0.1;

export interface CreateRideTransactionsInput {
  rideId: string;
  fare: number;
  driver_id: string;
  passenger_id: string;
  passenger_name?: string;
  passenger_username?: string;
  passenger_email?: string;
  passenger_phone?: string;
  passenger_gender?: string;
  pickup: string;
  destination: string;
  payment_method: string;
}

export async function createRideTransactions(input: CreateRideTransactionsInput) {
  const commission = +(input.fare * COMMISSION_RATE).toFixed(2);
  const grossAmount = input.fare;

  const passengerDetails = {
    name: input.passenger_name || 'Passenger',
    username: input.passenger_username || (input.passenger_email?.split('@')[0] ?? 'passenger'),
    email: input.passenger_email || '',
    phone: input.passenger_phone || '',
    gender: input.passenger_gender || '',
  };
  const route = { pickup: input.pickup, destination: input.destination };

  // 1. Create Driver Gross Fare Transaction
  await addDoc(collection(db, 'transactions'), stripUndefined({
    user_id: input.driver_id,
    ride_id: input.rideId,
    amount: input.payment_method === 'cash' ? 0 : grossAmount,
    cash_amount: grossAmount,
    payment_method: input.payment_method,
    transaction_type: 'fare_payment',
    label: input.payment_method === 'cash' ? 'Trip payment from passenger (Cash)' : 'Trip payment from passenger',
    role: 'driver',
    status: 'completed',
    route,
    passenger: passengerDetails,
    created_at: serverTimestamp(),
  }));

  // 2. Create Driver Commission service fee Transaction
  await addDoc(collection(db, 'transactions'), stripUndefined({
    user_id: input.driver_id,
    ride_id: input.rideId,
    amount: input.payment_method === 'cash' ? 0 : -commission,
    cash_amount: commission,
    payment_method: input.payment_method,
    transaction_type: 'service_fee',
    label: input.payment_method === 'cash' ? 'System commission fee (Cash - 0%)' : 'System commission fee (10%)',
    role: 'driver',
    status: 'completed',
    created_at: serverTimestamp(),
  }));

  // 3. Passenger transaction: release held transaction if it exists
  let passengerPaidUpdated = false;
  if (input.payment_method !== 'cash') {
    try {
      const q = query(
        collection(db, 'transactions'),
        where('ride_id', '==', input.rideId),
        where('user_id', '==', input.passenger_id),
        where('status', '==', 'held')
      );
      const snap = await getDocs(q);
      if (!snap.empty) {
        const batch = writeBatch(db);
        snap.forEach((d) => {
          batch.update(d.ref, {
            status: 'completed',
            label: `Ride fare paid (Escrow Released)`,
            role: 'passenger',
          });
        });
        await batch.commit();
        passengerPaidUpdated = true;
      }
    } catch (err) {
      console.warn('Error releasing held transaction, fallback to new entry:', err);
    }
  }

  // 4. Create new passenger completed transaction if fallback or cash
  if (!passengerPaidUpdated) {
    await addDoc(collection(db, 'transactions'), stripUndefined({
      user_id: input.passenger_id,
      ride_id: input.rideId,
      amount: input.payment_method === 'cash' ? 0 : -grossAmount,
      cash_amount: grossAmount,
      payment_method: input.payment_method,
      transaction_type: 'fare_payment',
      label: input.payment_method === 'cash' ? 'Ride fare paid (Cash)' : 'Ride fare paid',
      role: 'passenger',
      status: 'completed',
      route,
      created_at: serverTimestamp(),
    }));
  }
}
