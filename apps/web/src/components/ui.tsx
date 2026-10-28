"use client";
import { cn } from "@/lib/utils";
import {
  useEffect,
  useRef,
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from "react";

export function Button({
  className,
  variant = "primary",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "ghost" | "danger" | "outline";
}) {
  const styles = {
    primary: "bg-[#1680ff] text-white hover:bg-[#2558c7]",
    ghost: "bg-transparent text-[#344867] hover:bg-blue-50",
    danger: "bg-[#c23b3b] text-white hover:bg-[#a83232]",
    outline: "border border-[#1680ff] text-[#1680ff] hover:bg-[#1680ff]/10",
  };
  return (
    <button
      className={cn(
        "ui-button inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition disabled:opacity-50",
        styles[variant],
        className,
      )}
      {...props}
    />
  );
}

export function Input(props: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={cn(
        "w-full rounded-lg border border-[#e1eaf5] bg-white px-3 py-2.5 text-sm text-[#1c2d49] outline-none focus:border-[#1680ff]",
        props.className,
      )}
    />
  );
}

export function Select(props: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      className={cn(
        "w-full rounded-lg border border-[#e1eaf5] bg-white px-3 py-2.5 text-sm text-[#1c2d49] outline-none focus:border-[#1680ff]",
        props.className,
      )}
    />
  );
}

export function Textarea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...props}
      className={cn(
        "w-full rounded-lg border border-[#e1eaf5] bg-white px-3 py-2.5 text-sm text-[#1c2d49] outline-none focus:border-[#1680ff]",
        props.className,
      )}
    />
  );
}

export function Field({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <label className="block text-sm">
      <span className="mb-1 block text-[#71829b]">{label}</span>
      {children}
    </label>
  );
}

export function Modal({
  title,
  children,
  onClose,
  wide,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
  wide?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    dialog?.showModal();
    return () => dialog?.close();
  }, []);
  return (
    <dialog
      ref={ref}
      aria-label={title}
      onCancel={onClose}
      className="fixed inset-0 m-auto max-h-[95vh] w-full max-w-3xl border-0 bg-transparent p-4 text-[#1c2d49] backdrop:bg-slate-900/30"
    >
      <div
        className={cn(
          "max-h-[90vh] w-full overflow-auto rounded-2xl border border-[#e1eaf5] bg-[#ffffff] p-5 shadow-2xl",
          wide ? "max-w-3xl" : "max-w-xl",
        )}
      >
        <div className="mb-4 flex items-start justify-between gap-4">
          <h2 className="text-lg font-medium">{title}</h2>
          <Button
            type="button"
            variant="ghost"
            onClick={onClose}
            aria-label="Закрыть"
          >
            ×
          </Button>
        </div>
        {children}
      </div>
    </dialog>
  );
}

export function StatCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: ReactNode;
  hint?: string;
}) {
  return (
    <Card>
      <p className="text-sm text-[#71829b]">{label}</p>
      <p className="mt-2 text-3xl font-semibold">{value}</p>
      {hint ? <p className="mt-1 text-xs text-[#71829b]">{hint}</p> : null}
    </Card>
  );
}

export function TableWrap({ children }: { children: ReactNode }) {
  return (
    <div className="overflow-x-auto rounded-2xl border border-[#e1eaf5]">
      {children}
    </div>
  );
}

export function Card({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "ui-card rounded-2xl border border-[#e1eaf5] bg-[#ffffff]/90 p-5 shadow-sm",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function Badge({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: "neutral" | "ok" | "warn" | "bad";
}) {
  const tones = {
    neutral: "bg-slate-100 text-[#344867]",
    ok: "bg-emerald-500/15 text-emerald-700",
    warn: "bg-amber-500/15 text-amber-700",
    bad: "bg-red-500/15 text-red-700",
  };
  return (
    <span className={cn("rounded-full px-2.5 py-1 text-xs", tones[tone])}>
      {children}
    </span>
  );
}

export function PageTitle({
  title,
  subtitle,
}: {
  title: string;
  subtitle?: string;
}) {
  return (
    <div className="mb-6">
      <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
      {subtitle ? (
        <p className="mt-1 text-sm text-[#71829b]">{subtitle}</p>
      ) : null}
    </div>
  );
}

export function Empty({ title }: { title: string }) {
  return (
    <div className="rounded-xl border border-dashed border-[#e1eaf5] p-10 text-center text-[#71829b]">
      {title}
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return (
    <div className={cn("animate-pulse rounded-lg bg-slate-100", className)} />
  );
}
