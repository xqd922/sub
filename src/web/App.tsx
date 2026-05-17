import { AdminPage } from "./admin/AdminPage";
import { HomeContent } from "./HomeContent";

export function App() {
  if (window.location.pathname.startsWith("/admin")) {
    return <AdminPage />;
  }

  return <HomeContent />;
}
