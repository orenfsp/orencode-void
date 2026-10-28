import { Skeleton } from "@/components/ui";
export default function Loading() {
  return (
    <div aria-label="Загрузка" className="space-y-4">
      <Skeleton className="h-8 w-64" />
      <Skeleton className="h-40" />
      <Skeleton className="h-40" />
    </div>
  );
}
