import * as React from "react";
import { api, type Creds } from "./api";

type State = {
  creds: Creds | null;
  manufacturerId: string | null;
  signIn: (creds: Creds) => Promise<void>;
  signOut: () => void;
};

const Ctx = React.createContext<State | null>(null);
const STORAGE = "hyperwisor-studio.creds";

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [creds, setCreds] = React.useState<Creds | null>(() => {
    try {
      const raw = localStorage.getItem(STORAGE);
      return raw ? JSON.parse(raw) : null;
    } catch { return null; }
  });
  const [manufacturerId, setManufacturerId] = React.useState<string | null>(null);

  // Re-verify on boot so we know the keys are still valid.
  React.useEffect(() => {
    if (!creds) return;
    api.verify(creds)
      .then((r) => setManufacturerId(r.manufacturer_id))
      .catch(() => { localStorage.removeItem(STORAGE); setCreds(null); });
  }, [creds?.apiKey]);

  const signIn = async (next: Creds) => {
    const r = await api.verify(next);
    setManufacturerId(r.manufacturer_id);
    setCreds(next);
    localStorage.setItem(STORAGE, JSON.stringify(next));
  };

  const signOut = () => {
    localStorage.removeItem(STORAGE);
    setCreds(null);
    setManufacturerId(null);
  };

  return (
    <Ctx.Provider value={{ creds, manufacturerId, signIn, signOut }}>
      {children}
    </Ctx.Provider>
  );
}

export function useAuth() {
  const c = React.useContext(Ctx);
  if (!c) throw new Error("useAuth must be inside AuthProvider");
  return c;
}
