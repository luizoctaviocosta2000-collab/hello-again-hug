type Message = { role: string; body: string };

/** Drafts and notes were never sent to the customer. Do not teach the model
 * that a proposed response was actually said, or repeat the latest question. */
export function attendanceContext(messages: Message[]) {
  const questions = messages.filter((message) => message.role === "customer");
  const last = questions.at(-1);
  if (!last) return null;
  return {
    message: last.body,
    history: questions
      .slice(0, -1)
      .slice(-12)
      .map((message) => ({
        role: "customer" as const,
        text: message.body,
      })),
  };
}
