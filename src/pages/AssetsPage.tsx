import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Input } from '../components/ui/Input';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { EmptyStateCard } from '../components/cards/EmptyStateCard';
import { AssetCard } from '../components/cards/AssetCard';
import { ErrorCard } from '../components/cards/ErrorCard';
import { Sheet } from '../components/ui/Sheet';
import { useAssets } from '../hooks/useAssets';
import { useToast } from '../components/ui/Toast';
import type { AssetType, UsageUnit } from '../lib/types';
import { Skeleton } from '../components/ui/Skeleton';

const assetTypes: AssetType[] = ['marine', 'vehicle', 'equipment', 'other'];
const usageUnits: UsageUnit[] = ['hours', 'miles', 'runtime', 'cycles'];
type StatusFilter = 'all' | 'overdue' | 'due_soon' | 'ok';

export function AssetsPage() {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const { assets, isLoading, isError, errorMessage, createAsset } = useAssets();
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<AssetType | 'all'>('all');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [openCreate, setOpenCreate] = useState(false);

  const [name, setName] = useState('');
  const [assetType, setAssetType] = useState<AssetType>('marine');
  const [identifier, setIdentifier] = useState('');
  const [usageUnit, setUsageUnit] = useState<UsageUnit>('hours');
  const [currentUsage, setCurrentUsage] = useState('0');

  const filtered = assets.filter((asset) => {
    const q = search.trim().toLowerCase();
    const passesSearch =
      !q ||
      asset.name.toLowerCase().includes(q) ||
      asset.type.toLowerCase().includes(q) ||
      (asset.identifier || '').toLowerCase().includes(q);

    const passesType = typeFilter === 'all' || asset.type === typeFilter;
    const passesStatus = statusFilter === 'all' || asset.status === statusFilter;

    return passesSearch && passesType && passesStatus;
  });

  const submitCreate = async () => {
    const normalizedName = name.trim();
    const usageValue = Number(currentUsage);

    if (!normalizedName) {
      showToast('Asset name is required', 'danger');
      return;
    }
    if (!Number.isFinite(usageValue) || usageValue < 0) {
      showToast('Current usage must be a non-negative number', 'danger');
      return;
    }

    try {
      await createAsset.mutateAsync({
        name: normalizedName,
        type: assetType,
        identifier,
        usageUnit,
        currentUsage: usageValue,
      });

      setOpenCreate(false);
      setName('');
      setIdentifier('');
      setCurrentUsage('0');
      setAssetType('marine');
      setUsageUnit('hours');
      showToast('Asset created', 'info');
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Failed to create asset';
      showToast(msg, 'danger');
    }
  };

  return (
    <section className="space-y-4">
      <Card className="space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1">
            <p className="text-xs tracking-[0.18em] text-fleet-mid">ASSET COMMAND</p>
            <h2 className="fleet-text-metal text-lg font-semibold text-fleet-white">All Assets</h2>
            <p className="text-sm text-fleet-light">Search and filter your operational fleet inventory.</p>
          </div>
          <Button className="px-3 text-xs" onClick={() => setOpenCreate(true)}>
            Add Asset
          </Button>
        </div>

        <Input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search assets by name or identifier"
          aria-label="Search assets"
        />

        <div className="flex gap-3 overflow-x-auto pb-1">
          <Button
            variant={statusFilter === 'all' ? 'primary' : 'ghost'}
            className="shrink-0 rounded-lg px-3 text-xs"
            onClick={() => setStatusFilter('all')}
          >
            All Status
          </Button>
          <Button
            variant={statusFilter === 'overdue' ? 'primary' : 'ghost'}
            className="shrink-0 rounded-lg px-3 text-xs"
            onClick={() => setStatusFilter('overdue')}
          >
            Overdue
          </Button>
          <Button
            variant={statusFilter === 'due_soon' ? 'primary' : 'ghost'}
            className="shrink-0 rounded-lg px-3 text-xs"
            onClick={() => setStatusFilter('due_soon')}
          >
            Due Soon
          </Button>
          <Button
            variant={statusFilter === 'ok' ? 'primary' : 'ghost'}
            className="shrink-0 rounded-lg px-3 text-xs"
            onClick={() => setStatusFilter('ok')}
          >
            On Track
          </Button>
        </div>

        <div className="flex gap-3 overflow-x-auto pb-1">
          <Button
            variant={typeFilter === 'all' ? 'primary' : 'ghost'}
            className="shrink-0 rounded-lg px-3 text-xs"
            onClick={() => setTypeFilter('all')}
          >
            All Types
          </Button>
          {assetTypes.map((type) => (
            <Button
              key={type}
              variant={typeFilter === type ? 'primary' : 'ghost'}
              className="shrink-0 rounded-lg px-3 text-xs capitalize"
              onClick={() => setTypeFilter(type)}
            >
              {type}
            </Button>
          ))}
        </div>
      </Card>

      {isError ? (
        <ErrorCard message={errorMessage || 'Unable to load assets'} />
      ) : isLoading ? (
        <div className="space-y-4 lg:grid lg:grid-cols-2 lg:gap-4 lg:space-y-0">
          <Card className="space-y-3">
            <Skeleton className="h-5 w-1/3" />
            <Skeleton className="h-20" />
          </Card>
          <Card className="space-y-3">
            <Skeleton className="h-5 w-1/3" />
            <Skeleton className="h-20" />
          </Card>
        </div>
      ) : assets.length === 0 ? (
        <EmptyStateCard
          title="No assets yet"
          message="Create your first asset to begin usage, maintenance, and downtime tracking."
          actionLabel="Add Asset"
          onAction={() => setOpenCreate(true)}
        />
      ) : filtered.length === 0 ? (
        <EmptyStateCard
          title="No assets found"
          message="Try a different search or create a new asset."
          actionLabel="Add Asset"
          onAction={() => setOpenCreate(true)}
        />
      ) : (
        <div className="space-y-4 lg:grid lg:grid-cols-2 lg:gap-4 lg:space-y-0">
          {filtered.map((asset) => (
            <AssetCard
              key={asset.id}
              name={asset.name}
              type={asset.type}
              currentUsage={Number(asset.current_usage)}
              usageUnit={asset.usage_unit}
              status={asset.status}
              nextDue={asset.nextDueLabel}
              onOpen={() => navigate(`/assets/${asset.id}`)}
            />
          ))}
        </div>
      )}

      <Sheet open={openCreate} title="Add Asset" onClose={() => setOpenCreate(false)}>
        <div className="space-y-4">
          <label className="block space-y-2">
            <span className="text-sm text-fleet-light">Name</span>
            <Input value={name} onChange={(event) => setName(event.target.value)} placeholder="Asset name" />
          </label>

          <label className="block space-y-2">
            <span className="text-sm text-fleet-light">Identifier</span>
            <Input
              value={identifier}
              onChange={(event) => setIdentifier(event.target.value)}
              placeholder="Hull, VIN, serial (optional)"
            />
          </label>

          <div className="grid grid-cols-2 gap-3">
            <label className="block space-y-2">
              <span className="text-sm text-fleet-light">Type</span>
              <select
                className="fleet-field tap"
                value={assetType}
                onChange={(event) => setAssetType(event.target.value as AssetType)}
              >
                {assetTypes.map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>
            </label>

            <label className="block space-y-2">
              <span className="text-sm text-fleet-light">Usage Unit</span>
              <select
                className="fleet-field tap"
                value={usageUnit}
                onChange={(event) => setUsageUnit(event.target.value as UsageUnit)}
              >
                {usageUnits.map((unit) => (
                  <option key={unit} value={unit}>
                    {unit}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <label className="block space-y-2">
            <span className="text-sm text-fleet-light">Current Usage</span>
            <Input
              type="number"
              min="0"
              step="0.1"
              value={currentUsage}
              onChange={(event) => setCurrentUsage(event.target.value)}
            />
          </label>

          <Button block onClick={submitCreate} disabled={createAsset.isPending}>
            {createAsset.isPending ? 'Creating...' : 'Create Asset'}
          </Button>
        </div>
      </Sheet>
    </section>
  );
}
