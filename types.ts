/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

export const MAX_GRAMMAR_FIXER_TEXT_LENGTH = 12000;
export const MAX_GRAMMAR_FIXER_RESPONSE_LENGTH = 16000;
export const MAX_GRAMMAR_FIXER_MODEL_LENGTH = 200;
export const MAX_GRAMMAR_FIXER_ENDPOINT_LENGTH = 2048;
export const MAX_GRAMMAR_FIXER_RESPONSE_PATH_LENGTH = 200;
export const MAX_GRAMMAR_FIXER_API_KEY_LENGTH = 4096;
export const MAX_GRAMMAR_FIXER_MODEL_LIST_BYTES = 5_000_000;
export const GRAMMAR_FIXER_TIMEOUT_MS = 30000;

export type GrammarFixerProvider = "gemini" | "openai" | "local" | "custom";
export type GrammarFixerPromptKind = "fix" | "rewrite" | "reply";
export type GrammarFixerAuthKind = "none" | "bearer" | "apiKey";
export type GrammarFixerWritingStyle = "closest" | "clean" | "casual" | "punchy" | "formal";

export interface GrammarFixerAuthConfig {
    kind: GrammarFixerAuthKind;
    apiKey?: string;
}

export interface GrammarFixerCustomSettings {
    endpoint: string;
    auth: GrammarFixerAuthConfig;
    responseTextPath: string;
}

export interface GrammarFixerNativeRequest {
    provider: GrammarFixerProvider;
    model: string;
    promptKind: GrammarFixerPromptKind;
    text: string;
    apiKey?: string;
    endpoint?: string;
    custom?: GrammarFixerCustomSettings;
}

export interface GrammarFixerNativeResponse {
    ok: boolean;
    text?: string;
    error?: string;
    status?: number;
}

export interface GrammarFixerModelListRequest {
    provider: GrammarFixerProvider;
    endpoint?: string;
    apiKey?: string;
}

export interface GrammarFixerModelListResponse {
    ok: boolean;
    models?: string[];
    error?: string;
    status?: number;
}
