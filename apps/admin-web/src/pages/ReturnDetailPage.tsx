import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { approveReturnRequest, getReturnRequest } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { RETURN_REVIEW_ROLES } from "@/lib/roles";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ReturnStatusBadge } from "@/components/ReturnStatusBadge";
import { RejectReturnDialog } from "@/components/RejectReturnDialog";

// §7 модуль #9 7-р зүйл: "дэлгэрэнгүй, Зөвшөөрөх/Татгалзах товч".
export function ReturnDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { accessToken, hasRole } = useAuth();
  const canReview = hasRole(RETURN_REVIEW_ROLES);
  const queryClient = useQueryClient();
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);

  const returnQuery = useQuery({
    queryKey: ["return", id],
    queryFn: () => getReturnRequest(accessToken, id as string),
    enabled: !!id,
  });

  const approveMutation = useMutation({
    mutationFn: () => approveReturnRequest(accessToken, id as string),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["return", id] });
      void queryClient.invalidateQueries({ queryKey: ["returns"] });
    },
  });

  if (returnQuery.isLoading) {
    return <p className="text-sm text-muted-foreground">Ачааллаж байна…</p>;
  }

  if (returnQuery.isError || !returnQuery.data) {
    return (
      <p className="text-sm text-destructive">
        Буцаалтын хүсэлт олдсонгүй эсвэл татахад алдаа гарлаа.
      </p>
    );
  }

  const rr = returnQuery.data;
  const canDecide = canReview && rr.status === "REQUESTED";
  // §7 модуль #9 3(д): "refund API алдаа өгвөл status=REFUND_FAILED (...
  // гараар дахин оролдох боломжтой байх)" — backend-ийн approve() нь
  // REFUND_FAILED-ээс ч дахин дуудагдах боломжтой (return-request.service.ts).
  const canRetry = canReview && rr.status === "REFUND_FAILED";
  const lineTotal =
    Number(rr.orderItem.unitPriceSnapshot) * rr.orderItem.quantity;

  return (
    <div className="space-y-6">
      <div>
        <Link
          to="/returns"
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          ← Буцаалтууд руу буцах
        </Link>
        <div className="mt-1 flex items-center gap-2">
          <h1 className="text-xl font-semibold tracking-tight">
            Буцаалт №{rr.id.slice(0, 8)}
          </h1>
          <ReturnStatusBadge status={rr.status} />
        </div>
        <p className="text-sm text-muted-foreground">
          {new Date(rr.requestedAt).toLocaleString("mn-MN")} · захиалга{" "}
          <Link
            to={`/orders/${rr.orderItem.orderId}`}
            className="underline underline-offset-2 hover:text-foreground"
          >
            №{rr.orderItem.orderId.slice(0, 8)}
          </Link>
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Дэлгэрэнгүй</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div>
            <span className="text-muted-foreground">Шалтгаан: </span>
            {rr.reason}
          </div>
          <div>
            <span className="text-muted-foreground">Бараа: </span>
            {rr.orderItem.quantity} ×{" "}
            {Number(rr.orderItem.unitPriceSnapshot).toLocaleString("mn-MN")}₮
            {" = "}
            {lineTotal.toLocaleString("mn-MN")}₮
          </div>
          {rr.rejectedReason && (
            <div>
              <span className="text-muted-foreground">
                Татгалзсан шалтгаан:{" "}
              </span>
              {rr.rejectedReason}
            </div>
          )}
          {rr.refundFeePercent !== null && (
            <div>
              <span className="text-muted-foreground">
                Шимтгэлийн хувь (снапшот):{" "}
              </span>
              {Number(rr.refundFeePercent)}%
            </div>
          )}
          {rr.refundAmount !== null && (
            <div>
              <span className="text-muted-foreground">Буцаах дүн: </span>
              {Number(rr.refundAmount).toLocaleString("mn-MN")}₮
            </div>
          )}
          {rr.providerRefundId && (
            <div>
              <span className="text-muted-foreground">
                Provider refund ID:{" "}
              </span>
              <code className="rounded bg-muted px-1 py-0.5 text-xs">
                {rr.providerRefundId}
              </code>
            </div>
          )}
          {rr.status === "REFUND_FAILED" && (
            <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-destructive">
              Refund амжилтгүй болсон — доорх "Дахин оролдох" товчоор
              шимтгэлийн тооцоог дахин хийж, provider-ийг дахин дуудна.
            </p>
          )}
        </CardContent>
      </Card>

      {(canDecide || canRetry) && (
        <Card>
          <CardHeader>
            <CardTitle>Шийдвэр гаргах</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            <Button
              disabled={approveMutation.isPending}
              onClick={() => approveMutation.mutate()}
            >
              {approveMutation.isPending
                ? "Боловсруулж байна…"
                : canRetry
                  ? "Дахин оролдох"
                  : "Зөвшөөрөх"}
            </Button>
            {canDecide && (
              <Button
                variant="destructive"
                disabled={approveMutation.isPending}
                onClick={() => setRejectDialogOpen(true)}
              >
                Татгалзах
              </Button>
            )}
          </CardContent>
          {approveMutation.isError && (
            <CardContent className="pt-0 text-sm text-destructive">
              Зөвшөөрөхөд алдаа гарлаа.
            </CardContent>
          )}
        </Card>
      )}

      {canDecide && (
        <RejectReturnDialog
          open={rejectDialogOpen}
          onOpenChange={setRejectDialogOpen}
          returnRequestId={rr.id}
        />
      )}
    </div>
  );
}
