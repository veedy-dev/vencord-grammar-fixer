/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { GrammarFixerPromptKind, MAX_GRAMMAR_FIXER_RESPONSE_LENGTH, MAX_GRAMMAR_FIXER_TEXT_LENGTH } from "./types";

const instructions: Record<GrammarFixerPromptKind, string> = {
    fix: "Fix grammar, spelling, punctuation, and clarity while preserving the user's meaning and tone. Return only the corrected text.",
    rewrite: "Rewrite the text to be clearer and more natural while preserving meaning. Return only the rewritten text.",
    reply: "Draft a concise reply using the provided message as context. Return only the reply text."
};

export function clampPromptText(text: string) {
    return text.slice(0, MAX_GRAMMAR_FIXER_TEXT_LENGTH);
}

export function clampResponseText(text: string) {
    return text.slice(0, MAX_GRAMMAR_FIXER_RESPONSE_LENGTH);
}

export function sanitizePromptText(text: string) {
    return text
        .replace(/https?:\/\/(?:canary\.|ptb\.)?discord(?:app)?\.com\/channels\/\d{17,20}\/\d{17,20}(?:\/\d{17,20})?/gi, "[Discord link]")
        .replace(/<@!?\d{17,20}>/g, "@mention")
        .replace(/<@&\d{17,20}>/g, "@role")
        .replace(/<#\d{17,20}>/g, "#channel")
        .replace(/<a?:([A-Za-z0-9_~.-]+):\d{17,20}>/g, ":$1:")
        .replace(/\b\d{17,20}\b/g, "[id]");
}

export function buildGrammarFixerPrompt(kind: GrammarFixerPromptKind, text: string, context?: string) {
    const sanitizedText = sanitizePromptText(text);
    const sanitizedContext = context ? sanitizePromptText(context) : "";
    const textPrefix = `${instructions[kind]}\n\nText:\n`;
    const textBudget = Math.max(0, MAX_GRAMMAR_FIXER_TEXT_LENGTH - textPrefix.length);
    const safeText = sanitizedText.slice(0, textBudget);
    const contextPrefix = `${instructions[kind]}\n\nContext:\n`;
    const contextSuffix = `\n\nText:\n${safeText}`;
    const contextBudget = Math.max(0, MAX_GRAMMAR_FIXER_TEXT_LENGTH - contextPrefix.length - contextSuffix.length);
    const safeContext = sanitizedContext ? sanitizedContext.slice(0, contextBudget) : "";

    const prompt = safeContext
        ? `${contextPrefix}${safeContext}${contextSuffix}`
        : `${textPrefix}${safeText}`;

    return clampPromptText(prompt);
}
