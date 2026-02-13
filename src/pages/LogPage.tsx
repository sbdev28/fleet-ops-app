import { useState } from 'react';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Sheet } from '../components/ui/Sheet';
import { useToast } from '../components/ui/Toast';

type LogType = 'usage' | 'maintenance' | 'downtime';

export function LogPage() {
  const [logType, setLogType] = useState<LogType>('usage');
  const [open, setOpen] = useState(false);
  const { showToast } = useToast();

  const startLog = (type: LogType) => {
    setLogType(type);
    setOpen(true);
  };

  const submitStub = () => {
    setOpen(false);
    showToast('Log draft captured. Full form wiring is next in Step 6.', 'info');
  };

  return (
    <section className="space-y-4">
      <Card className="space-y-3">
        <p className="text-lg font-semibold text-fleet-white">Log Type</p>
        <div className="grid grid-cols-3 gap-3">
          <Button className="text-xs" onClick={() => startLog('usage')} block>
            Usage
          </Button>
          <Button className="text-xs" variant="ghost" onClick={() => startLog('maintenance')} block>
            Maintenance
          </Button>
          <Button className="text-xs" variant="ghost" onClick={() => startLog('downtime')} block>
            Downtime
          </Button>
        </div>
      </Card>

      <Card>
        <p className="text-sm text-fleet-light">Keep logs short in mobile flow: select type, select asset, submit in under 30 seconds.</p>
      </Card>

      <Sheet open={open} title="Create Log" onClose={() => setOpen(false)}>
        <div className="space-y-4">
          <p className="text-sm text-fleet-light">
            Selected type: <span className="font-semibold text-fleet-white capitalize">{logType}</span>
          </p>
          <p className="text-sm text-fleet-light">Step 6 will add the final 6-field form and Supabase writes.</p>
          <Button block onClick={submitStub}>
            Continue
          </Button>
        </div>
      </Sheet>
    </section>
  );
}
