import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Switch, Alert, Modal, TextInput, ActivityIndicator, Image } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, BorderRadius, FontSize, FontWeight, Shadows } from '@/constants/theme';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { useEffect, useState } from 'react';
import * as ImagePicker from 'expo-image-picker';
import { performOCR } from '@/utils/ocr';
import { doc, setDoc, getDoc, serverTimestamp } from 'firebase/firestore';
import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from '@/utils/firebase';

interface VehicleDoc {
  id: string;
  uri: string;
  type: 'Road Tax' | 'Vehicle Ownership Certificate' | 'Other';
  uploadedUrl?: string;
}

async function uploadDocAsync(uri: string, path: string): Promise<string> {
  if (!uri) return '';
  if (uri.startsWith('http://') || uri.startsWith('https://')) return uri;
  const blob = await new Promise<Blob>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.onload = () => resolve(xhr.response);
    xhr.onerror = (e) => reject(e);
    xhr.responseType = 'blob';
    xhr.open('GET', uri, true);
    xhr.send(null);
  });
  const fileRef = storageRef(storage, path);
  await uploadBytes(fileRef, blob);
  return await getDownloadURL(fileRef);
}

export default function DriverProfileScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user, logout, switchRole, verifyAdminDocs, updateProfile } = useAuth();
  const { themeMode, setTheme, isDark } = useTheme();

  // Modal State
  const [modalVisible, setModalVisible] = useState(false);
  const [vehicleDocs, setVehicleDocs] = useState<VehicleDoc[]>([]);
  const [plateNumber, setPlateNumber] = useState(user?.vehiclePlate || '');
  const [vehicleModel, setVehicleModel] = useState(user?.vehicleModel || '');
  const [vehicleColor, setVehicleColor] = useState(user?.vehicleColor || '');
  const [roadTaxExpiry, setRoadTaxExpiry] = useState('');
  const [loadingOCR, setLoadingOCR] = useState(false);
  const [savingVehicle, setSavingVehicle] = useState(false);

  useEffect(() => {
    if (!user) return;
    (async () => {
      try {
        const snap = await getDoc(doc(db, 'user_documents', user.id));
        if (!snap.exists()) return;
        const data = snap.data();
        const saved = Array.isArray(data?.vehicle_documents) ? data.vehicle_documents : [];
        const mapped: VehicleDoc[] = saved
          .filter((d: any) => d?.url)
          .map((d: any, i: number) => ({
            id: `saved_${i}_${d.uploaded_at || ''}`,
            uri: d.url,
            type: (d.type as VehicleDoc['type']) || 'Other',
            uploadedUrl: d.url,
          }));
        setVehicleDocs(mapped);
        if (data?.road_tax_expiry) setRoadTaxExpiry(data.road_tax_expiry);
      } catch {}
    })();
  }, [user?.id]);

  const openUpdateModal = () => {
    setPlateNumber(user?.vehiclePlate || '');
    setVehicleModel(user?.vehicleModel || '');
    setVehicleColor(user?.vehicleColor || '');
    setModalVisible(true);
  };

  const handleAddVehicleDoc = () => {
    Alert.alert(
      'Select Document Type',
      'Choose the type of document you want to upload',
      [
        { text: 'Road Tax', onPress: () => initiateVehicleDocCapture('Road Tax') },
        { text: 'Vehicle Ownership Certificate (VOC)', onPress: () => initiateVehicleDocCapture('Vehicle Ownership Certificate') },
        { text: 'Other Document', onPress: () => initiateVehicleDocCapture('Other') },
        { text: 'Cancel', style: 'cancel' }
      ]
    );
  };

  const initiateVehicleDocCapture = (type: VehicleDoc['type']) => {
    Alert.alert(
      `Upload ${type}`,
      'Choose document source',
      [
        { text: 'Camera', onPress: () => captureVehicleDoc(type, true) },
        { text: 'Gallery', onPress: () => captureVehicleDoc(type, false) },
        { text: 'Cancel', style: 'cancel' }
      ]
    );
  };

  const captureVehicleDoc = async (type: VehicleDoc['type'], useCamera: boolean) => {
    try {
      const permission = useCamera 
        ? await ImagePicker.requestCameraPermissionsAsync() 
        : await ImagePicker.requestMediaLibraryPermissionsAsync();

      if (permission.status !== 'granted') {
        Alert.alert('Permission Required', 'Access to camera/gallery is required.');
        return;
      }

      const result = useCamera
        ? await ImagePicker.launchCameraAsync({ allowsEditing: true, quality: 0.8 })
        : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, allowsEditing: true, quality: 0.8 });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const uri = result.assets[0].uri;
        const newDoc: VehicleDoc = {
          id: String(Date.now()),
          uri,
          type
        };
        setVehicleDocs(prev => [...prev, newDoc]);

        setLoadingOCR(true);
        try {
          const ocrResult = await performOCR(uri, 'road_tax');
          if (ocrResult.rawData.plateNumber) setPlateNumber(ocrResult.rawData.plateNumber);
          if (ocrResult.rawData.vehicleModel) setVehicleModel(ocrResult.rawData.vehicleModel);
          if (ocrResult.rawData.expiryDate) setRoadTaxExpiry(ocrResult.rawData.expiryDate);

          const colorsList = ['WHITE', 'BLACK', 'SILVER', 'GREY', 'GRAY', 'RED', 'BLUE', 'GREEN', 'YELLOW', 'BROWN', 'ORANGE', 'GOLD'];
          const joinedLines = ocrResult.lines.join(' ').toUpperCase();
          const foundColor = colorsList.find(c => joinedLines.includes(c));
          if (foundColor) {
            setVehicleColor(foundColor.charAt(0) + foundColor.slice(1).toLowerCase());
          }
        } catch (e: any) {
          console.warn('OCR Failure on vehicle doc:', e?.message);
        } finally {
          setLoadingOCR(false);
        }
      }
    } catch (error) {
      console.error(error);
    }
  };

  const removeVehicleDoc = (id: string) => {
    setVehicleDocs(prev => prev.filter(d => d.id !== id));
  };

  const handleSaveVehicle = async () => {
    if (!user) return;
    setSavingVehicle(true);
    try {
      const uploadedDocs: { type: string; url: string; uploaded_at: number }[] = [];
      for (const d of vehicleDocs) {
        if (d.uploadedUrl) {
          uploadedDocs.push({ type: d.type, url: d.uploadedUrl, uploaded_at: Date.now() });
          continue;
        }
        try {
          const safeType = d.type.replace(/\s+/g, '_').toLowerCase();
          const ownerKey = user.firebaseUid || user.id;
          const path = `documents/${ownerKey}/${safeType}_${d.id}.jpg`;
          const url = await uploadDocAsync(d.uri, path);
          uploadedDocs.push({ type: d.type, url, uploaded_at: Date.now() });
          d.uploadedUrl = url;
        } catch (uploadErr: any) {
          console.warn('Doc upload failed:', uploadErr?.message);
          Alert.alert('Upload Issue', `Could not upload ${d.type}. ${uploadErr?.message || ''}`);
        }
      }

      await updateProfile({
        vehiclePlate: plateNumber,
        vehicleModel: vehicleModel,
        vehicleColor: vehicleColor,
        road_tax_expiry: roadTaxExpiry || null,
      });

      const docsRef = doc(db, 'user_documents', user.id);
      await setDoc(
        docsRef,
        {
          user_id: user.id,
          vehicle_documents: uploadedDocs,
          plate_number: plateNumber,
          vehicle_model: vehicleModel,
          vehicle_color: vehicleColor,
          road_tax_expiry: roadTaxExpiry || null,
          updated_at: serverTimestamp(),
        },
        { merge: true }
      );

      Alert.alert(
        'Saved',
        uploadedDocs.length > 0
          ? `Vehicle updated and ${uploadedDocs.length} document(s) uploaded.`
          : 'Vehicle information saved.'
      );
      setModalVisible(false);
    } catch (err: any) {
      Alert.alert('Error', 'Failed to update vehicle details: ' + (err?.message || ''));
    } finally {
      setSavingVehicle(false);
    }
  };

  const handleSimulateApproval = async () => {
    if (!user) return;
    try {
      await verifyAdminDocs();
      Alert.alert('Simulate Admin Approval', 'Documents approved successfully! Your verification status is now updated.');
    } catch (err: any) {
      Alert.alert('Error', 'Failed to approve documents: ' + err.message);
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
    },
    modalContent: { backgroundColor: isDark ? Colors.darkCard : Colors.white },
  };

  return (
    <ScrollView style={[styles.container, dynamicStyles.container, { paddingTop: insets.top }]} contentContainerStyle={styles.content}>
      {/* Profile header */}
      <View style={styles.profileHeader}>
        <View style={styles.avatar}>
          <Ionicons name="person" size={36} color={Colors.white} />
        </View>
        <Text style={[styles.name, dynamicStyles.text]}>{user?.name ?? 'Driver'}</Text>
        <Text style={[styles.email, dynamicStyles.subText]}>{user?.email ?? 'driver@utem.edu.my'}</Text>
        <View style={styles.roleBadge}>
          <Ionicons name="car-sport" size={14} color={Colors.primary} />
          <Text style={styles.roleText}>Driver</Text>
        </View>
      </View>

      {/* Vehicle info */}
      <Text style={styles.sectionTitle}>Vehicle Information</Text>
      <View style={[styles.card, dynamicStyles.card]}>
        <DriverRow icon="car" label="Vehicle Model" value={user?.vehicleModel ?? 'Not set'} isDark={isDark} />
        <DriverRow icon="document-text" label="Plate Number" value={user?.vehiclePlate ?? 'Not set'} isDark={isDark} />
        <DriverRow icon="color-palette" label="Vehicle Colour" value={user?.vehicleColor ?? 'Not set'} isDark={isDark} />
        <DriverRow 
          icon="shield-checkmark" 
          label="Verification Status" 
          value={user?.is_verified ? 'Verified' : 'Pending Verification'} 
          valueColor={user?.is_verified ? Colors.success : Colors.warning}
          isDark={isDark} 
          last 
        />
        
        {/* Update Vehicle Info & Docs Button */}
        <TouchableOpacity style={styles.updateDocsBtn} onPress={openUpdateModal}>
          <Ionicons name="cloud-upload" size={20} color={Colors.primary} />
          <Text style={styles.updateDocsText}>Update Documents & Vehicle</Text>
        </TouchableOpacity>
      </View>

      {/* Account */}
      <Text style={styles.sectionTitle}>Account</Text>
      <View style={[styles.card, dynamicStyles.card]}>
        <DriverRow icon="person-outline" label="Full Name" value={user?.name ?? 'Driver'} isDark={isDark} />
        <DriverRow icon="mail-outline" label="Email" value={user?.email ?? 'Not set'} isDark={isDark} />
        <DriverRow icon="call-outline" label="Phone" value={user?.phone ?? 'Not set'} isDark={isDark} last />
      </View>

      {/* Settings */}
      <Text style={styles.sectionTitle}>Settings</Text>
      <View style={[styles.card, dynamicStyles.card]}>
        <View style={[styles.settingRow, dynamicStyles.border, { flexDirection: 'column', alignItems: 'stretch', gap: Spacing.sm }]}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <View style={styles.settingLeft}>
              <Ionicons name="color-palette-outline" size={20} color={isDark ? Colors.gray300 : Colors.gray600} />
              <Text style={[styles.settingLabel, dynamicStyles.text]}>Theme</Text>
            </View>
          </View>
          
          <View style={styles.themeSelectorGroup}>
            {(['system', 'light', 'dark'] as const).map((mode) => (
              <TouchableOpacity
                key={mode}
                style={[
                  styles.themeSelectorBtn,
                  { backgroundColor: isDark ? Colors.gray900 : Colors.gray50 },
                  themeMode === mode && { backgroundColor: Colors.primary }
                ]}
                onPress={() => setTheme(mode)}
              >
                <Text
                  style={[
                    styles.themeSelectorText,
                    { color: isDark ? Colors.gray400 : Colors.gray600 },
                    themeMode === mode && { color: Colors.white, fontWeight: 'bold' }
                  ]}
                >
                  {mode.charAt(0).toUpperCase() + mode.slice(1)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </View>

      {/* Switch & Logout */}
      <TouchableOpacity style={styles.switchBtn} onPress={() => { switchRole(); router.replace('/(passenger)/home'); }}>
        <Ionicons name="swap-horizontal" size={20} color={Colors.primary} />
        <Text style={styles.switchText}>Switch to Passenger Mode</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.logoutBtn} onPress={() => { logout(); router.replace('/(auth)/login'); }}>
        <Ionicons name="log-out-outline" size={20} color={Colors.error} />
        <Text style={styles.logoutText}>Log Out</Text>
      </TouchableOpacity>

      {/* Update Vehicle & Docs Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={modalVisible}
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, dynamicStyles.modalContent]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, dynamicStyles.text]}>Update Vehicle & Docs</Text>
              <TouchableOpacity onPress={() => setModalVisible(false)} style={styles.modalCloseBtn}>
                <Ionicons name="close" size={24} color={isDark ? Colors.white : Colors.gray900} />
              </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={styles.modalBody} keyboardShouldPersistTaps="handled">
              
              <Text style={[styles.modalSectionTitle, dynamicStyles.text]}>1. Upload Vehicle Documents</Text>
              
              {/* Docs list */}
              {vehicleDocs.map((doc) => (
                <View key={doc.id} style={[styles.docListItem, { backgroundColor: isDark ? Colors.gray900 : Colors.gray50, borderColor: isDark ? Colors.darkBorder : Colors.gray200 }]}>
                  <Image source={{ uri: doc.uri }} style={styles.docListThumbnail} />
                  <View style={{ flex: 1, marginLeft: Spacing.sm }}>
                    <Text style={[styles.docListType, dynamicStyles.text]}>{doc.type}</Text>
                    <Text style={[styles.docListSub, dynamicStyles.subText]}>{doc.uploadedUrl ? 'Saved' : 'Ready to upload'}</Text>
                  </View>
                  <TouchableOpacity onPress={() => removeVehicleDoc(doc.id)} style={styles.docDeleteBtn}>
                    <Ionicons name="trash-outline" size={20} color={Colors.error} />
                  </TouchableOpacity>
                </View>
              ))}

              <TouchableOpacity
                style={[styles.addDocBtn, { borderColor: isDark ? Colors.darkBorder : Colors.gray200 }]}
                onPress={handleAddVehicleDoc}
              >
                <Ionicons name="add-circle-outline" size={24} color={Colors.primary} />
                <Text style={{ color: Colors.primary, fontWeight: 'bold', fontSize: FontSize.sm }}>Add Vehicle Document</Text>
              </TouchableOpacity>

              {loadingOCR && (
                <View style={styles.loadingBox}>
                  <ActivityIndicator size="small" color={Colors.primary} />
                  <Text style={[styles.loadingText, dynamicStyles.text]}>Scanning document (OCR)...</Text>
                </View>
              )}

              <Text style={[styles.modalSectionTitle, dynamicStyles.text]}>2. Vehicle Specifications</Text>

              <View style={styles.inputGroup}>
                <Text style={[styles.inputLabel, dynamicStyles.subText]}>Plate Number</Text>
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
                <Text style={[styles.inputLabel, dynamicStyles.subText]}>Vehicle Model</Text>
                <TextInput
                  style={[styles.input, dynamicStyles.input]}
                  value={vehicleModel}
                  onChangeText={setVehicleModel}
                  placeholder="E.g., Perodua Myvi"
                  placeholderTextColor={Colors.gray400}
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={[styles.inputLabel, dynamicStyles.subText]}>Vehicle Colour</Text>
                <TextInput
                  style={[styles.input, dynamicStyles.input]}
                  value={vehicleColor}
                  onChangeText={setVehicleColor}
                  placeholder="E.g., White"
                  placeholderTextColor={Colors.gray400}
                />
              </View>

              {/* Simulation section */}
              <View style={[styles.simulationBox, { borderColor: Colors.warning + '50', backgroundColor: Colors.warning + '10' }]}>
                <Ionicons name="construct" size={20} color={Colors.warning} />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.simulationTitle, { color: Colors.warning }]}>Admin Simulation Utility</Text>
                  <Text style={[styles.simulationDesc, dynamicStyles.subText]}>Click below to simulate an immediate admin approval for this driver account's documents.</Text>
                  <TouchableOpacity style={[styles.simulateBtn, { backgroundColor: Colors.warning }]} onPress={handleSimulateApproval}>
                    <Text style={styles.simulateBtnText}>Simulate Approve Docs</Text>
                  </TouchableOpacity>
                </View>
              </View>

              <TouchableOpacity
                style={[styles.saveBtn, savingVehicle && { opacity: 0.7 }]}
                onPress={handleSaveVehicle}
                disabled={savingVehicle}
              >
                {savingVehicle ? (
                  <ActivityIndicator color={Colors.white} />
                ) : (
                  <Text style={styles.saveBtnText}>Save specifications & upload</Text>
                )}
              </TouchableOpacity>

            </ScrollView>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

function DriverRow({ icon, label, value, valueColor, last, isDark }: { icon: keyof typeof Ionicons.glyphMap; label: string; value: string; valueColor?: string; last?: boolean; isDark: boolean }) {
  return (
    <View style={[styles.row, !last && { borderBottomWidth: 1, borderBottomColor: isDark ? Colors.darkBorder : Colors.gray100 }]}>
      <Ionicons name={icon} size={20} color={isDark ? Colors.gray500 : Colors.gray400} />
      <View style={styles.rowInfo}>
        <Text style={styles.rowLabel}>{label}</Text>
        <Text style={[styles.rowValue, valueColor ? { color: valueColor } : { color: isDark ? Colors.white : Colors.gray900 }]}>{value}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { paddingBottom: Spacing.xxl },
  profileHeader: { alignItems: 'center', paddingVertical: Spacing.xl },
  avatar: { width: 80, height: 80, borderRadius: 40, backgroundColor: Colors.primary, justifyContent: 'center', alignItems: 'center', marginBottom: Spacing.sm },
  name: { fontSize: FontSize.xl, fontWeight: FontWeight.bold },
  email: { fontSize: FontSize.sm, marginTop: 2 },
  roleBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: Colors.primary + '12', borderRadius: BorderRadius.full, paddingHorizontal: Spacing.md, paddingVertical: 4, marginTop: Spacing.sm },
  roleText: { fontSize: FontSize.sm, fontWeight: FontWeight.bold, color: Colors.primary },
  sectionTitle: { fontSize: FontSize.sm, fontWeight: FontWeight.semibold, color: Colors.gray400, textTransform: 'uppercase', letterSpacing: 0.5, paddingHorizontal: Spacing.lg, marginTop: Spacing.lg, marginBottom: Spacing.sm },
  card: { marginHorizontal: Spacing.md, borderRadius: BorderRadius.lg, ...Shadows.sm },
  row: { flexDirection: 'row', alignItems: 'center', padding: Spacing.md },
  rowInfo: { marginLeft: Spacing.md, flex: 1 },
  rowLabel: { fontSize: FontSize.xs, color: Colors.gray400 },
  rowValue: { fontSize: FontSize.md, fontWeight: FontWeight.medium, marginTop: 1 },
  switchBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.sm, backgroundColor: Colors.primary + '15', marginHorizontal: Spacing.md, borderRadius: BorderRadius.md, paddingVertical: 14, marginTop: Spacing.xl },
  switchText: { fontSize: FontSize.md, fontWeight: FontWeight.bold, color: Colors.primary },
  logoutBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.sm, marginHorizontal: Spacing.md, borderRadius: BorderRadius.md, paddingVertical: 14, marginTop: Spacing.sm },
  logoutText: { fontSize: FontSize.md, fontWeight: FontWeight.bold, color: Colors.error },
  updateDocsBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: Spacing.md },
  updateDocsText: { fontSize: FontSize.md, color: Colors.primary, fontWeight: FontWeight.medium },
  settingRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: Spacing.md },
  settingLeft: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  settingLabel: { fontSize: FontSize.md },
  themeSelectorGroup: {
    flexDirection: 'row',
    gap: Spacing.xs,
    marginTop: Spacing.xs,
    width: '100%',
  },
  themeSelectorBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  themeSelectorText: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.medium,
  },

  // Modal styles
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: { borderTopLeftRadius: BorderRadius.xl, borderTopRightRadius: BorderRadius.xl, padding: Spacing.lg, maxHeight: '85%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.md },
  modalTitle: { fontSize: FontSize.lg, fontWeight: FontWeight.bold },
  modalCloseBtn: { padding: 4 },
  modalBody: { paddingBottom: Spacing.xl },
  modalSectionTitle: { fontSize: FontSize.sm, fontWeight: FontWeight.bold, textTransform: 'uppercase', letterSpacing: 0.5, marginTop: Spacing.lg, marginBottom: Spacing.sm },
  docListItem: { flexDirection: 'row', alignItems: 'center', padding: Spacing.sm, borderRadius: BorderRadius.md, borderWidth: 1, marginBottom: Spacing.sm },
  docListThumbnail: { width: 50, height: 50, borderRadius: BorderRadius.sm },
  docListType: { fontSize: FontSize.sm, fontWeight: FontWeight.bold },
  docListSub: { fontSize: FontSize.xs, marginTop: 2 },
  docDeleteBtn: { padding: Spacing.sm },
  addDocBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.sm, paddingVertical: 12, borderWidth: 1, borderStyle: 'dashed', borderRadius: BorderRadius.md, marginBottom: Spacing.md },
  loadingBox: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginVertical: Spacing.sm, alignSelf: 'center' },
  loadingText: { fontSize: FontSize.xs },
  inputGroup: { marginBottom: Spacing.sm },
  inputLabel: { fontSize: FontSize.xs, fontWeight: FontWeight.semibold, marginBottom: 4 },
  input: { height: 48, borderRadius: BorderRadius.md, borderWidth: 1, paddingHorizontal: Spacing.md, fontSize: FontSize.md },
  saveBtn: { backgroundColor: Colors.primary, borderRadius: BorderRadius.md, paddingVertical: 14, alignItems: 'center', marginTop: Spacing.lg, ...Shadows.md },
  saveBtnText: { color: Colors.white, fontSize: FontSize.md, fontWeight: FontWeight.bold },
  
  // Simulation styles
  simulationBox: { flexDirection: 'row', borderWidth: 1, borderRadius: BorderRadius.md, padding: Spacing.md, gap: Spacing.sm, marginVertical: Spacing.md },
  simulationTitle: { fontSize: FontSize.sm, fontWeight: FontWeight.bold },
  simulationDesc: { fontSize: 11, lineHeight: 16, marginTop: 2 },
  simulateBtn: { alignSelf: 'flex-start', borderRadius: BorderRadius.sm, paddingHorizontal: Spacing.md, paddingVertical: 8, marginTop: Spacing.sm },
  simulateBtnText: { color: Colors.white, fontSize: FontSize.xs, fontWeight: FontWeight.bold },
});
