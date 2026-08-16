import { useEffect, useState, type FormEvent } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  createProduct,
  updateProduct,
  type Category,
  type Product,
  type ProductInput,
} from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { slugify } from "@/lib/slug";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface ProductDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  product: Product | null;
  categories: Category[];
}

// Бүтээгдэхүүнд ч Устгах товч ЗОРИУДАА байхгүй (§Даалгавар) — Ангилалтай
// ижил "Идэвхгүй болгох" toggle л ашиглана.
export function ProductDialog({
  open,
  onOpenChange,
  product,
  categories,
}: ProductDialogProps) {
  const { accessToken } = useAuth();
  const queryClient = useQueryClient();
  const isEdit = product !== null;

  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const [description, setDescription] = useState("");
  const [brand, setBrand] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [isActive, setIsActive] = useState(true);

  useEffect(() => {
    if (!open) return;
    setName(product?.name ?? "");
    setSlug(product?.slug ?? "");
    setSlugTouched(false);
    setDescription(product?.description ?? "");
    setBrand(product?.brand ?? "");
    setCategoryId(product?.categoryId ?? categories[0]?.id ?? "");
    setIsActive(product?.isActive ?? true);
  }, [open, product, categories]);

  const mutation = useMutation({
    mutationFn: () => {
      const dto: ProductInput = {
        name,
        slug,
        description: description || undefined,
        brand: brand || undefined,
        categoryId,
        isActive,
      };
      return isEdit
        ? updateProduct(accessToken, product.id, dto)
        : createProduct(accessToken, dto);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["products"] });
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
          <DialogTitle>
            {isEdit ? "Бүтээгдэхүүн засах" : "Шинэ бүтээгдэхүүн"}
          </DialogTitle>
          <DialogDescription>
            {isEdit
              ? "Бүтээгдэхүүний мэдээллийг шинэчилнэ."
              : "Каталогт шинэ бүтээгдэхүүн нэмнэ."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          <div className="space-y-1.5">
            <Label htmlFor="product-name">Нэр</Label>
            <Input
              id="product-name"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (!slugTouched) setSlug(slugify(e.target.value));
              }}
              required
              disabled={mutation.isPending}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="product-slug">Slug</Label>
            <Input
              id="product-slug"
              value={slug}
              onChange={(e) => {
                setSlug(e.target.value);
                setSlugTouched(true);
              }}
              required
              disabled={mutation.isPending}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="product-category">Ангилал</Label>
            <Select
              value={categoryId}
              onValueChange={setCategoryId}
              disabled={mutation.isPending}
            >
              <SelectTrigger id="product-category" className="w-full">
                <SelectValue placeholder="Ангилал сонгох" />
              </SelectTrigger>
              <SelectContent>
                {categories.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="product-brand">Брэнд</Label>
            <Input
              id="product-brand"
              value={brand}
              onChange={(e) => setBrand(e.target.value)}
              disabled={mutation.isPending}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="product-description">Тайлбар</Label>
            <Textarea
              id="product-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              disabled={mutation.isPending}
              rows={3}
            />
          </div>

          <div className="flex items-center justify-between rounded-lg border border-border p-3">
            <Label htmlFor="product-active">Идэвхтэй</Label>
            <Switch
              id="product-active"
              checked={isActive}
              onCheckedChange={setIsActive}
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
              disabled={mutation.isPending || !categoryId}
            >
              {mutation.isPending ? "Хадгалж байна…" : "Хадгалах"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
