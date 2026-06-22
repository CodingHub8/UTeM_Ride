import { addDoc, collection, onSnapshot, orderBy, query, serverTimestamp } from 'firebase/firestore';
import { db } from '@/utils/firebase';

export interface ChatMessage {
  id: string;
  ride_id: string;
  sender_id: string;
  sender_name: string;
  sender_role: 'driver' | 'passenger';
  text: string;
  created_at?: number;
}

export function subscribeRideChat(rideId: string, onMessages: (messages: ChatMessage[]) => void) {
  const q = query(collection(db, 'ride_chats', rideId, 'messages'), orderBy('created_at', 'asc'));
  return onSnapshot(q, (snap) => {
    const list = snap.docs.map((d) => {
      const data = d.data();
      return {
        id: d.id,
        ride_id: rideId,
        sender_id: data.sender_id,
        sender_name: data.sender_name,
        sender_role: data.sender_role,
        text: data.text,
        created_at: data.created_at?.toMillis?.() || data.created_at || Date.now(),
      } as ChatMessage;
    });
    onMessages(list);
  });
}

export async function sendRideChatMessage(input: {
  rideId: string;
  senderId: string;
  senderName: string;
  senderRole: 'driver' | 'passenger';
  text: string;
}) {
  const trimmed = input.text.trim();
  if (!trimmed) return;
  await addDoc(collection(db, 'ride_chats', input.rideId, 'messages'), {
    sender_id: input.senderId,
    sender_name: input.senderName,
    sender_role: input.senderRole,
    text: trimmed,
    created_at: serverTimestamp(),
  });
}
