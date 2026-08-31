// Shared v1 client health assessment question structure.
// Used by both the client form and the coach read-only view.

export type AssessmentField = {
  key: string;
  label: string;
  type: 'yesno' | 'yesno_text' | 'text' | 'textarea' | 'select' | 'medications';
  // For yesno_text: which value reveals the follow-up text
  revealOn?: 'yes';
  followUpLabel?: string;
  options?: string[];
  // Health-risk flag: coach view highlights when this answers 'yes'
  flagOnYes?: boolean;
  placeholder?: string;
};

export type AssessmentSection = {
  key: string;
  title: string;
  description?: string;
  fields: AssessmentField[];
};

export const ASSESSMENT_SECTIONS: AssessmentSection[] = [
  {
    key: 'health',
    title: 'Health Screening',
    description: 'This helps your coach train you safely. Your coach is not a medical professional — anything concerning may be referred to your doctor.',
    fields: [
      { key: 'medicalConditions', label: 'Do you have any current medical conditions?', type: 'yesno_text', revealOn: 'yes', followUpLabel: 'Please describe', flagOnYes: true },
      { key: 'heartCondition', label: 'Any heart or cardiovascular condition?', type: 'yesno', flagOnYes: true },
      { key: 'bloodPressure', label: 'High or low blood pressure?', type: 'yesno', flagOnYes: true },
      { key: 'diabetes', label: 'Diabetes or blood glucose issues?', type: 'yesno', flagOnYes: true },
      { key: 'asthma', label: 'Asthma or respiratory condition?', type: 'yesno', flagOnYes: true },
      { key: 'chestPainDizziness', label: 'Any chest pain, dizziness, or fainting during activity?', type: 'yesno', flagOnYes: true },
      { key: 'doctorRestricted', label: 'Has a doctor ever advised you to restrict exercise?', type: 'yesno_text', revealOn: 'yes', followUpLabel: 'What did they advise?', flagOnYes: true },
      { key: 'recentSurgery', label: 'Any recent surgery or hospitalisation?', type: 'yesno_text', revealOn: 'yes', followUpLabel: 'Please describe', flagOnYes: true },
      { key: 'pregnancy', label: 'Are you pregnant or postnatal?', type: 'select', options: ['No', 'Yes', 'Not applicable'], flagOnYes: true },
    ],
  },
  {
    key: 'medication',
    title: 'Medication',
    fields: [
      { key: 'takingMedication', label: 'Are you currently taking any medication?', type: 'yesno', flagOnYes: true },
      // medications list only shown when takingMedication === 'yes'
      { key: 'medications', label: 'Your medication', type: 'medications' },
    ],
  },
  {
    key: 'injuries',
    title: 'Injuries & Pain',
    fields: [
      { key: 'currentInjuries', label: 'Any current injuries or pain?', type: 'yesno_text', revealOn: 'yes', followUpLabel: 'Where, and what makes it worse?', flagOnYes: true },
      { key: 'pastInjuries', label: 'Any past significant injuries or surgery?', type: 'yesno_text', revealOn: 'yes', followUpLabel: 'Please describe' },
      { key: 'underTreatment', label: 'Are you currently under physio or medical treatment?', type: 'yesno_text', revealOn: 'yes', followUpLabel: 'Please describe', flagOnYes: true },
    ],
  },
  {
    key: 'lifestyle',
    title: 'Lifestyle',
    fields: [
      { key: 'activityLevel', label: 'Current activity level', type: 'select', options: ['Sedentary', 'Lightly active', 'Moderately active', 'Very active'] },
      { key: 'occupation', label: 'Is your job mostly sedentary or active?', type: 'select', options: ['Mostly sedentary', 'Mix of both', 'Mostly active'] },
      { key: 'sleep', label: 'Average hours of sleep per night', type: 'select', options: ['Less than 5', '5–6', '7–8', '9+'] },
      { key: 'stress', label: 'Current stress level', type: 'select', options: ['Low', 'Moderate', 'High'] },
      { key: 'trainingDays', label: 'Days per week you can realistically train', type: 'select', options: ['1', '2', '3', '4', '5', '6', '7'] },
    ],
  },
  {
    key: 'goals',
    title: 'Goals',
    fields: [
      { key: 'primaryGoal', label: 'What is your primary goal?', type: 'text', placeholder: 'e.g. Run a sub-30 5K, lose 8kg, get stronger' },
      { key: 'whyMatters', label: 'Why does this matter to you?', type: 'textarea', placeholder: 'What would achieving it mean?' },
      { key: 'timeframe', label: 'Target timeframe', type: 'text', placeholder: 'e.g. By June, next 3 months' },
      { key: 'previousAttempts', label: 'Previous attempts — what has worked or not worked before?', type: 'textarea', placeholder: 'Optional' },
    ],
  },
];

export const CONSENT_TEXT =
  "I consent to sharing this health information with my coach. I understand it is stored securely and used only to help plan my training. I acknowledge my coach is not a medical professional and that I should consult a doctor about any medical concerns.";
