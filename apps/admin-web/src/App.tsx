import { useState } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { LoginScreen } from "@/components/LoginScreen";
import { Layout } from "@/components/Layout";
import { AuthProvider, type StaffSession } from "@/lib/auth-context";
import { DashboardPage } from "@/pages/DashboardPage";
import { CategoriesPage } from "@/pages/CategoriesPage";
import { ProductsPage } from "@/pages/ProductsPage";
import { ProductDetailPage } from "@/pages/ProductDetailPage";
import { InventoryPage } from "@/pages/InventoryPage";
import { OrdersPage } from "@/pages/OrdersPage";
import { OrderDetailPage } from "@/pages/OrderDetailPage";

function App() {
  // §ADR 004: access token-г зөвхөн in-memory React state-д хадгална
  // (localStorage БИШ) — XSS эрсдэлээс сэргийлнэ. Session персист хийх нь
  // дараагийн Phase-д нэмэгдэнэ (одоогоор хуудас refresh хийвэл дахин
  // нэвтрэх шаардлагатай).
  const [session, setSession] = useState<StaffSession | null>(null);

  return (
    <BrowserRouter>
      <Routes>
        <Route
          path="/login"
          element={
            session ? (
              <Navigate to="/dashboard" replace />
            ) : (
              <LoginScreen
                onLoginSuccess={(accessToken, email) =>
                  setSession({ accessToken, email })
                }
              />
            )
          }
        />

        <Route
          element={
            session ? (
              <AuthProvider session={session} onLogout={() => setSession(null)}>
                <Layout />
              </AuthProvider>
            ) : (
              <Navigate to="/login" replace />
            )
          }
        >
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/categories" element={<CategoriesPage />} />
          <Route path="/products" element={<ProductsPage />} />
          <Route path="/products/:id" element={<ProductDetailPage />} />
          <Route path="/inventory" element={<InventoryPage />} />
          <Route path="/orders" element={<OrdersPage />} />
          <Route path="/orders/:id" element={<OrderDetailPage />} />
        </Route>

        <Route
          path="*"
          element={<Navigate to={session ? "/dashboard" : "/login"} replace />}
        />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
