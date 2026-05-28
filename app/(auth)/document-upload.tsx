import { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
  TextInput,
  Image,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { Colors, Spacing, BorderRadius, FontSize, FontWeight, Shadows } from '@/constants/theme';
import { useAuth, Gender } from '@/contexts/AuthContext';
import { performOCR } from '@/utils/ocr';
import { encryptObject } from '@/utils/encryption';
import { useTheme } from '@/contexts/ThemeContext';

export default function DocumentUploadScreen() {
  const router = useRouter();
  const { register } = useAuth();
  const { isDark } = useTheme();
  
  // Params passed from Step 1 registration (name is now extracted via OCR)
  const params = useLocalSearchParams<{
    email: string;
    phone: string;
    gender: string;
    password: string;
  }>();

  // Image URI states
  const [matricUri, setMatricUri] = useState<string | null>(null);
  const [roadTaxUri, setRoadTaxUri] = useState<string | null>(null);

  // OCR Loading states
  const [matricLoading, setMatricLoading] = useState(false);
  const [roadTaxLoading, setRoadTaxLoading] = useState(false);

  // Extracted OCR Data (Editable by user for validation)
  const [studentId, setStudentId] = useState('');
  const [extractedName, setExtractedName] = useState('');
  const [plateNumber, setPlateNumber] = useState('');
  const [vehicleModel, setVehicleModel] = useState('');
  const [roadTaxExpiry, setRoadTaxExpiry] = useState('');
  
  // Extracted raw OCR lines
  const [matricLines, setMatricLines] = useState<string[]>([]);
  const [roadTaxLines, setRoadTaxLines] = useState<string[]>([]);

  // Function to choose image source
  const showImageSource = (type: 'matric_card' | 'road_tax') => {
    Alert.alert(
      'Select Image Source',
      'Choose how you want to upload your document',
      [
        {
          text: 'Camera',
          onPress: () => handleTakePhoto(type),
        },
        {
          text: 'Gallery',
          onPress: () => handlePickImage(type),
        },
        {
          text: 'Cancel',
          style: 'cancel',
        },
      ]
    );
  };

  // Image Picker Logic
  const handlePickImage = async (type: 'matric_card' | 'road_tax') => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Required', 'We need access to your gallery to upload documents.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        quality: 0.8,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const uri = result.assets[0].uri;
        if (type === 'matric_card') {
          setMatricUri(uri);
          processDocumentOCR(uri, 'matric_card');
        } else {
          setRoadTaxUri(uri);
          processDocumentOCR(uri, 'road_tax');
        }
      }
    } catch (error) {
      console.error('Image selection error:', error);
    }
  };

  // Camera Logic
  const handleTakePhoto = async (type: 'matric_card' | 'road_tax') => {
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Required', 'We need access to your camera to take photos.');
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        allowsEditing: true,
        quality: 0.8,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const uri = result.assets[0].uri;
        if (type === 'matric_card') {
          setMatricUri(uri);
          processDocumentOCR(uri, 'matric_card');
        } else {
          setRoadTaxUri(uri);
          processDocumentOCR(uri, 'road_tax');
        }
      }
    } catch (error) {
      console.error('Camera capture error:', error);
    }
  };

  // OCR Processing
  const processDocumentOCR = async (uri: string, type: 'matric_card' | 'road_tax') => {
    if (type === 'matric_card') {
      setMatricLoading(true);
    } else {
      setRoadTaxLoading(true);
    }

    try {
      const ocrResult = await performOCR(uri, type);
      
      if (type === 'matric_card') {
        setMatricLines(ocrResult.lines);
        if (ocrResult.rawData.studentId) setStudentId(ocrResult.rawData.studentId);
        if (ocrResult.rawData.name) setExtractedName(ocrResult.rawData.name);
      } else {
        setRoadTaxLines(ocrResult.lines);
        if (ocrResult.rawData.plateNumber) setPlateNumber(ocrResult.rawData.plateNumber);
        if (ocrResult.rawData.vehicleModel) setVehicleModel(ocrResult.rawData.vehicleModel);
        if (ocrResult.rawData.expiryDate) setRoadTaxExpiry(ocrResult.rawData.expiryDate);
      }
    } catch (e: any) {
      // Show the actual error message (e.g., API key not configured, API error)
      Alert.alert(
        'OCR Extraction Failed',
        e?.message || 'Could not extract text from document. Please enter your details manually below.'
      );
    } finally {
      if (type === 'matric_card') {
        setMatricLoading(false);
      } else {
        setRoadTaxLoading(false);
      }
    }
  };

  const handleCompleteRegister = async () => {
    if (!matricUri) {
      Alert.alert('Matric Card Required', 'Please scan or upload your UTeM matric card to continue.');
      return;
    }
    if (!studentId) {
      Alert.alert('Matric ID Required', 'Please provide your Student/Staff ID.');
      return;
    }

    // Encrypt sensitive information client-side before transmission
    // Contains documents, license, and raw OCR output lines
    const sensitivePayload = {
      studentId,
      fullName: extractedName,
      matricImage: matricUri,
      roadTaxImage: roadTaxUri || 'N/A',
      vehiclePlate: plateNumber || 'N/A',
      vehicleModel: vehicleModel || 'N/A',
      matricOcrLines: matricLines,
      roadTaxOcrLines: roadTaxLines,
    };

    // Client-side secure encryption of sensitive data
    const encryptedData = encryptObject(sensitivePayload, params.password);

    try {
      await register(
        extractedName,
        params.email,
        params.phone,
        params.gender as Gender,
        params.password,
        studentId, // Student/Staff ID becomes PRIMARY KEY
        matricUri,
        roadTaxUri || '',
        plateNumber,
        vehicleModel,
        encryptedData
      );
      
      Alert.alert('Registration Successful', `Welcome, your Student ID (${studentId}) is registered.`, [
        { text: 'OK', onPress: () => router.replace('/(auth)/role-select') }
      ]);
    } catch (e: any) {
      console.error('[Register Error]', e);
      const errorMsg = e?.message || 'Something went wrong. Please try again.';
      Alert.alert('Registration Failed', errorMsg);
    }
  };

  const dynamicStyles = {
    container: { backgroundColor: isDark ? Colors.darkBg : Colors.gray50 },
    card: { backgroundColor: isDark ? Colors.darkCard : Colors.white },
    text: { color: isDark ? Colors.white : Colors.gray900 },
    subText: { color: isDark ? Colors.gray400 : Colors.gray500 },
    border: { borderBottomColor: isDark ? Colors.darkBorder : Colors.gray100 },
    input: {
      backgroundColor: isDark ? Colors.gray900 : Colors.gray50,
      color: isDark ? Colors.white : Colors.gray900,
      borderColor: isDark ? Colors.darkBorder : Colors.gray200,
    }
  };

  return (
    <LinearGradient colors={[Colors.primary, Colors.primaryDark]} style={styles.gradient}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.flex}
      >
        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
          
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
              <Ionicons name="arrow-back" size={24} color={Colors.white} />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Document Verification</Text>
            <Text style={styles.headerSub}>Verify identity via OCR text extraction</Text>
          </View>

          {/* Cards Container */}
          <View style={[styles.card, dynamicStyles.card]}>
            <Text style={[styles.sectionTitle, dynamicStyles.text]}>1. Matric / Staff Card (Front)</Text>
            <Text style={[styles.sectionSubtitle, dynamicStyles.subText]}>
              Upload front side to verify student/staff status (Limit: 1 registration per ID)
            </Text>

            <TouchableOpacity
              style={[styles.uploadBox, matricUri && styles.uploadBoxActive, { borderColor: isDark ? Colors.darkBorder : Colors.gray200 }]}
              onPress={() => showImageSource('matric_card')}
            >
              {matricLoading ? (
                <View style={styles.loadingBox}>
                  <ActivityIndicator size="large" color={Colors.primary} />
                  <Text style={[styles.uploadText, dynamicStyles.text, { marginTop: 10 }]}>Extracting Text via OCR...</Text>
                </View>
              ) : matricUri ? (
                <View style={styles.previewContainer}>
                  <Image source={{ uri: matricUri }} style={styles.previewImage} />
                  <View style={styles.editOverlay}>
                    <Ionicons name="camera" size={20} color={Colors.white} />
                    <Text style={styles.editText}>Tap to Change</Text>
                  </View>
                </View>
              ) : (
                <View style={styles.uploadPlaceholder}>
                  <Ionicons name="card-outline" size={40} color={Colors.primary} />
                  <Text style={[styles.uploadText, dynamicStyles.text]}>Scan or Upload Matric Card</Text>
                  <Text style={[styles.uploadSub, dynamicStyles.subText]}>Supports JPG, PNG</Text>
                </View>
              )}
            </TouchableOpacity>

            {/* Extracted Matric Fields */}
            {matricUri && !matricLoading && (
              <View style={styles.fieldsContainer}>
                <Text style={styles.fieldHeader}>Verified Matric Details</Text>
                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Student/Staff ID (Primary Key)</Text>
                  <TextInput
                    style={[styles.input, dynamicStyles.input]}
                    value={studentId}
                    onChangeText={setStudentId}
                    placeholder="E.g., B032110194"
                    placeholderTextColor={Colors.gray400}
                  />
                </View>
                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Full Name</Text>
                  <TextInput
                    style={[styles.input, dynamicStyles.input]}
                    value={extractedName}
                    onChangeText={setExtractedName}
                    placeholder="E.g., Muhammad Hazim"
                    placeholderTextColor={Colors.gray400}
                  />
                </View>
              </View>
            )}

            <View style={styles.sectionDivider} />

            <Text style={[styles.sectionTitle, dynamicStyles.text]}>2. Road Tax (Optional for Drivers)</Text>
            <Text style={[styles.sectionSubtitle, dynamicStyles.subText]}>
              Upload vehicle road tax slip to activate driver capabilities
            </Text>

            <TouchableOpacity
              style={[styles.uploadBox, roadTaxUri && styles.uploadBoxActive, { borderColor: isDark ? Colors.darkBorder : Colors.gray200 }]}
              onPress={() => showImageSource('road_tax')}
            >
              {roadTaxLoading ? (
                <View style={styles.loadingBox}>
                  <ActivityIndicator size="large" color={Colors.primary} />
                  <Text style={[styles.uploadText, dynamicStyles.text, { marginTop: 10 }]}>Extracting Text via OCR...</Text>
                </View>
              ) : roadTaxUri ? (
                <View style={styles.previewContainer}>
                  <Image source={{ uri: roadTaxUri }} style={styles.previewImage} />
                  <View style={styles.editOverlay}>
                    <Ionicons name="camera" size={20} color={Colors.white} />
                    <Text style={styles.editText}>Tap to Change</Text>
                  </View>
                </View>
              ) : (
                <View style={styles.uploadPlaceholder}>
                  <Ionicons name="document-text-outline" size={40} color={Colors.accent} />
                  <Text style={[styles.uploadText, dynamicStyles.text]}>Scan or Upload Road Tax</Text>
                  <Text style={[styles.uploadSub, dynamicStyles.subText]}>Required to earn as driver</Text>
                </View>
              )}
            </TouchableOpacity>

            {/* Extracted Road Tax Fields */}
            {roadTaxUri && !roadTaxLoading && (
              <View style={styles.fieldsContainer}>
                <Text style={styles.fieldHeader}>Verified Road Tax Details</Text>
                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Vehicle Plate Number</Text>
                  <TextInput
                    style={[styles.input, dynamicStyles.input]}
                    value={plateNumber}
                    onChangeText={setPlateNumber}
                    placeholder="E.g., WKL 2847"
                    placeholderTextColor={Colors.gray400}
                    autoCapitalize="characters"
                  />
                </View>
                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Vehicle Model</Text>
                  <TextInput
                    style={[styles.input, dynamicStyles.input]}
                    value={vehicleModel}
                    onChangeText={setVehicleModel}
                    placeholder="E.g., Perodua Myvi"
                    placeholderTextColor={Colors.gray400}
                  />
                </View>
                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Road Tax Expiry Date</Text>
                  <TextInput
                    style={[styles.input, dynamicStyles.input]}
                    value={roadTaxExpiry}
                    onChangeText={setRoadTaxExpiry}
                    placeholder="E.g., 15-05-2027"
                    placeholderTextColor={Colors.gray400}
                  />
                </View>
              </View>
            )}

            {/* Encryption Protection Notice */}
            <View style={[styles.securityAlert, { backgroundColor: Colors.primary + '10', borderColor: Colors.primary + '30' }]}>
              <Ionicons name="shield-checkmark" size={18} color={Colors.primary} />
              <Text style={[styles.securityText, { color: isDark ? Colors.primaryLight : Colors.primaryDark }]}>
                Data Security: Extracted document contents are client-side encrypted before storage. Crucial files are invisible to third parties.
              </Text>
            </View>

            {/* Complete Register Button */}
            <TouchableOpacity
              style={[styles.submitBtn, (!matricUri || !studentId) && styles.btnDisabled]}
              onPress={handleCompleteRegister}
              disabled={matricLoading || roadTaxLoading || !matricUri || !studentId}
            >
              <LinearGradient
                colors={[Colors.primary, Colors.primaryLight]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.submitGradient}
              >
                <Text style={styles.submitBtnText}>Complete Registration</Text>
              </LinearGradient>
            </TouchableOpacity>

          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  gradient: { flex: 1 },
  flex: { flex: 1 },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: Spacing.lg,
  },
  header: {
    marginBottom: Spacing.lg,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  headerTitle: {
    fontSize: FontSize.xxl,
    fontWeight: FontWeight.bold,
    color: Colors.white,
  },
  headerSub: {
    fontSize: FontSize.sm,
    color: 'rgba(255,255,255,0.7)',
    marginTop: 4,
  },
  card: {
    backgroundColor: Colors.white,
    borderRadius: BorderRadius.xl,
    padding: Spacing.lg,
    ...Shadows.lg,
  },
  sectionTitle: {
    fontSize: FontSize.md,
    fontWeight: FontWeight.bold,
    marginBottom: 4,
  },
  sectionSubtitle: {
    fontSize: FontSize.xs,
    marginBottom: Spacing.md,
  },
  uploadBox: {
    height: 140,
    borderRadius: BorderRadius.md,
    borderWidth: 2,
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.md,
    overflow: 'hidden',
  },
  uploadBoxActive: {
    borderStyle: 'solid',
    borderWidth: 1,
  },
  uploadPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.md,
  },
  uploadText: {
    fontSize: FontSize.md,
    fontWeight: FontWeight.semibold,
    marginTop: Spacing.sm,
  },
  uploadSub: {
    fontSize: FontSize.xs,
    marginTop: 2,
  },
  loadingBox: {
    alignItems: 'center',
  },
  previewContainer: {
    width: '100%',
    height: '100%',
    position: 'relative',
  },
  previewImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  editOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 8,
  },
  editText: {
    color: Colors.white,
    fontWeight: FontWeight.bold,
    fontSize: FontSize.xs,
  },
  fieldsContainer: {
    marginBottom: Spacing.lg,
    padding: Spacing.sm,
  },
  fieldHeader: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.bold,
    color: Colors.primary,
    marginBottom: Spacing.sm,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  inputGroup: {
    marginBottom: Spacing.sm,
  },
  inputLabel: {
    fontSize: FontSize.xs,
    color: Colors.gray400,
    fontWeight: FontWeight.semibold,
    marginBottom: 4,
  },
  input: {
    height: 48,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    paddingHorizontal: Spacing.md,
    fontSize: FontSize.md,
  },
  sectionDivider: {
    height: 1,
    backgroundColor: Colors.gray200,
    marginVertical: Spacing.lg,
  },
  securityAlert: {
    flexDirection: 'row',
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    alignItems: 'flex-start',
    gap: Spacing.sm,
    marginBottom: Spacing.lg,
  },
  securityText: {
    fontSize: 11,
    flex: 1,
    lineHeight: 16,
    fontWeight: FontWeight.medium,
  },
  submitBtn: {
    borderRadius: BorderRadius.md,
    overflow: 'hidden',
    marginTop: Spacing.sm,
  },
  btnDisabled: {
    opacity: 0.5,
  },
  submitGradient: {
    paddingVertical: 16,
    alignItems: 'center',
  },
  submitBtnText: {
    color: Colors.white,
    fontSize: FontSize.lg,
    fontWeight: FontWeight.bold,
  },
});
