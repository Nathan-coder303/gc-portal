import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import PantryClient from "./PantryClient";

// Hidden personal grocery/pantry page. Not linked from anywhere; accessible
// only if you know the URL. Auth-protected via the standard middleware.
export const dynamic = "force-dynamic";

export default async function PantryPage() {
  const session = await auth();
  if (!session) redirect("/login");

  return <PantryClient />;
}
