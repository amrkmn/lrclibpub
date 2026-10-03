import { parseLyricsfile } from './parser';

export type LyricsfileIssueSeverity = 'error' | 'warning';
// oxlint-disable-next-line anti-slop/no-unknown-type-aliases -- LyricsfileValidationResult is a concrete domain result type

export interface LyricsfileIssue {
    path: string;
    severity: LyricsfileIssueSeverity;
    message: string;
}

export interface LyricsfileValidationResult {
    isValid: boolean;
    hasErrors: boolean;
    hasWarnings: boolean;
    issues: LyricsfileIssue[];
    yamlError: string | null;
    data: unknown | null;
}

type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };

function isObject(v: unknown): v is Record<string, JsonValue> {
    return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function isString(v: unknown): v is string {
    return typeof v === 'string';
}

function isBoolean(v: unknown): v is boolean {
    return typeof v === 'boolean';
}

function isInt(v: unknown): v is number {
    return typeof v === 'number' && Number.isInteger(v);
}

export function validateLyricsfileYaml(raw: string): LyricsfileValidationResult {
    const issues: LyricsfileIssue[] = [];

    if (!raw.trim()) {
        return {
            isValid: false,
            hasErrors: true,
            hasWarnings: false,
            issues: [{ path: '', severity: 'error', message: 'Lyricsfile is empty' }],
            yamlError: null,
            data: null
        };
    }

    const { yamlError, rawParsed } = parseLyricsfile(raw);

    if (yamlError) {
        return {
            isValid: false,
            hasErrors: true,
            hasWarnings: false,
            issues: [{ path: '', severity: 'error', message: `YAML parse error: ${yamlError}` }],
            yamlError,
            data: null
        };
    }

    const obj: unknown = rawParsed;

    if (!isObject(obj)) {
        return {
            isValid: false,
            hasErrors: true,
            hasWarnings: false,
            issues: [{ path: '', severity: 'error', message: 'Root must be a YAML mapping' }],
            yamlError: null,
            data: rawParsed
        };
    }

    // version
    if (!('version' in obj)) {
        issues.push({
            path: 'version',
            severity: 'error',
            message: 'Missing required field: version'
        });
    } else if (obj.version !== '1.0') {
        issues.push({
            path: 'version',
            severity: 'error',
            message: `version must be '1.0', got '${String(obj.version)}'`
        });
    }

    // metadata
    if (!('metadata' in obj) || !isObject(obj.metadata)) {
        issues.push({
            path: 'metadata',
            severity: 'error',
            message: 'Missing or invalid metadata (must be a mapping)'
        });
    } else {
        const m = obj.metadata;

        if (!('title' in m) || !isString(m.title) || !m.title.trim()) {
            issues.push({
                path: 'metadata.title',
                severity: 'error',
                message: 'metadata.title is required and must be non-empty string'
            });
        }

        if (!('artist' in m) || !isString(m.artist) || !m.artist.trim()) {
            issues.push({
                path: 'metadata.artist',
                severity: 'error',
                message: 'metadata.artist is required and must be non-empty string'
            });
        }

        if ('album' in m && m.album !== null && !isString(m.album)) {
            issues.push({
                path: 'metadata.album',
                severity: 'error',
                message: 'metadata.album must be a string'
            });
        }

        if ('duration_ms' in m && m.duration_ms !== null) {
            if (!isInt(m.duration_ms) || m.duration_ms < 0) {
                issues.push({
                    path: 'metadata.duration_ms',
                    severity: 'error',
                    message: 'metadata.duration_ms must be integer >= 0'
                });
            }
        }

        if ('offset_ms' in m && m.offset_ms !== null) {
            if (!isInt(m.offset_ms)) {
                issues.push({
                    path: 'metadata.offset_ms',
                    severity: 'error',
                    message: 'metadata.offset_ms must be integer'
                });
            } else {
                // ponytail: spec unresolved (issue #6) — warn only, don't shift timings
                issues.push({
                    path: 'metadata.offset_ms',
                    severity: 'warning',
                    message: 'offset_ms is pending spec resolution — value will be stored as-is'
                });
            }
        }

        if ('language' in m && m.language !== null && !isString(m.language)) {
            issues.push({
                path: 'metadata.language',
                severity: 'error',
                message: 'metadata.language must be a string'
            });
        }

        if ('instrumental' in m && m.instrumental !== null && !isBoolean(m.instrumental)) {
            issues.push({
                path: 'metadata.instrumental',
                severity: 'error',
                message: 'metadata.instrumental must be boolean'
            });
        }

        const isInstrumental = m.instrumental === true;

        // instrumental guard
        if (isInstrumental) {
            if (Array.isArray(obj.lines) && obj.lines.length > 0) {
                issues.push({
                    path: 'lines',
                    severity: 'error',
                    message: 'instrumental tracks must not have lines'
                });
            }

            if (isString(obj.plain) && obj.plain.trim().length > 0) {
                issues.push({
                    path: 'plain',
                    severity: 'error',
                    message: 'instrumental tracks must not have plain lyrics'
                });
            }
        }

        // lines
        if ('lines' in obj && obj.lines !== null && obj.lines !== undefined) {
            if (!Array.isArray(obj.lines)) {
                issues.push({
                    path: 'lines',
                    severity: 'error',
                    message: 'lines must be an array'
                });
            } else {
                obj.lines.forEach((line: any, idx: number) => {
                    const base = `lines[${idx}]`;

                    if (!isObject(line)) {
                        issues.push({
                            path: base,
                            severity: 'error',
                            message: 'line must be a mapping'
                        });

                        return;
                    }

                    if (!('text' in line) || !isString(line.text) || !line.text.trim()) {
                        issues.push({
                            path: `${base}.text`,
                            severity: 'error',
                            message: 'text is required and must be non-empty string'
                        });
                    }

                    if (!('start_ms' in line) || !isInt(line.start_ms) || line.start_ms < 0) {
                        issues.push({
                            path: `${base}.start_ms`,
                            severity: 'error',
                            message: 'start_ms is required and must be integer >= 0'
                        });
                    }

                    if ('end_ms' in line && line.end_ms !== null) {
                        if (!isInt(line.end_ms) || line.end_ms < 0) {
                            issues.push({
                                path: `${base}.end_ms`,
                                severity: 'error',
                                message: 'end_ms must be integer >= 0'
                            });
                        } else if (isInt(line.start_ms) && line.end_ms < line.start_ms) {
                            issues.push({
                                path: `${base}.end_ms`,
                                severity: 'error',
                                message: 'end_ms must be >= start_ms'
                            });
                        }
                    }

                    if ('words' in line && line.words !== null && line.words !== undefined) {
                        if (!Array.isArray(line.words)) {
                            issues.push({
                                path: `${base}.words`,
                                severity: 'error',
                                message: 'words must be an array'
                            });
                        } else {
                            line.words.forEach((w: any, wi: number) => {
                                const wp = `${base}.words[${wi}]`;

                                if (!isObject(w)) {
                                    issues.push({
                                        path: wp,
                                        severity: 'error',
                                        message: 'word must be a mapping'
                                    });

                                    return;
                                }

                                if (!('text' in w) || !isString(w.text) || !w.text.trim()) {
                                    issues.push({
                                        path: `${wp}.text`,
                                        severity: 'error',
                                        message: 'text is required'
                                    });
                                }

                                if (!('start_ms' in w) || !isInt(w.start_ms) || w.start_ms < 0) {
                                    issues.push({
                                        path: `${wp}.start_ms`,
                                        severity: 'error',
                                        message: 'start_ms is required and must be integer >= 0'
                                    });
                                }

                                if ('end_ms' in w && w.end_ms !== null) {
                                    if (!isInt(w.end_ms) || w.end_ms < 0) {
                                        issues.push({
                                            path: `${wp}.end_ms`,
                                            severity: 'error',
                                            message: 'end_ms must be integer >= 0'
                                        });
                                    } else if (isInt(w.start_ms) && w.end_ms < w.start_ms) {
                                        issues.push({
                                            path: `${wp}.end_ms`,
                                            severity: 'error',
                                            message: 'end_ms must be >= start_ms'
                                        });
                                    }
                                }
                            });
                        }
                    }
                });
            }
        }

        // plain
        if (
            'plain' in obj &&
            obj.plain !== null &&
            obj.plain !== undefined &&
            !isString(obj.plain)
        ) {
            issues.push({ path: 'plain', severity: 'error', message: 'plain must be a string' });
        }
    }

    const hasErrors = issues.some((i) => i.severity === 'error');
    const hasWarnings = issues.some((i) => i.severity === 'warning');

    return {
        isValid: !hasErrors,
        hasErrors,
        hasWarnings,
        issues,
        yamlError: null,
        data: rawParsed
    };
}
