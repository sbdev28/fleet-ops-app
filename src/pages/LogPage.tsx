import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Sheet } from '../components/ui/Sheet';
import { useToast } from '../components/ui/Toast';
import { useLogWizard } from '../hooks/useLogWizard';
import { EmptyStateCard } from '../components/cards/EmptyStateCard';
import { ErrorCard } from '../components/cards/ErrorCard';
import { Skeleton } from '../components/ui/Skeleton';

type LogType = 'usage' | 'maintenance' | 'downtime';

function asLogType(value: string | null): LogType | null {
  if (value === 'usage' || value === 'maintenance' || value === 'downtime') {
    return value;
  }
  return null;
}

export function LogPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const preselectedAssetId = searchParams.get('assetId') || '';
  const preselectedLogType = asLogType(searchParams.get('type'));
  const [logType, setLogType] = useState<LogType>(preselectedLogType || 'usage');
  const [open, setOpen] = useState(false);
  const [autoOpenedFromQuery, setAutoOpenedFromQuery] = useState(false);

  const [assetId, setAssetId] = useState(preselectedAssetId);
  const [value, setValue] = useState('');
  const [date, setDate] = useState('');
  const [notes, setNotes] = useState('');
  const [category, setCategory] = useState('General');
  const [cost, setCost] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [reason, setReason] = useState('');

  const { showToast } = useToast();
  const { assets, isLoadingAssets, assetsError, addUsageLog, addMaintenanceLog, addDowntimeLog } =
    useLogWizard();

  const selectedAsset = useMemo(() => assets.find((item) => item.id === assetId) || null, [assets, assetId]);

  useEffect(() => {
    if (!preselectedLogType || autoOpenedFromQuery || isLoadingAssets || open || assets.length === 0) {
      return;
    }
    setLogType(preselectedLogType);
    if (!assetId) {
      setAssetId(assets[0].id);
    }
    setOpen(true);
    setAutoOpenedFromQuery(true);
  }, [preselectedLogType, autoOpenedFromQuery, isLoadingAssets, open, assets, assetId]);

  const startLog = (type: LogType) => {
    setLogType(type);
    if (!assetId && assets.length > 0) {
      setAssetId(assets[0].id);
    }
    setOpen(true);
  };

  const clearForm = () => {
    setValue('');
    setDate('');
    setNotes('');
    setCategory('General');
    setCost('');
    setStartDate('');
    setEndDate('');
    setReason('');
  };

  const isSubmitting = addUsageLog.isPending || addMaintenanceLog.isPending || addDowntimeLog.isPending;

  const submitLog = async () => {
    if (!assetId) {
      showToast('Select an asset first', 'danger');
      return;
    }

    try {
      if (logType === 'usage') {
        const numeric = Number(value);
        if (!Number.isFinite(numeric) || numeric <= 0) {
          showToast('Usage value must be greater than zero', 'danger');
          return;
        }
        await addUsageLog.mutateAsync({
          assetId,
          value: numeric,
          date: date || undefined,
          notes,
        });
      } else if (logType === 'maintenance') {
        const normalizedCategory = category.trim();
        if (!normalizedCategory) {
          showToast('Category is required', 'danger');
          return;
        }
        const numericCost = cost.trim() === '' ? null : Number(cost);
        if (numericCost !== null && (!Number.isFinite(numericCost) || numericCost < 0)) {
          showToast('Cost must be empty or a non-negative number', 'danger');
          return;
        }
        await addMaintenanceLog.mutateAsync({
          assetId,
          category: normalizedCategory,
          cost: numericCost,
          date: date || undefined,
          notes,
        });
      } else {
        const normalizedReason = reason.trim();
        if (!startDate) {
          showToast('Start date is required', 'danger');
          return;
        }
        if (!normalizedReason) {
          showToast('Reason is required', 'danger');
          return;
        }
        await addDowntimeLog.mutateAsync({
          assetId,
          startDate,
          endDate: endDate || undefined,
          reason: normalizedReason,
          notes,
        });
      }

      clearForm();
      setOpen(false);
      showToast('Log recorded', 'info');
      navigate(`/assets/${assetId}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to submit log';
      showToast(message, 'danger');
    }
  };

  return (
    <section className="space-y-4">
      <Card className="space-y-3">
        <div className="space-y-1">
          <p className="text-xs tracking-[0.18em] text-fleet-mid">LOG WIZARD</p>
          <h2 className="fleet-text-metal text-lg font-semibold text-fleet-white">Record Activity</h2>
          <p className="text-sm text-fleet-light">Select a log type and complete the flow in under 30 seconds.</p>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <Button
            className="text-xs"
            variant={logType === 'usage' ? 'primary' : 'ghost'}
            onClick={() => startLog('usage')}
            block
          >
            Usage
          </Button>
          <Button
            className="text-xs"
            variant={logType === 'maintenance' ? 'primary' : 'ghost'}
            onClick={() => startLog('maintenance')}
            block
          >
            Maintenance
          </Button>
          <Button
            className="text-xs"
            variant={logType === 'downtime' ? 'primary' : 'ghost'}
            onClick={() => startLog('downtime')}
            block
          >
            Downtime
          </Button>
        </div>
      </Card>

      {assetsError ? <ErrorCard message={assetsError} /> : null}

      {isLoadingAssets ? (
        <Card className="space-y-3">
          <Skeleton className="h-5 w-1/2" />
          <Skeleton className="h-16" />
        </Card>
      ) : assets.length === 0 ? (
        <EmptyStateCard
          title="No assets available"
          message="Create an asset first, then return here to log usage, maintenance, or downtime."
          actionLabel="Go to Assets"
          onAction={() => navigate('/assets')}
        />
      ) : (
        <Card className="space-y-3">
          {selectedAsset ? (
            <div className="fleet-panel-subtle rounded-xl border border-fleet-mid p-3">
              <p className="text-xs tracking-wide text-fleet-mid">SELECTED ASSET</p>
              <p className="text-sm font-semibold text-fleet-white">{selectedAsset.name}</p>
              <p className="text-xs text-fleet-light capitalize">
                {selectedAsset.type} • {Number(selectedAsset.current_usage)} {selectedAsset.usage_unit}
              </p>
            </div>
          ) : (
            <p className="text-sm text-fleet-light">Select an asset in the log form to continue.</p>
          )}
        </Card>
      )}

      <Sheet open={open} title="Create Log" onClose={() => setOpen(false)}>
        <div className="space-y-4">
          <label className="block space-y-2">
            <span className="text-sm text-fleet-light">Asset</span>
            <select
              className="fleet-field tap"
              value={assetId}
              onChange={(event) => setAssetId(event.target.value)}
            >
              <option value="">Select asset</option>
              {assets.map((asset) => (
                <option key={asset.id} value={asset.id}>
                  {asset.name}
                </option>
              ))}
            </select>
          </label>

          <p className="text-sm text-fleet-light">
            Type: <span className="font-semibold capitalize text-fleet-white">{logType}</span>
          </p>

          {logType === 'usage' ? (
            <label className="block space-y-2">
              <span className="text-sm text-fleet-light">Usage Added</span>
              <input
                type="number"
                min="0.1"
                step="0.1"
                className="fleet-field tap"
                value={value}
                onChange={(event) => setValue(event.target.value)}
              />
            </label>
          ) : null}

          {logType === 'maintenance' ? (
            <>
              <label className="block space-y-2">
                <span className="text-sm text-fleet-light">Category</span>
                <input
                  type="text"
                  className="fleet-field tap"
                  value={category}
                  onChange={(event) => setCategory(event.target.value)}
                />
              </label>
              <label className="block space-y-2">
                <span className="text-sm text-fleet-light">Cost (optional)</span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  className="fleet-field tap"
                  value={cost}
                  onChange={(event) => setCost(event.target.value)}
                />
              </label>
            </>
          ) : null}

          {logType === 'downtime' ? (
            <>
              <label className="block space-y-2">
                <span className="text-sm text-fleet-light">Reason</span>
                <input
                  type="text"
                  className="fleet-field tap"
                  value={reason}
                  onChange={(event) => setReason(event.target.value)}
                />
              </label>
              <label className="block space-y-2">
                <span className="text-sm text-fleet-light">Start Date</span>
                <input
                  type="datetime-local"
                  className="fleet-field tap"
                  value={startDate}
                  onChange={(event) => setStartDate(event.target.value)}
                />
              </label>
              <label className="block space-y-2">
                <span className="text-sm text-fleet-light">End Date (optional)</span>
                <input
                  type="datetime-local"
                  className="fleet-field tap"
                  value={endDate}
                  onChange={(event) => setEndDate(event.target.value)}
                />
              </label>
            </>
          ) : null}

          {logType !== 'downtime' ? (
            <label className="block space-y-2">
              <span className="text-sm text-fleet-light">Date (optional)</span>
              <input
                type="datetime-local"
                className="fleet-field tap"
                value={date}
                onChange={(event) => setDate(event.target.value)}
              />
            </label>
          ) : null}

          <label className="block space-y-2">
            <span className="text-sm text-fleet-light">Notes (optional)</span>
            <textarea
              className="fleet-field min-h-[96px] p-3"
              rows={3}
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
            />
          </label>

          <Button block onClick={submitLog} disabled={isSubmitting}>
            {isSubmitting ? 'Saving...' : 'Save Log'}
          </Button>
        </div>
      </Sheet>
    </section>
  );
}
