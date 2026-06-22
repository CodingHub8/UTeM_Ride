import { Platform } from 'react-native';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/utils/firebase';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

const EXPO_PUSH_ENDPOINT = 'https://exp.host/--/api/v2/push/send';

function getProjectId(): string | undefined {
  return (
    Constants.expoConfig?.extra?.eas?.projectId ||
    (Constants as any)?.easConfig?.projectId
  );
}

export async function registerForPushNotifications(): Promise<string | null> {
  if (!Device.isDevice) return null;

  try {
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'default',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#0057B8',
      });
    }

    const { status: existing } = await Notifications.getPermissionsAsync();
    let finalStatus = existing;
    if (existing !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    if (finalStatus !== 'granted') return null;

    const projectId = getProjectId();
    const tokenResponse = await Notifications.getExpoPushTokenAsync(
      projectId ? { projectId } : undefined
    );
    return tokenResponse.data;
  } catch (e) {
    console.warn('registerForPushNotifications error:', e);
    return null;
  }
}

export async function savePushToken(userId: string, token: string) {
  try {
    await setDoc(
      doc(db, 'users', userId),
      { expo_push_token: token, push_updated_at: serverTimestamp() },
      { merge: true }
    );
  } catch (e) {
    console.warn('savePushToken error:', e);
  }
}

export async function sendExpoPush(
  token: string,
  title: string,
  body: string,
  data?: Record<string, any>
) {
  if (!token) return;
  try {
    await fetch(EXPO_PUSH_ENDPOINT, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Accept-encoding': 'gzip, deflate',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        to: token,
        sound: 'default',
        title,
        body,
        data: data || {},
      }),
    });
  } catch (e) {
    console.warn('sendExpoPush error:', e);
  }
}

async function getUserPushToken(userId: string): Promise<string | null> {
  try {
    const snap = await getDoc(doc(db, 'users', userId));
    if (snap.exists()) {
      return (snap.data().expo_push_token as string) || null;
    }
  } catch (e) {
    console.warn('getUserPushToken error:', e);
  }
  return null;
}

type RideEvent = 'accepted' | 'arrived' | 'in_progress' | 'completed' | 'cancelled' | 'new_request';

const MESSAGES: Record<RideEvent, { title: string; body: string }> = {
  accepted: { title: 'Driver found', body: 'Your driver is on the way to the pickup point.' },
  arrived: { title: 'Driver arrived', body: 'Your driver is waiting at the pickup point.' },
  in_progress: { title: 'Trip started', body: 'Your trip is now in progress. Enjoy the ride!' },
  completed: { title: 'Trip completed', body: 'Thanks for riding with UTeM Ride.' },
  cancelled: { title: 'Ride cancelled', body: 'This ride has been cancelled.' },
  new_request: { title: 'New ride request', body: 'A passenger nearby is requesting a ride.' },
};

export async function notifyUser(
  userId: string,
  event: RideEvent,
  data?: Record<string, any>
) {
  const token = await getUserPushToken(userId);
  if (!token) return;
  const msg = MESSAGES[event];
  await sendExpoPush(token, msg.title, msg.body, { event, ...data });
}

export async function presentLocalNotification(title: string, body: string) {
  try {
    await Notifications.scheduleNotificationAsync({
      content: { title, body, sound: 'default' },
      trigger: null,
    });
  } catch (e) {
    console.warn('presentLocalNotification error:', e);
  }
}
