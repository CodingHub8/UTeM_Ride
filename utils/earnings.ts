import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { db } from '@/utils/firebase';

export interface EarningsSummary {
  today: number;
  week: number;
  todayTrips: number;
  weekTrips: number;
}

function startOfDay(d = new Date()) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

function startOfWeek(d = new Date()) {
  const day = d.getDay();
  const diff = day === 0 ? 6 : day - 1;
  const monday = new Date(d.getFullYear(), d.getMonth(), d.getDate() - diff);
  return monday.getTime();
}

export function subscribeDriverEarnings(driverId: string, onUpdate: (summary: EarningsSummary) => void) {
  const q = query(collection(db, 'transactions'), where('user_id', '==', driverId));
  return onSnapshot(q, (snap) => {
    const todayStart = startOfDay();
    const weekStart = startOfWeek();
    let today = 0;
    let week = 0;
    const tripIdsToday = new Set<string>();
    const tripIdsWeek = new Set<string>();

    snap.forEach((d) => {
      const data = d.data();
      // Include both online ('fare_payment') and cash ('cash_payment') positive earnings
      const isEarningType = data.transaction_type === 'fare_payment' || data.transaction_type === 'cash_payment';
      const amt = Number(data.amount) || 0;

      if (!isEarningType || amt <= 0) return;

      // Extract timestamp with fallback to Date.now() for pending Firestore serverTimestamp writes
      let ts = 0;
      if (data.created_at && typeof data.created_at.toMillis === 'function') {
        ts = data.created_at.toMillis();
      } else if (typeof data.created_at === 'number' && data.created_at > 0) {
        ts = data.created_at;
      } else if (typeof data.timestamp === 'number' && data.timestamp > 0) {
        ts = data.timestamp;
      } else {
        ts = Date.now();
      }

      const rideId = data.ride_id || d.id;

      if (ts >= todayStart) {
        today += amt;
        tripIdsToday.add(rideId);
      }
      if (ts >= weekStart) {
        week += amt;
        tripIdsWeek.add(rideId);
      }
    });

    onUpdate({
      today: Number(today.toFixed(2)),
      week: Number(week.toFixed(2)),
      todayTrips: tripIdsToday.size,
      weekTrips: tripIdsWeek.size,
    });
  });
}
