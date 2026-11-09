import type { Metadata } from "next";
import Link from "next/link";
import { AuthCard } from "@/components/auth/auth-card";

export const metadata: Metadata = { title: "Privacy Policy" };

export default function Page() {
  return (
    <AuthCard title="Privacy Policy" subtitle="Aurum Ventura Enterprise LLC">
      <p className="text-sm text-muted-foreground">Our Privacy Policy is being finalized and will be published here. To ask about it now, use the demo form on the home page.</p>
      <Link href="/#demo" className="mt-4 inline-block text-sm text-primary underline">Back to the demo form</Link>
    </AuthCard>
  );
}
