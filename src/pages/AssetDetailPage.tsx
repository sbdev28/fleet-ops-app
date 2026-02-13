import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useToast } from '../components/ui/Toast';
import { AssetDetailHeaderCard } from '../components/cards/AssetDetailHeaderCard';
import { RuleCard } from '../components/cards/RuleCard';
import { TimelineCards } from '../components/cards/TimelineCards';
import { useAssetDetail } from '../hooks/useAssetDetail';
import { EmptyStateCard } from '../components/cards/EmptyStateCard';
import { ErrorCard } from '../components/cards/ErrorCard';
import { Skeleton } from '../components/ui/Skeleton';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Sheet } from '../components/ui/Sheet';
import type { MaintenanceRuleRow } from '../lib/types';
import { downloadCsv } from '../lib/csv';

type TriggerUnit = MaintenanceRuleRow['trigger_unit'];

const triggerUnits: TriggerUnit[] = ['hours', 'miles', 'runtime', 'cycles', 'days'];

function toDateTimeInput(isoValue: string | null): string {
  if (!isoValue) return '';

  const date = new Date(isoValue);
  if (Number.isNaN(date.getTime())) return '';

  const yyyy = date.getFullYear();
  const mm = `${date.getMonth() + 1}`.padStart(2, '0');
  const dd = `${date.getDate()}`.padStart(2, '0');
  const hh = `${date.getHours()}`.padStart(2, '0');
  const min = `${date.getMinutes()}`.padStart(2, '0');

  return `${yyyy}-${mm}-${dd}T${hh}:${min}`;
}

