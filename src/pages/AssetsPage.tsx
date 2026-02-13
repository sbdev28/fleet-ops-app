import { useState } from 'react';
import { Card } from '../components/ui/Card';
import { Input } from '../components/ui/Input';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';

export function AssetsPage() {
  const [search, setSearch] = useState('');

  return (
    <section className="space-y-4">
      <Card className="space-y-3">
        <Input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search assets by name or identifier"
          aria-label="Search assets"
        />
        <div className="flex flex-wrap gap-3">
          <Button variant="ghost" className="rounded-lg px-3 text-xs">
            Type
          </Button>
          <Button variant="ghost" className="rounded-lg px-3 text-xs">
            Status
          </Button>
          <Button variant="ghost" className="rounded-lg px-3 text-xs">
            Unit
          </Button>
        </div>
      </Card>

      <Card className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <p className="text-lg font-semibold text-fleet-white">No assets yet</p>
          <Badge tone="neutral">Empty</Badge>
        </div>
        <p className="text-sm text-fleet-light">Create your first asset to begin usage, maintenance, and downtime tracking.</p>
        <Button block>Add Asset</Button>
      </Card>
    </section>
  );
}
