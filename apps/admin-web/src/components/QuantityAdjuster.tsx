import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface QuantityAdjusterProps {
  currentQuantity: number;
  onAdjust: (delta: number) => void;
  disabled?: boolean;
}

// InventoryItem.quantity-г шууд "тавьж" бичихгүй, зөвхөн +N/-N (delta)
// байдлаар өөрчлөх UI — backend-ийн atomic increment endpoint
// (PATCH /inventory-items/:id/adjust-quantity) -тэй нийцтэй.
export function QuantityAdjuster({
  currentQuantity,
  onAdjust,
  disabled,
}: QuantityAdjusterProps) {
  const [amount, setAmount] = useState("1");
  const parsedAmount = Number(amount);
  const isValid = Number.isInteger(parsedAmount) && parsedAmount > 0;

  return (
    <div className="flex items-center gap-3">
      <span className="text-sm text-muted-foreground">
        Одоогийн үлдэгдэл:{" "}
        <span className="font-medium text-foreground">{currentQuantity}</span>
      </span>
      <div className="flex items-center gap-1.5">
        <Button
          type="button"
          variant="outline"
          size="sm"
          aria-label="Нөөц хасах"
          disabled={disabled || !isValid}
          onClick={() => onAdjust(-parsedAmount)}
        >
          −
        </Button>
        <Input
          type="number"
          min={1}
          step={1}
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          className="w-16 text-center"
          aria-label="Дэлта тоо хэмжээ"
          disabled={disabled}
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          aria-label="Нөөц нэмэх"
          disabled={disabled || !isValid}
          onClick={() => onAdjust(parsedAmount)}
        >
          +
        </Button>
      </div>
    </div>
  );
}
