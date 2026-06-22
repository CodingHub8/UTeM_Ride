import {
  collection,
  doc,
  addDoc,
  updateDoc,
  getDoc,
  serverTimestamp,
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

  await addDoc(collection(db, 'transactions'), stripUndefined({
    user_id: input.driver_id,
    ride_id: input.rideId,
    amount: grossAmount,
    payment_method: input.payment_method,
    transaction_type: 'fare_payment',
    label: 'Trip payment from passenger',
    status: 'completed',
    route,
    passenger: passengerDetails,
    created_at: serverTimestamp(),
  }));

  await addDoc(collection(db, 'transactions'), stripUndefined({
    user_id: input.driver_id,
    ride_id: input.rideId,
    amount: -commission,
    payment_method: input.payment_method,
    transaction_type: 'service_fee',
    label: 'System commission fee (10%)',
    status: 'completed',
    created_at: serverTimestamp(),
  }));

  await addDoc(collection(db, 'transactions'), stripUndefined({
    user_id: input.passenger_id,
    ride_id: input.rideId,
    amount: -grossAmount,
    payment_method: input.payment_method,
    transaction_type: 'fare_payment',
    label: 'Ride fare paid',
    status: 'completed',
    route,
    created_at: serverTimestamp(),
  }));
}
