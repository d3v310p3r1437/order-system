import { useBranding } from "@/lib/use-branding";
import { cn } from "@/lib/utils";

interface BrandMarkProps {
  className?: string;
  // logo зураг ирээгүй/ачааллаж байгаа үед initials badge-ийн дэвсгэр/
  // текст өнгө — LoginScreen-ийн харанхуй (primary) панель дээр "white",
  // бусад цайвар дэвсгэр дээр (Layout sidebar, LoginScreen-ийн mobile
  // хувилбар) "primary".
  fallbackVariant?: "primary" | "white";
}

// GET /settings/branding-ээс ирсэн лого зургийг (байхгүй/ачаалж байгаа үед
// storeName-ийн эхний үсгээр initials badge) харуулах дундын widget —
// LoginScreen (desktop+mobile) БОЛОН Layout sidebar 3 газарт адилхан
// дахин ашиглана.
export function BrandMark({ className, fallbackVariant = "primary" }: BrandMarkProps) {
  const { data: branding } = useBranding();

  if (branding?.logoUrl) {
    return (
      <img
        src={branding.logoUrl}
        alt={branding.storeName}
        className={cn("size-7 shrink-0 rounded-lg object-cover", className)}
      />
    );
  }

  const initials = (branding?.storeName ?? "ЗС").trim().slice(0, 2).toUpperCase();
  return (
    <span
      className={cn(
        "flex size-7 shrink-0 items-center justify-center rounded-lg text-xs font-bold",
        fallbackVariant === "white"
          ? "bg-white/15 text-primary-foreground"
          : "bg-primary text-primary-foreground",
        className,
      )}
    >
      {initials}
    </span>
  );
}
