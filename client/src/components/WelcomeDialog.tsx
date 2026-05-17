import { motion } from "framer-motion";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Code2, Book, Shield, GraduationCap } from "lucide-react";

interface WelcomeDialogProps {
  open: boolean;
  onEnableGuided: () => void;
  onJustExplore: () => void;
}

export function WelcomeDialog({
  open,
  onEnableGuided,
  onJustExplore,
}: WelcomeDialogProps) {
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onJustExplore()}>
      <DialogContent className="max-w-2xl">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25 }}
          className="space-y-5"
        >
          <DialogHeader>
            <DialogTitle className="text-base flex items-center gap-2">
              <GraduationCap className="h-5 w-5 text-primary" />
              Welcome to your first alert, SOC Analyst.
            </DialogTitle>
          </DialogHeader>

          <p className="text-sm leading-relaxed">
            Here is how the workspace is laid out — three panels you'll bounce between every shift:
          </p>

          {/* Visual layout sketch */}
          <div className="grid grid-cols-3 gap-2 text-[11px]">
            <LayoutBox
              icon={<Shield className="h-4 w-4 text-primary" />}
              title="Alert info"
              body="Severity, entities, MITRE, and your investigation goals checklist."
            />
            <LayoutBox
              icon={<Code2 className="h-4 w-4 text-primary" />}
              title="Tools"
              body="Sentinel KQL / Rapid7 / ELK / EDR — switch tabs to see the same attack in each."
              accent
            />
            <LayoutBox
              icon={<Book className="h-4 w-4 text-primary" />}
              title="Runbook & triage"
              body="Step-by-step playbook on top. Notebook and triage on the bottom."
            />
          </div>

          <p className="text-sm leading-relaxed text-muted-foreground">
            The <strong className="text-foreground">runbook on the right</strong> guides every
            step. Turn on Guided Mode for interactive coaching — each runbook step gets a "Guide
            me" button that opens a plain-English walkthrough with practice exercises.
          </p>

          <div className="flex flex-wrap items-center justify-end gap-2 pt-1">
            <Button
              variant="outline"
              size="sm"
              onClick={onJustExplore}
              data-testid="welcome-explore"
            >
              Just explore
            </Button>
            <Button
              size="sm"
              onClick={onEnableGuided}
              className="gap-1.5"
              data-testid="welcome-guided"
            >
              <GraduationCap className="h-3.5 w-3.5" />
              Turn on Guided Mode and start
            </Button>
          </div>
        </motion.div>
      </DialogContent>
    </Dialog>
  );
}

function LayoutBox({
  icon,
  title,
  body,
  accent,
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
  accent?: boolean;
}) {
  return (
    <div
      className={`rounded border p-3 text-left ${
        accent
          ? "border-primary/40 bg-primary/5"
          : "border-border bg-card/60"
      }`}
    >
      <div className="flex items-center gap-1.5 mb-1.5">
        {icon}
        <div className="text-xs font-semibold">{title}</div>
      </div>
      <p className="text-[11px] text-muted-foreground leading-snug">{body}</p>
    </div>
  );
}
