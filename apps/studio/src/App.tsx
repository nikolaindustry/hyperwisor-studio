import { Navigate, Route, Routes } from "react-router-dom";
import { useAuth } from "@/auth";
import { Login } from "@/pages/Login";
import { Products } from "@/pages/Products";
import { Generate } from "@/pages/Generate";

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
      <Route
        path="/products"
        element={
          <RequireAuth>
            <Products />
          </RequireAuth>
        }
      />
      <Route
        path="/generate/:id"
        element={
          <RequireAuth>
            <Generate />
          </RequireAuth>
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
