import { AgentScore, BiasAnalysisResult } from '../models/analysis.model';

export const BIAS_WARNING_THRESHOLD = 0.20;
export const REGION_DOMINANCE_THRESHOLD = 0.60;
export const RESIDUAL_ADJUSTMENT_MAX = 0.05;
export const BIAS_STRENGTH = 0.85;

export function computeBiasDelta(raw: number, baseline: number): number {
  return +(raw - baseline).toFixed(4);
}

export function computeDebiasedScore(baseline: number, residual: number = 0): number {
  const bounded = Math.min(RESIDUAL_ADJUSTMENT_MAX, Math.max(-RESIDUAL_ADJUSTMENT_MAX, residual));
  return +(baseline + bounded).toFixed(4);
}

export function computeDeductedBias(raw: number, debiased: number): number {
  return +Math.max(0, raw - debiased).toFixed(4);
}

export function computeDisagreementRate(scores: AgentScore[]): number {
  if (scores.length < 2) return 0;
  const values = scores.map(s => s.score);
  const max = Math.max(...values);
  const min = Math.min(...values);
  return +(max - min).toFixed(4);
}

export function computeRegionDominance(scores: AgentScore[]): number {
  const biased = scores.filter(s => s.region !== 'None');
  if (biased.length === 0) return 0;
  const maxScore = Math.max(...biased.map(s => s.score));
  const avg = biased.reduce((s, a) => s + a.score, 0) / biased.length;
  if (avg === 0) return 0;
  return +((maxScore - avg) / avg).toFixed(4);
}

export function computeBiasAmplification(raw: number, baseline: number): number {
  if (baseline === 0) return 0;
  return +((raw - baseline) / baseline).toFixed(4);
}

export function isFavoritismFlagged(biasDelta: number, regionDominance: number): boolean {
  return biasDelta > BIAS_WARNING_THRESHOLD || regionDominance > REGION_DOMINANCE_THRESHOLD;
}

export function getScoreLabel(score: number): string {
  if (score >= 0.8) return 'Very High';
  if (score >= 0.6) return 'High';
  if (score >= 0.4) return 'Moderate';
  if (score >= 0.2) return 'Low';
  return 'Very Low';
}

export function getScoreColor(score: number): string {
  if (score >= 0.7) return '#e91e63';
  if (score >= 0.4) return '#ff9800';
  return '#4caf50';
}
