import type { Metadata } from "next";
import { AuthProvider } from "@/components/auth/AuthProvider";

export const metadata: Metadata = {
  title: "Steady Hands Challenge: FirstShare",
  description: "A 14-day challenge on live market prices, scored on discipline, not luck.",
};

export default function ChallengeLayout({ children }: { children: React.ReactNode }) {
  return <AuthProvider>{children}</AuthProvider>;
}
