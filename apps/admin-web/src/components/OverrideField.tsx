import type { ReactNode } from "react";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

interface OverrideFieldProps {
  label: string;
  hint: string;
  enabled: boolean;
  onEnabledChange: (enabled: boolean) => void;
  disabled?: boolean;
  children: ReactNode;
}

// Override-той талбарын нийтлэг UI (branchPrice, preOrder эрх): унтраасан
// үед input бүрэн алга болж variant-ийн анхны утгыг өвлөнө гэдгийг тод
// харуулна — асаасан үед л input гарч ирнэ.
export function OverrideField({
  label,
  hint,
  enabled,
  onEnabledChange,
  disabled,
  children,
}: OverrideFieldProps) {
  return (
    <div className="space-y-2 rounded-lg border border-border p-3">
      <div className="flex items-center justify-between gap-3">
        <div className="space-y-0.5">
          <Label>{label}</Label>
          <p className="text-xs text-muted-foreground">{hint}</p>
        </div>
        <Switch
          checked={enabled}
          onCheckedChange={onEnabledChange}
          disabled={disabled}
          aria-label={label}
        />
      </div>
      {enabled && <div className="pt-1">{children}</div>}
    </div>
  );
}
