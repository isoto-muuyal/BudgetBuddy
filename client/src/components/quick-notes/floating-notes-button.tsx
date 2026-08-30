import { useState } from "react";
import { NotebookPen } from "lucide-react";
import NotesListModal from "./notes-list-modal";
import NoteEditorModal from "./note-editor-modal";

type NotesUiState = { view: "closed" } | { view: "list" } | { view: "editor"; noteId: string | null };

export default function FloatingNotesButton() {
  const [state, setState] = useState<NotesUiState>({ view: "closed" });

  return (
    <>
      <button
        type="button"
        onClick={() => setState({ view: "list" })}
        aria-label="Quick expense notes"
        className="fixed bottom-6 right-6 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-amber-400 text-amber-950 shadow-xl transition-transform hover:scale-105 hover:bg-amber-300 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-2"
      >
        <NotebookPen className="h-6 w-6" />
      </button>

      <NotesListModal
        open={state.view === "list"}
        onOpenChange={(open) => setState(open ? { view: "list" } : { view: "closed" })}
        onSelectNote={(id) => setState({ view: "editor", noteId: id })}
        onCreateNote={(id) => setState({ view: "editor", noteId: id })}
      />

      <NoteEditorModal
        open={state.view === "editor"}
        noteId={state.view === "editor" ? state.noteId : null}
        onOpenChange={(open) => setState(open ? state : { view: "closed" })}
        onBack={() => setState({ view: "list" })}
      />
    </>
  );
}
