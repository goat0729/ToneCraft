export type RelationshipType =
  | 'Boss/Manager'
  | 'Coworker'
  | 'Client'
  | 'Friend/Partner'
  | 'Customer Support';

export const RELATIONSHIP_OPTIONS: RelationshipType[] = [
  'Boss/Manager',
  'Coworker',
  'Client',
  'Friend/Partner',
  'Customer Support',
];

export interface SubtextAnalysis {
  detected_tone: string;
  aggression_score: number;
  core_goal: string;
  trigger_phrases: string[];
}

export type RewriteStyle =
  | 'Diplomatic & Warm'
  | 'Firm & Professional'
  | 'Direct & Concise';

export interface RewriteOption {
  style: RewriteStyle;
  message: string;
  why_it_works: string;
}

export interface Step1ApiResponse {
  analysis: SubtextAnalysis;
  rawJsonOutput: string;
  step1Meta: {
    model: string;
    systemInstruction: string;
    userPrompt: string;
  };
}

export interface Step2ApiResponse {
  rewrites: RewriteOption[];
  exactPromptSent: {
    model: string;
    systemInstruction: string;
    userPrompt: string;
  };
}

export type ChainPhase = 'idle' | 'step1' | 'step2' | 'complete' | 'error';

export interface AnalysisHistoryEntry {
  id: string;
  timestamp: number;
  relationship: RelationshipType;
  detected_tone: string;
  aggression_score: number;
}
