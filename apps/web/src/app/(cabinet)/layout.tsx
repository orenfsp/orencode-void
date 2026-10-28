import { Shell } from "@/components/shell";

export default function CabinetLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <Shell>{children}</Shell>;
}
