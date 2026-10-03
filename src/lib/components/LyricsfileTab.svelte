<script lang="ts">
    import { formatMs } from "$lib/lyricsfile/parser";
    import { validateLyricsfileYaml, type LyricsfileValidationResult } from "$lib/lyricsfile/validator";

    let {
        lyricsfile = $bindable(""),
        trackName = $bindable(""),
        artistName = $bindable(""),
        albumName = $bindable(""),
        duration = $bindable(""),
    }: {
        lyricsfile: string;
        trackName: string;
        artistName: string;
        albumName: string;
        duration: string;
    } = $props();

    let validation = $state<LyricsfileValidationResult | null>(null);

    let showWarning = $state(false);

    let dismissed = $state(false);

    // Boundary decoders for validator output: the YAML-derived payload is
    // untrusted, so each field is narrowed through a predicate.
    function isString(v: unknown): v is string {
        return typeof v === "string";
    }

    function isNumber(v: unknown): v is number {
        return typeof v === "number";
    }

    // Lyricsfile metadata fields arrive untyped from YAML; each field is
    // narrowed through a predicate at use.
    interface LyricsfileMetadata {
        title?: unknown;
        artist?: unknown;
        album?: unknown;
        duration_ms?: unknown;
    }

    function isMetadata(v: unknown): v is LyricsfileMetadata {
        return typeof v === "object" && v !== null && !Array.isArray(v);
    }

    interface PreviewLine {
        text: string;
        start_ms: number;
        end_ms?: number;
    }

    function isPreviewLine(v: unknown): v is PreviewLine {
        if (typeof v !== "object" || v === null || Array.isArray(v)) return false;

        // SAFETY: just established v is a non-array object; the field
        // predicates below narrow each property before anything is used.
        const l = v as { text: unknown; start_ms: unknown; end_ms?: unknown };

        return (
            isString(l.text) &&
            isNumber(l.start_ms) &&
            (l.end_ms === undefined || isNumber(l.end_ms))
        );
    }

    function runValidation() {
        if (!lyricsfile.trim()) {
            validation = null;
            showWarning = false;
            dismissed = false;

            return;
        }

        validation = validateLyricsfileYaml(lyricsfile);
        showWarning = validation.hasErrors || validation.hasWarnings;

        if (dismissed) showWarning = false;

        // auto-fill metadata if empty
        if (validation.data) {
            const d: any = validation.data;

            if (isMetadata(d?.metadata)) {
                const m = d.metadata;

                if (!trackName && isString(m.title)) trackName = m.title;

                if (!artistName && isString(m.artist)) artistName = m.artist;

                if (!albumName && isString(m.album)) albumName = m.album;

                if (!duration && isNumber(m.duration_ms)) duration = Math.round(m.duration_ms / 1000).toString();
            }
        }
    }

    function dismiss() {
        dismissed = true;
        showWarning = false;
    }

    async function onFileChange(e: Event) {
        // SAFETY: onFileChange is bound to this component's own <input
        // type=file>; target is that element while mounted, and the
        // optional chain below tolerates absence regardless.
        const file = (e.target as HTMLInputElement)?.files?.[0];

        if (!file) return;
        lyricsfile = await file.text();
        dismissed = false;
        runValidation();
    }

    const previewLines = $derived.by(() => {
        if (!validation?.data) return null;
        const d: any = validation.data;

        if (!Array.isArray(d.lines)) return null;

        return d.lines.filter(isPreviewLine).slice(0, 20);
    });
</script>

