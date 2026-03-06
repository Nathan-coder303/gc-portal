import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export default async function Home() {
  const session = await auth();
  if (!session) redirect("/login");

  // Find the first project for this user's company
  const project = await prisma.project.findFirst({
    where: { companyId: session.user.companyId },
  });

  if (!project) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-gray-500">No projects found. Contact your administrator.</p>
      </div>
    );
  }

  redirect(`/${session.user.companyId}/${project.id}/dashboard`);
}
