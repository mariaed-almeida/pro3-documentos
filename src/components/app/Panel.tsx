import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface Props {
  title?: string;
  description?: string;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
}

/** Bloco com título em serifa; substitui o "card com sombra" genérico. */
const Panel = ({ title, description, actions, children, className, bodyClassName }: Props) => (
  <section className={cn("rounded-md border bg-card", className)}>
    {(title || actions) && (
      <div className="flex items-start justify-between gap-4 border-b px-5 py-4">
        <div>
          {title && <h2 className="font-serif text-lg leading-tight">{title}</h2>}
          {description && <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>}
        </div>
        {actions}
      </div>
    )}
    <div className={cn("p-5", bodyClassName)}>{children}</div>
  </section>
);

export default Panel;