export function AssetDetailPage() {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const highlightedRuleId = searchParams.get('ruleId');
  const navigate = useNavigate();
  const { showToast } = useToast();
  const {
    asset,
    assetStatus,
    rules,
    ruleCards,
    timelineItems,
    isLoading,
    isError,
    errorMessage,
    createRule,
    updateRule,
    exportTimelineCsv,
  } = useAssetDetail(id);

  const [openRuleSheet, setOpenRuleSheet] = useState(false);
  const [editingRuleId, setEditingRuleId] = useState<string | null>(null);
  const [triggerUnit, setTriggerUnit] = useState<TriggerUnit>('hours');
  const [intervalValue, setIntervalValue] = useState('100');
  const [baselineValue, setBaselineValue] = useState('');
  const [baselineDate, setBaselineDate] = useState('');

  const rulesById = useMemo(() => new Map(rules.map((rule) => [rule.id, rule])), [rules]);

  const upcomingRuleCards = useMemo(
    () =>
      ruleCards.filter(
        (rule) =>
          rule.status === 'overdue' ||
          rule.status === 'due_soon' ||
          rule.status === 'baseline',
      ),
    [ruleCards],
  );

  useEffect(() => {
    if (!highlightedRuleId) return;
    const el = document.getElementById(`rule-${highlightedRuleId}`);
    if (!el) return;

    const timer = window.setTimeout(() => {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 100);

    return () => window.clearTimeout(timer);
  }, [highlightedRuleId, ruleCards.length]);

  if (isError) {
    return <ErrorCard message={errorMessage || 'Unable to load asset detail'} />;
  }

  if (isLoading) {
    return (
      <section className="space-y-4">
        <Card className="space-y-3">
          <Skeleton className="h-6 w-2/3" />
          <Skeleton className="h-5 w-1/3" />
          <Skeleton className="h-20" />
        </Card>
        <Card className="space-y-3">
          <Skeleton className="h-5 w-1/2" />
          <Skeleton className="h-16" />
        </Card>
      </section>
    );
  }

  if (!asset) {
    return <ErrorCard message="Asset not found or access denied." />;
  }

  const openCreateRule = () => {
    setEditingRuleId(null);
    setTriggerUnit(asset.usage_unit);
    setIntervalValue('100');
    setBaselineValue('');
    setBaselineDate('');
    setOpenRuleSheet(true);
  };

  const openEditRule = (rule: MaintenanceRuleRow) => {
    setEditingRuleId(rule.id);
    setTriggerUnit(rule.trigger_unit);
    setIntervalValue(`${Number(rule.interval_value)}`);
    setBaselineValue(
      rule.last_completed_value !== null ? `${Number(rule.last_completed_value)}` : '',
    );
    setBaselineDate(toDateTimeInput(rule.last_completed_date));
    setOpenRuleSheet(true);
  };

  const submitRule = async () => {
    const intervalNumber = Number(intervalValue);

    if (!Number.isFinite(intervalNumber) || intervalNumber <= 0) {
      showToast('Interval must be greater than zero', 'danger');
      return;
    }

    let nextBaselineValue: number | null = null;
    let nextBaselineDate: string | null = null;

    if (triggerUnit === 'days') {
      if (baselineDate) {
        const parsed = new Date(baselineDate);
        if (Number.isNaN(parsed.getTime())) {
          showToast('Baseline date is invalid', 'danger');
          return;
        }
        nextBaselineDate = parsed.toISOString();
      }
    } else if (baselineValue.trim()) {
      const parsed = Number(baselineValue);
      if (!Number.isFinite(parsed) || parsed < 0) {
        showToast('Baseline value must be a non-negative number', 'danger');
        return;
      }
      nextBaselineValue = parsed;
    }

    try {
      const payload = {
        id: editingRuleId || undefined,
        triggerUnit,
        intervalValue: intervalNumber,
        lastCompletedValue: nextBaselineValue,
        lastCompletedDate: nextBaselineDate,
      };

      if (editingRuleId) {
        await updateRule.mutateAsync(payload);
        showToast('Rule updated', 'info');
      } else {
        await createRule.mutateAsync(payload);
        showToast('Rule created', 'info');
      }

      setOpenRuleSheet(false);
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Failed to save rule';
      showToast(msg, 'danger');
    }
  };

  const isSavingRule = createRule.isPending || updateRule.isPending;

  const handleExport = async () => {
    try {
      const result = await exportTimelineCsv.mutateAsync();
      downloadCsv(result.filename, result.csv);
      showToast('Timeline CSV exported', 'info');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to export CSV';
      showToast(message, 'danger');
    }
  };

  return (
    <section className="space-y-4">
      <AssetDetailHeaderCard
        name={asset.name}
        identifier={asset.identifier || undefined}
        status={assetStatus.status}
        currentUsage={Number(asset.current_usage)}
        usageUnit={asset.usage_unit}
        isExporting={exportTimelineCsv.isPending}
        onLog={() => navigate(`/log?assetId=${asset.id}`)}
        onExport={handleExport}
      />

      <div className="space-y-4 lg:grid lg:grid-cols-[1.05fr_1fr] lg:gap-4 lg:space-y-0">
        <div className="space-y-4">
          <Card className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <h2 className="fleet-text-metal text-lg font-semibold text-fleet-white">Rules</h2>
              <Button variant="ghost" className="px-3 text-xs" onClick={openCreateRule}>
                Add Rule
              </Button>
            </div>

            {ruleCards.length === 0 ? (
              <EmptyStateCard
                title="No maintenance rules"
                message="Add a rule to activate due-soon and overdue tracking."
                actionLabel="Create Rule"
                onAction={openCreateRule}
              />
            ) : (
              <div className="space-y-4">
                {ruleCards.map((rule) => (
                  <div key={rule.id} id={`rule-${rule.id}`}>
                    <RuleCard
                      triggerUnit={rule.triggerUnit}
                      intervalValue={rule.intervalValue}
                      lastCompleted={rule.lastCompleted}
                      status={rule.status}
                      highlighted={rule.id === highlightedRuleId}
                      onEdit={() => {
                        const nextRule = rulesById.get(rule.id);
                        if (!nextRule) return;
                        openEditRule(nextRule);
                      }}
                    />
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>

        <div className="space-y-4">
          <Card className="space-y-3">
            <h2 className="fleet-text-metal text-lg font-semibold text-fleet-white">Upcoming</h2>
            {upcomingRuleCards.length === 0 ? (
              <div className="fleet-panel-subtle rounded-xl border border-fleet-mid p-3">
                <p className="text-sm text-fleet-light">No overdue or due-soon rules.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {upcomingRuleCards.map((rule) => (
                  <div key={rule.id}>
                    <RuleCard
                      triggerUnit={rule.triggerUnit}
                      intervalValue={rule.intervalValue}
                      lastCompleted={rule.lastCompleted}
                      status={rule.status}
                      highlighted={rule.id === highlightedRuleId}
                      onEdit={() => {
                        const nextRule = rulesById.get(rule.id);
                        if (!nextRule) return;
                        openEditRule(nextRule);
                      }}
                    />
                  </div>
                ))}
              </div>
            )}
          </Card>

          <Card className="space-y-3">
            <h2 className="fleet-text-metal text-lg font-semibold text-fleet-white">Timeline</h2>
            <TimelineCards items={timelineItems} />
          </Card>
        </div>
      </div>

      <Sheet
        open={openRuleSheet}
        title={editingRuleId ? 'Edit Maintenance Rule' : 'Create Maintenance Rule'}
        onClose={() => setOpenRuleSheet(false)}
      >
        <div className="space-y-4">
          <label className="block space-y-2">
            <span className="text-sm text-fleet-light">Trigger Unit</span>
            <select
              className="fleet-field tap"
              value={triggerUnit}
              onChange={(event) => setTriggerUnit(event.target.value as TriggerUnit)}
            >
              {triggerUnits.map((unit) => (
                <option key={unit} value={unit}>
                  {unit}
                </option>
              ))}
            </select>
          </label>

          <label className="block space-y-2">
            <span className="text-sm text-fleet-light">Interval Value</span>
            <Input
              type="number"
              min="0.1"
              step="0.1"
              value={intervalValue}
              onChange={(event) => setIntervalValue(event.target.value)}
            />
          </label>

          {triggerUnit === 'days' ? (
            <label className="block space-y-2">
              <span className="text-sm text-fleet-light">Baseline Date (optional)</span>
              <Input
                type="datetime-local"
                value={baselineDate}
                onChange={(event) => setBaselineDate(event.target.value)}
              />
            </label>
          ) : (
            <label className="block space-y-2">
              <span className="text-sm text-fleet-light">Baseline Value (optional)</span>
              <Input
                type="number"
                min="0"
                step="0.1"
                value={baselineValue}
                onChange={(event) => setBaselineValue(event.target.value)}
              />
            </label>
          )}

          <Button block onClick={submitRule} disabled={isSavingRule}>
            {isSavingRule ? 'Saving...' : editingRuleId ? 'Save Rule' : 'Create Rule'}
          </Button>
        </div>
      </Sheet>
    </section>
  );
}
