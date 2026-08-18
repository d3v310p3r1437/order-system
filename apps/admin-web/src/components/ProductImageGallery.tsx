import { useRef, useState, type DragEvent } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  deleteProductImage,
  uploadProductImage,
  type ProductImage,
} from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface ProductImageGalleryProps {
  productId: string;
  images: ProductImage[];
  canWrite: boolean;
}

// docs/plan.md §8 Phase 2 Хэсэг A, даалгавар #6: drag-drop эсвэл file
// picker-ээр зураг upload хийх, gallery харагдац, устгах товч.
// apps/api/src/catalog/product-image-ийн `{status,leadDays}`-тэй ижил
// зарчмаар (ADR 005-ийн "ганц газар л шийднэ") frontend талд ямар ч
// validation logic (mimetype/size) ДАХИН БИЧЭЭГҮЙ — зөвхөн backend-ийн
// буцаасан алдааны мессежийг харуулна.
export function ProductImageGallery({
  productId,
  images,
  canWrite,
}: ProductImageGalleryProps) {
  const { accessToken } = useAuth();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  const uploadMutation = useMutation({
    mutationFn: (file: File) =>
      uploadProductImage(accessToken, productId, file),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["product", productId] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (imageId: string) =>
      deleteProductImage(accessToken, productId, imageId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["product", productId] });
    },
  });

  function handleFiles(files: FileList | null) {
    const file = files?.[0];
    if (file) {
      uploadMutation.mutate(file);
    }
  }

  function handleDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setIsDragging(false);
    handleFiles(e.dataTransfer.files);
  }

  return (
    <div className="space-y-3">
      {canWrite && (
        <div
          role="button"
          tabIndex={0}
          aria-label="Зураг байршуулах"
          onClick={() => fileInputRef.current?.click()}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              fileInputRef.current?.click();
            }
          }}
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
          className={cn(
            "flex cursor-pointer items-center justify-center rounded-lg border-2 border-dashed p-6 text-center text-sm text-muted-foreground transition-colors",
            isDragging
              ? "border-primary bg-primary/5"
              : "border-border hover:border-primary/50",
          )}
        >
          {uploadMutation.isPending
            ? "Байршуулж байна…"
            : "Зураг чирж оруулах эсвэл товшиж сонгоно уу (jpg/png/webp, 5MB хүртэл)"}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={(e) => handleFiles(e.target.files)}
          />
        </div>
      )}

      {uploadMutation.isError && (
        <p
          role="alert"
          className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
        >
          {uploadMutation.error instanceof Error
            ? uploadMutation.error.message
            : "Зураг байршуулахад алдаа гарлаа"}
        </p>
      )}

      {images.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Зураг оруулаагүй байна.
        </p>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {images.map((image) => (
            <div
              key={image.id}
              className="group relative overflow-hidden rounded-lg border border-border"
            >
              <img
                src={image.url}
                alt={image.altText ?? "Бүтээгдэхүүний зураг"}
                className="aspect-square w-full object-cover"
              />
              {canWrite && (
                <Button
                  type="button"
                  variant="destructive"
                  size="sm"
                  className="absolute top-1 right-1 opacity-0 transition-opacity group-hover:opacity-100"
                  onClick={() => deleteMutation.mutate(image.id)}
                  disabled={deleteMutation.isPending}
                >
                  Устгах
                </Button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
