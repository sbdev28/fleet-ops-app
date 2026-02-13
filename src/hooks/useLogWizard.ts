import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../supabaseClient';
import { useAuth } from './useAuth';
import type { AssetRow } from '../lib/types';

type UsagePayload = {
  assetId: string;
  value: number;
  date?: string;
  notes?: string;
};

type MaintenancePayload = {
  assetId: string;
  category: string;
  cost?: number | null;
  date?: string;
  notes?: string;
};

type DowntimePayload = {
  assetId: string;
  startDate: string;
  endDate?: string;
  reason: string;
  notes?: string;
};

async function fetchAssets(ownerId: string): Promise<AssetRow[]> {
  const { data, error } = await supabase
    .from('assets')
    .select('*')
    .eq('owner_id', ownerId)
    .order('name', { ascending: true });

  if (error) throw error;
  return (data || []) as AssetRow[];
}

function cleanText(value: string | undefined): string | null {
  const out = (value || '').trim();
  return out.length ? out : null;
}

export function useLogWizard() {
  const { session } = useAuth();
  const ownerId = session?.user.id;
  const queryClient = useQueryClient();

  const assetsQuery = useQuery({
    queryKey: ['log-assets', ownerId],
    queryFn: () => fetchAssets(ownerId as string),
    enabled: Boolean(ownerId),
  });

  const usageMutation = useMutation({
    mutationFn: async (payload: UsagePayload) => {
      const nowIso = payload.date || new Date().toISOString();

      const { data: asset, error: assetError } = await supabase
        .from('assets')
        .select('id,current_usage,usage_unit')
        .eq('id', payload.assetId)
        .eq('owner_id', ownerId as string)
        .single();

      if (assetError) throw assetError;

      const { error: insertError } = await supabase.from('usage_logs').insert({
        asset_id: payload.assetId,
        owner_id: ownerId,
        date: nowIso,
        value: payload.value,
        unit: asset.usage_unit,
        notes: cleanText(payload.notes),
      });
      if (insertError) throw insertError;

      const { error: updateError } = await supabase
        .from('assets')
        .update({ current_usage: Number(asset.current_usage) + payload.value })
        .eq('id', payload.assetId)
        .eq('owner_id', ownerId as string);

      if (updateError) throw updateError;

      return payload.assetId;
    },
    onSuccess: (assetId) => {
      queryClient.invalidateQueries({ queryKey: ['assets', ownerId] });
      queryClient.invalidateQueries({ queryKey: ['log-assets', ownerId] });
      queryClient.invalidateQueries({ queryKey: ['asset', ownerId, assetId] });
      queryClient.invalidateQueries({ queryKey: ['asset-usage-logs', ownerId, assetId] });
    },
  });

  const maintenanceMutation = useMutation({
    mutationFn: async (payload: MaintenancePayload) => {
      const nowIso = payload.date || new Date().toISOString();
      const { error } = await supabase.from('maintenance_entries').insert({
        asset_id: payload.assetId,
        owner_id: ownerId,
        date: nowIso,
        category: payload.category.trim(),
        cost: typeof payload.cost === 'number' && Number.isFinite(payload.cost) ? payload.cost : null,
        notes: cleanText(payload.notes),
      });
      if (error) throw error;
      return payload.assetId;
    },
    onSuccess: (assetId) => {
      queryClient.invalidateQueries({ queryKey: ['asset-maintenance-entries', ownerId, assetId] });
      queryClient.invalidateQueries({ queryKey: ['asset', ownerId, assetId] });
      queryClient.invalidateQueries({ queryKey: ['assets', ownerId] });
    },
  });

  const downtimeMutation = useMutation({
    mutationFn: async (payload: DowntimePayload) => {
      const { error } = await supabase.from('downtime_events').insert({
        asset_id: payload.assetId,
        owner_id: ownerId,
        start_date: payload.startDate,
        end_date: cleanText(payload.endDate),
        reason: payload.reason.trim(),
        notes: cleanText(payload.notes),
      });
      if (error) throw error;
      return payload.assetId;
    },
    onSuccess: (assetId) => {
      queryClient.invalidateQueries({ queryKey: ['asset-downtime-events', ownerId, assetId] });
      queryClient.invalidateQueries({ queryKey: ['asset', ownerId, assetId] });
      queryClient.invalidateQueries({ queryKey: ['assets', ownerId] });
    },
  });

  return {
    assets: assetsQuery.data || [],
    isLoadingAssets: assetsQuery.isLoading,
    assetsError: (assetsQuery.error as Error | null)?.message || '',
    addUsageLog: usageMutation,
    addMaintenanceLog: maintenanceMutation,
    addDowntimeLog: downtimeMutation,
  };
}
