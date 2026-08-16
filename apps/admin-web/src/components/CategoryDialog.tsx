import { useEffect, useState, type FormEvent } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  createCategory,
  updateCategory,
  type Category,
  type CategoryInput,
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

const NO_PARENT = "__none__";

interface CategoryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  category: Category | null;
  allCategories: Category[];
}

// Ангилалд Устгах товч ЗОРИУДАА байхгүй (§Даалгавар) — variant/inventory-той
// foreign key зөрчилдөх эрсдэлтэй тул зөвхөн "Идэвхгүй болгох" toggle-оор
// шийднэ, UI дээр "Идэвхгүй" гэж ялгаатай харуулна (бүтэц дата бүрэн
// хадгалагдана).
export function CategoryDialog({
  open,
  onOpenChange,
  category,
  allCategories,
}: CategoryDialogProps) {
  const { accessToken } = useAuth();
  const queryClient = useQueryClient();
  const isEdit = category !== null;

  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const [description, setDescription] = useState("");
  const [parentId, setParentId] = useState(NO_PARENT);
  const [isActive, setIsActive] = useState(true);

  useEffect(() => {
    if (!open) return;
    setName(category?.name ?? "");
    setSlug(category?.slug ?? "");
    setSlugTouched(false);
    setDescription(category?.description ?? "");
    setParentId(category?.parentId ?? NO_PARENT);
    setIsActive(category?.isActive ?? true);
  }, [open, category]);

  const mutation = useMutation({
    mutationFn: () => {
      const dto: CategoryInput = {
        name,
        slug,
        description: description || undefined,
        parentId: parentId === NO_PARENT ? null : parentId,
        isActive,
      };
      return isEdit
        ? updateCategory(accessToken, category.id, dto)
        : createCategory(accessToken, dto);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["categories"] });
      onOpenChange(false);
    },
  });

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    mutation.mutate();
  }

  // Эцэг ангилал сонголтоос өөрийгөө хасна (өөрийгөө эцэг болгож
  // сонгохоос сэргийлнэ — циклийн энгийн хамгаалалт).
  const parentOptions = allCategories.filter((c) => c.id !== category?.id);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {isEdit ? "Ангилал засах" : "Шинэ ангилал"}
          </DialogTitle>
          <DialogDescription>
            {isEdit
              ? "Ангиллын мэдээллийг шинэчилнэ."
              : "Каталогт шинэ ангилал нэмнэ."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          <div className="space-y-1.5">
            <Label htmlFor="category-name">Нэр</Label>
            <Input
              id="category-name"
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
            <Label htmlFor="category-slug">Slug</Label>
            <Input
              id="category-slug"
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
            <Label htmlFor="category-description">Тайлбар</Label>
            <Textarea
              id="category-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              disabled={mutation.isPending}
              rows={3}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="category-parent">Эцэг ангилал</Label>
            <Select
              value={parentId}
              onValueChange={setParentId}
              disabled={mutation.isPending}
            >
              <SelectTrigger id="category-parent" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NO_PARENT}>Байхгүй (үндсэн)</SelectItem>
                {parentOptions.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center justify-between rounded-lg border border-border p-3">
            <Label htmlFor="category-active">Идэвхтэй</Label>
            <Switch
              id="category-active"
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
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? "Хадгалж байна…" : "Хадгалах"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
