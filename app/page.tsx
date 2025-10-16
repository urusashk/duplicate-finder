import DuplicateFinder from "@/components/duplicate-finder"

export default function Page() {
  return (
    <main className="mx-auto max-w-3xl p-6">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold text-pretty">Duplicate File Finder</h1>
        <p className="text-sm text-muted-foreground">
          Scan a folder to find duplicate files by name, size, or content hash.
        </p>
      </header>
      <DuplicateFinder />
      <footer className="mt-8 text-xs text-muted-foreground">
        Built for minimalism. No files are uploaded; processing happens locally in your browser.
      </footer>
    </main>
  )
}
