"use client";

import { refreshConfirmed } from "../../components/confirmedStore";
import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  clearAdminSession,
  meApi,
  setAdminSession,
} from "../../components/authUtils";

export default function MasterLayout({ children }) {
  const path = usePathname();
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [failure, setFailure] = useState("");

  useEffect(() => {
    let active = true;

    async function validate() {
      if (path === "/master/login") {
        if (active) setReady(true);
        return;
      }

      const user = await meApi();
      if (!active) return;

      if (!user || !user.accesses?.includes("MASTER")) {
        clearAdminSession();
        router.replace("/master/login");
        return;
      }

      const access = path.startsWith("/master/cadastros")
        ? "CADASTROS"
        : path.startsWith("/master/relatorios")
          ? "RELATORIOS"
          : "MASTER";
      if (!user.accesses.includes(access)) {
        router.replace("/master");
        return;
      }
      setAdminSession(user);
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
  }, [path, router]);

  return ready ? (
    children
  ) : (
    <div className="auth-loading">{failure || "Carregando..."}</div>
  );
}
