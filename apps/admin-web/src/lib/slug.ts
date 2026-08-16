// Нэрнээс slug санал болгох (гэхдээ ямагт засварлаж болно) — Монгол
// кирилл үсгийг orчуулахгүй, зөвхөн латин үсэг/тоог хадгална.
export function slugify(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
