export interface ReadabilityResult {
  wordCount: number;
  sentenceCount: number;
  syllableCount: number;
  avgWordsPerSentence: number;
  avgSyllablesPerWord: number;
  readingEase: number;
  gradeLevel: number;
  styleLabel: string;
  tonePerceptionNote: string;
}

function countWordSyllables(rawWord: string): number {
  const word = rawWord.toLowerCase().replace(/[^a-z]/g, '');
  if (!word) return 0;
  if (word.length <= 3) return 1;

  let processed = word
    .replace(/(?:[^laeiouy]es|ed)$/i, '')
    .replace(/(?:[^laeiouy]e)$/i, '')
    .replace(/^y/, '');

  if (!processed) return 1;

  const vowelGroups = processed.match(/[aeiouy]{1,2}/g);
  const count = vowelGroups ? vowelGroups.length : 1;

  return Math.max(1, count);
}

function countSentences(text: string): number {
  const punctuated = text
    .split(/[.!?]+/)
    .map((segment) => segment.trim())
    .filter((segment) => /[a-zA-Z0-9]/.test(segment));

  if (punctuated.length > 0) {
    return punctuated.length;
  }

  const lines = text
    .split(/\n+/)
    .map((line) => line.trim())
    .filter((line) => /[a-zA-Z0-9]/.test(line));

  return Math.max(1, lines.length);
}

function classifyReadability(
  readingEase: number,
  gradeLevel: number,
  avgWordsPerSentence: number
): { styleLabel: string; tonePerceptionNote: string } {
  if (avgWordsPerSentence <= 8 && readingEase >= 75) {
    return {
      styleLabel: 'Short & Blunt',
      tonePerceptionNote:
        'Very short, clipped sentences read fast and direct, which can come across as abrupt or confrontational under tension.',
    };
  }

  if (readingEase < 45 || gradeLevel >= 12) {
    return {
      styleLabel: 'Dense & Complex',
      tonePerceptionNote:
        'Long sentences or multi-syllable phrasing raise cognitive load, making the message feel rigid, lecturing, or stern.',
    };
  }

  if (readingEase >= 70) {
    return {
      styleLabel: 'Plain & Direct',
      tonePerceptionNote:
        'Simple vocabulary and crisp pacing keep the point unmistakable, though little softens blunt phrasing.',
    };
  }

  return {
    styleLabel: 'Standard & Measured',
    tonePerceptionNote:
      'Moderate sentence length and complexity keep the draft approachable without sounding overly formal or terse.',
  };
}

export function analyzeReadability(text: string): ReadabilityResult | null {
  const trimmed = text.trim();
  if (!trimmed) return null;

  const words = trimmed.match(/[A-Za-z0-9']+/g) ?? [];
  const wordCount = words.length;
  if (wordCount === 0) return null;

  const sentenceCount = countSentences(trimmed);
  const syllableCount = words.reduce((sum, token) => {
    const cleaned = token.replace(/[^A-Za-z]/g, '');
    if (!cleaned) return sum + 1;
    return sum + countWordSyllables(cleaned);
  }, 0);

  const avgWordsPerSentence = wordCount / sentenceCount;
  const avgSyllablesPerWord = syllableCount / wordCount;

  const rawEase =
    206.835 - 1.015 * avgWordsPerSentence - 84.6 * avgSyllablesPerWord;
  const readingEase = Math.round(Math.min(100, Math.max(0, rawEase)));

  const rawGrade =
    0.39 * avgWordsPerSentence + 11.8 * avgSyllablesPerWord - 15.59;
  const gradeLevel = Math.round(Math.max(0, rawGrade) * 10) / 10;

  const { styleLabel, tonePerceptionNote } = classifyReadability(
    readingEase,
    gradeLevel,
    avgWordsPerSentence
  );

  return {
    wordCount,
    sentenceCount,
    syllableCount,
    avgWordsPerSentence: Math.round(avgWordsPerSentence * 10) / 10,
    avgSyllablesPerWord: Math.round(avgSyllablesPerWord * 100) / 100,
    readingEase,
    gradeLevel,
    styleLabel,
    tonePerceptionNote,
  };
}
