import { NotesBuddy } from "@/components/notes-buddy";

export default function Home() {
  return (
    <main className="flex h-screen w-full flex-col items-center justify-center bg-background p-4">
      {/* Ambient glow — a soft rose wash in the top-right corner so the flat
          black background reads as a designed surface, not a void. */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 -z-10"
        style={{
          background:
            "radial-gradient(600px circle at 80% 10%, rgba(214,156,174,0.08), transparent 60%)",
        }}
      />
      <div className="w-full max-w-5xl h-[85vh] flex flex-col">
        <header className="mb-4 px-2">
          <h1 className="font-display text-xl font-semibold text-text-primary">
            AI Study Notes Buddy
          </h1>
          <p className="text-sm text-text-secondary">
            Paste lecture notes — get a summary, flashcards &amp; a quiz
          </p>
        </header>
        <NotesBuddy />
      </div>
    </main>
  );
}
