import { Crown, Gem, Medal, Sparkles } from "lucide-react";

export const VIP_TIERS = {
  silver: { label: "Silver VIP", icon: Medal, className: "bg-muted text-foreground ring-border" },
  golden: {
    label: "Golden VIP",
    icon: Crown,
    className: "gold-gradient ring-transparent",
  },
  diamond: {
    label: "Diamond VIP",
    icon: Gem,
    className: "bg-primary-soft text-primary ring-primary/30",
  },
} as const;

export type VipTier = keyof typeof VIP_TIERS;

export function VipBadge({
  tier,
  className = "",
}: {
  tier: string | null | undefined;
  className?: string;
}) {
  const conf = tier && tier in VIP_TIERS ? VIP_TIERS[tier as VipTier] : null;
  if (!conf) return null;
  const Icon = conf.icon;
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-bold ring-1 ${conf.className} ${className}`}
    >
      <Icon className="h-3.5 w-3.5" />
      {conf.label}
    </span>
  );
}

export function VipTierHint() {
  return (
    <p className="inline-flex items-center gap-1 text-xs text-muted-foreground">
      <Sparkles className="h-3.5 w-3.5" /> Earn Silver, Golden and Diamond badges by scoring higher
      with clean, flag-free attempts.
    </p>
  );
}
