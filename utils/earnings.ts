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
    let todayTrips = 0;
    let weekTrips = 0;
    const tripIdsToday = new Set<string>();
    const tripIdsWeek = new Set<string>();

    snap.forEach((d) => {
      const data = d.data();
      if (data.transaction_type !== 'fare_payment' || Number(data.amount) <= 0) return;
      const ts = data.created_at?.toMillis?.() || data.timestamp || 0;
      const amt = Number(data.amount) || 0;
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
      today,
      week,
      todayTrips: tripIdsToday.size,
      weekTrips: tripIdsWeek.size,
    });
  });
}
