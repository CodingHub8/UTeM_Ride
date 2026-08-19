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
  increment,
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
  const snapRide = await getDoc(ref);

  let actualPassengerId = passengerId;
  let actualFare = fareAmount;
  let actualPaymentMethod = paymentMethod;
  let actualPaymentLabel = paymentLabel || '';

  if (snapRide.exists()) {
    const data = snapRide.data();
    if (data.passenger_id) actualPassengerId = data.passenger_id;
    if (data.fare) {
      const parsed = parseFare(data.fare);
      if (parsed > 0) actualFare = parsed;
    }
    if (data.payment_method) actualPaymentMethod = data.payment_method;
    if (data.payment_label) actualPaymentLabel = data.payment_label;
  }

  await updateDoc(ref, {
    status: 'cancelled' as RideStatus,
    cancelled_at: serverTimestamp(),
  });

  if (actualPaymentMethod !== 'cash' && actualFare > 0 && actualPassengerId && actualPassengerId !== 'anonymous') {
    const q = query(
      collection(db, 'transactions'),
      where('ride_id', '==', rideId),
      where('user_id', '==', actualPassengerId),
      where('status', '==', 'held')
    );
    const snap = await getDocs(q);
    const batch = writeBatch(db);

    if (!snap.empty) {
      snap.forEach((d) => {
        batch.update(d.ref, { status: 'refunded' });
      });
    }

    const refundRef = doc(collection(db, 'transactions'));
    batch.set(refundRef, {
      user_id: actualPassengerId,
      ride_id: rideId,
      amount: actualFare, // positive refund credit
      payment_method: actualPaymentMethod,
      transaction_type: 'refund',
      label: `Refund: Ride cancelled/expired (${actualPaymentLabel || actualPaymentMethod})`,
      role: 'passenger',
      status: 'completed',
      created_at: serverTimestamp(),
    });

    // Directly increment passenger's wallet_balance document in Firestore
    const userRef = doc(db, 'users', actualPassengerId);
    batch.update(userRef, {
      passenger_wallet_balance: increment(actualFare),
      wallet_balance: increment(actualFare),
      updated_at: serverTimestamp(),
    });

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
  const netEarnings = +(grossAmount - commission).toFixed(2);

  const passengerDetails = {
    id: input.passenger_id,
    passenger_id: input.passenger_id,
    name: input.passenger_name || 'Passenger',
    username: input.passenger_username || (input.passenger_email?.split('@')[0] ?? 'passenger'),
    email: input.passenger_email || '',
    phone: input.passenger_phone || '',
    gender: input.passenger_gender || '',
  };
  const route = { pickup: input.pickup, destination: input.destination };

  const isCash = input.payment_method === 'cash';

  if (isCash) {
    // 1. CASH RIDE: Driver receives gross cash in hand.
    // Deduct 10% platform fee from driver's e-wallet balance
    const driverRef = doc(db, 'users', input.driver_id);
    await updateDoc(driverRef, {
      driver_wallet_balance: increment(-commission),
      wallet_balance: increment(-commission),
      updated_at: serverTimestamp(),
    });

    // Transaction 1 for driver: Cash Payment (+ RM X.XX info record)
    await addDoc(collection(db, 'transactions'), stripUndefined({
      user_id: input.driver_id,
      ride_id: input.rideId,
      amount: grossAmount,
      cash_amount: grossAmount,
      payment_method: 'cash',
      transaction_type: 'cash_payment',
      label: 'Cash payment',
      role: 'driver_cash_info',
      status: 'completed',
      route,
      passenger: passengerDetails,
      created_at: serverTimestamp(),
    }));

    // Transaction 2 for driver: Cash fee (-10%) (- RM Y.YY)
    await addDoc(collection(db, 'transactions'), stripUndefined({
      user_id: input.driver_id,
      ride_id: input.rideId,
      amount: -commission,
      cash_amount: grossAmount,
      payment_method: 'cash',
      transaction_type: 'service_fee',
      label: 'Cash fee (-10%)',
      role: 'driver',
      status: 'completed',
      route,
      passenger: passengerDetails,
      created_at: serverTimestamp(),
    }));
  } else {
    // 2. ONLINE PAYMENT RIDE (FPX / Card / E-Wallet):
    // Credit net earnings (90% of fare) directly to driver's e-wallet balance
    const driverRef = doc(db, 'users', input.driver_id);
    await updateDoc(driverRef, {
      driver_wallet_balance: increment(netEarnings),
      wallet_balance: increment(netEarnings),
      updated_at: serverTimestamp(),
    });

    const methodLower = (input.payment_method || '').toLowerCase();
    let onlineLabel = 'Online payment';
    if (methodLower.includes('fpx')) {
      onlineLabel = 'FPX (Online payment)';
    } else if (methodLower.includes('card')) {
      onlineLabel = 'Card payment';
    } else {
      onlineLabel = 'E-Wallet (Online payment)';
    }

    // Record single net earnings transaction for driver: + RM netEarnings
    await addDoc(collection(db, 'transactions'), stripUndefined({
      user_id: input.driver_id,
      ride_id: input.rideId,
      amount: netEarnings,
      cash_amount: grossAmount,
      payment_method: input.payment_method,
      transaction_type: 'fare_payment',
      label: onlineLabel,
      role: 'driver',
      status: 'completed',
      route,
      passenger: passengerDetails,
      created_at: serverTimestamp(),
    }));
  }

  // 3. Passenger transaction: release held transaction if it exists
  if (!isCash) {
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
            label: `Ride fare paid`,
            role: 'passenger',
          });
        });
        await batch.commit();
      }
    } catch (err) {
      console.warn('Error releasing held passenger escrow transaction:', err);
    }
  }
}
