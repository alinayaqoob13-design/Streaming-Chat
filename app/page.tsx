import { NotesBuddy } from "@/components/notes-buddy";

export default function Home() {
  return (
    <main className="flex h-screen w-full flex-col items-center justify-center bg-background p-4">
      <div className="w-full max-w-3xl h-[85vh] flex flex-col">
        <header className="mb-4 flex items-center justify-between px-2">
          <div>
            <h1 className="font-display text-xl font-semibold text-text-primary">
              AI Study Notes Buddy
            </h1>
            <p className="text-sm text-text-secondary">
              Paste lecture notes — get a summary, flashcards &amp; a quiz
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="inline-flex h-2 w-2 rounded-full bg-success animate-pulse" />
            <span className="text-xs text-text-muted">Live</span>
          </div>
        </header>
        <NotesBuddy />
      </div>
    </main>
  );
}
