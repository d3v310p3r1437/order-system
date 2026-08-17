import { useEffect, useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getReturnFeePercent, updateReturnFeePercent } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

// §7 модуль #9 6-р зүйл, 7-р зүйл: "Тохиргооны хуудсанд (эсвэл Dashboard-д)
// RETURN_FEE_PERCENT засах талбар (зөвхөн global scope дүрд харагдана)" —
// DashboardPage-д шууд суулгасан (тусдаа Тохиргоо route ЗОХИОГООГҮЙ, ганц
// талбарт router нэмэх нь илүүц гэж үзсэн).
export function ReturnFeeSettingCard() {
  const { accessToken } = useAuth();
  const queryClient = useQueryClient();
  const [value, setValue] = useState("");

  const settingQuery = useQuery({
    queryKey: ["settings", "return-fee-percent"],
    queryFn: () => getReturnFeePercent(accessToken),
  });

  useEffect(() => {
    if (settingQuery.data) {
      setValue(settingQuery.data.value);
    }
  }, [settingQuery.data]);

  const mutation = useMutation({
    mutationFn: () => updateReturnFeePercent(accessToken, Number(value)),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: ["settings", "return-fee-percent"],
      });
    },
  });

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    mutation.mutate();
  }

  return (
    <Card className="max-w-xl">
      <CardHeader>
        <CardTitle className="text-base">Буцаалтын шимтгэл</CardTitle>
        <CardDescription>
          Зөвшөөрсөн буцаалт бүрийн refund дүнгээс хасагдах хувь (%). Шинэ
          утга зөвхөн ЦААШДЫН зөвшөөрөгдөх буцаалтад хамаарна — өмнөх
          буцаалтын snapshot өөрчлөгдөхгүй.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {settingQuery.isLoading ? (
          <p className="text-sm text-muted-foreground">Ачааллаж байна…</p>
        ) : (
          <form
            onSubmit={handleSubmit}
            className="flex items-end gap-3"
            noValidate
          >
            <div className="space-y-1.5">
              <Label htmlFor="return-fee-percent">Шимтгэлийн хувь (%)</Label>
              <Input
                id="return-fee-percent"
                type="number"
                min={0}
                max={100}
                step="0.01"
                value={value}
                onChange={(e) => setValue(e.target.value)}
                className="w-32"
                disabled={mutation.isPending}
                required
              />
            </div>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? "Хадгалж байна…" : "Хадгалах"}
            </Button>
          </form>
        )}
        {mutation.isError && (
          <p
            role="alert"
            className="mt-3 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
          >
            {mutation.error instanceof Error
              ? mutation.error.message
              : "Тодорхойгүй алдаа гарлаа"}
          </p>
        )}
        {mutation.isSuccess && (
          <p className="mt-3 text-sm text-muted-foreground">Шинэчлэгдлээ.</p>
        )}
      </CardContent>
    </Card>
  );
}
