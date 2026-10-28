import { PublicFooter, PublicHeader } from "@/components/public-shell";
export default function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <PublicHeader />
      <div className="min-h-[70vh]">{children}</div>
      <PublicFooter />
    </>
  );
}
