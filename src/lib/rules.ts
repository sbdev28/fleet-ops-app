import type { MaintenanceRuleRow } from './types';

export type RuleStatus = 'overdue' | 'due_soon' | 'ok' | 'baseline';
export type AssetStatus = 'overdue' | 'due_soon' | 'ok';
export type AlertSeverity = 'overdue' | 'due_soon';

const DAY_MS = 24 * 60 * 60 * 1000;

const ruleSeverity: Record<RuleStatus, number> = {
  overdue: 3,
  due_soon: 2,
  baseline: 2,
  ok: 1,
};

function asNumber(value: number | string | null | undefined): number {
  const n = Number(value ?? 0);
  return Number.isFinite(n) ? n : 0;
}

function formatRemaining(value: number): string {
  if (value <= 0) return 'Due now';
  if (value < 10) return value.toFixed(1);
  return Math.round(value).toString();
}

export function getRuleStatus(rule: MaintenanceRuleRow, currentUsage: number, now = new Date()): RuleStatus {
  const interval = asNumber(rule.interval_value);
  const triggerUnit = rule.trigger_unit;

  if (triggerUnit === 'days') {
    if (!rule.last_completed_date) return 'baseline';

    const lastMs = new Date(rule.last_completed_date).getTime();
    const dueMs = lastMs + interval * DAY_MS;
    const remainingDays = (dueMs - now.getTime()) / DAY_MS;

    if (remainingDays <= 0) return 'overdue';
    if (remainingDays <= 7) return 'due_soon';
    return 'ok';
  }

  if (rule.last_completed_value === null) {
    return 'baseline';
  }

  const dueAt = asNumber(rule.last_completed_value) + interval;
  const remaining = dueAt - currentUsage;

  if (remaining <= 0) return 'overdue';
  if (remaining <= interval * 0.1) return 'due_soon';
  return 'ok';
}

export function getRuleNextDueLabel(rule: MaintenanceRuleRow, currentUsage: number, now = new Date()): string {
  const interval = asNumber(rule.interval_value);

  if (rule.trigger_unit === 'days') {
    if (!rule.last_completed_date) return 'Set baseline date';
    const dueMs = new Date(rule.last_completed_date).getTime() + interval * DAY_MS;
    const remainingDays = (dueMs - now.getTime()) / DAY_MS;
    if (remainingDays <= 0) return 'Overdue';
    return `${Math.ceil(remainingDays)} days`;
  }

  if (rule.last_completed_value === null) {
    return `Set baseline ${rule.trigger_unit}`;
  }

  const dueAt = asNumber(rule.last_completed_value) + interval;
  const remaining = dueAt - currentUsage;
  if (remaining <= 0) return 'Overdue';
  return `${formatRemaining(remaining)} ${rule.trigger_unit}`;
}

export function getAlertSeverity(status: RuleStatus): AlertSeverity | null {
  if (status === 'overdue') return 'overdue';
  if (status === 'due_soon' || status === 'baseline') return 'due_soon';
  return null;
}

export function getAssetStatus(
  rules: MaintenanceRuleRow[],
  currentUsage: number,
  now = new Date(),
): { status: AssetStatus; nextDueLabel: string } {
  if (rules.length === 0) {
    return { status: 'ok', nextDueLabel: 'No rules' };
  }

  const evaluated = rules.map((rule) => ({
    rule,
    status: getRuleStatus(rule, currentUsage, now),
    nextDueLabel: getRuleNextDueLabel(rule, currentUsage, now),
  }));

  evaluated.sort((a, b) => ruleSeverity[b.status] - ruleSeverity[a.status]);

  const top = evaluated[0];
  const assetStatus: AssetStatus = top.status === 'baseline' ? 'due_soon' : top.status;

  return {
    status: assetStatus,
    nextDueLabel: top.nextDueLabel,
  };
}
