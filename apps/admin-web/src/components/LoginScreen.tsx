import { useState, type FormEvent } from "react";
import { useMutation } from "@tanstack/react-query";
import { ApiError, staffLogin } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface LoginScreenProps {
  onLoginSuccess: (accessToken: string, email: string) => void;
}

export function LoginScreen({ onLoginSuccess }: LoginScreenProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const loginMutation = useMutation({
    mutationFn: () => staffLogin(email, password),
    onSuccess: (tokens) => onLoginSuccess(tokens.accessToken, email),
  });

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    loginMutation.mutate();
  }

  const errorMessage =
    loginMutation.error instanceof ApiError
      ? loginMutation.error.code === "TOO_MANY_ATTEMPTS"
        ? loginMutation.error.message
        : "И-мэйл эсвэл нууц үг буруу байна"
      : loginMutation.isError
        ? "Сервертэй холбогдоход алдаа гарлаа. Backend ажиллаж байгаа эсэхийг шалгана уу."
        : null;

  return (
    <div className="grid min-h-svh lg:grid-cols-2">
      {/* Брэндийн самбар — B2B admin panel-ийн танигдах хэсэг */}
      <div className="relative hidden flex-col justify-between overflow-hidden bg-primary p-10 text-primary-foreground lg:flex">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-40"
          style={{
            backgroundImage:
              "radial-gradient(circle at 20% 20%, rgba(255,255,255,0.18), transparent 45%), radial-gradient(circle at 80% 70%, rgba(255,255,255,0.12), transparent 40%)",
          }}
        />
        <div className="relative flex items-center gap-2 text-lg font-semibold tracking-tight">
          <span className="flex size-8 items-center justify-center rounded-lg bg-white/15 text-sm font-bold">
            ЗС
          </span>
          Захиалгын систем
        </div>
        <div className="relative space-y-3">
          <h1 className="text-3xl font-semibold tracking-tight text-balance">
            Олон салбарын захиалгын удирдлагын самбар
          </h1>
          <p className="max-w-md text-sm text-primary-foreground/75">
            Салбар, эрх, захиалга, тайлангаа нэг дороос удирдана уу.
            Ажилтны и-мэйл хаягаараа нэвтэрч эхлээрэй.
          </p>
        </div>
        <p className="relative text-xs text-primary-foreground/60">
          Phase 1 — Суурь бүтэц, Auth, RLS, аудит лог
        </p>
      </div>

      {/* Нэвтрэлтийн форм */}
      <div className="flex items-center justify-center p-6 sm:p-10">
        <div className="w-full max-w-sm space-y-8">
          <div className="space-y-1.5 lg:hidden">
            <div className="flex items-center gap-2 text-base font-semibold tracking-tight">
              <span className="flex size-7 items-center justify-center rounded-lg bg-primary text-xs font-bold text-primary-foreground">
                ЗС
              </span>
              Захиалгын систем
            </div>
          </div>

          <div className="space-y-1.5">
            <h2 className="text-xl font-semibold tracking-tight">
              Тавтай морил
            </h2>
            <p className="text-sm text-muted-foreground">
              Ажилтны и-мэйл, нууц үгээрээ нэвтэрнэ үү.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4" noValidate>
            <div className="space-y-1.5">
              <Label htmlFor="email">И-мэйл</Label>
              <Input
                id="email"
                type="email"
                autoComplete="username"
                placeholder="ажилтан@order-system.mn"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={loginMutation.isPending}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password">Нууц үг</Label>
              <Input
                id="password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={loginMutation.isPending}
              />
            </div>

            {errorMessage && (
              <p
                role="alert"
                className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
              >
                {errorMessage}
              </p>
            )}

            <Button
              type="submit"
              className="w-full"
              size="lg"
              disabled={loginMutation.isPending}
            >
              {loginMutation.isPending ? "Нэвтэрч байна…" : "Нэвтрэх"}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
