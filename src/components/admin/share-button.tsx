"use client";

import { useState } from "react";
import { Check, Copy, ExternalLink, Mail, Share2 } from "lucide-react";
import { Button, Input, buttonClass } from "@/components/ui/primitives";
import { Dialog } from "@/components/ui/dialog";

export function ShareButton({ slug, isOpen }: { slug: string; isOpen: boolean }) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  // Only needed once the dialog is open, which never happens during SSR.
  const url = open ? `${window.location.origin}/f/${slug}` : "";

  async function copy() {
    await navigator.clipboard.writeText(url).catch(() => undefined);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  }

  return (
    <>
      <div className="flex shrink-0 gap-2">
        <a href={`/f/${slug}`} target="_blank" rel="noreferrer" className={buttonClass("secondary")}>
          <ExternalLink className="size-4" aria-hidden /> Preview
        </a>
        <Button onClick={() => setOpen(true)}>
          <Share2 className="size-4" aria-hidden /> Share
        </Button>
      </div>
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title="Share with customers"
        description={isOpen ? "Anyone with this link can fill in the questionnaire." : "This questionnaire is closed — the link will show a closed notice until you reopen it in Settings."}
      >
        <div className="flex gap-2">
          <Input readOnly value={url} onFocus={(e) => e.currentTarget.select()} aria-label="Share link" className="font-mono text-[13px]" />
          <Button onClick={copy} className="shrink-0" aria-live="polite">
            {copied ? <Check className="size-4" aria-hidden /> : <Copy className="size-4" aria-hidden />}
            {copied ? "Copied" : "Copy"}
          </Button>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <a
            className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-border px-3 text-[13px] font-medium text-fg hover:bg-surface-2"
            href={`mailto:?subject=${encodeURIComponent("A short questionnaire for you")}&body=${encodeURIComponent(`Hello,\n\nCould you please take a few minutes to complete this questionnaire?\n\n${url}\n\nThank you!`)}`}
          >
            <Mail className="size-4" aria-hidden /> Compose email
          </a>
          <a
            className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-border px-3 text-[13px] font-medium text-fg hover:bg-surface-2"
            href={`https://wa.me/?text=${encodeURIComponent(url)}`}
            target="_blank"
            rel="noreferrer"
          >
            WhatsApp
          </a>
        </div>
      </Dialog>
    </>
  );
}
