import { useEffect, useState } from "react";
import ImobfyApp, { type ModuleId } from "./ImobfyApp";

/**
 * ImobfyApp uses browser-only APIs (localStorage/crypto). TanStack Start
 * renders routes on the server first, so keep the browser-dependent tree out
 * of SSR and mount it only after hydration.
 */
export default function ClientOnlyImobfyApp({ module }: { module: ModuleId }) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  return <ImobfyApp module={module} />;
}
