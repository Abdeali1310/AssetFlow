import Link from "next/link";
import { cn } from "@/lib/utils";

interface KpiCardProps {
  title: string;
  value: number;
  icon: React.ComponentType<{ className?: string }>;
  colorVariant: "primary" | "success" | "warning" | "destructive" | "muted";
  href?: string;
  index?: number;
}

const variantStyles: Record<
  KpiCardProps["colorVariant"],
  { iconBg: string; iconText: string }
> = {
  primary: { iconBg: "bg-primary/10", iconText: "text-primary" },
  success: { iconBg: "bg-success/10", iconText: "text-success" },
  warning: { iconBg: "bg-warning/10", iconText: "text-warning" },
  destructive: {
    iconBg: "bg-destructive/10",
    iconText: "text-destructive",
  },
  muted: { iconBg: "bg-muted", iconText: "text-muted-foreground" },
};

export function KpiCard({
  title,
  value,
  icon: Icon,
  colorVariant,
  href,
  index = 0,
}: KpiCardProps) {
  const styles = variantStyles[colorVariant];

  const content = (
    <div
      className={cn(
        "rounded-lg border border-border bg-card p-5 transition-all",
        href && "hover:shadow-md hover:border-border/80 cursor-pointer"
      )}
      style={{
        animationDelay: `${index * 80}ms`,
        animationFillMode: "backwards",
      }}
    >
      <div className="flex items-start justify-between">
        <div className="space-y-2">
          <p className="text-sm font-medium text-muted-foreground">{title}</p>
          <p className="text-3xl font-bold tracking-tight text-foreground">
            {value}
          </p>
        </div>
        <div
          className={cn(
            "flex h-10 w-10 items-center justify-center rounded-full",
            styles.iconBg
          )}
        >
          <Icon className={cn("h-5 w-5", styles.iconText)} />
        </div>
      </div>
    </div>
  );

  if (href) {
    return (
      <Link href={href} className="block animate-in fade-in slide-in-from-bottom-2">
        {content}
      </Link>
    );
  }

  return (
    <div className="animate-in fade-in slide-in-from-bottom-2">{content}</div>
  );
}
