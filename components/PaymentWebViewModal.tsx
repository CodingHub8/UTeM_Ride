import React, { useRef } from 'react';
import { Modal, View, StyleSheet, Text, TouchableOpacity, ActivityIndicator, SafeAreaView } from 'react-native';
import { WebView, WebViewNavigation } from 'react-native-webview';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@/constants/theme';

interface PaymentWebViewModalProps {
  visible: boolean;
  paymentUrl: string | null;
  onClose: (status: 'completed' | 'failed' | 'cancelled') => void;
  isDark?: boolean;
}

export default function PaymentWebViewModal({
  visible,
  paymentUrl,
  onClose,
  isDark = false,
}: PaymentWebViewModalProps) {
  const webViewRef = useRef<WebView>(null);

  if (!visible || !paymentUrl) return null;

  const handleNavigationStateChange = (navState: WebViewNavigation) => {
    const { url } = navState;
    console.log('[PaymentWebView] Navigation URL:', url);

    // 1. Intercept Payment Failure / Cancellation
    const isFailed =
      url.includes('payment-failed.html') ||
      url.includes('status=failed') ||
      url.includes('status=cancelled') ||
      url.includes('status=failed');

    if (isFailed) {
      console.log('[PaymentWebView] Detected Payment Failure/Cancellation URL');
      onClose('failed');
      return;
    }

    // 2. Intercept Payment Completion / Success
    const isSuccess =
      url.includes('payment-success.html') ||
      url.includes('status=completed') ||
      url.includes('utemride://payment-complete');

    if (isSuccess) {
      console.log('[PaymentWebView] Detected Payment Success URL');
      onClose('completed');
      return;
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent={false} onRequestClose={() => onClose('cancelled')}>
      <SafeAreaView style={[styles.container, isDark && styles.containerDark]}>
        {/* Modal Top Header Bar */}
        <View style={[styles.header, isDark && styles.headerDark]}>
          <TouchableOpacity style={styles.closeBtn} onPress={() => onClose('cancelled')}>
            <Ionicons name="close" size={24} color={isDark ? Colors.white : Colors.gray900} />
          </TouchableOpacity>
          <View style={styles.headerTitleContainer}>
            <Ionicons name="lock-closed" size={16} color={Colors.primary} style={{ marginRight: 6 }} />
            <Text style={[styles.headerTitle, isDark && styles.headerTitleDark]}>HitPay Secure Checkout</Text>
          </View>
          <View style={{ width: 32 }} />
        </View>

        {/* Embedded Native In-App WebView */}
        <WebView
          ref={webViewRef}
          source={{ uri: paymentUrl }}
          onNavigationStateChange={handleNavigationStateChange}
          startInLoadingState={true}
          renderLoading={() => (
            <View style={[styles.loadingContainer, isDark && styles.containerDark]}>
              <ActivityIndicator size="large" color={Colors.primary} />
              <Text style={[styles.loadingText, isDark && styles.loadingTextDark]}>
                Loading Payment Gateway...
              </Text>
            </View>
          )}
          javaScriptEnabled={true}
          domStorageEnabled={true}
          style={{ flex: 1 }}
        />
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  containerDark: {
    backgroundColor: '#0F172A',
  },
  header: {
    height: 54,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    backgroundColor: '#FFFFFF',
  },
  headerDark: {
    backgroundColor: '#1E293B',
    borderBottomColor: '#334155',
  },
  closeBtn: {
    padding: 6,
  },
  headerTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0F172A',
  },
  headerTitleDark: {
    color: '#F8FAFC',
  },
  loadingContainer: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#64748B',
  },
  loadingTextDark: {
    color: '#94A3B8',
  },
});
