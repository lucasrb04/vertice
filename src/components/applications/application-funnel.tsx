import { type ApplicationStatus, funnelSteps } from "@/lib/applications/labels";
import { cn } from "@/lib/utils";

/** Posição da candidatura no funil; a etapa atual leva `aria-current="step"`. */
export function ApplicationFunnel({ status }: { status: ApplicationStatus }) {
  return (
    <ol aria-label="Etapas da candidatura" className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-sm sm:gap-x-2">
      {funnelSteps(status).map((step, i) => (
        <li
          key={step.label}
          aria-current={step.state === "current" ? "step" : undefined}
          className={cn(
            "flex items-center gap-1.5",
            step.state === "current" && "font-bold text-ink",
            step.state === "done" && "text-ink-2",
            step.state === "upcoming" && "text-ink-3",
          )}
        >
          {/* No celular o funil quebra linha; sem o traço, nenhuma linha começa com um conector solto. */}
          {i > 0 && <span aria-hidden="true" className="hidden h-px w-5 bg-line-strong sm:block" />}
          <span
            aria-hidden="true"
            className={cn(
              "rounded-full",
              step.state === "current" && "size-3 bg-ipe ring-2 ring-ink",
              step.state === "done" && "size-2.5 bg-ink-2",
              step.state === "upcoming" && "size-2.5 border border-line-strong bg-surface",
            )}
          />
          {step.label}
          {step.state === "done" && <span className="sr-only">, concluída</span>}
        </li>
      ))}
    </ol>
  );
}
