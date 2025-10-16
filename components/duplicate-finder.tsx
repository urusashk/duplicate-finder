"use client"

import React from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

type Criterion = "hash" | "name" | "size"

type Grouped = Record<string, File[]>

function getRelativePath(file: File) {
  // webkitRelativePath is available when selecting a directory
  return (file as any).webkitRelativePath || file.name
}

async function sha256(file: File) {
  const buf = await file.arrayBuffer()
  const digest = await crypto.subtle.digest("SHA-256", buf)
  const bytes = new Uint8Array(digest)
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
}

export default function DuplicateFinder() {
  const inputRef = React.useRef<HTMLInputElement | null>(null)
  const [files, setFiles] = React.useState<File[]>([])
  const [criterion, setCriterion] = React.useState<Criterion>("hash")
  const [results, setResults] = React.useState<Grouped>({})
  const [scanning, setScanning] = React.useState(false)
  const [progress, setProgress] = React.useState(0)
  const [logs, setLogs] = React.useState<string[]>([])
  const log = React.useCallback((msg: string) => {
    // keep memory bounded: retain last ~1500 lines
    setLogs((prev) => (prev.length > 2000 ? [...prev.slice(-1500), msg] : [...prev, msg]))
  }, [])

  const handlePickFolder = () => inputRef.current?.click()

  const handleFilesChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const list = e.target.files ? Array.from(e.target.files) : []
    setFiles(list)
    setResults({})
    setProgress(0)
    setLogs([]) // reset process log
  }

  const groupByName = (items: File[]) => {
    const map: Grouped = {}
    let i = 0
    for (const f of items) {
      i += 1
      const key = f.name
      log(`[name] [${i}/${items.length}] pigeonhole key = "${key}" <= ${getRelativePath(f)}`)
      if (!map[key]) map[key] = []
      map[key].push(f)
    }
    log(`[name] grouping complete. Unique keys: ${Object.keys(map).length}`)
    return filterGroups(map)
  }

  const groupBySize = (items: File[]) => {
    const map: Grouped = {}
    let i = 0
    for (const f of items) {
      i += 1
      const key = String(f.size)
      log(`[size] [${i}/${items.length}] size=${f.size} bytes -> key "${key}" <= ${getRelativePath(f)}`)
      if (!map[key]) map[key] = []
      map[key].push(f)
    }
    log(`[size] grouping complete. Unique keys: ${Object.keys(map).length}`)
    return filterGroups(map)
  }

  const groupByHash = async (items: File[]) => {
    const map: Grouped = {}
    let done = 0
    for (const f of items) {
      const rel = getRelativePath(f)
      log(`[hash] [${done + 1}/${items.length}] hashing ${rel} (SHA-256)`)
      const key = await sha256(f)
      log(`[hash] → ${rel} digest=${key}`)
      if (!map[key]) map[key] = []
      map[key].push(f)
      done += 1
      setProgress(done / items.length)
      if (done % 25 === 0) await new Promise((r) => setTimeout(r, 0))
    }
    log(`[hash] hashing complete. Unique digests: ${Object.keys(map).length}`)
    return filterGroups(map)
  }

  const filterGroups = (map: Grouped) => {
    const out: Grouped = {}
    for (const k of Object.keys(map)) {
      if (map[k].length > 1) out[k] = map[k]
    }
    return out
  }

  const scan = async () => {
    if (!files.length) return
    setScanning(true)
    setResults({})
    setProgress(0)
    setLogs((prev) => [
      ...prev,
      `=== Scan started (${new Date().toLocaleString()}) ===`,
      `Selected criterion: ${criterion}`,
      criterion === "name"
        ? "Process: Using the pigeonhole principle by file name. Each file goes into a bucket keyed by its name; buckets with >1 file are duplicates."
        : criterion === "size"
          ? "Process: Using the pigeonhole principle by file size. Each file goes into a bucket keyed by its byte size; buckets with >1 file are potential duplicates."
          : "Process: Computing SHA-256 for each file (content-based). Files with the same digest are true duplicates.",
    ])

    try {
      if (criterion === "name") {
        setResults(groupByName(files))
        setProgress(1)
      } else if (criterion === "size") {
        setResults(groupBySize(files))
        setProgress(1)
      } else {
        const r = await groupByHash(files)
        setResults(r)
        setProgress(1)
      }
    } finally {
      setScanning(false)
      setLogs((prev) => [...prev, `=== Scan finished (${new Date().toLocaleString()}) ===`])
    }
  }

  const totalGroups = Object.keys(results).length

  return (
    <Card className="bg-card text-card-foreground">
      <CardHeader>
        <CardTitle className="text-base">Select Folder and Scan</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <input
          ref={inputRef}
          type="file"
          className="hidden"
          // Note: directory and webkitdirectory enable folder selection in supported browsers
          // @ts-expect-error non-standard attributes for folder selection
          webkitdirectory="true"
          // @ts-expect-error non-standard attributes for folder selection
          directory=""
          multiple
          onChange={handleFilesChange}
          aria-hidden="true"
        />

        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-3">
            <Button variant="secondary" onClick={handlePickFolder} className="min-w-32">
              Choose Folder
            </Button>
            <span className="text-sm text-muted-foreground" aria-live="polite">
              {files.length ? `${files.length} files selected` : "No folder selected"}
            </span>
          </div>

          <fieldset className="flex flex-wrap items-center gap-3" aria-label="Detection criterion">
            <legend className="sr-only">Detection criterion</legend>
            <label className="inline-flex items-center gap-2 text-sm">
              <input
                type="radio"
                name="criterion"
                value="hash"
                checked={criterion === "hash"}
                onChange={() => setCriterion("hash")}
                className="accent-primary"
              />
              <span>Content (hash)</span>
            </label>
            <label className="inline-flex items-center gap-2 text-sm">
              <input
                type="radio"
                name="criterion"
                value="name"
                checked={criterion === "name"}
                onChange={() => setCriterion("name")}
                className="accent-primary"
              />
              <span>File name</span>
            </label>
            <label className="inline-flex items-center gap-2 text-sm">
              <input
                type="radio"
                name="criterion"
                value="size"
                checked={criterion === "size"}
                onChange={() => setCriterion("size")}
                className="accent-primary"
              />
              <span>File size</span>
            </label>
          </fieldset>

          <div className="flex items-center gap-3">
            <Button onClick={scan} disabled={!files.length || scanning} className="min-w-24">
              {scanning ? "Scanning..." : "Scan"}
            </Button>
            {scanning ? (
              <div className="text-xs text-muted-foreground" aria-live="polite">
                {Math.round(progress * 100)}%
              </div>
            ) : null}
          </div>
        </div>

        <div className="pt-2">
          <h2 className="text-sm font-medium">
            {totalGroups ? `Duplicate groups: ${totalGroups}` : "No duplicates yet"}
          </h2>

          <div className="mt-3 space-y-4">
            {Object.entries(results).map(([groupKey, groupFiles], idx) => (
              <div key={groupKey} className="rounded-md border border-border p-3">
                <div className="mb-2 text-sm font-medium">Group {idx + 1}</div>
                <ul className="list-disc pl-5 text-sm">
                  {groupFiles.map((f, i) => (
                    <li key={i} className="break-all">
                      {getRelativePath(f)}{" "}
                      <span className="text-muted-foreground">({(f.size / 1024).toFixed(1)} KB)</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}

            {!scanning && files.length > 0 && totalGroups === 0 ? (
              <div className="text-sm text-muted-foreground">
                No duplicate files found based on the selected criterion.
              </div>
            ) : null}
          </div>
        </div>

        <div className="mt-6 space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium">Process log</h3>
            <div className="flex items-center gap-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  const text = logs.join("\n")
                  navigator.clipboard?.writeText(text)
                }}
                disabled={!logs.length}
                aria-label="Copy process log"
              >
                Copy
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setLogs([])}
                disabled={!logs.length}
                aria-label="Clear process log"
              >
                Clear
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => window.print()}
                disabled={!logs.length}
                aria-label="Print process log"
              >
                Print
              </Button>
            </div>
          </div>
          <pre
            className="max-h-64 overflow-auto rounded-md border border-border bg-muted/30 p-3 text-xs leading-5"
            aria-live="polite"
          >
            {logs.join("\n")}
          </pre>
          <p className="text-xs text-muted-foreground">
            Explanation: name and size modes bucket files by that attribute (pigeonhole principle). Hash mode reads file
            bytes and computes a SHA-256 digest using the Web Crypto API; equal digests indicate identical content.
          </p>
        </div>
      </CardContent>
    </Card>
  )
}
