import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../supabaseClient';
import { useAuth } from './useAuth';
import type { AssetRow, MaintenanceRuleRow } from '../lib/types';
import { getAlertSeverity, getRuleNextDueLabel, getRuleStatus } from '../lib/rules';

export type AlertView = {
  id: string;
  assetId: string;
  ruleId: string;
  title: string;
  detail: string;
  severity: 'overdue' | 'due_soon';
};

async function fetchAssets(ownerId: string): Promise<AssetRow[]> {
  const { data, error } = await supabase
    .from('assets')
    .select('*')
    .eq('owner_id', ownerId);

  if (error) throw error;
  return (data || []) as AssetRow[];
}

async function fetchRules(ownerId: string): Promise<MaintenanceRuleRow[]> {
  const { data, error } = await supabase
    .from('maintenance_rules')
    .select('*')
    .eq('owner_id', ownerId);

  if (error) throw error;
  return (data || []) as MaintenanceRuleRow[];
}

function formatInterval(value: number, unit: string): string {
  if (unit === 'days') {
    const rounded = Math.round(value);
    return rounded === 1 ? '1 day interval' : `${rounded} days interval`;
  }

  if (value % 1 === 0) {
    return `${Math.round(value)} ${unit} interval`;
  }

  return `${value.toFixed(1)} ${unit} interval`;
}

export function useAlerts() {
  const { session } = useAuth();
  const ownerId = session?.user.id;

  const assetsQuery = useQuery({
    queryKey: ['assets', ownerId],
    queryFn: () => fetchAssets(ownerId as string),
    enabled: Boolean(ownerId),
  });

  const rulesQuery = useQuery({
    queryKey: ['maintenance-rules', ownerId],
    queryFn: () => fetchRules(ownerId as string),
    enabled: Boolean(ownerId),
  });

  const alerts = useMemo<AlertView[]>(() => {
    const assets = assetsQuery.data || [];
    const rules = rulesQuery.data || [];

    if (assets.length === 0 || rules.length === 0) {
      return [];
    }

    const assetsById = new Map(assets.map((asset) => [asset.id, asset]));

    return rules
      .map((rule) => {
        const asset = assetsById.get(rule.asset_id);
        if (!asset) return null;

        const currentUsage = Number(asset.current_usage || 0);
        const status = getRuleStatus(rule, currentUsage);
        const severity = getAlertSeverity(status);

        if (!severity) return null;

        const nextDue = getRuleNextDueLabel(rule, currentUsage);

        return {
          id: `${rule.id}-${severity}`,
          assetId: asset.id,
          ruleId: rule.id,
          title: asset.name,
          detail: `${formatInterval(Number(rule.interval_value), rule.trigger_unit)} • ${nextDue}`,
          severity,
        } satisfies AlertView;
      })
      .filter((alert): alert is AlertView => alert !== null)
      .sort((a, b) => a.title.localeCompare(b.title));
  }, [assetsQuery.data, rulesQuery.data]);

  const overdueAlerts = useMemo(() => alerts.filter((alert) => alert.severity === 'overdue'), [alerts]);
  const dueSoonAlerts = useMemo(() => alerts.filter((alert) => alert.severity === 'due_soon'), [alerts]);

  return {
    assets: assetsQuery.data || [],
    alerts,
    overdueAlerts,
    dueSoonAlerts,
    totalAssets: (assetsQuery.data || []).length,
    isLoading: assetsQuery.isLoading || rulesQuery.isLoading,
    isError: assetsQuery.isError || rulesQuery.isError,
    errorMessage:
      (assetsQuery.error as Error | null)?.message ||
      (rulesQuery.error as Error | null)?.message ||
      '',
  };
}
