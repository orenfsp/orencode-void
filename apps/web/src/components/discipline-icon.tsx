import {
  BrainCircuit,
  CodeXml,
  LaptopMinimal,
  ShieldCheck,
  Bot,
  Drone,
} from "lucide-react";
const icons = {
  ALGORITHMIC: CodeXml,
  PRODUCT: LaptopMinimal,
  INFOSEC: ShieldCheck,
  AI: BrainCircuit,
  ROBOTICS: Bot,
  UAV: Drone,
};
export function DisciplineIcon({
  code,
  size = 32,
}: {
  code: string;
  size?: number;
}) {
  const Icon = icons[code as keyof typeof icons] ?? CodeXml;
  return (
    <Icon
      size={size}
      strokeWidth={1.35}
      className="text-[#369aff]"
      aria-hidden="true"
    />
  );
}
export function DisciplineBadge({
  name,
  code,
}: {
  name: string;
  code?: string;
}) {
  const tone =
    code === "ROBOTICS"
      ? "bg-[#d9f5ed] text-[#328c83]"
      : code === "AI"
        ? "bg-[#e0f5fa] text-[#087d99]"
        : "bg-[#dcefff] text-[#468fc7]";
  return (
    <span
      className={`inline-block rounded-full px-2.5 py-1 text-[10px] font-medium leading-tight ${tone}`}
    >
      {name}
    </span>
  );
}
