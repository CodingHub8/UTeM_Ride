import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, BorderRadius, FontSize, FontWeight, Shadows } from '@/constants/theme';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { addDoc, collection, query, where, onSnapshot, serverTimestamp, orderBy } from 'firebase/firestore';
import { db } from '@/utils/firebase';

interface FAQItem {
  id: string;
  question: string;
  answer: string;
}

const FAQS: FAQItem[] = [
  {
    id: '1',
    question: 'How do I request an on-demand ride in UTeM Ride?',
    answer: 'Enter your destination on the home screen, select your preferred ride type (Standard, Premium, Female Only, or Carpool), choose your payment method, and tap "Confirm Destination" to match with nearby online drivers.',
  },
  {
    id: '2',
    question: 'How does carpooling work for passengers and drivers?',
    answer: 'Drivers publish carpool routes with available seats and date/time. Passengers can view and book open seats, or publish a carpool request specifying their pickup, destination, time, and gender matching preference.',
  },
  {
    id: '3',
    question: 'What payment methods are supported in UTeM Ride?',
    answer: 'UTeM Ride supports Cash payments, FPX Online Banking, Credit/Debit cards, and DuitNow QR via our secure HitPay payment gateway sandbox.',
  },
  {
    id: '4',
    question: 'How can drivers withdraw their earnings?',
    answer: 'Drivers can navigate to the Wallet tab, connect their Malaysian bank account (Maybank, CIMB, Bank Islam, etc.), and initiate instant payouts directly to their bank account.',
  },
  {
    id: '5',
    question: 'What should I do in an emergency during a ride?',
    answer: 'Tap the SOS button on your active ride screen to immediately call UTeM Campus Security (Keselamatan UTeM at 06-270 1222) or national emergency services (999).',
  },
];

interface SupportTicket {
  id: string;
  subject: string;
  message: string;
  category: string;
  status: 'open' | 'in_progress' | 'resolved';
  created_at?: any;
}

