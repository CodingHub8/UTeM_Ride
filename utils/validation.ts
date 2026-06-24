import {
  collection,
  collectionGroup,
  getDocs,
  getDoc,
  doc,
  query,
  where,
  Timestamp,
} from 'firebase/firestore';
import { db } from './firebase';

export interface OverlapResult {
  hasOverlap: boolean;
  type?: 'carpool' | 'regular';
  timeLabel?: string;
  details?: string;
}

/**
 * Checks if a passenger has an overlapping carpool booking or regular ride
 * within 5 minutes of a proposed target time.
 *
 * @param passengerId The ID of the passenger
 * @param targetTime The proposed time (Date, Timestamp, or number)
 * @returns An OverlapResult indicating if there is an overlap
 */
export async function checkPassengerOverlap(
  passengerId: string,
  targetTime: Date | Timestamp | number
): Promise<OverlapResult> {
  const targetMs =
    targetTime instanceof Date
      ? targetTime.getTime()
      : targetTime instanceof Timestamp
      ? targetTime.toMillis()
      : targetTime;

  const OVERLAP_THRESHOLD_MS = 5 * 60 * 1000; // 5 minutes

  try {
    // 1. Check Carpool Bookings (confirmed or pending)
    const slotsQuery = query(
      collection(db, 'carpool_slots'),
      where('status', 'in', ['open', 'full'])
    );
    const slotsSnap = await getDocs(slotsQuery);

    for (const slotDoc of slotsSnap.docs) {
      const slotData = slotDoc.data();
      const bookingRef = doc(db, 'carpool_slots', slotDoc.id, 'bookings', passengerId);
      const bookingSnap = await getDoc(bookingRef);
      
      if (bookingSnap.exists()) {
        const bookingData = bookingSnap.data();
        if (bookingData.status === 'confirmed' || bookingData.status === 'pending') {
          const slotTime = slotData.date_time;
          if (slotTime?.toMillis) {
            const slotMs = slotTime.toMillis();
            const diff = Math.abs(slotMs - targetMs);
            if (diff < OVERLAP_THRESHOLD_MS) {
              const formattedTime = new Date(slotMs).toLocaleTimeString('en-US', {
                hour: '2-digit',
                minute: '2-digit',
              });
              return {
                hasOverlap: true,
                type: 'carpool',
                timeLabel: formattedTime,
                details: `You already have a carpool booking at ${formattedTime} (with driver ${slotData.driver_name || 'Driver'}), which overlaps with this slot.`,
              };
            }
          }
        }
      }
    }

    // 2. Check Regular Rides (requested, accepted, arrived, in_progress)
    const ridesQuery = query(
      collection(db, 'rides'),
      where('passenger_id', '==', passengerId)
    );

    const ridesSnap = await getDocs(ridesQuery);
    for (const rideDoc of ridesSnap.docs) {
      const rideData = rideDoc.data();
      const activeStatuses = ['requested', 'accepted', 'arrived', 'in_progress'];
      if (!activeStatuses.includes(rideData.status)) {
        continue;
      }
      
      // Use scheduled_time if scheduled, else use created_at / timestamp for immediate rides
      let rideMs = 0;
      if (rideData.scheduled_time?.toMillis) {
        rideMs = rideData.scheduled_time.toMillis();
      } else if (rideData.created_at?.toMillis) {
        rideMs = rideData.created_at.toMillis();
      } else if (rideData.timestamp) {
        rideMs = Number(rideData.timestamp);
      }

      if (rideMs > 0) {
        const diff = Math.abs(rideMs - targetMs);
        if (diff < OVERLAP_THRESHOLD_MS) {
          const formattedTime = new Date(rideMs).toLocaleTimeString('en-US', {
            hour: '2-digit',
            minute: '2-digit',
          });
          const rideDesc = rideData.scheduled_time ? 'scheduled' : 'immediate';
          return {
            hasOverlap: true,
            type: 'regular',
            timeLabel: formattedTime,
            details: `You have an active ${rideDesc} ride request at ${formattedTime} to ${rideData.destination_address || 'destination'}, which overlaps with this slot.`,
          };
        }
      }
    }

    return { hasOverlap: false };
  } catch (error) {
    console.error('[checkPassengerOverlap] Validation check failed:', error);
    // Fail-safe: return no overlap but log error
    return { hasOverlap: false };
  }
}
