import {
  Briefcase,
  Building2,
  Coins,
  FileText,
  Gavel,
  HeartHandshake,
  Landmark,
  Lightbulb,
  Scale,
  ShieldCheck,
  Users,
  type LucideIcon,
} from "lucide-react";

const ICONS: Record<string, LucideIcon> = {
  scale: Scale,
  building: Building2,
  land: Landmark,
  family: HeartHandshake,
  criminal: ShieldCheck,
  labor: Users,
  ip: Lightbulb,
  tax: Coins,
  litigation: Gavel,
  contract: FileText,
  advisory: Briefcase,
};

export function PracticeIcon({
  name,
  className,
}: {
  name: string;
  className?: string;
}) {
  const Icon = ICONS[name] ?? Scale;
  return <Icon className={className} aria-hidden />;
}

export const practiceIconNames = Object.keys(ICONS);
