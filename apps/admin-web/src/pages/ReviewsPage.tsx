import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { deleteReview, getReviewsForModeration } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { REVIEW_MODERATION_ROLES } from "@/lib/roles";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("mn-MN");
}

function Stars({ rating }: { rating: number }) {
  return (
    <span aria-label={`${rating}/5`} className="text-amber-500">
      {"★".repeat(rating)}
      <span className="text-muted-foreground">{"★".repeat(5 - rating)}</span>
    </span>
  );
}

// §7 модуль #11: сэтгэгдэл/үнэлгээний модераци дэлгэц (зөвхөн global scope
// дүрд харагдана — AuditLogsPage-ийн ерөнхий загварыг дахин ашигласан).
// ⚠️ ЭНД "Устгах" товч ЖИНХЭНЭ устгалт (DELETE /reviews/:id) — Category/
// Product-ийн isActive-toggle зарчмаас ЯЛГААТАЙ, учир нь энэ бол бизнес
// объектын амьдралын мөчлөгийн soft-deactivate биш, харин ХАРИЛЦАГЧИЙН
// БИЧСЭН КОНТЕНТИЙН модераци (зохисгүй/спам сэтгэгдэл устгах) — reviews_delete
// RLS policy-ийн "ӨӨРИЙН ЭСВЭЛ app_has_global_scope()" нөхцлийн 2-р
// хэсэг яг ЭНЭ дэлгэц зорилготой.
export function ReviewsPage() {
  const { accessToken, hasRole } = useAuth();
  const canModerate = hasRole(REVIEW_MODERATION_ROLES);
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);

  const reviewsQuery = useQuery({
    queryKey: ["reviews-moderation", page],
    queryFn: () => getReviewsForModeration(accessToken, page),
    enabled: canModerate,
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteReview(accessToken, id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["reviews-moderation"] });
    },
  });

  if (!canModerate) {
    return (
      <p className="text-sm text-muted-foreground">
        Энэ хуудсыг харах эрхгүй байна.
      </p>
    );
  }

  function handleDelete(id: string) {
    if (window.confirm("Энэ сэтгэгдлийг устгах уу? Энэ үйлдлийг буцаах боломжгүй.")) {
      deleteMutation.mutate(id);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">
          Сэтгэгдэл/үнэлгээ
        </h1>
        <p className="text-sm text-muted-foreground">
          Харилцагчдын бүтээгдэхүүнд үлдээсэн сэтгэгдэл — модераци (устгах).
        </p>
      </div>

      <Card>
        <CardContent>
          {reviewsQuery.isLoading && (
            <p className="text-sm text-muted-foreground">Ачааллаж байна…</p>
          )}
          {reviewsQuery.isError && (
            <p className="text-sm text-destructive">
              Сэтгэгдлийн мэдээлэл татахад алдаа гарлаа.
            </p>
          )}
          {reviewsQuery.isSuccess && reviewsQuery.data.reviews.length === 0 && (
            <p className="text-sm text-muted-foreground">
              Сэтгэгдэл алга байна.
            </p>
          )}
          {deleteMutation.isError && (
            <p role="alert" className="mb-3 text-sm text-destructive">
              Устгахад алдаа гарлаа.
            </p>
          )}

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs text-muted-foreground">
                  <th className="py-2 pr-3 font-medium">Үнэлгээ</th>
                  <th className="py-2 pr-3 font-medium">Бүтээгдэхүүн</th>
                  <th className="py-2 pr-3 font-medium">Сэтгэгдэл</th>
                  <th className="py-2 pr-3 font-medium">Огноо</th>
                  <th className="py-2 font-medium" />
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {(reviewsQuery.data?.reviews ?? []).map((review) => (
                  <tr key={review.id}>
                    <td className="whitespace-nowrap py-2 pr-3">
                      <Stars rating={review.rating} />
                    </td>
                    <td className="py-2 pr-3">{review.product.name}</td>
                    <td className="max-w-xs truncate py-2 pr-3 text-muted-foreground">
                      {review.comment ?? "—"}
                    </td>
                    <td className="whitespace-nowrap py-2 pr-3 text-muted-foreground">
                      {formatDateTime(review.createdAt)}
                    </td>
                    <td className="py-2 text-right">
                      <Button
                        type="button"
                        variant="destructive"
                        size="sm"
                        onClick={() => handleDelete(review.id)}
                        disabled={deleteMutation.isPending}
                      >
                        Устгах
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {reviewsQuery.isSuccess && reviewsQuery.data.totalCount > 0 && (
            <div className="mt-4 flex items-center justify-between text-sm text-muted-foreground">
              <span>Нийт: {reviewsQuery.data.totalCount}</span>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  Өмнөх
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={
                    page * reviewsQuery.data.limit >=
                    reviewsQuery.data.totalCount
                  }
                  onClick={() => setPage((p) => p + 1)}
                >
                  Дараах
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
