export type AssetType = 'marine' | 'vehicle' | 'equipment' | 'other';
export type UsageUnit = 'hours' | 'miles' | 'runtime' | 'cycles';

export type AssetRow = {
  id: string;
  owner_id: string;
  name: string;
  type: AssetType;
  identifier: string | null;
  current_usage: number;
  usage_unit: UsageUnit;
  created_at: string;
};

export type MaintenanceRuleRow = {
  id: string;
  asset_id: string;
  owner_id: string;
  trigger_unit: UsageUnit | 'days';
  interval_value: number;
  last_completed_value: number | null;
  last_completed_date: string | null;
};

export type UsageLogRow = {
  id: string;
  asset_id: string;
  owner_id: string;
  date: string;
  value: number;
  unit: string;
  notes: string | null;
};

export type MaintenanceEntryRow = {
  id: string;
  asset_id: string;
  owner_id: string;
  date: string;
  category: string;
  cost: number | null;
  notes: string | null;
  attachment_url: string | null;
};

export type DowntimeEventRow = {
  id: string;
  asset_id: string;
  owner_id: string;
  start_date: string;
  end_date: string | null;
  reason: string;
  notes: string | null;
};
