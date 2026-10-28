"use client";
import { Button, Card } from "@/components/ui";
export default function ErrorPage({
  reset,
}: {
  error: Error;
  reset: () => void;
}) {
  return (
    <Card>
      <h1 className="mb-3 text-lg font-semibold">Не удалось открыть раздел</h1>
      <p className="mb-4 text-sm text-[#71829b]">
        Повторите загрузку. Если ошибка сохраняется, проверьте доступность API.
      </p>
      <Button onClick={reset}>Попробовать снова</Button>
    </Card>
  );
}
