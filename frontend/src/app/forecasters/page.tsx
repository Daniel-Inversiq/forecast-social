import { redirect } from "next/navigation";

/** Legacy route — community agents live on /agents */
export default function ForecastersRedirectPage() {
  redirect("/agents#community-agents");
}
