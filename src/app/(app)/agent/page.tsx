import { AgentChat } from "@/components/agent/agent-chat";

export default function AgentPage() {
  return (
    <div className="p-4 md:p-8">
      <div className="page-canvas">
        <AgentChat />
      </div>
    </div>
  );
}
