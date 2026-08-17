import { useState, type FormEvent } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { rejectReturnRequest } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface RejectReturnDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  returnRequestId: string;
}

// §7 модуль #9 4-р зүйл: "Татгалзах урсгал ... rejectedReason заавал".
export function RejectReturnDialog({
  open,
  onOpenChange,
  returnRequestId,
}: RejectReturnDialogProps) {
  const { accessToken } = useAuth();
  const queryClient = useQueryClient();
  const [rejectedReason, setRejectedReason] = useState("");

  const mutation = useMutation({
    mutationFn: () =>
      rejectReturnRequest(accessToken, returnRequestId, rejectedReason),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["returns"] });
      void queryClient.invalidateQueries({
        queryKey: ["return", returnRequestId],
      });
      setRejectedReason("");
      onOpenChange(false);
    },
  });

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    mutation.mutate();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Буцаалтаас татгалзах</DialogTitle>
          <DialogDescription>
            Татгалзсан шалтгаанаа бичнэ үү — харилцагчид харагдана.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          <div className="space-y-1.5">
            <Label htmlFor="rejected-reason">Татгалзсан шалтгаан</Label>
            <Textarea
              id="rejected-reason"
              value={rejectedReason}
              onChange={(e) => setRejectedReason(e.target.value)}
              required
              rows={3}
              disabled={mutation.isPending}
            />
          </div>

          {mutation.isError && (
            <p
              role="alert"
              className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
            >
              {mutation.error instanceof Error
                ? mutation.error.message
                : "Тодорхойгүй алдаа гарлаа"}
            </p>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={mutation.isPending}
            >
              Болих
            </Button>
            <Button
              type="submit"
              variant="destructive"
              disabled={mutation.isPending || !rejectedReason.trim()}
            >
              {mutation.isPending ? "Илгээж байна…" : "Татгалзах"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
