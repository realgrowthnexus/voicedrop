import type { Metadata } from "next";
import { StudioClient } from "@/components/StudioClient";

export const metadata: Metadata = { title: "Studio" };

export default function DashboardPage() {
  return <StudioClient />;
}
