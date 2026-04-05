export interface RelatedWord {
  word: string;
  distance: number;
}

export interface PolitenessWord {
  word: string;
  level: number; // 0.1 to 2.0 for honorifics
}

export interface Word {
  id: string;
  korean: string;
  hanja?: string;
  pronunciation: string;
  definition: string;
  translation: string;
  exampleSentence: string;
  exampleEnglish: string;
  exampleTranslation: string;
  partOfSpeech: string;
  idiomExplanation?: string;
  synonyms: RelatedWord[];
  antonyms: RelatedWord[];
  honorifics: PolitenessWord[];
  casuals: PolitenessWord[];
  standardContext?: string;
  otherHomonyms: string[];
  isLearned?: boolean;
  hypernyms?: string[];
  hyponyms?: string[];
  relatedWords?: string[];
  officialInfo?: OfficialInfo[];
}

export interface Language {
  code: string;
  name: string;
  flag: string; // Emoji flag
}

export interface OfficialInfo {
  rank: string;
  rawWord: string;
  pos: string;
  meaning: string;
  grade: string;
}

export interface SentenceParticle {
  korean: string;
  baseForm?: string;
  meaning: string;
  pos: string;
}

export interface Sentence {
  id: string;
  original: string;
  translation: string;
  pronunciation: string;
  breakdown: SentenceParticle[];
  contextExplanation?: string;
  isLearned?: boolean;
}

export const SUPPORTED_LANGUAGES: Language[] = [
  { code: 'en', name: 'English (English)', flag: '🇺🇸' },
  { code: 'zh', name: '中文 (Chinese)', flag: '🇨🇳' },
  { code: 'ja', name: '日本語 (Japanese)', flag: '🇯🇵' },
  { code: 'vi', name: 'Tiếng Việt (Vietnamese)', flag: '🇻🇳' },
  { code: 'mn', name: 'Монгол (Mongolian)', flag: '🇲🇳' },
  { code: 'th', name: 'ภาษาไทย (Thai)', flag: '🇹🇭' },
  { code: 'id', name: 'Bahasa Indonesia (Indonesian)', flag: '🇮🇩' },
  { code: 'tl', name: 'Tagalog (Filipino)', flag: '🇵🇭' },
  { code: 'uz', name: 'Oʻzbekcha (Uzbek)', flag: '🇺🇿' },
  { code: 'kk', name: 'Қазақ (Kazakh)', flag: '🇰🇿' },
  { code: 'km', name: 'ភាសាខ្មែរ (Khmer)', flag: '🇰🇭' },
  { code: 'ur', name: 'اردو (Urdu)', flag: '🇵🇰' },
  { code: 'fa', name: 'فارسی (Persian)', flag: '🇮🇷' },
  { code: 'ru', name: 'Русский (Russian)', flag: '🇷🇺' },
  { code: 'fr', name: 'Français (French)', flag: '🇫🇷' },
  { code: 'es', name: 'Español (Spanish)', flag: '🇪🇸' },
  { code: 'de', name: 'Deutsch (German)', flag: '🇩🇪' },
  { code: 'ar', name: 'العربية (Arabic)', flag: '🇸🇦' },
  { code: 'it', name: 'Italiano (Italian)', flag: '🇮🇹' },
];