import { useEffect, useRef, useState, type FormEvent } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { updateBranding } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { useBranding } from "@/lib/use-branding";
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

// §7 "Дэлгүүрийн нэр/лого" даалгавар, 6-р зүйл: Dashboard-д (зөвхөн
// BRANDING_WRITE_ROLES дүрд) нэр засах + лого солих карт —
// ReturnFeeSettingCard.tsx-тэй ЯГ ижил "DashboardPage-д шууд суулгасан,
// тусдаа Тохиргоо route зохиогоогүй" зарчим.
export function BrandingSettingCard() {
  const { accessToken } = useAuth();
  const queryClient = useQueryClient();
  const brandingQuery = useBranding();
  const [storeName, setStoreName] = useState("");
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (brandingQuery.data) {
      setStoreName(brandingQuery.data.storeName);
    }
  }, [brandingQuery.data]);

  const mutation = useMutation({
    mutationFn: () =>
      updateBranding(accessToken, {
        storeName: storeName !== brandingQuery.data?.storeName ? storeName : undefined,
        logoFile: logoFile ?? undefined,
      }),
    onSuccess: () => {
      setLogoFile(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
      void queryClient.invalidateQueries({ queryKey: ["branding"] });
    },
  });

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    mutation.mutate();
  }

  return (
    <Card className="max-w-xl">
      <CardHeader>
        <CardTitle className="text-base">Брэндинг</CardTitle>
        <CardDescription>
          Дэлгүүрийн нэр/лого — энд өөрчилсөн даруйдаа Login дэлгэц,
          admin-web толгой хэсэг, Mobile апп бүгдэд шинэчлэгдэнэ (кодын
          дахин build/deploy шаардлагагүй).
        </CardDescription>
      </CardHeader>
      <CardContent>
        {brandingQuery.isLoading ? (
          <p className="text-sm text-muted-foreground">Ачааллаж байна…</p>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4" noValidate>
            <div className="space-y-1.5">
              <Label htmlFor="store-name">Дэлгүүрийн нэр</Label>
              <Input
                id="store-name"
                value={storeName}
                onChange={(e) => setStoreName(e.target.value)}
                className="max-w-xs"
                disabled={mutation.isPending}
                required
                maxLength={100}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="store-logo">Лого зураг (jpg/png/webp, 5MB хүртэл)</Label>
              <div className="flex items-center gap-3">
                {brandingQuery.data?.logoUrl && (
                  <img
                    src={brandingQuery.data.logoUrl}
                    alt={brandingQuery.data.storeName}
                    className="size-12 rounded-lg border border-border object-cover"
                  />
                )}
                <Input
                  id="store-logo"
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={(e) => setLogoFile(e.target.files?.[0] ?? null)}
                  disabled={mutation.isPending}
                  className="max-w-xs"
                />
              </div>
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
