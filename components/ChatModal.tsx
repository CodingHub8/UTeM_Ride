import { useEffect, useRef, useState } from 'react';
import { View, Text, Modal, FlatList, TextInput, TouchableOpacity, StyleSheet, KeyboardAvoidingView, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, BorderRadius, FontSize, FontWeight } from '@/constants/theme';
import { sendRideChatMessage, subscribeRideChat, ChatMessage } from '@/utils/chat';

interface ChatModalProps {
  visible: boolean;
  onClose: () => void;
  rideId: string;
  userId: string;
  userName: string;
  userRole: 'driver' | 'passenger';
  isDark: boolean;
}

export default function ChatModal({ visible, onClose, rideId, userId, userName, userRole, isDark }: ChatModalProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const listRef = useRef<FlatList>(null);

  useEffect(() => {
    if (!visible || !rideId) return;
    const unsub = subscribeRideChat(rideId, setMessages);
    return () => unsub();
  }, [visible, rideId]);

  useEffect(() => {
    if (messages.length) {
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
    }
  }, [messages.length]);

  const send = async () => {
    if (!text.trim() || !rideId) return;
    setSending(true);
    try {
      await sendRideChatMessage({
        rideId,
        senderId: userId,
        senderName: userName,
        senderRole: userRole,
        text: text.trim(),
      });
      setText('');
    } finally {
      setSending(false);
    }
  };

  const dynamic = {
    bg: { backgroundColor: isDark ? Colors.darkBg : Colors.gray50 },
    card: { backgroundColor: isDark ? Colors.darkCard : Colors.white },
    text: { color: isDark ? Colors.white : Colors.gray900 },
    sub: { color: isDark ? Colors.gray400 : Colors.gray500 },
    input: {
      backgroundColor: isDark ? Colors.gray900 : Colors.gray100,
      color: isDark ? Colors.white : Colors.gray900,
      borderColor: isDark ? Colors.darkBorder : Colors.gray200,
    },
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView style={[styles.overlay, dynamic.bg]} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={[styles.sheet, dynamic.card]}>
          <View style={styles.header}>
            <Text style={[styles.title, dynamic.text]}>Ride Chat</Text>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={24} color={isDark ? Colors.white : Colors.gray900} />
            </TouchableOpacity>
          </View>

          <FlatList
            ref={listRef}
            data={messages}
            keyExtractor={(item) => item.id}
            style={styles.list}
            contentContainerStyle={{ padding: Spacing.md, flexGrow: 1 }}
            ListEmptyComponent={
              <Text style={[styles.empty, dynamic.sub]}>No messages yet. Say hi!</Text>
            }
            renderItem={({ item }) => {
              const mine = item.sender_id === userId;
              return (
                <View style={[styles.bubbleRow, mine && styles.bubbleRowMine]}>
                  <View style={[styles.bubble, mine ? styles.bubbleMine : styles.bubbleOther]}>
                    {!mine && <Text style={styles.senderName}>{item.sender_name}</Text>}
                    <Text style={[styles.bubbleText, mine && { color: Colors.white }]}>{item.text}</Text>
                  </View>
                </View>
              );
            }}
          />

          <View style={styles.inputRow}>
            <TextInput
              style={[styles.input, dynamic.input]}
              value={text}
              onChangeText={setText}
              placeholder="Type a message..."
              placeholderTextColor={Colors.gray400}
              multiline
            />
            <TouchableOpacity style={styles.sendBtn} onPress={send} disabled={sending || !text.trim()}>
              <Ionicons name="send" size={20} color={Colors.white} />
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.35)' },
  sheet: { height: '75%', borderTopLeftRadius: BorderRadius.xl, borderTopRightRadius: BorderRadius.xl },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: Spacing.md, borderBottomWidth: 1, borderBottomColor: Colors.gray100 },
  title: { fontSize: FontSize.lg, fontWeight: FontWeight.bold },
  list: { flex: 1 },
  empty: { textAlign: 'center', marginTop: Spacing.xl },
  bubbleRow: { marginBottom: Spacing.sm, alignItems: 'flex-start' },
  bubbleRowMine: { alignItems: 'flex-end' },
  bubble: { maxWidth: '80%', borderRadius: BorderRadius.lg, padding: Spacing.sm },
  bubbleMine: { backgroundColor: Colors.primary },
  bubbleOther: { backgroundColor: Colors.gray100 },
  senderName: { fontSize: FontSize.xs, color: Colors.gray500, marginBottom: 2 },
  bubbleText: { fontSize: FontSize.sm },
  inputRow: { flexDirection: 'row', alignItems: 'flex-end', padding: Spacing.md, gap: Spacing.sm },
  input: { flex: 1, minHeight: 44, maxHeight: 100, borderRadius: BorderRadius.md, borderWidth: 1, paddingHorizontal: Spacing.md, paddingVertical: 10 },
  sendBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center' },
});
