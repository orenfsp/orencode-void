"use client";
import { Button, Card, Field, Input } from "@/components/ui";
import { Brand } from "@/components/public-shell";
import { api, type AuthUser } from "@/lib/api";
import { NAV } from "@/lib/nav";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { useState } from "react";
import { z } from "zod";
import { ArrowLeft, ShieldCheck } from "lucide-react";
import Link from "next/link";
const schema = z.object({
  email: z.string().email("Укажите корректный email"),
  password: z.string().min(8, "Минимум 8 символов"),
});
export default function LoginPage() {
  const router = useRouter();
  const [error, setError] = useState("");
  const form = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: { email: "", password: "" },
  });
  return (
    <main className="grid min-h-screen place-items-center bg-[#f5f9ff] px-4 py-12">
      <div className="w-full max-w-md">
        <div className="mb-9 flex justify-center">
          <Brand />
        </div>
        <Card className="p-8">
          <h1 className="text-2xl font-semibold">Рады видеть вас</h1>
          <p className="mt-2 text-sm text-[#71829b]">
            Войдите в личный кабинет платформы
          </p>
          <form
            className="mt-7 space-y-5"
            onSubmit={form.handleSubmit(async (values) => {
              setError("");
              try {
                const user = await api<AuthUser>("/auth/login", {
                  method: "POST",
                  body: JSON.stringify(values),
                });
                const next = new URLSearchParams(window.location.search).get(
                  "next",
                );
                router.push(
                  next?.startsWith("/") &&
                    !next.startsWith("//") &&
                    !next.includes("\\")
                    ? next
                    : (NAV[user.activeRole]?.[0]?.href ?? "/dashboard"),
                );
              } catch (e) {
                setError(e instanceof Error ? e.message : "Ошибка входа");
              }
            })}
          >
            <Field label="Электронная почта">
              <Input
                type="email"
                autoComplete="username"
                placeholder="name@example.ru"
                {...form.register("email")}
              />
            </Field>
            {form.formState.errors.email && (
              <p className="text-xs text-red-600">
                {form.formState.errors.email.message}
              </p>
            )}
            <Field label="Пароль">
              <Input
                type="password"
                autoComplete="current-password"
                {...form.register("password")}
              />
            </Field>
            {form.formState.errors.password && (
              <p className="text-xs text-red-600">
                {form.formState.errors.password.message}
              </p>
            )}
            {error && (
              <p
                role="alert"
                className="rounded-lg bg-red-50 p-3 text-sm text-red-700"
              >
                {error}
              </p>
            )}
            <Button
              type="submit"
              className="w-full py-3"
              disabled={form.formState.isSubmitting}
            >
              {form.formState.isSubmitting ? "Входим…" : "Войти"}
            </Button>
          </form>
          <div className="mt-6 flex items-start gap-2 text-xs leading-relaxed text-[#8492a8]">
            <ShieldCheck size={17} className="shrink-0" />
            Учётную запись и роли назначает федерация. Данные тестовых
            пользователей приведены в README проекта.
          </div>
        </Card>
        <Link
          href="/"
          className="mt-7 flex items-center justify-center gap-2 text-sm text-[#71829b]"
        >
          <ArrowLeft size={15} />
          Вернуться на главную
        </Link>
      </div>
    </main>
  );
}
