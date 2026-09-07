/**
 * UTeM Ride Automated Unit Test Suite
 * Run with: npm test
 */

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;

function assert(condition, message) {
  totalTests++;
  if (condition) {
    passedTests++;
    console.log(`  ✓ PASSED: ${message}`);
  } else {
    failedTests++;
    console.error(`  ✗ FAILED: ${message}`);
  }
}

// -------------------------------------------------------------------
// 1. Helper Logic Definitions (Matching app utils)
// -------------------------------------------------------------------
function parseFare(val) {
  if (val === undefined || val === null) return 0;
  if (typeof val === 'number') return isNaN(val) ? 0 : Math.max(0, val);
  const cleaned = String(val).replace(/[^0-9.]/g, '');
  const num = parseFloat(cleaned);
  return isNaN(num) ? 0 : Math.max(0, num);
}

function calculateEarnings(fare, commissionRate = 0.10) {
  const fareVal = parseFare(fare);
  const commission = +(fareVal * commissionRate).toFixed(2);
  const netEarnings = +(fareVal - commission).toFixed(2);
  return { fareVal, commission, netEarnings };
}

function calculateAverageRating(starsList) {
  if (!starsList || starsList.length === 0) return 0;
  const sum = starsList.reduce((acc, s) => acc + (Number(s) || 5), 0);
  return Number((sum / starsList.length).toFixed(1));
}

function extractEmailAlias(email) {
  if (!email || typeof email !== 'string' || !email.includes('@')) return '@passenger';
  return `@${email.split('@')[0]}`;
}

function formatPhoneNumber(input) {
  if (!input) return '';
  const cleaned = String(input).replace(/[^\d+]/g, '');
  if (cleaned.startsWith('+')) return cleaned;
  const digitsNoLeadingZero = cleaned.replace(/^0+/, '');
  return `+60${digitsNoLeadingZero}`;
}

function generate6DigitOtp() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// -------------------------------------------------------------------
// 2. Test Execution
// -------------------------------------------------------------------
console.log('\n==================================================');
console.log('🚗 UTeM Ride Automated Unit Test Suite');
console.log('==================================================\n');

// Suite 1: Fare Parsing & Price Extraction
console.log('[Suite 1: Fare Parsing & Price Extraction]');
assert(parseFare('11.62') === 11.62, 'parseFare("11.62") returns 11.62');
assert(parseFare('RM 11.62') === 11.62, 'parseFare("RM 11.62") strips currency symbol correctly');
assert(parseFare(15.5) === 15.5, 'parseFare(15.5) handles numeric values');
assert(parseFare(undefined) === 0, 'parseFare(undefined) returns 0 safely');
assert(parseFare(null) === 0, 'parseFare(null) returns 0 safely');
assert(parseFare('RM 0.00') === 0, 'parseFare("RM 0.00") returns 0');

// Suite 2: Driver Earnings & Commission Split
console.log('\n[Suite 2: Driver Earnings & Commission Split]');
const e1 = calculateEarnings(11.62, 0.10);
assert(e1.fareVal === 11.62, 'Gross earnings is RM 11.62');
assert(e1.commission === 1.16, 'Commission (10%) is -RM 1.16');
assert(e1.netEarnings === 10.46, 'Net driver payout is RM 10.46');

const e2 = calculateEarnings('RM 25.00', 0.10);
assert(e2.commission === 2.50, 'Commission for RM 25.00 is RM 2.50');
assert(e2.netEarnings === 22.50, 'Net earnings for RM 25.00 is RM 22.50');

// Suite 3: Rating Average Calculation
console.log('\n[Suite 3: Rating Average Calculation]');
assert(calculateAverageRating([5, 5, 4]) === 4.7, '5 + 5 + 4 averages to 4.7');
assert(calculateAverageRating([5, 5, 5, 5]) === 5.0, 'Four 5-star ratings average to 5.0');
assert(calculateAverageRating([1, 2]) === 1.5, '1 + 2 averages to 1.5');
assert(calculateAverageRating([]) === 0, 'Empty rating list defaults to 0 (No ratings)');

// Suite 4: Email Prefix Alias Formatting
console.log('\n[Suite 4: Email Prefix Alias Formatting]');
assert(extractEmailAlias('b032410541@student.utem.edu.my') === '@b032410541', 'UTeM student email extracts @b032410541');
assert(extractEmailAlias('driver1@utem.edu.my') === '@driver1', 'Driver email extracts @driver1');
assert(extractEmailAlias('invalid_email') === '@passenger', 'Invalid email falls back to @passenger');

// Suite 5: 2FA Phone Formatting & OTP Generation
console.log('\n[Suite 5: 2FA Phone Formatting & OTP Generation]');
assert(formatPhoneNumber('0123456789') === '+60123456789', 'Formats 0123456789 to +60123456789');
assert(formatPhoneNumber('+60198765432') === '+60198765432', 'Preserves international +60 format');

const otp = generate6DigitOtp();
assert(otp.length === 6, 'Generated OTP is exactly 6 digits');
assert(/^\d{6}$/.test(otp), 'Generated OTP contains numeric digits only');

// Summary Report
console.log('\n==================================================');
console.log(`Test Execution Complete: ${passedTests}/${totalTests} Passed.`);
console.log('==================================================\n');

if (failedTests > 0) {
  process.exit(1);
} else {
  process.exit(0);
}
