/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { GrammarFixerPromptKind, GrammarFixerWritingStyle, MAX_GRAMMAR_FIXER_RESPONSE_LENGTH, MAX_GRAMMAR_FIXER_TEXT_LENGTH } from "./types";

const instructions: Record<GrammarFixerPromptKind, string> = {
    fix: "Fix grammar, spelling, punctuation, and clarity while preserving the user's meaning and tone. Return only the corrected text.",
    rewrite: "Rewrite the text to be clearer and more natural while preserving meaning. Return only the rewritten text.",
    reply: "Write a short, natural reply to the message below on the user's behalf. Return only the reply text."
};

const styleInstructions: Record<GrammarFixerWritingStyle, string> = {
    closest: "Style: Stay as close as possible to the original wording, tone, and level of formality.",
    clean: "Style: Make the text clean, natural, and easy to read without changing the intended tone.",
    casual: "Style: Use a casual, friendly tone while keeping the message clear.",
    punchy: "Style: Be punchy, direct, and concise.",
    formal: "Style: Use a polished, formal tone."
};

const naturalPunctuationInstruction = "Avoid AI-looking punctuation. Do not use em dashes or semicolons. Prefer commas, periods, or short separate sentences.";

const replyWithDraftInstruction = "The user is replying to the message below and has already started a draft reply. Build the reply from that draft: keep the user's intent, stance, and meaning, and just make it clear and natural. Do not flip the user's position or add claims they did not make. Return only the reply text.";

export function clampPromptText(text: string) {
    return text.slice(0, MAX_GRAMMAR_FIXER_TEXT_LENGTH);
}

export function clampResponseText(text: string) {
    return text
        .replace(/\s*—\s*/g, ", ")
        .replace(/;\s*/g, ". ")
        .slice(0, MAX_GRAMMAR_FIXER_RESPONSE_LENGTH);
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

export function buildGrammarFixerPrompt(kind: GrammarFixerPromptKind, text: string, context?: string, style: GrammarFixerWritingStyle = "closest") {
    const sanitizedText = sanitizePromptText(text);
    const sanitizedContext = context ? sanitizePromptText(context) : "";
    const isReply = kind === "reply";
    const baseInstruction = isReply && sanitizedContext ? replyWithDraftInstruction : instructions[kind];
    const instruction = `${baseInstruction}\n${styleInstructions[style] ?? styleInstructions.closest}\n${naturalPunctuationInstruction}`;
    const primaryLabel = isReply ? "Message you are replying to:" : "Text:";
    const contextLabel = isReply ? "Your draft reply:" : "Context:";

    const primaryPrefix = `${instruction}\n\n${primaryLabel}\n`;
    const primaryBudget = Math.max(0, MAX_GRAMMAR_FIXER_TEXT_LENGTH - primaryPrefix.length);
    const safeText = sanitizedText.slice(0, primaryBudget);

    if (!sanitizedContext) return clampPromptText(`${primaryPrefix}${safeText}`);

    const contextSuffix = `\n\n${contextLabel}\n`;
    const contextBudget = Math.max(0, MAX_GRAMMAR_FIXER_TEXT_LENGTH - primaryPrefix.length - safeText.length - contextSuffix.length);
    const safeContext = sanitizedContext.slice(0, contextBudget);

    return clampPromptText(`${primaryPrefix}${safeText}${contextSuffix}${safeContext}`);
}
