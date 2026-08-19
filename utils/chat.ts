import { addDoc, collection, onSnapshot, orderBy, query, serverTimestamp } from 'firebase/firestore';
import { db } from '@/utils/firebase';
import { encryptData, decryptData } from '@/utils/encryption';

export interface ChatMessage {
  id: string;
  ride_id: string;
  sender_id: string;
  sender_name: string;
  sender_role: 'driver' | 'passenger';
  text: string;
  is_encrypted?: boolean;
  created_at?: number;
}

export function subscribeRideChat(rideId: string, onMessages: (messages: ChatMessage[]) => void) {
  const q = query(collection(db, 'ride_chats', rideId, 'messages'), orderBy('created_at', 'asc'));
  return onSnapshot(q, (snap) => {
    const list = snap.docs.map((d) => {
      const data = d.data();
      let decryptedText = data.text || '';
      if (data.is_encrypted && decryptedText) {
        try {
          const decrypted = decryptData(decryptedText, rideId);
          if (decrypted) decryptedText = decrypted;
        } catch {
          // Fallback if decryption fails
        }
      }
      return {
        id: d.id,
        ride_id: rideId,
        sender_id: data.sender_id,
        sender_name: data.sender_name,
        sender_role: data.sender_role,
        text: decryptedText,
        is_encrypted: data.is_encrypted ?? true,
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
  const encryptedPayload = encryptData(trimmed, input.rideId);
  await addDoc(collection(db, 'ride_chats', input.rideId, 'messages'), {
    sender_id: input.senderId,
    sender_name: input.senderName,
    sender_role: input.senderRole,
    text: encryptedPayload,
    is_encrypted: true,
    created_at: serverTimestamp(),
  });
}
