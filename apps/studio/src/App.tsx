import { Navigate, Route, Routes } from "react-router-dom";
import { useAuth } from "@/auth";
import { Login } from "@/pages/Login";
import { Products } from "@/pages/Products";
import { Generate } from "@/pages/Generate";
import { StudioShell } from "@/components/StudioShell";

function RequireAuth({ children }: { children: JSX.Element }) {
  const { creds } = useAuth();
  return creds ? children : <Navigate to="/" replace />;
}

export function App() {
  const { creds } = useAuth();
  return (
    <Routes>
      <Route
        path="/"
        element={creds ? <Navigate to="/products" replace /> : <Login />}
      />

      {/* Shell-wrapped routes share the sidebar + chrome */}
      <Route
        element={
          <RequireAuth>
            <StudioShell />
          </RequireAuth>
        }
      >
        <Route path="/products" element={<Products />} />
        <Route path="/generate/:id" element={<Generate />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
