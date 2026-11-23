import type { Metadata } from "next";
import { Studio } from "@/components/Studio";

export const metadata: Metadata = { title: "Studio" };

export default function DashboardPage() {
  return <Studio />;
}
