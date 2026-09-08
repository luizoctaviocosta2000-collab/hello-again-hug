/*
 * Small compatibility layer for the existing profile modal.
 * It makes the Corretor/Captador choice reliably clickable even when
 * the legacy modal markup is rendered without an explicit button type.
 */

if (typeof window !== "undefined") {
  const normalize = (value: string | null | undefined) => (value || "").replace(/\s+/g, " ").trim().toLowerCase();

  const roleFromElement = (element: Element | null) => {
    const text = normalize(element?.textContent);
    if (text === "corretor") return "Corretor" as const;
    if (text === "captador") return "Captador" as const;
    return null;
  };

  const isRoleChoice = (element: Element | null) => Boolean(roleFromElement(element));

  const markChoice = (role: "Corretor" | "Captador") => {
    document.querySelectorAll("button, [role='button']").forEach((element) => {
      if (!isRoleChoice(element)) return;
      element.classList.toggle("imobfy-role-selected", roleFromElement(element) === role);
      element.classList.add("imobfy-role-choice");
    });
  };

  const persistSelectedRole = (role: "Corretor" | "Captador") => {
    try {
      const session = JSON.parse(localStorage.getItem("imobfy-session-v1") || "null");
      if (!session) return;
      const sessionId = String(session?.user_id || session?.email || "local")
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9@._-]/g, "-");
      const key = `imobfy-v1:${sessionId}`;
      const raw = localStorage.getItem(key);
      if (!raw) return;
      const data = JSON.parse(raw);
      data.profile = { ...(data.profile || {}), role };
      localStorage.setItem(key, JSON.stringify(data));
    } catch {
      // React remains the source of truth when the compatibility layer cannot persist.
    }
  };

  document.addEventListener("click", (event) => {
    const target = event.target as Element | null;
    const role = roleFromElement(target?.closest("button, [role='button']") || target);
    if (role) {
      markChoice(role);
      sessionStorage.setItem("imobfy-selected-role", role);
      return;
    }

    const button = target?.closest("button");
    const text = normalize(button?.textContent);
    if (!button || !(text === "salvar" || text.includes("salvar perfil") || text.includes("começar"))) return;

    const selected = sessionStorage.getItem("imobfy-selected-role");
    if (selected !== "Corretor" && selected !== "Captador") return;

    window.setTimeout(() => persistSelectedRole(selected), 50);
  }, true);

  const observer = new MutationObserver(() => {
    const selected = sessionStorage.getItem("imobfy-selected-role");
    if (selected === "Corretor" || selected === "Captador") markChoice(selected);
  });

  observer.observe(document.documentElement, { childList: true, subtree: true });
}
