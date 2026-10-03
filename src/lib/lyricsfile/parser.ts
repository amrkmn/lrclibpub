import * as YAML from "yaml";

export interface LyricsfileWord {
  text: string;
  start_ms: number;
  end_ms?: number;
}

export interface LyricsfileLine {
  text: string;
  start_ms: number;
  end_ms?: number;
  words?: LyricsfileWord[];
}

export interface LyricsfileMetadata {
  title: string;
  artist: string;
  album?: string;
  duration_ms?: number;
  offset_ms?: number;
  language?: string;
  instrumental?: boolean;
}

export interface LyricsfileData {
  version: string;
  metadata: LyricsfileMetadata;
  lines?: LyricsfileLine[];
  plain?: string;
}

export interface ParseResult {
  data: LyricsfileData | null;
  yamlError: string | null;
  rawParsed: unknown;
}

export function parseLyricsfile(raw: string): ParseResult {
  if (!raw.trim()) return { data: null, yamlError: null, rawParsed: null };

  try {
    const parsed = YAML.parse(raw);

    // SAFETY: YAML.parse returns unknown; validated by validateLyricsfileYaml before use
    return { data: parsed as LyricsfileData, yamlError: null, rawParsed: parsed };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);

    return { data: null, yamlError: msg, rawParsed: null };
  }
}

export function formatMs(ms: number): string {
  const minutes = Math.floor(ms / 60000);
  const seconds = Math.floor((ms % 60000) / 1000);
  const millis = ms % 1000;

  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}.${String(millis).padStart(3, "0")}`;
}
