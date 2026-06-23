/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { IpcMainInvokeEvent } from "electron";

import { GRAMMAR_FIXER_TIMEOUT_MS, GrammarFixerAuthKind, GrammarFixerNativeRequest, GrammarFixerNativeResponse, GrammarFixerPromptKind, GrammarFixerProvider, MAX_GRAMMAR_FIXER_API_KEY_LENGTH, MAX_GRAMMAR_FIXER_ENDPOINT_LENGTH, MAX_GRAMMAR_FIXER_MODEL_LENGTH, MAX_GRAMMAR_FIXER_RESPONSE_LENGTH, MAX_GRAMMAR_FIXER_RESPONSE_PATH_LENGTH, MAX_GRAMMAR_FIXER_TEXT_LENGTH } from "./types";

const defaultEndpoints = {
    gemini: "https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent",
    openai: "https://api.openai.com/v1/chat/completions"
};

function sanitizeError(error: unknown) {
    if (error instanceof Error && error.name === "AbortError") return "Request timed out";
    if (error instanceof Error && error.message === "Provider response was too large") return "Provider response was too large";
    return "Provider request failed";
}

function isLoopback(url: URL) {
    return ["localhost", "127.0.0.1", "[::1]", "::1"].includes(url.hostname);
}

function requireEnum<T extends string>(value: unknown, allowed: readonly T[]) {
    if (typeof value !== "string" || !allowed.includes(value as T)) throw new Error("Invalid request");
    return value as T;
}

function requireString(value: unknown, maxLength: number, allowEmpty = true) {
    if (typeof value !== "string") throw new Error("Invalid request");
    const text = value.trim();
    if (!allowEmpty && !text) throw new Error("Invalid request");
    if (text.length > maxLength) throw new Error("Invalid request");
    return text;
}

function validateEndpoint(provider: GrammarFixerNativeRequest["provider"], endpoint: string) {
    if (!endpoint || endpoint.length > MAX_GRAMMAR_FIXER_ENDPOINT_LENGTH) throw new Error("Invalid endpoint");
    const url = new URL(endpoint);
    if (url.username || url.password) throw new Error("Invalid endpoint");
    if (provider === "local") {
        if ((url.protocol === "http:" || url.protocol === "https:") && isLoopback(url)) return url;
        throw new Error("Local provider requires a loopback endpoint");
    }

    if (url.protocol !== "https:") throw new Error("Remote providers require HTTPS");
    return url;
}

function getPathValue(value: unknown, path: string) {
    return path.split(".").reduce<unknown>((current, key) => {
        if (!current || typeof current !== "object") return undefined;
        return (current as Record<string, unknown>)[key];
    }, value);
}

async function readLimitedResponse(response: Response) {
    const limit = MAX_GRAMMAR_FIXER_RESPONSE_LENGTH * 4;
    if (!response.body?.getReader) throw new Error("Provider response stream unavailable");

    const reader = response.body.getReader();
    const chunks: Uint8Array[] = [];
    let size = 0;

    while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        size += value.byteLength;
        if (size > limit) {
            await reader.cancel();
            throw new Error("Provider response was too large");
        }
        chunks.push(value);
    }

    const bytes = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) {
        bytes.set(chunk, offset);
        offset += chunk.byteLength;
    }

    return new TextDecoder().decode(bytes);
}

