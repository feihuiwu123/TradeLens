import { AssistantChat } from "@/components/assistant-chat";
import { SectionTitle } from "@/components/ui";

export const dynamic = "force-dynamic";

export default function AssistantPage() {
  return (
    <main className="mx-auto max-w-7xl px-5 py-12">
      <SectionTitle
        kicker="TRADE ASSISTANT"
        title="贸差眼助手"
        desc="站内助手直接读货源库、税则和运价。你也可以把同一套 API 交给 Hermes、Claude 或任何个人助手。"
      />
      <AssistantChat />
    </main>
  );
}
