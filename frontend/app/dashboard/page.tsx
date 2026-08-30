import { auth } from "@/auth";
import { redirect } from "next/navigation";

import DashboardShell from "@/components/dashboard-shell";


export default async function DashboardPage() {
  const session = await auth();

  const user = session?.user || {
    name: "Dev User",
    email: "dev@contextswitch.ai",
    image: "",
  };

  return (
    <DashboardShell
      user={{
        name: user.name,
        email: user.email,
        image: user.image,
      }}
    />
  );
}