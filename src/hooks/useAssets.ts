import { useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../supabaseClient';
import { useAuth } from './useAuth';
import type { AssetRow, AssetType, MaintenanceRuleRow, UsageUnit } from '../lib/types';
import { getAssetStatus } from '../lib/rules';

type CreateAssetPayload = {
  name: string;
  type: AssetType;
  identifier?: string;
  usageUnit: UsageUnit;
  currentUsage: number;
};

export type AssetView = AssetRow & {
  status: 'overdue' | 'due_soon' | 'ok';
  nextDueLabel: string;
};

async function fetchAssets(ownerId: string): Promise<AssetRow[]> {
  const { data, error } = await supabase
    .from('assets')
    .select('*')
    .eq('owner_id', ownerId)
    .order('created_at', { ascending: false });

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

export function useAssets() {
  const { session } = useAuth();
  const queryClient = useQueryClient();
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

  const createAssetMutation = useMutation({
    mutationFn: async (payload: CreateAssetPayload) => {
      const insertPayload = {
        name: payload.name,
        type: payload.type,
        identifier: payload.identifier?.trim() || null,
        usage_unit: payload.usageUnit,
        current_usage: payload.currentUsage,
      };

      const { data, error } = await supabase
        .from('assets')
        .insert(insertPayload)
        .select('*')
        .single();

      if (error) throw error;
      return data as AssetRow;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['assets', ownerId] });
    },
  });

  const assets = useMemo<AssetView[]>(() => {
    const rows = assetsQuery.data || [];
    const rules = rulesQuery.data || [];

    return rows.map((asset) => {
      const assetRules = rules.filter((rule) => rule.asset_id === asset.id);
      const agg = getAssetStatus(assetRules, Number(asset.current_usage || 0));
      return {
        ...asset,
        status: agg.status,
        nextDueLabel: agg.nextDueLabel,
      };
    });
  }, [assetsQuery.data, rulesQuery.data]);

  return {
    assets,
    isLoading: assetsQuery.isLoading || rulesQuery.isLoading,
    isError: assetsQuery.isError || rulesQuery.isError,
    errorMessage:
      (assetsQuery.error as Error | null)?.message ||
      (rulesQuery.error as Error | null)?.message ||
      '',
    createAsset: createAssetMutation,
  };
}
