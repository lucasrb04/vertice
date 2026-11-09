import { type ApplicationStatus, funnelSteps } from "@/lib/applications/labels";
import { cn } from "@/lib/utils";

/** Posição da candidatura no funil; a etapa atual leva `aria-current="step"`. */
export function ApplicationFunnel({ status }: { status: ApplicationStatus }) {
  return (
    <ol aria-label="Etapas da candidatura" className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs sm:gap-x-2">
      {funnelSteps(status).map((step, i) => (
        <li
          key={step.label}
          aria-current={step.state === "current" ? "step" : undefined}
          className={cn(
            "flex items-center gap-1.5",
            step.state === "current" && "font-medium text-stone-900",
            step.state === "done" && "text-stone-600",
            step.state === "upcoming" && "text-stone-500",
          )}
        >
          {/* No celular o funil quebra linha; sem o traço, nenhuma linha começa com um conector solto. */}
          {i > 0 && <span aria-hidden="true" className="hidden h-px w-4 bg-stone-300 sm:block" />}
          <span
            aria-hidden="true"
            className={cn(
              "size-2 rounded-full",
              step.state === "current" && "bg-brand",
              step.state === "done" && "bg-stone-400",
              step.state === "upcoming" && "border border-stone-300 bg-white",
            )}
          />
          {step.label}
          {step.state === "done" && <span className="sr-only">, concluída</span>}
        </li>
      ))}
    </ol>
  );
}