<div class="space-y-4">
    <div class="flex items-center gap-4 flex-wrap">
        <h3 class="text-lg font-semibold">Lyricsfile Input</h3>
        <label
            for="lfFile"
            class="flex items-center gap-2 px-3 py-1.5 text-sm bg-indigo-200/75 hover:bg-indigo-200 text-indigo-700 rounded-md cursor-pointer transition-colors"
        >
            <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="17 8 12 3 7 8" />
                <line x1="12" y1="3" x2="12" y2="15" />
            </svg>
            Upload YAML
        </label>
        <input type="file" id="lfFile" accept=".yaml,.yml,.lrcf,.txt" class="hidden" onchange={onFileChange} />
        <span class="text-xs text-indigo-600">.yaml / .yml / .lrcf</span>
    </div>

    <div>
        <label for="lyricsfile" class="block text-sm font-medium mb-1">Lyricsfile (YAML)</label>
        <textarea
            id="lyricsfile"
            bind:value={lyricsfile}
            oninput={() => {
                dismissed = false;
                runValidation();
            }}
            rows="14"
            placeholder={`version: '1.0'
metadata:
  title: Song Title
  artist: Artist Name
  album: Album (optional)
  duration_ms: 210000
  language: en
lines:
  - text: First line
    start_ms: 1000
    end_ms: 4000
  - text: Second line
    start_ms: 5000
plain: |
  First line
  Second line`}
            class="w-full px-3 py-2 border border-indigo-200 rounded-md focus:outline-hidden focus:ring-2 focus:ring-indigo-500 font-mono text-sm"
        ></textarea>
        <p class="mt-1 text-sm text-indigo-600">
            Spec: <a href="https://github.com/tranxuanthang/lyricsfile" target="_blank" rel="noopener noreferrer" class="underline">lyricsfile</a> — leave empty for instrumental (set metadata.instrumental: true)
        </p>
    </div>

    {#if showWarning && validation}
        <div class="{validation.hasErrors ? 'bg-red-50 border-red-300' : 'bg-amber-50 border-amber-300'} border rounded-lg p-4 shadow-sm">
            <div class="flex items-center justify-between mb-2">
                <h4 class="text-sm font-semibold {validation.hasErrors ? 'text-red-900' : 'text-amber-900'}">
                    {validation.hasErrors ? 'Lyricsfile Errors' : 'Lyricsfile Warnings'} — {validation.issues.length} issue{validation.issues.length === 1 ? '' : 's'}
                </h4>
                <button type="button" onclick={dismiss} aria-label="Dismiss" class="{validation.hasErrors ? 'text-red-700' : 'text-amber-700'} hover:opacity-70">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" class="size-4"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18 18 6M6 6l12 12" /></svg>
                </button>
            </div>
            <ul class="space-y-1 max-h-48 overflow-y-auto">
                {#each validation.issues as issue, i (i)}
                    <li class="text-xs flex gap-2 {issue.severity === 'error' ? 'text-red-700' : 'text-amber-700'}">
                        <span class="font-mono font-semibold shrink-0">{issue.severity === 'error' ? 'ERROR' : 'WARN'}</span>
                        <span class="font-mono opacity-70">{issue.path || '(root)'}</span>
                        <span>{issue.message}</span>
                    </li>
                {/each}
            </ul>
            {#if !validation.hasErrors}
                <button type="button" onclick={dismiss} class="mt-3 text-xs px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-md">Continue anyway</button>
            {/if}
        </div>
    {/if}

    {#if previewLines && previewLines.length > 0}
        <div class="border border-indigo-200 rounded-md p-3 bg-white">
            <p class="text-xs font-medium text-indigo-700 mb-2">Preview — first {previewLines.length} line{previewLines.length === 1 ? '' : 's'} (total {(validation?.data as any)?.lines?.length ?? 0})</p>
            <div class="space-y-1 max-h-40 overflow-y-auto font-mono text-xs">
                {#each previewLines as line, i (i)}
                    <div class="flex gap-2"><span class="text-indigo-500 shrink-0">[{formatMs(line.start_ms)}]</span><span class="truncate">{line.text}</span></div>
                {/each}
                {#if (validation?.data as any)?.lines?.length > 20}
                    <div class="text-indigo-400 italic">… and {(validation?.data as any).lines.length - 20} more</div>
                {/if}
            </div>
        </div>
    {/if}
</div>
