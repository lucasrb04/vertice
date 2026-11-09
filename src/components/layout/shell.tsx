import { cn } from "@/lib/utils";

/** A única largura de casca do site: cabeçalho, listas, Kanban e páginas de leitura partem dela. */
export function Shell({ className, children }: { className?: string; children: React.ReactNode }) {
  return <div className={cn("mx-auto w-full max-w-[1320px] px-4 sm:px-6", className)}>{children}</div>;
}
