// Copyright © 2026 Richard Skerritt. All rights reserved.
// See LICENSE for permitted use terms.
import { motion } from "framer-motion";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Lightbulb } from "lucide-react";
import { getGuideIntro } from "@/lib/tutorialEngine";
import type { RunbookCategory } from "@/lib/types";

interface CategoryIntroDialogProps {
  open: boolean;
  category: RunbookCategory | null;
  onAccept: () => void;
  onDismiss: () => void;
}

export function CategoryIntroDialog({
  open,
  category,
  onAccept,
  onDismiss,
}: CategoryIntroDialogProps) {
  const intro = category ? getGuideIntro(category) : null;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onDismiss()}>
      <DialogContent className="max-w-xl">
        {!intro ? (
          <>
            <DialogHeader>
              <DialogTitle>No intro</DialogTitle>
            </DialogHeader>
            <p className="text-sm text-muted-foreground">
              No intro defined for this category — add one to <code className="mono">guideSteps.json</code>.
            </p>
          </>
        ) : (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2 }}
            className="space-y-4"
          >
            <DialogHeader>
              <DialogTitle className="text-base">{intro.title}</DialogTitle>
            </DialogHeader>

            <div className="text-sm leading-relaxed space-y-2.5 whitespace-pre-line">
              {intro.body.split("\n\n").map((para, i) => (
                <p key={i}>{para}</p>
              ))}
            </div>

            <blockquote className="rounded border-l-4 border-l-yellow-500 border-y border-r border-yellow-900/40 bg-yellow-900/10 text-yellow-100/90 p-3 flex items-start gap-2">
              <Lightbulb className="h-4 w-4 mt-0.5 shrink-0 text-yellow-400" />
              <span className="text-sm italic leading-relaxed">{intro.analogy}</span>
            </blockquote>

            <div className="flex justify-end gap-2 pt-1">
              <Button variant="outline" size="sm" onClick={onDismiss} data-testid="intro-skip">
                Not now
              </Button>
              <Button size="sm" onClick={onAccept} data-testid="intro-accept">
                Got it, let's investigate
              </Button>
            </div>
          </motion.div>
        )}
      </DialogContent>
    </Dialog>
  );
}
