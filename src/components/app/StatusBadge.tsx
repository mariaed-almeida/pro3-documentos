import { cn } from "@/lib/utils";
import { statusOf } from "@/lib/status";

interface Props {
  status: string;
  className?: string;
  withIcon?: boolean;
}

const StatusBadge = ({ status, className, withIcon = true }: Props) => {
  const meta = statusOf(status);
  const Icon = meta.icon;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-sm border px-2 py-0.5 text-xs font-medium whitespace-nowrap",
        meta.badge,
        className,
      )}
    >
      {withIcon && <Icon className="h-3 w-3" aria-hidden />}
      {meta.label}
    </span>
  );
};

export default StatusBadge;
