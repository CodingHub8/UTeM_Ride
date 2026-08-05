import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, BorderRadius, FontSize, FontWeight, Shadows } from '@/constants/theme';
import { addDoc, collection, doc, getDoc, serverTimestamp, updateDoc } from 'firebase/firestore';
import { db } from '@/utils/firebase';

interface RatingModalProps {
  visible: boolean;
  onClose: () => void;
  targetUserId: string;
  targetUserName?: string;
  rideId: string;
  role: 'driver' | 'passenger';
  isDark?: boolean;
}

export default function RatingModal({
  visible,
  onClose,
  targetUserId,
  targetUserName,
  rideId,
  role,
  isDark,
}: RatingModalProps) {
  const [stars, setStars] = useState(5);
  const [feedback, setFeedback] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!targetUserId || !rideId) return;
    setSubmitting(true);
    try {
      // 1. Write rating document
      await addDoc(collection(db, 'ratings'), {
        target_user_id: targetUserId,
        ride_id: rideId,
        stars,
        feedback: feedback.trim(),
        role,
        created_at: serverTimestamp(),
      });

      // 2. Recalculate and update target user's average rating in Firestore
      const userRef = doc(db, 'users', targetUserId);
      const userSnap = await getDoc(userRef);
      if (userSnap.exists()) {
        const data = userSnap.data();
        const currentAvg = data.average_rating || 5.0;
        const currentCount = data.total_ratings || 0;

        const newCount = currentCount + 1;
        const newAvg = Number(((currentAvg * currentCount + stars) / newCount).toFixed(1));

        await updateDoc(userRef, {
          average_rating: newAvg,
          total_ratings: newCount,
          updated_at: serverTimestamp(),
        });
      }

      Alert.alert('Rating Submitted', `Thank you for rating ${targetUserName || 'your driver/passenger'}!`);
      onClose();
    } catch (err: any) {
      console.error('[Rating Error]', err);
      Alert.alert('Submission Failed', err.message || 'Could not submit rating.');
    } finally {
      setSubmitting(false);
    }
  };

  const dynamicStyles = {
    modalContent: { backgroundColor: isDark ? Colors.darkCard : Colors.white },
    text: { color: isDark ? Colors.white : Colors.gray900 },
    subText: { color: isDark ? Colors.gray400 : Colors.gray600 },
    input: {
      backgroundColor: isDark ? Colors.gray900 : Colors.gray50,
      color: isDark ? Colors.white : Colors.gray900,
      borderColor: isDark ? Colors.darkBorder : Colors.gray200,
    },
  };

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.overlay}>
        <View style={[styles.modalContent, dynamicStyles.modalContent]}>
          <Text style={[styles.title, dynamicStyles.text]}>
            Rate {role === 'driver' ? 'Driver' : 'Passenger'}
          </Text>
          <Text style={[styles.subtitle, dynamicStyles.subText]}>
            How was your trip with {targetUserName || 'your driver/passenger'}?
          </Text>

          {/* Star selector */}
          <View style={styles.starRow}>
            {[1, 2, 3, 4, 5].map((star) => (
              <TouchableOpacity key={star} onPress={() => setStars(star)} style={styles.starBtn}>
                <Ionicons
                  name={star <= stars ? 'star' : 'star-outline'}
                  size={36}
                  color={star <= stars ? '#FFD700' : Colors.gray300}
                />
              </TouchableOpacity>
            ))}
          </View>

          {/* Feedback input */}
          <TextInput
            style={[styles.input, dynamicStyles.input]}
            placeholder="Write a brief comment (optional)..."
            placeholderTextColor={Colors.gray400}
            multiline
            numberOfLines={3}
            value={feedback}
            onChangeText={setFeedback}
          />

          {/* Buttons */}
          <View style={styles.btnColumn}>
            <TouchableOpacity
              style={[styles.submitBtn, submitting && { opacity: 0.7 }]}
              onPress={handleSubmit}
              disabled={submitting}
            >
              {submitting ? (
                <ActivityIndicator color={Colors.white} />
              ) : (
                <Text style={styles.submitBtnText}>Submit Rating</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity style={styles.skipBtn} onPress={onClose} disabled={submitting}>
              <Text style={[styles.skipBtnText, dynamicStyles.subText]}>Skip</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
  },
  modalContent: {
    width: '100%',
    borderRadius: BorderRadius.xl,
    padding: Spacing.xl,
    alignItems: 'center',
    ...Shadows.lg,
  },
  title: { fontSize: FontSize.lg, fontWeight: FontWeight.bold, marginBottom: 4 },
  subtitle: { fontSize: FontSize.xs, textAlign: 'center', marginBottom: Spacing.lg },
  starRow: { flexDirection: 'row', gap: 10, marginBottom: Spacing.lg },
  starBtn: { padding: 4 },
  input: {
    width: '100%',
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    fontSize: FontSize.sm,
    textAlignVertical: 'top',
    height: 80,
    marginBottom: Spacing.lg,
  },
  btnColumn: { width: '100%', gap: 10 },
  submitBtn: {
    width: '100%',
    backgroundColor: Colors.primary,
    paddingVertical: 14,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
  },
  submitBtnText: { color: Colors.white, fontWeight: FontWeight.bold, fontSize: FontSize.sm },
  skipBtn: {
    width: '100%',
    paddingVertical: 12,
    alignItems: 'center',
  },
  skipBtnText: { fontSize: FontSize.sm, fontWeight: FontWeight.semibold },
});
