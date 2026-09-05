import { useQuery } from "@tanstack/react-query";
import { getBranding } from "@/lib/api";

// GET /settings/branding нэвтрэлтгүй нээлттэй тул LoginScreen/Layout
// хоёуланд адилхан дуудагдана. staleTime-ыг өндөр (5 минут) тавьсан —
// лого/нэр ховор өөрчлөгддөг тул хуудас бүрд дахин дуудах шаардлагагүй
// (Flutter талын "app эхлэх бүрд дахин дуудахгүй" зарчимтай төстэй).
export function useBranding() {
  return useQuery({
    queryKey: ["branding"],
    queryFn: getBranding,
    staleTime: 5 * 60 * 1000,
  });
}
