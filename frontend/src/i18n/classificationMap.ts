import type { TFunction } from 'i18next';

export function translateClassification(label: string, t: TFunction): string {
  const map: Record<string, string> = {
    'Normal': t('classification.Normal'),
    'Low': t('classification.Low'),
    'Prediabetes': t('classification.Prediabetes'),
    'Needs Monitoring': t('classification.NeedsMonitoring'),
    'Diabetes': t('classification.Diabetes'),
  };
  return map[label] ?? label;
}

export function translateRisk(label: string, t: TFunction): string {
  const map: Record<string, string> = {
    'Low': t('classification.risk.Low'),
    'Moderate': t('classification.risk.Moderate'),
    'High': t('classification.risk.High'),
  };
  return map[label] ?? label;
}
