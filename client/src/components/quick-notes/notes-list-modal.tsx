import { useMutation, useQuery } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { cn } from "@/lib/utils";
import type { QuickExpenseNote } from "@shared/schema";

interface NotesListModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelectNote: (id: string) => void;
  onCreateNote: (id: string) => void;
}

const STICKY_ROTATIONS = ["-rotate-2", "rotate-1", "-rotate-1", "rotate-2", "rotate-0", "rotate-3"];

export default function NotesListModal({ open, onOpenChange, onSelectNote, onCreateNote }: NotesListModalProps) {
  const { toast } = useToast();

  const notesQuery = useQuery<QuickExpenseNote[]>({
    queryKey: ["/api/quick-notes"],
    enabled: open,
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/quick-notes", { description: "", items: [] });
      return (await response.json()) as QuickExpenseNote;
    },
    onSuccess: (note) => {
      queryClient.invalidateQueries({ queryKey: ["/api/quick-notes"] });
      onCreateNote(note.id);
    },
    onError: (error: any) => {
      toast({
        title: "Could not create note",
        description: error?.message || "Please try again.",
        variant: "destructive",
      });
    },
  });

  const notes = notesQuery.data ?? [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl bg-[#f5f0e0]">
        <DialogHeader>
          <DialogTitle className="font-handwriting text-2xl text-yellow-950">Quick Expense Notes</DialogTitle>
        </DialogHeader>
        <div className="grid max-h-[60vh] grid-cols-2 gap-4 overflow-y-auto p-1 sm:grid-cols-3">
          <button
            type="button"
            onClick={() => createMutation.mutate()}
            disabled={createMutation.isPending}
            className="flex aspect-square flex-col items-center justify-center gap-2 rounded-sm border-2 border-dashed border-amber-500 text-amber-700 transition-colors hover:bg-amber-50"
          >
            <Plus className="h-8 w-8" />
            <span className="font-handwriting text-lg">
              {createMutation.isPending ? "Creating..." : "New note"}
            </span>
          </button>
          {notes.map((note, index) => (
            <button
              key={note.id}
              type="button"
              onClick={() => onSelectNote(note.id)}
              className={cn(
                "flex aspect-square flex-col justify-between rounded-sm bg-yellow-200 p-4 text-left shadow-md transition-transform hover:scale-[1.03] hover:shadow-lg",
                STICKY_ROTATIONS[index % STICKY_ROTATIONS.length]
              )}
            >
              <p className="font-handwriting line-clamp-5 text-lg text-yellow-950">
                {note.description || "Untitled note"}
              </p>
              <span className="font-handwriting text-xs text-yellow-800/70">
                {new Date(note.updatedAt).toLocaleDateString()}
              </span>
            </button>
          ))}
          {notes.length === 0 && !notesQuery.isLoading && (
            <div className="col-span-full py-8 text-center text-sm text-muted-foreground">
              No notes yet. Click "New note" to jot one down.
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
