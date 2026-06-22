import { useEffect } from 'react';
import { View, ActivityIndicator, Text, StyleSheet } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { Colors } from '@/constants/theme';
import { fulfillPaymentFromDeepLink } from '@/utils/paymentReturn';

export default function PaymentCompleteScreen() {
  const params = useLocalSearchParams<{ status?: string; reference?: string }>();
  const router = useRouter();

  useEffect(() => {
    const run = async () => {
      try {
        await WebBrowser.dismissBrowser();
      } catch {
        // ignore
      }

      const status = String(params.status || 'completed');
      const reference = String(params.reference || '');
      let deepLink = `utemride://payment-complete?status=${encodeURIComponent(status)}`;
      if (reference) deepLink += `&reference=${encodeURIComponent(reference)}`;

      await fulfillPaymentFromDeepLink(deepLink);

      if (router.canGoBack()) {
        router.back();
      } else {
        router.replace('/(passenger)/home');
      }
    };

    void run();
  }, [params.reference, params.status, router]);

  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color={Colors.primary} />
      <Text style={styles.text}>Returning to UTeM Ride…</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.white },
  text: { marginTop: 16, color: Colors.gray600, fontSize: 16 },
});
