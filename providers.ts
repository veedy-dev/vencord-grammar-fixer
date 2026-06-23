/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { buildGrammarFixerPrompt, clampResponseText } from "./prompts";
import { GrammarFixerNativeRequest, GrammarFixerNativeResponse, GrammarFixerPromptKind, GrammarFixerProvider, GrammarFixerWritingStyle } from "./types";

export interface GrammarFixerProviderSettings {
    provider: GrammarFixerProvider;
    model: string;
    apiKey: string;
    endpoint: string;
    customAuthKind: "none" | "bearer" | "apiKey";
    customApiKey: string;
    customResponseTextPath: string;
    writingStyle: GrammarFixerWritingStyle;
}

export function buildGrammarFixerRequest(settings: GrammarFixerProviderSettings, promptKind: GrammarFixerPromptKind, text: string, context?: string): GrammarFixerNativeRequest {
    const prompt = buildGrammarFixerPrompt(promptKind, text, context, settings.writingStyle).trim();
    const endpoint = settings.endpoint.trim();

    const request: GrammarFixerNativeRequest = {
        provider: settings.provider,
        model: settings.model.trim(),
        promptKind,
        text: prompt,
        apiKey: settings.apiKey,
        endpoint
    };

    if (settings.provider === "custom") {
        request.custom = {
            endpoint,
            auth: {
                kind: settings.customAuthKind,
                apiKey: settings.customApiKey
            },
            responseTextPath: settings.customResponseTextPath.trim()
        };
    }

    return request;
}

export function normalizeGrammarFixerResponse(response: GrammarFixerNativeResponse) {
    if (!response.ok) throw new Error(response.error || "GrammarFixer request failed");
    return clampResponseText(response.text || "");
}
