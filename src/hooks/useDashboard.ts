import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../supabaseClient';
import { useAuth } from './useAuth';
import { useAlerts } from './useAlerts';
import { useAssets, type AssetView } from './useAssets';
import { formatDateTimeLabel, formatMoney } from '../lib/format';

type UsageActivity = {
  id: string;
  asset_id: string;
  date: string;
  value: number;
  unit: string;
  notes: string | null;
};

type MaintenanceActivity = {
  id: string;
  asset_id: string;
  date: string;
  category: string;
  cost: number | null;
  notes: string | null;
};

type DowntimeActivity = {
  id: string;
  asset_id: string;
  start_date: string;
  reason: string;
  end_date: string | null;
  notes: string | null;
};

export type DashboardActivity = {
  id: string;
  kind: 'usage' | 'maintenance' | 'downtime';
  assetId: string;
  assetName: string;
  summary: string;
  dateLabel: string;
  sortDate: string;
};

const statusRank: Record<AssetView['status'], number> = {
  overdue: 0,
  due_soon: 1,
  ok: 2,
};

async function fetchRecentUsage(ownerId: string): Promise<UsageActivity[]> {
  const { data, error } = await supabase
    .from('usage_logs')
    .select('id,asset_id,date,value,unit,notes')
    .eq('owner_id', ownerId)
    .order('date', { ascending: false })
    .limit(5);

  if (error) throw error;
  return (data || []) as UsageActivity[];
}

async function fetchRecentMaintenance(ownerId: string): Promise<MaintenanceActivity[]> {
  const { data, error } = await supabase
    .from('maintenance_entries')
    .select('id,asset_id,date,category,cost,notes')
    .eq('owner_id', ownerId)
    .order('date', { ascending: false })
    .limit(5);

  if (error) throw error;
  return (data || []) as MaintenanceActivity[];
}

async function fetchRecentDowntime(ownerId: string): Promise<DowntimeActivity[]> {
  const { data, error } = await supabase
    .from('downtime_events')
    .select('id,asset_id,start_date,reason,end_date,notes')
    .eq('owner_id', ownerId)
    .order('start_date', { ascending: false })
    .limit(5);

  if (error) throw error;
  return (data || []) as DowntimeActivity[];
}

async function fetchRecentActivity(ownerId: string) {
  const [usage, maintenance, downtime] = await Promise.all([
    fetchRecentUsage(ownerId),
    fetchRecentMaintenance(ownerId),
    fetchRecentDowntime(ownerId),
  ]);

  return { usage, maintenance, downtime };
}

export function useDashboard() {
  const { session } = useAuth();
  const ownerId = session?.user.id;
  const {
    assets: alertAssets,
    overdueAlerts,
    dueSoonAlerts,
    totalAssets,
    isLoading: isSignalsLoading,
    isError: isSignalsError,
    errorMessage: signalsErrorMessage,
  } = useAlerts();
  const {
    assets: assetsWithStatus,
    isLoading: isAssetsLoading,
    isError: isAssetsError,
    errorMessage: assetsErrorMessage,
  } = useAssets();

  const recentQuery = useQuery({
    queryKey: ['dashboard-recent-activity', ownerId],
    queryFn: () => fetchRecentActivity(ownerId as string),
    enabled: Boolean(ownerId),
  });

  const assetsById = useMemo(
    () => new Map(alertAssets.map((asset) => [asset.id, asset.name])),
    [alertAssets],
  );

  const recentActivity = useMemo<DashboardActivity[]>(() => {
    const usageItems: DashboardActivity[] = (recentQuery.data?.usage || []).map((row) => ({
      id: `usage-${row.id}`,
      kind: 'usage',
      assetId: row.asset_id,
      assetName: assetsById.get(row.asset_id) || 'Unknown asset',
      summary: `Usage +${Number(row.value)} ${row.unit}${row.notes ? ` • ${row.notes}` : ''}`,
      dateLabel: formatDateTimeLabel(row.date),
      sortDate: row.date,
    }));

    const maintenanceItems: DashboardActivity[] = (recentQuery.data?.maintenance || []).map((row) => ({
      id: `maintenance-${row.id}`,
      kind: 'maintenance',
      assetId: row.asset_id,
      assetName: assetsById.get(row.asset_id) || 'Unknown asset',
      summary: `${row.category}${row.cost ? ` • ${formatMoney(Number(row.cost))}` : ''}${row.notes ? ` • ${row.notes}` : ''}`,
      dateLabel: formatDateTimeLabel(row.date),
      sortDate: row.date,
    }));

    const downtimeItems: DashboardActivity[] = (recentQuery.data?.downtime || []).map((row) => ({
      id: `downtime-${row.id}`,
      kind: 'downtime',
      assetId: row.asset_id,
      assetName: assetsById.get(row.asset_id) || 'Unknown asset',
      summary: `${row.reason}${row.end_date ? ' • Closed' : ' • Active'}${row.notes ? ` • ${row.notes}` : ''}`,
      dateLabel: formatDateTimeLabel(row.start_date),
      sortDate: row.start_date,
    }));

    return [...usageItems, ...maintenanceItems, ...downtimeItems]
      .sort((a, b) => new Date(b.sortDate).getTime() - new Date(a.sortDate).getTime())
      .slice(0, 5);
  }, [recentQuery.data, assetsById]);

  const attention = useMemo(() => [...overdueAlerts, ...dueSoonAlerts].slice(0, 5), [overdueAlerts, dueSoonAlerts]);
  const overdueAssetCount = useMemo(() => new Set(overdueAlerts.map((item) => item.assetId)).size, [overdueAlerts]);
  const dueSoonAssetCount = useMemo(() => {
    const overdueIds = new Set(overdueAlerts.map((item) => item.assetId));
    return new Set(dueSoonAlerts.map((item) => item.assetId).filter((id) => !overdueIds.has(id))).size;
  }, [overdueAlerts, dueSoonAlerts]);

  const healthScore = useMemo(() => {
    if (totalAssets === 0) return 100;
    const weightedIssues = overdueAssetCount * 2 + dueSoonAssetCount;
    const maxWeight = Math.max(totalAssets * 2, 1);
    const ratio = Math.min(weightedIssues / maxWeight, 1);
    return Math.max(0, Math.min(100, Math.round((1 - ratio) * 100)));
  }, [totalAssets, overdueAssetCount, dueSoonAssetCount]);

  const assetPreview = useMemo(
    () =>
      [...assetsWithStatus]
        .sort((a, b) => statusRank[a.status] - statusRank[b.status] || a.name.localeCompare(b.name))
        .slice(0, 4),
    [assetsWithStatus],
  );

  return {
    totalAssets,
    overdueCount: overdueAssetCount,
    dueSoonCount: dueSoonAssetCount,
    healthScore,
    assetPreview,
    attention,
    recentActivity,
    isLoading: isSignalsLoading || isAssetsLoading || recentQuery.isLoading,
    isError: isSignalsError || isAssetsError || recentQuery.isError,
    errorMessage:
      signalsErrorMessage ||
      assetsErrorMessage ||
      (recentQuery.error as Error | null)?.message ||
      '',
  };
}
