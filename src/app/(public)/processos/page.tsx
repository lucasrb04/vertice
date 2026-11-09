import { permanentRedirect } from "next/navigation";

/** A lista virou a página inicial (D51); links já divulgados de `/processos` seguem funcionando. */
export default async function ProcessosRedirect({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(await searchParams)) {
    for (const v of Array.isArray(value) ? value : value === undefined ? [] : [value]) query.append(key, v);
  }
  const qs = query.toString();
  permanentRedirect(qs ? `/?${qs}` : "/");
}
