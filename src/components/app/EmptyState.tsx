import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

interface Props {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: ReactNode;
}

const EmptyState = ({ icon: Icon, title, description, action }: Props) => (
  <div className="flex flex-col items-center rounded-md border border-dashed bg-card/50 px-6 py-14 text-center">
    <Icon className="mb-4 h-8 w-8 text-muted-foreground/60" strokeWidth={1.25} />
    <h3 className="font-serif text-lg">{title}</h3>
    {description && <p className="mt-1 max-w-sm text-sm text-muted-foreground">{description}</p>}
    {action && <div className="mt-5">{action}</div>}
  </div>
);

export default EmptyState;
