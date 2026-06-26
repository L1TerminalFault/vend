import { GiCoffeeCup } from "react-icons/gi";
import { FiBox } from "react-icons/fi";

export function getProductIconBg(name: string): string {
  const n = name.toLowerCase();
  if (n.includes("cappuccino")) return "bg-amber-500/20 text-amber-500";
  if (n.includes("macchiato")) return "bg-orange-500/20 text-orange-400";
  if (n.includes("coffee") || n.includes("espresso") || n.includes("latte")) return "bg-amber-700/20 text-amber-700";
  return "bg-violet-500/20 text-violet-400";
}

export default function ProductIcon({ name, className = "text-lg" }: { name: string; className?: string }) {
  const n = name.toLowerCase();
  if (n.includes("cappuccino")) {
    return <GiCoffeeCup className={`${className} text-amber-600`} />;
  }
  if (n.includes("macchiato")) {
    return <GiCoffeeCup className={`${className} text-orange-400`} />;
  }
  if (n.includes("coffee") || n.includes("espresso") || n.includes("latte")) {
    return <GiCoffeeCup className={`${className} text-amber-800`} />;
  }
  return <FiBox className={className} />;
}
