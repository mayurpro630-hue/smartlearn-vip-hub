import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { RefreshCw, Save } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { recomputeVipTiers } from "@/lib/admin.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { VipBadge } from "@/components/VipBadge";

type TierRow = {
  tier: string;
  label: string;
  min_score: number;
  min_tests: number;
  max_flags: number;
  rank: number;
  enabled: boolean;
};

export function VipSettings() {
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState<Record<string, TierRow>>({});
  const [busy, setBusy] = useState(false);

  const tiers = useQuery({
    queryKey: ["vip-tiers"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vip_tiers")
        .select("tier, label, min_score, min_tests, max_flags, rank, enabled")
        .order("rank");
      if (error) throw error;
      return (data ?? []) as TierRow[];
    },
  });

  useEffect(() => {
    if (tiers.data) {
      setDraft(Object.fromEntries(tiers.data.map((t) => [t.tier, t])));
    }
  }, [tiers.data]);

  const rows = tiers.data ?? [];

  function patch(tier: string, key: keyof TierRow, value: number | boolean) {
    setDraft((d) => ({ ...d, [tier]: { ...d[tier]!, [key]: value } }));
  }

  async function saveAll() {
    setBusy(true);
    for (const row of Object.values(draft)) {
      const { error } = await supabase
        .from("vip_tiers")
        .update({
          min_score: Math.max(0, Number(row.min_score) || 0),
          min_tests: Math.max(0, Number(row.min_tests) || 0),
          max_flags: Math.max(0, Number(row.max_flags) || 0),
          enabled: row.enabled,
        })
        .eq("tier", row.tier);
      if (error) {
        setBusy(false);
        toast.error("Could not save VIP criteria");
        return;
      }
    }
    const res = await recomputeVipTiers();
    setBusy(false);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    toast.success(`Criteria saved · ${res.updated} student records re-evaluated`);
    queryClient.invalidateQueries();
  }

  return (
    <div className="space-y-4">
      <section className="surface-card p-5">
        <h2 className="font-bold">VIP badge criteria</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          A student is awarded the highest tier whose criteria they meet, using their official
          (first-attempt) records only. Practice retakes never count.
        </p>
      </section>

      {rows.map((row) => {
        const d = draft[row.tier] ?? row;
        return (
          <section key={row.tier} className="surface-card space-y-3 p-5">
            <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
              <VipBadge tier={row.tier} />
              <div className="flex shrink-0 items-center gap-2">
                <Label htmlFor={`enabled-${row.tier}`} className="text-xs text-muted-foreground">
                  Active
                </Label>
                <Switch
                  id={`enabled-${row.tier}`}
                  checked={d.enabled}
                  onCheckedChange={(v) => patch(row.tier, "enabled", v)}
                />
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="space-y-1">
                <Label htmlFor={`score-${row.tier}`} className="text-xs">
                  Minimum total marks
                </Label>
                <Input
                  id={`score-${row.tier}`}
                  type="number"
                  min={0}
                  value={d.min_score}
                  onChange={(e) => patch(row.tier, "min_score", Number(e.target.value))}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor={`tests-${row.tier}`} className="text-xs">
                  Minimum tests completed
                </Label>
                <Input
                  id={`tests-${row.tier}`}
                  type="number"
                  min={0}
                  value={d.min_tests}
                  onChange={(e) => patch(row.tier, "min_tests", Number(e.target.value))}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor={`flags-${row.tier}`} className="text-xs">
                  Max anti-cheating flags
                </Label>
                <Input
                  id={`flags-${row.tier}`}
                  type="number"
                  min={0}
                  value={d.max_flags}
                  onChange={(e) => patch(row.tier, "max_flags", Number(e.target.value))}
                />
              </div>
            </div>
          </section>
        );
      })}

      <div className="flex flex-wrap gap-2">
        <Button onClick={saveAll} disabled={busy || rows.length === 0}>
          <Save className="h-4 w-4" /> {busy ? "Saving…" : "Save & re-evaluate badges"}
        </Button>
        <Button
          variant="outline"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            const res = await recomputeVipTiers();
            setBusy(false);
            if (!res.ok) {
              toast.error(res.error);
              return;
            }
            toast.success(`${res.updated} student records re-evaluated`);
            queryClient.invalidateQueries();
          }}
        >
          <RefreshCw className="h-4 w-4" /> Re-evaluate now
        </Button>
      </div>
    </div>
  );
}
