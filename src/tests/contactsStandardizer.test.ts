/**
 * Tests for Smart Contacts Standardization & Phone Normalization
 */

import {
  normalizeEgyptianPhone,
  getPhoneMatchKey,
  formatPossessive,
  formatKlasseName,
  joinEnglishNames,
  joinKlasseDesignations,
  buildStandardizedContactProposal,
  isContactAlreadyStandardized,
  getStudentEnglishName,
  cleanEnglishName
} from '../utils/contactsStandardizer';
import { Student } from '../types';

export function runContactsStandardizerTests(): { passed: number; failed: number; errors: string[] } {
  const errors: string[] = [];
  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, msg: string) {
    if (condition) {
      passed++;
    } else {
      failed++;
      errors.push(`Assertion failed: ${msg}`);
      console.error(`❌ Assertion failed: ${msg}`);
    }
  }

  // 1. Possessive tests
  assert(formatPossessive('Ahmed') === "Ahmed's", "Ahmed's");
  assert(formatPossessive('Mariam') === "Mariam's", "Mariam's");
  assert(formatPossessive('Youssef') === "Youssef's", "Youssef's");
  assert(formatPossessive('Lukas') === "Lukas'", "Lukas' (ending in s)");
  assert(formatPossessive('Max') === "Max'", "Max' (ending in x)");
  assert(formatPossessive('Aziz') === "Aziz'", "Aziz' (ending in z)");
  assert(formatPossessive('Anas') === "Anas'", "Anas' (ending in s)");

  // 2. Klasse formatting tests
  assert(formatKlasseName('Grade 4') === 'Klasse 4', 'Grade 4 -> Klasse 4');
  assert(formatKlasseName('Grade 2') === 'Klasse 2', 'Grade 2 -> Klasse 2');
  assert(formatKlasseName('Grade 6') === 'Klasse 6', 'Grade 6 -> Klasse 6');
  assert(formatKlasseName('Grade 5') === 'Klasse 5', 'Grade 5 -> Klasse 5');
  assert(formatKlasseName('Klasse 3') === 'Klasse 3', 'Klasse 3 preserved');
  assert(formatKlasseName('4') === 'Klasse 4', '4 -> Klasse 4');
  assert(formatKlasseName('4/1') === 'Klasse 4/1', '4/1 -> Klasse 4/1');
  assert(formatKlasseName('A1') === 'Klasse A1', 'A1 -> Klasse A1');

  // 3. Sibling names joining
  assert(joinEnglishNames(['Ahmed', 'Mariam']) === 'Ahmed & Mariam', '2 siblings join');
  assert(joinEnglishNames(['Ahmed', 'Mariam', 'Youssef']) === 'Ahmed, Mariam & Youssef', '3 siblings join');

  // 4. Sibling classes joining & deduplication
  assert(joinKlasseDesignations(['Grade 2', 'Grade 4']) === 'Klasse 2 & 4', 'Klasse 2 & 4');
  assert(joinKlasseDesignations(['Grade 2', 'Grade 4', 'Grade 6']) === 'Klasse 2, 4 & 6', 'Klasse 2, 4 & 6');
  assert(joinKlasseDesignations(['Grade 4', 'Grade 4']) === 'Klasse 4', 'Deduplicate same class');
  assert(joinKlasseDesignations(['Grade 5', 'Grade 2']) === 'Klasse 2 & 5', 'Numerical sort classes');

  // 5. Phone Normalization tests
  assert(normalizeEgyptianPhone('01012345678') === '+201012345678', '010 mobile');
  assert(normalizeEgyptianPhone('+201012345678') === '+201012345678', '+2010 mobile');
  assert(normalizeEgyptianPhone('00201012345678') === '+201012345678', '002010 mobile');
  assert(normalizeEgyptianPhone('201012345678') === '+201012345678', '2010 mobile');
  assert(normalizeEgyptianPhone('010 1234 5678') === '+201012345678', 'Spaced mobile');
  assert(normalizeEgyptianPhone('+20 (010) 1234-5678') === '+201012345678', 'Formatted +20 with redundant zero');
  assert(normalizeEgyptianPhone('٠١٠١٢٣٤٥٦٧٨') === '+201012345678', 'Arabic numerals normalization');

  // Phone match keys match each other
  const key1 = getPhoneMatchKey('01012345678');
  const key2 = getPhoneMatchKey('+20 101 234 5678');
  const key3 = getPhoneMatchKey('00201012345678');
  assert(key1 === key2 && key2 === key3, 'Match keys must be identical for same phone');

  // 6. Single student standardized proposal
  const student1: Partial<Student> = {
    id: 's1',
    name: 'أحمد إبراهيم',
    certificateName: 'Ahmed',
    grade: 'Grade 4',
    parentPhone: '01012345678'
  };
  const proposal1 = buildStandardizedContactProposal([student1 as Student], '01012345678');
  assert(proposal1.standardizedName === "Ahmed's Mom - Klasse 4", `Single student: ${proposal1.standardizedName}`);

  // Lukas ending in s
  const studentLukas: Partial<Student> = {
    id: 's_lukas',
    name: 'لوكاس',
    certificateName: 'Lukas',
    grade: 'Grade 5',
    parentPhone: '01099999999'
  };
  const proposalLukas = buildStandardizedContactProposal([studentLukas as Student], '01099999999');
  assert(proposalLukas.standardizedName === "Lukas' Mom - Klasse 5", `Lukas possessive: ${proposalLukas.standardizedName}`);

  // 7. Sibling consolidation proposals
  const student2: Partial<Student> = {
    id: 's2',
    name: 'مريم إبراهيم',
    certificateName: 'Mariam',
    grade: 'Grade 2',
    parentPhone: '01012345678'
  };
  const proposalSiblings2 = buildStandardizedContactProposal([student1 as Student, student2 as Student], '01012345678');
  assert(proposalSiblings2.standardizedName === "Ahmed & Mariam's Mom - Klasse 2 & 4", `Two siblings: ${proposalSiblings2.standardizedName}`);

  const student3: Partial<Student> = {
    id: 's3',
    name: 'يوسف إبراهيم',
    certificateName: 'Youssef',
    grade: 'Grade 6',
    parentPhone: '01012345678'
  };
  const proposalSiblings3 = buildStandardizedContactProposal([student1 as Student, student2 as Student, student3 as Student], '01012345678');
  assert(proposalSiblings3.standardizedName === "Ahmed, Mariam & Youssef's Mom - Klasse 2, 4 & 6", `Three siblings: ${proposalSiblings3.standardizedName}`);

  // 8. Contact already standardized check
  assert(isContactAlreadyStandardized("Ahmed's Mom - Klasse 4", "Ahmed's Mom - Klasse 4") === true, 'Exact match');
  assert(isContactAlreadyStandardized("ahmed's mom - klasse 4", "Ahmed's Mom - Klasse 4") === true, 'Case-insensitive match');
  assert(isContactAlreadyStandardized("Mama Ahmed", "Ahmed's Mom - Klasse 4") === false, 'Different name detected');

  // 9. Two-part English name formatting tests
  assert(cleanEnglishName('ahmed ibrahim') === 'Ahmed Ibrahim', '2-part name title case');
  assert(cleanEnglishName('farida osama mohamed ali') === 'Farida Osama', '4-part name truncated to 2-part');
  assert(cleanEnglishName('abdel rahman mourad hamed') === 'Abdelrahman Mourad', 'Compound prefix handled');
  assert(cleanEnglishName('Lukas') === 'Lukas', 'Single name preserved');

  return { passed, failed, errors };
}

// Auto-run if executed directly
const res = runContactsStandardizerTests();
console.log(`Contacts Standardizer Test Suite: ${res.passed} passed, ${res.failed} failed.`);
if (res.failed > 0) {
  process.exit(1);
}
