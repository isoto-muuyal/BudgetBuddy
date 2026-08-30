import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { ArrowLeft, Loader2, Plus, Sparkles, Trash2 } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { parseMoney } from "@/lib/debt-plan";
import type { QuickExpenseNote, QuickNoteItem } from "@shared/schema";

interface NoteEditorModalProps {
  open: boolean;
  noteId: string | null;
  onOpenChange: (open: boolean) => void;
  onBack: () => void;
}

const EMPTY_ITEM: QuickNoteItem = { name: "", amount: "", paidAmount: "", dueDate: "" };
const HANDWRITTEN_FIELD =
  "border-0 border-b border-yellow-900/40 bg-transparent font-handwriting text-lg text-yellow-950 rounded-none px-1 focus-visible:ring-0 focus-visible:border-yellow-900";

function formatCurrency(value: number): string {
  return value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function NoteEditorModal({ open, noteId, onOpenChange, onBack }: NoteEditorModalProps) {
  const { toast } = useToast();
  const [description, setDescription] = useState("");
  const [items, setItems] = useState<QuickNoteItem[]>([{ ...EMPTY_ITEM }]);
  const [reviewContext, setReviewContext] = useState("");

  const noteQuery = useQuery<QuickExpenseNote>({
    queryKey: ["/api/quick-notes", noteId],
    enabled: open && !!noteId,
  });

  useEffect(() => {
    if (noteQuery.data) {
      setDescription(noteQuery.data.description);
      const loadedItems = Array.isArray(noteQuery.data.items) ? (noteQuery.data.items as QuickNoteItem[]) : [];
      setItems(loadedItems.length ? loadedItems : [{ ...EMPTY_ITEM }]);
    }
  }, [noteQuery.data]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("PATCH", `/api/quick-notes/${noteId}`, {
        description,
        items: items.filter((item) => item.name.trim() || item.amount.trim()),
      });
      return (await response.json()) as QuickExpenseNote;
    },
    onSuccess: (note) => {
      queryClient.invalidateQueries({ queryKey: ["/api/quick-notes"] });
      queryClient.setQueryData(["/api/quick-notes", noteId], note);
      toast({ title: "Note saved" });
    },
    onError: (error: any) => {
      toast({ title: "Could not save note", description: error?.message || "Please try again.", variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async () => apiRequest("DELETE", `/api/quick-notes/${noteId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/quick-notes"] });
      toast({ title: "Note deleted" });
      onBack();
    },
    onError: (error: any) => {
      toast({ title: "Could not delete note", description: error?.message || "Please try again.", variant: "destructive" });
    },
  });

  const reviewMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", `/api/quick-notes/${noteId}/review`, { context: reviewContext });
      return (await response.json()) as QuickExpenseNote;
    },
    onSuccess: (note) => {
      queryClient.setQueryData(["/api/quick-notes", noteId], note);
    },
    onError: (error: any) => {
      toast({ title: "AI review failed", description: error?.message || "Please try again.", variant: "destructive" });
    },
  });

  const totals = useMemo(
    () =>
      items.reduce(
        (acc, item) => {
          acc.amount += parseMoney(item.amount);
          acc.paid += parseMoney(item.paidAmount || "0");
          return acc;
        },
        { amount: 0, paid: 0 }
      ),
    [items]
  );

  const updateItem = (index: number, patch: Partial<QuickNoteItem>) => {
    setItems((current) => current.map((item, i) => (i === index ? { ...item, ...patch } : item)));
  };

  const addRow = () => setItems((current) => [...current, { ...EMPTY_ITEM }]);
  const removeRow = (index: number) => setItems((current) => current.filter((_, i) => i !== index));

  const note = noteQuery.data;
  const isLoadingNote = !noteId || noteQuery.isLoading;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl bg-[#fdf6d8]">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" onClick={onBack} className="h-8 w-8 text-yellow-900">
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <DialogTitle className="font-handwriting text-2xl text-yellow-950">Quick Note</DialogTitle>
          </div>
        </DialogHeader>

        {isLoadingNote ? (
          <div className="flex items-center justify-center py-12 text-yellow-800">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        ) : (
          <div className="space-y-5">
            <Textarea
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="What's this note about? e.g. Road trip from Chihuahua to Saucillo"
              className="min-h-16 resize-none border-0 border-b-2 border-yellow-900/30 bg-transparent font-handwriting text-xl leading-relaxed text-yellow-950 rounded-none px-1 focus-visible:ring-0"
            />

            <div className="space-y-2">
              <div className="grid grid-cols-[1.4fr_0.8fr_0.8fr_0.8fr_auto] gap-2 text-xs uppercase tracking-wide text-yellow-800/70">
                <span>Expense</span>
                <span>Amount</span>
                <span>Paid (optional)</span>
                <span>Due date (optional)</span>
                <span />
              </div>
              {items.map((item, index) => (
                <div key={index} className="grid grid-cols-[1.4fr_0.8fr_0.8fr_0.8fr_auto] items-center gap-2">
                  <Input
                    value={item.name}
                    onChange={(event) => updateItem(index, { name: event.target.value })}
                    placeholder="gasoline"
                    className={HANDWRITTEN_FIELD}
                  />
                  <Input
                    value={item.amount}
                    onChange={(event) => updateItem(index, { amount: event.target.value })}
                    placeholder="100"
                    inputMode="decimal"
                    className={HANDWRITTEN_FIELD}
                  />
                  <Input
                    value={item.paidAmount}
                    onChange={(event) => updateItem(index, { paidAmount: event.target.value })}
                    placeholder="-"
                    inputMode="decimal"
                    className={HANDWRITTEN_FIELD}
                  />
                  <Input
                    value={item.dueDate}
                    onChange={(event) => updateItem(index, { dueDate: event.target.value })}
                    placeholder="-"
                    className={HANDWRITTEN_FIELD}
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => removeRow(index)}
                    className="h-8 w-8 text-yellow-800/60 hover:text-red-600"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
              <Button variant="ghost" size="sm" onClick={addRow} className="text-yellow-800 hover:bg-yellow-900/10">
                <Plus className="mr-2 h-4 w-4" />
                Add row
              </Button>

              <div className="grid grid-cols-[1.4fr_0.8fr_0.8fr_0.8fr_auto] gap-2 border-t-2 border-double border-yellow-900/50 pt-2 font-handwriting text-lg font-semibold text-yellow-950">
                <span>Total</span>
                <span>${formatCurrency(totals.amount)}</span>
                <span>${formatCurrency(totals.paid)}</span>
                <span />
                <span />
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 border-t border-yellow-900/20 pt-4">
              <Button
                onClick={() => saveMutation.mutate()}
                disabled={saveMutation.isPending}
                className="bg-yellow-700 text-yellow-50 hover:bg-yellow-800"
              >
                {saveMutation.isPending ? "Saving..." : "Save"}
              </Button>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="outline" className="border-yellow-900/30 text-yellow-900 hover:bg-yellow-900/10">
                    Delete
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete this note?</AlertDialogTitle>
                    <AlertDialogDescription>This cannot be undone.</AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={() => deleteMutation.mutate()}>Delete</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>

            <div className="space-y-2 rounded-md border border-yellow-900/20 bg-yellow-100/60 p-3">
              <div className="flex items-center gap-2 text-sm font-semibold text-yellow-900">
                <Sparkles className="h-4 w-4" />
                Ask AI to review
              </div>
              <Textarea
                value={reviewContext}
                onChange={(event) => setReviewContext(event.target.value)}
                placeholder="Any extra context for the AI? (optional)"
                className="min-h-14 resize-none bg-white/70 font-sans text-sm"
              />
              <Button
                size="sm"
                onClick={() => reviewMutation.mutate()}
                disabled={reviewMutation.isPending}
                className="bg-amber-500 text-amber-950 hover:bg-amber-400"
              >
                {reviewMutation.isPending ? "Thinking..." : "Ask AI to review"}
              </Button>

              {note?.aiReview && (
                <div className="mt-2 rounded-md bg-white/80 p-3 font-sans text-sm text-gray-800">
                  <div className="mb-1 text-xs text-gray-500">
                    Reviewed {note.aiReviewedAt ? new Date(note.aiReviewedAt).toLocaleString() : ""}
                  </div>
                  {note.aiReview}
                </div>
              )}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
