import { auth } from "@/auth";
import { redirect } from "next/navigation";

import DashboardShell from "@/components/dashboard-shell";


export default async function DashboardPage() {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  return (
    <DashboardShell
      user={{
        name: session.user.name,
        email: session.user.email,
        image: session.user.image,
      }}
    />
  );
}