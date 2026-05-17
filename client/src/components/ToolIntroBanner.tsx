import { useEffect, useState } from "react";
import { Info, X } from "lucide-react";

interface ToolIntroBannerProps {
  toolId: "sentinel" | "rapid7" | "elk" | "edr";
  message: string;
}

const storageKey = (toolId: string) => `tool_intro_seen_${toolId}`;

export function ToolIntroBanner({ toolId, message }: ToolIntroBannerProps) {
  const [show, setShow] = useState<boolean | null>(null);

  useEffect(() => {
    try {
      setShow(localStorage.getItem(storageKey(toolId)) !== "true");
    } catch {
      setShow(true);
    }
  }, [toolId]);

  if (show === null || show === false) return null;

  const dismiss = () => {
    try {
      localStorage.setItem(storageKey(toolId), "true");
    } catch {}
    setShow(false);
  };

  return (
    <div
      className="flex items-start gap-2 px-3 py-2 text-[11px] leading-relaxed"
      style={{
        backgroundColor: "rgba(56, 132, 255, 0.10)",
        borderBottom: "1px solid rgba(56, 132, 255, 0.30)",
        color: "#cfe1ff",
      }}
      data-testid={`tool-intro-${toolId}`}
    >
      <Info className="h-3.5 w-3.5 mt-0.5 shrink-0" style={{ color: "#7faaff" }} />
      <div className="flex-1">{message}</div>
      <button
        onClick={dismiss}
        className="shrink-0 text-white/60 hover:text-white"
        data-testid={`tool-intro-${toolId}-dismiss`}
        title="Dismiss"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

export const INTRO_TEXT: Record<ToolIntroBannerProps["toolId"], string> = {
  sentinel:
    "You're in Microsoft Sentinel's Log Analytics workspace. Use KQL to query logs. Start with the starter query, then pivot on entities you find.",
  rapid7:
    "This is Rapid7 InsightIDR Log Search. Use key=value LEQL queries to search across log sets. Check the Assets tab for the device risk score.",
  elk:
    "This is Kibana Discover (ELK Stack). Use Lucene/KQL syntax to search across ECS-formatted events. The field list on the left lets you add columns.",
  edr:
    "This is Microsoft Defender for Endpoint's device view. Review the risk level, active alerts, and logged-on users before pivoting back to KQL.",
};
