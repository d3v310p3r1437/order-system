import { useState } from "react";
import { LoginScreen } from "@/components/LoginScreen";
import { Dashboard } from "@/components/Dashboard";

interface StaffSession {
  accessToken: string;
  email: string;
}

function App() {
  // §Даалгавар 9: access token-г зөвхөн in-memory React state-д хадгална
  // (localStorage БИШ) — XSS эрсдэлээс сэргийлнэ. Session персист хийх нь
  // дараагийн Phase-д нэмэгдэнэ (одоогоор хуудас refresh хийвэл дахин
  // нэвтрэх шаардлагатай).
  const [session, setSession] = useState<StaffSession | null>(null);

  if (!session) {
    return (
      <LoginScreen
        onLoginSuccess={(accessToken, email) =>
          setSession({ accessToken, email })
        }
      />
    );
  }

  return (
    <Dashboard
      accessToken={session.accessToken}
      email={session.email}
      onLogout={() => setSession(null)}
    />
  );
}

export default App;
