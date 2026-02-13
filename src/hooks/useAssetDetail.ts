import { useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../supabaseClient';
import { useAuth } from './useAuth';
import type {
  AssetRow,
  DowntimeEventRow,
  MaintenanceEntryRow,
  MaintenanceRuleRow,
  UsageLogRow,
} from '../lib/types';
import { getAssetStatus, getRuleStatus } from '../lib/rules';
import { formatDateTimeLabel, formatMoney } from '../lib/format';
import { toCsv, toSafeFilename } from '../lib/csv';
import type { TimelineItem } from '../components/cards/TimelineCards';

export type RuleMutationPayload = {
  id?: string;
  triggerUnit: MaintenanceRuleRow['trigger_unit'];
  intervalValue: number;
  lastCompletedValue: number | null;
  lastCompletedDate: string | null;
};

async function fetchAsset(assetId: string): Promise<AssetRow | null> {
  const { data, error } = await supabase.from('assets').select('*').eq('id', assetId).maybeSingle();
  if (error) throw error;
  return (data as AssetRow | null) ?? null;
}

async function fetchRules(assetId: string): Promise<MaintenanceRuleRow[]> {
  const { data, error } = await supabase
    .from('maintenance_rules')
    .select('*')
    .eq('asset_id', assetId)
    .order('interval_value', { ascending: true });

  if (error) throw error;
  return (data || []) as MaintenanceRuleRow[];
}

async function fetchUsageLogs(assetId: string): Promise<UsageLogRow[]> {
  const { data, error } = await supabase
    .from('usage_logs')
    .select('*')
    .eq('asset_id', assetId)
    .order('date', { ascending: false })
    .limit(20);

  if (error) throw error;
  return (data || []) as UsageLogRow[];
}

async function fetchMaintenanceEntries(assetId: string): Promise<MaintenanceEntryRow[]> {
  const { data, error } = await supabase
    .from('maintenance_entries')
    .select('*')
    .eq('asset_id', assetId)
    .order('date', { ascending: false })
    .limit(20);

  if (error) throw error;
  return (data || []) as MaintenanceEntryRow[];
}

async function fetchDowntimeEvents(assetId: string): Promise<DowntimeEventRow[]> {
  const { data, error } = await supabase
    .from('downtime_events')
    .select('*')
    .eq('asset_id', assetId)
    .order('start_date', { ascending: false })
    .limit(20);

  if (error) throw error;
  return (data || []) as DowntimeEventRow[];
}

async function fetchAllUsageLogs(assetId: string): Promise<UsageLogRow[]> {
  const { data, error } = await supabase
    .from('usage_logs')
    .select('*')
    .eq('asset_id', assetId)
    .order('date', { ascending: true });

  if (error) throw error;
  return (data || []) as UsageLogRow[];
}

async function fetchAllMaintenanceEntries(assetId: string): Promise<MaintenanceEntryRow[]> {
  const { data, error } = await supabase
    .from('maintenance_entries')
    .select('*')
    .eq('asset_id', assetId)
    .order('date', { ascending: true });

  if (error) throw error;
  return (data || []) as MaintenanceEntryRow[];
}

async function fetchAllDowntimeEvents(assetId: string): Promise<DowntimeEventRow[]> {
  const { data, error } = await supabase
    .from('downtime_events')
    .select('*')
    .eq('asset_id', assetId)
    .order('start_date', { ascending: true });

  if (error) throw error;
  return (data || []) as DowntimeEventRow[];
}

export function useAssetDetail(assetId: string | undefined) {
  const { session } = useAuth();
  const queryClient = useQueryClient();
  const ownerId = session?.user.id;
  const enabled = Boolean(ownerId && assetId);

  const assetQuery = useQuery({
    queryKey: ['asset', ownerId, assetId],
    queryFn: () => fetchAsset(assetId as string),
    enabled,
  });

  const rulesQuery = useQuery({
    queryKey: ['asset-rules', ownerId, assetId],
    queryFn: () => fetchRules(assetId as string),
    enabled,
  });

  const usageQuery = useQuery({
    queryKey: ['asset-usage-logs', ownerId, assetId],
    queryFn: () => fetchUsageLogs(assetId as string),
    enabled,
  });

  const maintenanceQuery = useQuery({
    queryKey: ['asset-maintenance-entries', ownerId, assetId],
    queryFn: () => fetchMaintenanceEntries(assetId as string),
    enabled,
  });

  const downtimeQuery = useQuery({
    queryKey: ['asset-downtime-events', ownerId, assetId],
    queryFn: () => fetchDowntimeEvents(assetId as string),
    enabled,
  });

  const timelineItems = useMemo<TimelineItem[]>(() => {
    const usageItems: Array<TimelineItem & { sortDate: string }> = (usageQuery.data || []).map((row) => ({
      id: `usage-${row.id}`,
      type: 'usage',
      dateLabel: formatDateTimeLabel(row.date),
      summary: `Usage +${Number(row.value)} ${row.unit}${row.notes ? ` • ${row.notes}` : ''}`,
      sortDate: row.date,
    }));

    const maintenanceItems: Array<TimelineItem & { sortDate: string }> = (maintenanceQuery.data || []).map((row) => ({
      id: `maintenance-${row.id}`,
      type: 'maintenance',
      dateLabel: formatDateTimeLabel(row.date),
      summary: `${row.category}${row.cost ? ` • ${formatMoney(Number(row.cost))}` : ''}${row.notes ? ` • ${row.notes}` : ''}`,
      sortDate: row.date,
    }));

    const downtimeItems: Array<TimelineItem & { sortDate: string }> = (downtimeQuery.data || []).map((row) => ({
      id: `downtime-${row.id}`,
      type: 'downtime',
      dateLabel: formatDateTimeLabel(row.start_date),
      summary: `${row.reason}${row.end_date ? ' • Closed' : ' • Active'}${row.notes ? ` • ${row.notes}` : ''}`,
      sortDate: row.start_date,
    }));

    return [...usageItems, ...maintenanceItems, ...downtimeItems]
      .sort((a, b) => new Date(b.sortDate).getTime() - new Date(a.sortDate).getTime())
      .map(({ sortDate: _sortDate, ...item }) => item);
  }, [usageQuery.data, maintenanceQuery.data, downtimeQuery.data]);

  const assetStatus = useMemo(() => {
    if (!assetQuery.data) return { status: 'ok' as const, nextDueLabel: 'No rules' };
    return getAssetStatus(rulesQuery.data || [], Number(assetQuery.data.current_usage || 0));
  }, [assetQuery.data, rulesQuery.data]);

  const ruleCards = useMemo(() => {
    const asset = assetQuery.data;
    if (!asset) return [];
    return (rulesQuery.data || []).map((rule) => ({
      id: rule.id,
      triggerUnit: rule.trigger_unit,
      intervalValue: Number(rule.interval_value),
      lastCompleted:
        rule.trigger_unit === 'days'
          ? rule.last_completed_date
            ? formatDateTimeLabel(rule.last_completed_date)
            : 'Not set'
          : rule.last_completed_value !== null
            ? `${Number(rule.last_completed_value)} ${rule.trigger_unit}`
            : 'Not set',
      status: getRuleStatus(rule, Number(asset.current_usage || 0)),
    }));
  }, [rulesQuery.data, assetQuery.data]);

  const isLoading =
    assetQuery.isLoading ||
    rulesQuery.isLoading ||
    usageQuery.isLoading ||
    maintenanceQuery.isLoading ||
    downtimeQuery.isLoading;

  const isError =
    assetQuery.isError ||
    rulesQuery.isError ||
    usageQuery.isError ||
    maintenanceQuery.isError ||
    downtimeQuery.isError;

  const errorMessage =
    (assetQuery.error as Error | null)?.message ||
    (rulesQuery.error as Error | null)?.message ||
    (usageQuery.error as Error | null)?.message ||
    (maintenanceQuery.error as Error | null)?.message ||
    (downtimeQuery.error as Error | null)?.message ||
    '';

  const createRule = useMutation({
    mutationFn: async (payload: RuleMutationPayload) => {
      if (!ownerId || !assetId) {
        throw new Error('Session or asset context is missing');
      }

      const { error } = await supabase.from('maintenance_rules').insert({
        asset_id: assetId,
        owner_id: ownerId,
        trigger_unit: payload.triggerUnit,
        interval_value: payload.intervalValue,
        last_completed_value: payload.triggerUnit === 'days' ? null : payload.lastCompletedValue,
        last_completed_date: payload.triggerUnit === 'days' ? payload.lastCompletedDate : null,
      });

      if (error) throw error;
      return assetId;
    },
    onSuccess: (nextAssetId) => {
      queryClient.invalidateQueries({ queryKey: ['asset-rules', ownerId, nextAssetId] });
      queryClient.invalidateQueries({ queryKey: ['maintenance-rules', ownerId] });
      queryClient.invalidateQueries({ queryKey: ['assets', ownerId] });
    },
  });

  const updateRule = useMutation({
    mutationFn: async (payload: RuleMutationPayload) => {
      if (!ownerId || !assetId || !payload.id) {
        throw new Error('Rule update context is missing');
      }

      const { error } = await supabase
        .from('maintenance_rules')
        .update({
          trigger_unit: payload.triggerUnit,
          interval_value: payload.intervalValue,
          last_completed_value: payload.triggerUnit === 'days' ? null : payload.lastCompletedValue,
          last_completed_date: payload.triggerUnit === 'days' ? payload.lastCompletedDate : null,
        })
        .eq('id', payload.id)
        .eq('asset_id', assetId)
        .eq('owner_id', ownerId);

      if (error) throw error;
      return assetId;
    },
    onSuccess: (nextAssetId) => {
      queryClient.invalidateQueries({ queryKey: ['asset-rules', ownerId, nextAssetId] });
      queryClient.invalidateQueries({ queryKey: ['maintenance-rules', ownerId] });
      queryClient.invalidateQueries({ queryKey: ['assets', ownerId] });
    },
  });

  const exportTimelineCsv = useMutation({
    mutationFn: async () => {
      if (!assetId) {
        throw new Error('Asset context is missing');
      }

      const [usageLogs, maintenanceEntries, downtimeEvents] = await Promise.all([
        fetchAllUsageLogs(assetId),
        fetchAllMaintenanceEntries(assetId),
        fetchAllDowntimeEvents(assetId),
      ]);

      const assetName = assetQuery.data?.name || 'Asset';

      const rows = [
        ...usageLogs.map((row) => ({
          sortDate: row.date,
          sortType: 'usage',
          sortId: row.id,
          event_type: 'usage',
          event_timestamp: row.date,
          event_end_timestamp: '',
          asset_id: assetId,
          asset_name: assetName,
          usage_value: `${Number(row.value)}`,
          usage_unit: row.unit,
          maintenance_category: '',
          maintenance_cost: '',
          downtime_reason: '',
          downtime_status: '',
          notes: row.notes || '',
          attachment_url: '',
        })),
        ...maintenanceEntries.map((row) => ({
          sortDate: row.date,
          sortType: 'maintenance',
          sortId: row.id,
          event_type: 'maintenance',
          event_timestamp: row.date,
          event_end_timestamp: '',
          asset_id: assetId,
          asset_name: assetName,
          usage_value: '',
          usage_unit: '',
          maintenance_category: row.category,
          maintenance_cost: row.cost !== null ? `${Number(row.cost)}` : '',
          downtime_reason: '',
          downtime_status: '',
          notes: row.notes || '',
          attachment_url: row.attachment_url || '',
        })),
        ...downtimeEvents.map((row) => ({
          sortDate: row.start_date,
          sortType: 'downtime',
          sortId: row.id,
          event_type: 'downtime',
          event_timestamp: row.start_date,
          event_end_timestamp: row.end_date || '',
          asset_id: assetId,
          asset_name: assetName,
          usage_value: '',
          usage_unit: '',
          maintenance_category: '',
          maintenance_cost: '',
          downtime_reason: row.reason,
          downtime_status: row.end_date ? 'closed' : 'active',
          notes: row.notes || '',
          attachment_url: '',
        })),
      ]
        .sort((a, b) => {
          const timeCompare = new Date(a.sortDate).getTime() - new Date(b.sortDate).getTime();
          if (timeCompare !== 0) return timeCompare;
          const typeCompare = a.sortType.localeCompare(b.sortType);
          if (typeCompare !== 0) return typeCompare;
          return a.sortId.localeCompare(b.sortId);
        })
        .map(({ sortDate: _sortDate, sortType: _sortType, sortId: _sortId, ...rest }) => rest);

      const headers = [
        'event_type',
        'event_timestamp',
        'event_end_timestamp',
        'asset_id',
        'asset_name',
        'usage_value',
        'usage_unit',
        'maintenance_category',
        'maintenance_cost',
        'downtime_reason',
        'downtime_status',
        'notes',
        'attachment_url',
      ];

      return {
        filename: `${toSafeFilename(assetName)}-timeline.csv`,
        csv: toCsv(headers, rows),
      };
    },
  });

  return {
    asset: assetQuery.data,
    assetStatus,
    rules: rulesQuery.data || [],
    ruleCards,
    timelineItems,
    isLoading,
    isError,
    errorMessage,
    createRule,
    updateRule,
    exportTimelineCsv,
  };
}
