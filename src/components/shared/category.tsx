import { Construction, Droplets, Lightbulb, Trash2, Waves, Zap, type LucideIcon } from "lucide-react";
import { CATEGORY_META, type Category } from "@/lib/domain";
import { cn } from "@/lib/utils";

export const CATEGORY_ICONS: Record<Category, LucideIcon> = {
  water: Droplets,
  sewerage: Waves,
  garbage: Trash2,
  streetlight: Lightbulb,
  road: Construction,
  electricity: Zap,
};

export function CategoryIcon({ category, className }: { category: Category; className?: string }) {
  const Icon = CATEGORY_ICONS[category];
  return <Icon className={className} style={{ color: CATEGORY_META[category].color }} aria-hidden="true" />;
}

/** Rounded tile with the category icon on a tinted background. */
export function CategoryTile({
  category,
  size = "md",
  className,
}: {
  category: Category;
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const Icon = CATEGORY_ICONS[category];
  const color = CATEGORY_META[category].color;
  const box = size === "lg" ? "size-12 rounded-xl" : size === "sm" ? "size-8 rounded-lg" : "size-10 rounded-xl";
  const icon = size === "lg" ? "size-6" : size === "sm" ? "size-4" : "size-5";
  return (
    <span
      className={cn("grid shrink-0 place-items-center border", box, className)}
      style={{ background: `${color}1F`, borderColor: `${color}55`, color }}
    >
      <Icon className={icon} aria-hidden="true" />
    </span>
  );
}