export default function SupportScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { isDark } = useTheme();

  const [expandedFaq, setExpandedFaq] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'faq' | 'ticket' | 'history'>('faq');

  // Support ticket form
  const [subject, setSubject] = useState('');
  const [category, setCategory] = useState('General');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Tickets history
  const [tickets, setTickets] = useState<SupportTicket[]>([]);

  useEffect(() => {
    if (!user?.id) return;
    const q = query(
      collection(db, 'support_tickets'),
      where('user_id', '==', user.id)
    );
    const unsub = onSnapshot(q, (snap) => {
      const list: SupportTicket[] = [];
      snap.forEach((docSnap) => {
        list.push({ id: docSnap.id, ...(docSnap.data() as any) });
      });
      setTickets(list);
    }, (err) => {
      console.warn('[Support] Error fetching tickets:', err);
    });
    return unsub;
  }, [user?.id]);

  const handleSubmitTicket = async () => {
    if (!subject.trim() || !message.trim()) {
      Alert.alert('Incomplete Form', 'Please fill in both the subject and message fields.');
      return;
    }
    if (!user) return;

    setSubmitting(true);
    try {
      await addDoc(collection(db, 'support_tickets'), {
        user_id: user.id,
        user_name: user.name || 'Student/Staff',
        user_email: user.email || '',
        subject: subject.trim(),
        category,
        message: message.trim(),
        status: 'open',
        created_at: serverTimestamp(),
      });

      Alert.alert('Ticket Submitted', 'Your support ticket has been submitted to UTeM Ride Admin. We will get back to you shortly.');
      setSubject('');
      setMessage('');
      setActiveTab('history');
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to submit ticket.');
    } finally {
      setSubmitting(false);
    }
  };

  const dynamicStyles = {
    container: { backgroundColor: isDark ? Colors.darkBg : Colors.gray50 },
    card: { backgroundColor: isDark ? Colors.darkCard : Colors.white, borderColor: isDark ? Colors.darkBorder : Colors.gray200 },
    text: { color: isDark ? Colors.white : Colors.gray900 },
    subText: { color: isDark ? Colors.gray400 : Colors.gray600 },
    input: { backgroundColor: isDark ? Colors.gray900 : Colors.gray50, color: isDark ? Colors.white : Colors.gray900, borderColor: isDark ? Colors.darkBorder : Colors.gray200 },
  };

  return (
    <View style={[styles.container, dynamicStyles.container]}>
      {/* Top Header */}
      <View style={[styles.header, { backgroundColor: isDark ? Colors.darkCard : Colors.white }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color={isDark ? Colors.white : Colors.gray900} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, dynamicStyles.text]}>Help & Support</Text>
      </View>

      {/* Tabs */}
      <View style={styles.tabContainer}>
        <TouchableOpacity
          style={[styles.tabBtn, activeTab === 'faq' && styles.activeTabBtn]}
          onPress={() => setActiveTab('faq')}
        >
          <Ionicons name="help-circle-outline" size={18} color={activeTab === 'faq' ? Colors.white : Colors.gray500} />
          <Text style={[styles.tabText, activeTab === 'faq' && styles.activeTabText]}>FAQ</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tabBtn, activeTab === 'ticket' && styles.activeTabBtn]}
          onPress={() => setActiveTab('ticket')}
        >
          <Ionicons name="create-outline" size={18} color={activeTab === 'ticket' ? Colors.white : Colors.gray500} />
          <Text style={[styles.tabText, activeTab === 'ticket' && styles.activeTabText]}>New Ticket</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tabBtn, activeTab === 'history' && styles.activeTabBtn]}
          onPress={() => setActiveTab('history')}
        >
          <Ionicons name="list-outline" size={18} color={activeTab === 'history' ? Colors.white : Colors.gray500} />
          <Text style={[styles.tabText, activeTab === 'history' && styles.activeTabText]}>My Tickets ({tickets.length})</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {/* FAQ TAB */}
        {activeTab === 'faq' && (
          <View style={styles.faqList}>
            <Text style={[styles.sectionTitle, dynamicStyles.text]}>Frequently Asked Questions</Text>
            {FAQS.map((faq) => {
              const isOpen = expandedFaq === faq.id;
              return (
                <TouchableOpacity
                  key={faq.id}
                  style={[styles.faqCard, dynamicStyles.card]}
                  onPress={() => setExpandedFaq(isOpen ? null : faq.id)}
                  activeOpacity={0.8}
                >
                  <View style={styles.faqHeader}>
                    <Text style={[styles.faqQuestion, dynamicStyles.text]}>{faq.question}</Text>
                    <Ionicons
                      name={isOpen ? 'chevron-up' : 'chevron-down'}
                      size={20}
                      color={Colors.primary}
                    />
                  </View>
                  {isOpen && (
                    <Text style={[styles.faqAnswer, dynamicStyles.subText]}>{faq.answer}</Text>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        )}

        {/* NEW TICKET TAB */}
        {activeTab === 'ticket' && (
          <View style={[styles.ticketCard, dynamicStyles.card]}>
            <Text style={[styles.sectionTitle, dynamicStyles.text]}>Submit a Support Ticket</Text>
            <Text style={[styles.sectionSub, dynamicStyles.subText]}>
              Encountered an issue or have a suggestion? Fill in the details below.
            </Text>

            <Text style={[styles.fieldLabel, dynamicStyles.subText]}>Category</Text>
            <View style={styles.categoryRow}>
              {['General', 'Ride Issue', 'Payment', 'Account'].map((cat) => (
                <TouchableOpacity
                  key={cat}
                  style={[
                    styles.catChip,
                    { backgroundColor: isDark ? Colors.gray900 : Colors.gray100 },
                    category === cat && { backgroundColor: Colors.primary }
                  ]}
                  onPress={() => setCategory(cat)}
                >
                  <Text style={[styles.catText, category === cat && { color: Colors.white, fontWeight: 'bold' }]}>{cat}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={[styles.fieldLabel, dynamicStyles.subText]}>Subject</Text>
            <TextInput
              style={[styles.input, dynamicStyles.input]}
              placeholder="e.g. Issue with payment verification"
              placeholderTextColor={Colors.gray400}
              value={subject}
              onChangeText={setSubject}
            />

            <Text style={[styles.fieldLabel, dynamicStyles.subText]}>Message / Details</Text>
            <TextInput
              style={[styles.input, dynamicStyles.input, { height: 110, textAlignVertical: 'top' }]}
              placeholder="Describe your issue or query clearly..."
              placeholderTextColor={Colors.gray400}
              multiline
              value={message}
              onChangeText={setMessage}
            />

            <TouchableOpacity
              style={[styles.submitBtn, submitting && { opacity: 0.7 }]}
              onPress={handleSubmitTicket}
              disabled={submitting}
            >
              {submitting ? (
                <ActivityIndicator color={Colors.white} />
              ) : (
                <>
                  <Ionicons name="send" size={18} color={Colors.white} style={{ marginRight: 6 }} />
                  <Text style={styles.submitBtnText}>Submit Support Ticket</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        )}

        {/* MY TICKETS HISTORY TAB */}
        {activeTab === 'history' && (
          <View style={styles.historyList}>
            <Text style={[styles.sectionTitle, dynamicStyles.text]}>Ticket History</Text>
            {tickets.length === 0 ? (
              <View style={[styles.emptyCard, dynamicStyles.card]}>
                <Ionicons name="checkmark-done-circle-outline" size={48} color={Colors.gray400} />
                <Text style={[styles.emptyText, dynamicStyles.subText]}>No tickets submitted yet.</Text>
              </View>
            ) : (
              tickets.map((t) => (
                <View key={t.id} style={[styles.ticketItem, dynamicStyles.card]}>
                  <View style={styles.ticketHeader}>
                    <Text style={[styles.ticketSubject, dynamicStyles.text]}>{t.subject}</Text>
                    <View style={[styles.statusBadge, t.status === 'resolved' ? styles.statusResolved : styles.statusOpen]}>
                      <Text style={styles.statusBadgeText}>{t.status.toUpperCase()}</Text>
                    </View>
                  </View>
                  <Text style={[styles.ticketCategory, { color: Colors.primary }]}>{t.category}</Text>
                  <Text style={[styles.ticketMessage, dynamicStyles.subText]}>{t.message}</Text>
                </View>
              ))
            )}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingTop: 50,
    paddingBottom: Spacing.md,
    ...Shadows.sm,
  },
  backBtn: { marginRight: Spacing.md },
  headerTitle: { fontSize: FontSize.lg, fontWeight: FontWeight.bold },
  tabContainer: {
    flexDirection: 'row',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    gap: 8,
  },
  tabBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.gray200,
    gap: 4,
  },
  activeTabBtn: { backgroundColor: Colors.primary },
  tabText: { fontSize: FontSize.xs, fontWeight: FontWeight.semibold, color: Colors.gray700 },
  activeTabText: { color: Colors.white },
  content: { padding: Spacing.lg },
  faqList: { gap: 12 },
  sectionTitle: { fontSize: FontSize.md, fontWeight: FontWeight.bold, marginBottom: Spacing.xs },
  sectionSub: { fontSize: FontSize.xs, marginBottom: Spacing.md },
  faqCard: {
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    ...Shadows.sm,
  },
  faqHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  faqQuestion: { fontSize: FontSize.sm, fontWeight: FontWeight.bold, flex: 1, marginRight: 8 },
  faqAnswer: { fontSize: FontSize.xs, marginTop: Spacing.sm, lineHeight: 18 },
  ticketCard: {
    padding: Spacing.lg,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    ...Shadows.sm,
  },
  fieldLabel: { fontSize: FontSize.xs, fontWeight: FontWeight.semibold, marginTop: Spacing.sm, marginBottom: 4 },
  categoryRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: Spacing.sm },
  catChip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: BorderRadius.full },
  catText: { fontSize: FontSize.xs, color: Colors.gray700 },
  input: {
    paddingHorizontal: Spacing.md,
    paddingVertical: 10,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    fontSize: FontSize.sm,
    marginBottom: Spacing.sm,
  },
  submitBtn: {
    flexDirection: 'row',
    backgroundColor: Colors.primary,
    paddingVertical: 14,
    borderRadius: BorderRadius.md,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: Spacing.md,
  },
  submitBtnText: { color: Colors.white, fontWeight: FontWeight.bold, fontSize: FontSize.sm },
  historyList: { gap: 12 },
  emptyCard: { padding: Spacing.xl, alignItems: 'center', justifyContent: 'center', borderRadius: BorderRadius.md, borderWidth: 1 },
  emptyText: { marginTop: Spacing.sm, fontSize: FontSize.xs },
  ticketItem: { padding: Spacing.md, borderRadius: BorderRadius.md, borderWidth: 1, gap: 4 },
  ticketHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  ticketSubject: { fontSize: FontSize.sm, fontWeight: FontWeight.bold, flex: 1 },
  ticketCategory: { fontSize: FontSize.xs, fontWeight: FontWeight.semibold },
  ticketMessage: { fontSize: FontSize.xs, marginTop: 4 },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 4 },
  statusOpen: { backgroundColor: Colors.warning + '30' },
  statusResolved: { backgroundColor: Colors.success + '30' },
  statusBadgeText: { fontSize: 10, fontWeight: FontWeight.bold },
});