function validateRequest(request: GrammarFixerNativeRequest) {
    if (!request || typeof request !== "object") throw new Error("Invalid request");
    const provider = requireEnum<GrammarFixerProvider>(request.provider, ["gemini", "openai", "local", "custom"]);
    const promptKind = requireEnum<GrammarFixerPromptKind>(request.promptKind, ["fix", "rewrite", "reply"]);
    const model = requireString(request.model, MAX_GRAMMAR_FIXER_MODEL_LENGTH);
    const text = requireString(request.text, MAX_GRAMMAR_FIXER_TEXT_LENGTH, false);
    const endpoint = request.endpoint === undefined ? undefined : requireString(request.endpoint, MAX_GRAMMAR_FIXER_ENDPOINT_LENGTH);
    const apiKey = request.apiKey === undefined ? undefined : requireString(request.apiKey, MAX_GRAMMAR_FIXER_API_KEY_LENGTH);
    const { custom } = request;

    if (provider === "custom") {
        if (!custom || typeof custom !== "object") throw new Error("Invalid request");
        const { auth } = custom;
        if (!auth || typeof auth !== "object") throw new Error("Invalid request");
        const authKind = requireEnum<GrammarFixerAuthKind>(auth.kind, ["none", "bearer", "apiKey"]);
        const authApiKey = auth.apiKey === undefined ? undefined : requireString(auth.apiKey, MAX_GRAMMAR_FIXER_API_KEY_LENGTH);
        return {
            ...request,
            provider,
            promptKind,
            model,
            text,
            endpoint,
            apiKey,
            custom: {
                endpoint: requireString(custom.endpoint, MAX_GRAMMAR_FIXER_ENDPOINT_LENGTH),
                responseTextPath: requireString(custom.responseTextPath, MAX_GRAMMAR_FIXER_RESPONSE_PATH_LENGTH, false),
                auth: { kind: authKind, apiKey: authApiKey }
            }
        };
    }

    return { ...request, provider, promptKind, model, text, endpoint, apiKey, custom: undefined };
}

function buildRequest(request: GrammarFixerNativeRequest) {
    request = validateRequest(request);
    if (request.provider === "gemini") {
        const endpoint = defaultEndpoints.gemini.replace("{model}", encodeURIComponent(request.model || "gemini-1.5-flash"));
        const url = validateEndpoint(request.provider, endpoint);
        const headers: Record<string, string> = { "Content-Type": "application/json" };
        if (request.apiKey) headers["X-goog-api-key"] = request.apiKey;
        return { url, body: { contents: [{ parts: [{ text: request.text }] }] }, headers, responsePath: "candidates.0.content.parts.0.text" };
    }

    if (request.provider === "openai" || request.provider === "local") {
        const endpoint = request.provider === "local" ? request.endpoint || "" : request.endpoint || defaultEndpoints.openai;
        const url = validateEndpoint(request.provider, endpoint);
        const headers: Record<string, string> = { "Content-Type": "application/json" };
        if (request.apiKey) headers.Authorization = `Bearer ${request.apiKey}`;
        return { url, body: { model: request.model, messages: [{ role: "user", content: request.text }] }, headers, responsePath: "choices.0.message.content" };
    }

    const { custom } = request;
    if (!custom?.endpoint || !custom.responseTextPath) throw new Error("Custom provider requires endpoint and response path");
    const url = validateEndpoint(request.provider, custom.endpoint);
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (custom.auth.kind === "bearer" && custom.auth.apiKey) headers.Authorization = `Bearer ${custom.auth.apiKey}`;
    if (custom.auth.kind === "apiKey" && custom.auth.apiKey) headers["X-API-Key"] = custom.auth.apiKey;
    return { url, body: { model: request.model, promptKind: request.promptKind, text: request.text }, headers, responsePath: custom.responseTextPath };
}

export async function makeGrammarFixerRequest(_: IpcMainInvokeEvent, request: GrammarFixerNativeRequest): Promise<GrammarFixerNativeResponse> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), GRAMMAR_FIXER_TIMEOUT_MS);

    try {
        const prepared = buildRequest(request);
        const response = await fetch(prepared.url, {
            method: "POST",
            headers: prepared.headers,
            body: JSON.stringify(prepared.body),
            redirect: "error",
            signal: controller.signal
        });

        const data = await readLimitedResponse(response);

        const json = JSON.parse(data);
        const text = getPathValue(json, prepared.responsePath);
        if (typeof text !== "string") return { ok: false, status: response.status, error: "Provider response did not contain text" };

        return { ok: response.ok, status: response.status, text: text.slice(0, MAX_GRAMMAR_FIXER_RESPONSE_LENGTH), error: response.ok ? undefined : "Provider returned an error" };
    } catch (error) {
        return { ok: false, error: sanitizeError(error) };
    } finally {
        clearTimeout(timeout);
    }
}
