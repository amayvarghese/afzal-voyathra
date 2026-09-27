"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/primitives";
import { ConfirmDialog } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/toast";

export function DeleteFormButton({ id, title, responseCount }: { id: string; title: string; responseCount: number }) {
  const router = useRouter();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function remove() {
    setDeleting(true);
    const res = await fetch(`/api/admin/forms/${id}`, { method: "DELETE" });
    if (res.ok) {
      toast("Questionnaire deleted");
      router.replace("/admin");
      router.refresh();
    } else {
      setDeleting(false);
      toast("Delete failed — please try again", "error");
    }
  }

  return (
    <>
      <Button variant="secondary" onClick={() => setOpen(true)} className="hover:border-danger/40 hover:bg-danger-soft hover:text-danger" aria-label={`Delete ${title}`}>
        <Trash2 className="size-4" aria-hidden />
        <span className="hidden sm:inline">Delete</span>
      </Button>
      <ConfirmDialog
        open={open}
        onClose={() => setOpen(false)}
        onConfirm={remove}
        loading={deleting}
        title="Delete questionnaire?"
        description={
          <>
            <strong className="font-medium text-fg">{title}</strong>
            {responseCount > 0
              ? ` and its ${responseCount} ${responseCount === 1 ? "response" : "responses"} will be permanently deleted from the database.`
              : " will be permanently deleted."}{" "}
            The share link will stop working. This can&apos;t be undone.
          </>
        }
        confirmLabel="Delete forever"
      />
    </>
  );
}
