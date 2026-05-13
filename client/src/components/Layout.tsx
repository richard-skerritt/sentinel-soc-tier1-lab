import { Link, useLocation } from "wouter";
import { Shield, Inbox, GraduationCap, MessageCircle, BarChart3, Settings, Home, Volume2, VolumeX } from "lucide-react";
import { ReactNode } from "react";
import { useMuted, useVoiceConfigured, stopVoice } from "@/lib/voice";

const nav = [
  { to: "/", label: "Briefing", icon: Home },
  { to: "/queue", label: "Queue", icon: Inbox },
  { to: "/learn", label: "Learn", icon: GraduationCap },
  { to: "/mentor", label: "Mentor", icon: MessageCircle },
  { to: "/dashboard", label: "Dashboard", icon: BarChart3 },
  { to: "/settings", label: "Settings", icon: Settings },
];

export function Layout({ children }: { children: ReactNode }) {
  const [loc] = useLocation();
  const [muted, setMuted] = useMuted();
  const voiceConfigured = useVoiceConfigured();
  return (
    <div className="flex h-screen overflow-hidden">
      <aside className="w-56 shrink-0 bg-sidebar border-r border-sidebar-border flex flex-col">
        <div className="px-4 py-4 border-b border-sidebar-border flex items-center gap-2">
          <Shield className="h-5 w-5 text-primary" />
          <div className="leading-tight">
            <div className="text-sm font-semibold tracking-tight">SENTINEL</div>
            <div className="text-[10px] uppercase tracking-widest text-muted-foreground">SOC Tier 1 Lab</div>
          </div>
        </div>
        <nav className="flex-1 p-2 space-y-1">
          {nav.map((n) => {
            const Icon = n.icon;
            const active = loc === n.to || (n.to !== "/" && loc.startsWith(n.to));
            return (
              <Link key={n.to} href={n.to} data-testid={`nav-${n.label.toLowerCase()}`}>
                <div
                  className={`flex items-center gap-2 px-3 py-2 text-sm rounded-md cursor-pointer transition-colors ${
                    active
                      ? "bg-sidebar-accent text-foreground"
                      : "text-muted-foreground hover:bg-sidebar-accent/50 hover:text-foreground"
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  <span>{n.label}</span>
                </div>
              </Link>
            );
          })}
        </nav>
        <div className="p-2 border-t border-sidebar-border space-y-2">
          <button
            type="button"
            onClick={() => {
              const next = !muted;
              setMuted(next);
              if (next) stopVoice();
            }}
            disabled={!voiceConfigured}
            data-testid="toggle-mute"
            title={voiceConfigured ? (muted ? "Unmute Morgan" : "Mute Morgan") : "Add ElevenLabs key in Settings"}
            className={`w-full flex items-center gap-2 px-3 py-2 text-sm rounded-md transition-colors ${
              voiceConfigured
                ? "text-muted-foreground hover:bg-sidebar-accent/50 hover:text-foreground cursor-pointer"
                : "text-muted-foreground/40 cursor-not-allowed"
            }`}
          >
            {muted || !voiceConfigured ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
            <span>
              {!voiceConfigured ? "Voice off" : muted ? "Voice muted" : "Voice on"}
            </span>
          </button>
          <div className="px-1 text-[10px] text-muted-foreground">
            <div className="mono">FROZEN_NOW</div>
            <div className="mono">2026-05-13T12:00Z</div>
          </div>
        </div>
      </aside>
      <main className="flex-1 overflow-auto scrollbar-thin">{children}</main>
    </div>
  );
}
