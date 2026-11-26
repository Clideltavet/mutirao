"use client";

import { refreshConfirmed } from "./confirmedStore";
import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { clearTabletSession, meApi, setTabletSession } from "./authUtils";

function needed(path) {
  if (path.startsWith("/configuracoes")) return "MASTER";
  if (path.startsWith("/entrada")) return "ENTRADA";
  if (path.startsWith("/pacientes")) return "PACIENTES";
  if (path.startsWith("/saida")) return "SAIDA";
  if (path.startsWith("/recepcao")) return "RECEPCAO";
  return null;
}

export default function AppAccessGate({ children }) {
  const pathname = usePathname();
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [failure, setFailure] = useState("");

  useEffect(() => {
    let active = true;

    async function validate() {
      if (pathname.startsWith("/cirurgia")) {
        try {
          await refreshConfirmed();
          if (active) setReady(true);
        } catch (e) {
          if (active)
            setFailure(
              "TV não autorizada ou sem conexão. Pareie este navegador nas Configurações do CMS.",
            );
        }
        return;
      }
      if (pathname.startsWith("/master") || pathname === "/") {
        if (active) setReady(true);
        return;
      }

      const user = await meApi();
      if (!active) return;

      if (!user) {
        clearTabletSession();
        router.replace("/");
        return;
      }

      setTabletSession(user);

      const access = needed(pathname);
      if (access && !user.accesses?.includes(access)) {
        router.replace("/");
        return;
      }

      try {
        await refreshConfirmed();
        setReady(true);
      } catch (e) {
        setFailure(e.message);
      }
    }

    setReady(false);
    validate();

    return () => {
      active = false;
    };
  }, [pathname, router]);

  return ready ? (
    children
  ) : (
    <div className="auth-loading">{failure || "Carregando..."}</div>
  );
}
