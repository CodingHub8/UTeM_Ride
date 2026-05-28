/**
 * OCR Text Extraction Utility for UTeM Ride
 * Handles text detection using Google Cloud Vision API.
 * No mock/simulated data — requires a valid API key.
 */

interface OCRResult {
  lines: string[];
  rawData: {
    studentId?: string;
    name?: string;
    plateNumber?: string;
    vehicleModel?: string;
    expiryDate?: string;
  };
}

import { readAsStringAsync } from 'expo-file-system/legacy';

/**
 * Converts a local URI to base64 string using expo-file-system.
 * Works reliably on iOS, Android, and Web platforms.
 */
async function uriToBase64(uri: string): Promise<string> {
  try {
    const base64 = await readAsStringAsync(uri, {
      encoding: 'base64',
    });
    return base64;
  } catch (error) {
    throw new Error(`Failed to read image file: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Perform Text Detection on an image using Google Cloud Vision API.
 * Throws an error if the API key is not configured or the API call fails.
 */
export async function performOCR(imageUri: string, type: 'matric_card' | 'road_tax'): Promise<OCRResult> {
  const apiKey = process.env.EXPO_PUBLIC_OCR_API_KEY;

  // Validate that the API key is configured
  if (!apiKey || apiKey.trim() === '' || apiKey.startsWith('YOUR_')) {
    throw new Error(
      'Google Cloud Vision API key is not configured.\n\n' +
      'To set it up:\n' +
      '1. Go to https://console.cloud.google.com/\n' +
      '2. Enable the Cloud Vision API\n' +
      '3. Create an API key under Credentials\n' +
      '4. Add it to your .env file as:\n' +
      '   EXPO_PUBLIC_OCR_API_KEY=AIzaSy...'
    );
  }

  console.log(`Performing real OCR text extraction for ${type}...`);
  const base64Image = await uriToBase64(imageUri);

  const response = await fetch(
    `https://vision.googleapis.com/v1/images:annotate?key=${apiKey}`,
    {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        requests: [
          {
            image: {
              content: base64Image,
            },
            features: [
              {
                type: 'TEXT_DETECTION',
              },
            ],
          },
        ],
      }),
    }
  );

  const data = await response.json();

  if (!response.ok) {
    const errorMsg = data.error?.message || `HTTP ${response.status}`;
    throw new Error(`Google Vision API error: ${errorMsg}`);
  }

  const textAnnotations = data.responses?.[0]?.textAnnotations;

  if (textAnnotations && textAnnotations.length > 0) {
    // The first element contains the full description with newlines
    const fullText = textAnnotations[0].description;
    const lines = fullText.split('\n').filter((line: string) => line.trim().length > 0);

    // Filter out non-Latin lines (e.g., Arabic, Chinese, etc.) to keep only Malay/English text
    const latinLines = lines.filter((line: string) => /^[\x00-\x7FA-Za-z0-9\s\-–—.,:;!?()'"\/@#$%&*+=\[\]{}|\\<>^`~]+$/.test(line.trim()));

    // Parse raw fields from the extracted lines (use filtered lines for parsing)
    const rawData = parseOCRLines(latinLines.length > 0 ? latinLines : lines, type);

    return { lines: latinLines.length > 0 ? latinLines : lines, rawData };
  } else {
    throw new Error('No text detected in the image. Please try a clearer photo.');
  }
}

/**
 * Convert a string to Title Case (first letter of each word capitalized).
 * Handles ALL CAPS names like "MUHAMMAD HAZIM" → "Muhammad Hazim"
 * Preserves special prefixes like "bin", "binti", "bt", "bint" as lowercase.
 */
function toTitleCase(text: string): string {
  const lowerExceptions = ['bin', 'binti', 'bt', 'bint', 'al', 'el', 'ibn'];
  return text
    .toLowerCase()
    .split(/\s+/)
    .map(word => {
      if (lowerExceptions.includes(word)) return word;
      if (word.length > 0) return word.charAt(0).toUpperCase() + word.slice(1);
      return word;
    })
    .join(' ')
    .trim();
}

/**
 * Helper to parse fields from OCR lines using Regex patterns
 */
function parseOCRLines(lines: string[], type: 'matric_card' | 'road_tax'): OCRResult['rawData'] {
  const data: OCRResult['rawData'] = {};
  const joinedText = lines.join(' ').toUpperCase();

  if (type === 'matric_card') {
    // Look for Matric Card IDs: e.g., B032410541, D01234, M12345
    // UTeM Student IDs typically start with B, D, M, P, T followed by numbers
    // OCR may insert spaces between characters, so we strip them first
    const strippedText = joinedText.replace(/\s+/g, '');
    const idMatch = strippedText.match(/[BDMPT]\d{5,9}/i);
    if (idMatch) {
      data.studentId = idMatch[0].toUpperCase();
    }

    // Try to find a line that starts with "NAMA" or "NAME" and take the text after it
    const nameLabelMatch = lines.find(line => /^NAMA\s*[:.]*\s*/i.test(line.trim()));
    if (nameLabelMatch) {
      // Extract text after "Nama" label (strip the label and any colons/dots/spaces)
      const extractedName = nameLabelMatch.replace(/^NAMA\s*[:.]*\s*/i, '').trim();
      if (extractedName.length > 2) {
        data.name = toTitleCase(extractedName);
      }
    }

    // Fallback: try to guess a name line (exclude lines with numbers, departments, UTeM headings, or government/ministry keywords)
    if (!data.name) {
      const excludeKeywords = [
        'STUDENT', 'STAFF', 'UNIVERSITI', 'TEKNIKAL', 'MALAYSIA', 'MELAKA',
        'UTEM', 'FACULTY', 'FTMK', 'FKE', 'FKP', 'KEMENTERIAN', 'PENDIDIKAN',
        'TINGGI', 'NO', 'ID', 'MATRIC', 'NAMA', 'TARIKH', 'SAH', 'HINGGA',
        'ALAMAT', 'JANTINA', 'BANGSA', 'WARGANEGARA', 'DIPLOMA', 'IJAZAH',
        'SARJANA', 'PHD', 'DOKTOR', 'FAKULTI', 'PUSAT', 'INSTITUT', 'MYSISWA',
        'MYDEBIT', 'ISLAMIC', 'KURSUS', 'MATRIK', 'RHB', 'VISA', 'DEBIT'
      ];
      const potentialNames = lines.filter(line => {
        const upper = line.trim().toUpperCase();
        const hasNumbers = /\d/.test(line);
        const isKeyword = excludeKeywords.some(kw => upper.includes(kw));
        return !hasNumbers && !isKeyword && upper.length > 5 && upper.length < 50;
      });

      if (potentialNames.length > 0) {
        data.name = toTitleCase(potentialNames[0].trim());
      }
    }
  } else if (type === 'road_tax') {
    // Look for Malaysian vehicle plate numbers (e.g. WKL 2847, JQB 1234, MALAYSIA 2026)
    const plateMatch = joinedText.match(/[A-Z]{1,3}\s?\d{1,4}\s?[A-Z]?/i);
    if (plateMatch) {
      data.plateNumber = plateMatch[0].toUpperCase().replace(/\s+/g, ' ');
    }

    // Look for Road Tax expiry date (usually formatted as DD-MM-YYYY or DD/MM/YYYY)
    const dateMatch = joinedText.match(/\d{2}[-/.]\d{2}[-/.]\d{4}/);
    if (dateMatch) {
      data.expiryDate = dateMatch[0];
    }

    // Try to extract common vehicle models
    const models = ['MYVI', 'SAGA', 'AXIA', 'ALZA', 'VIVA', 'PERSONA', 'BEZZA', 'CITY', 'CIVIC', 'VIOS'];
    const foundModel = models.find(m => joinedText.includes(m));
    if (foundModel) {
      data.vehicleModel = `Perodua ${foundModel.charAt(0) + foundModel.slice(1).toLowerCase()}`;
    }
  }

  return data;
}
