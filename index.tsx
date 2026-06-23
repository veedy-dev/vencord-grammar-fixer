/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { ChatBarButton, ChatBarButtonFactory } from "@api/ChatButtons";
import { findGroupChildrenByChildId, NavContextMenuPatchCallback } from "@api/ContextMenu";
import { definePluginSettings } from "@api/Settings";
import { Devs } from "@utils/constants";
import definePlugin, { OptionType, PluginNative } from "@utils/types";
import { Button, ChannelStore, DraftStore, DraftType, Forms, Menu, TextInput, Toasts, useState, useStateFromStores } from "@webpack/common";

import { openGrammarFixerModal } from "./GrammarFixerModal";
import { buildGrammarFixerRequest, type GrammarFixerProviderSettings, normalizeGrammarFixerResponse } from "./providers";
import { openReplySuggestionModal } from "./ReplySuggestionModal";
import type { GrammarFixerModelListRequest, GrammarFixerPromptKind, GrammarFixerProvider, GrammarFixerWritingStyle } from "./types";

const Native = VencordNative.pluginHelpers.GrammarFixer as PluginNative<typeof import("./native")>;

let requestId = 0;
let requestInFlight = false;

function isCustomProvider() {
    return settings.store.provider === "custom";
}

function usesProviderApiKey() {
    return settings.store.provider === "gemini" || settings.store.provider === "openai";
}

function usesEndpoint() {
    return settings.store.provider !== "gemini";
}

function usesCustomApiKey() {
    return settings.store.provider === "custom" && settings.store.customAuthKind !== "none";
}

function getEndpointLabel(provider: GrammarFixerProvider) {
    if (provider === "openai") return "Endpoint (Optional, defaults to OpenAI)";
    if (provider === "local") return "Endpoint (Required, loopback only)";
    return "Endpoint (Required)";
}

function getProviderApiKeyLabel(provider: GrammarFixerProvider) {
    return provider === "gemini" ? "Provider API Key (Required)" : "Provider API Key (Required for OpenAI, optional for compatible endpoints)";
}

function getModelListRequest(): GrammarFixerModelListRequest {
    return {
        provider: settings.store.provider as GrammarFixerProvider,
        endpoint: settings.store.endpoint,
        apiKey: usesProviderApiKey() ? settings.store.apiKey : undefined
    };
}

function SettingsTextInput({ title, note, value, setValue, placeholder, type = "text" }: { title: string; note: string; value: string; setValue(value: string): void; placeholder: string; type?: string; }) {
    return (
        <>
            <Forms.FormTitle tag="h4">{title}</Forms.FormTitle>
            <Forms.FormText>{note}</Forms.FormText>
            <TextInput type={type} value={value} onChange={setValue} placeholder={placeholder} />
        </>
    );
}

function ModelSetting({ setValue }: { setValue(value: string): void; }) {
    const { provider, model, endpoint } = settings.use(["provider", "model", "endpoint"]);
    const [models, setModels] = useState<string[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const canFetch = provider !== "custom" && !IS_WEB;

    async function fetchModels() {
        if (!canFetch || isLoading) return;

        setIsLoading(true);
        try {
            const response = await Native.listGrammarFixerModels(getModelListRequest());
            if (!response.ok) throw new Error(response.error || "Could not fetch models");

            setModels(response.models ?? []);
            Toasts.show({ id: Toasts.genId(), message: `Fetched ${response.models?.length ?? 0} models.`, type: Toasts.Type.SUCCESS });
        } catch (error) {
            Toasts.show({ id: Toasts.genId(), message: error instanceof Error ? error.message : "Could not fetch models", type: Toasts.Type.FAILURE });
        } finally {
            setIsLoading(false);
        }
    }

    return (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <SettingsTextInput title="Model (Required)" note="Enter a model manually or fetch available models for Gemini, OpenAI-compatible, and Local providers." value={model} setValue={setValue} placeholder="Model name" />
            <Button disabled={!canFetch || isLoading || (provider === "local" && !endpoint.trim())} onClick={fetchModels}>{isLoading ? "Fetching..." : "Fetch models"}</Button>
            {provider === "custom" && <Forms.FormText>Custom model list is manual.</Forms.FormText>}
            {provider === "local" && !endpoint.trim() && <Forms.FormText>Set a required loopback endpoint before fetching local models.</Forms.FormText>}
            {models.length > 0 && (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                    {models.map(modelId => <Button key={modelId} size="sm" onClick={() => setValue(modelId)}>{modelId}</Button>)}
                </div>
            )}
        </div>
    );
}

const settings = definePluginSettings({
    provider: {
        type: OptionType.SELECT,
        description: IS_WEB ? "Provider (desktop only)" : "Provider",
        options: [
            { label: "Gemini", value: "gemini", default: true },
            { label: "OpenAI-compatible", value: "openai" },
            { label: "Local", value: "local" },
            { label: "Custom JSON POST", value: "custom" }
        ]
    },
    writingStyle: {
        type: OptionType.SELECT,
        description: "Writing style for grammar fixes and reply suggestions",
        options: [
            { label: "Closest to Original", value: "closest", default: true },
            { label: "Clean & Natural", value: "clean" },
            { label: "Casual & Friendly", value: "casual" },
            { label: "Punchy & Direct", value: "punchy" },
            { label: "Formal", value: "formal" }
        ]
    },
    model: {
        type: OptionType.COMPONENT,
        default: "gemini-1.5-flash",
        component: ModelSetting
    },
    apiKey: {
        type: OptionType.COMPONENT,
        default: "",
        hidden: () => !usesProviderApiKey(),
        component: ({ setValue }) => {
            const { apiKey, provider } = settings.use(["apiKey", "provider"]);

            return <SettingsTextInput title={getProviderApiKeyLabel(provider as GrammarFixerProvider)} note="Masked visually, but stored as plaintext in Vencord settings." value={apiKey} setValue={setValue} placeholder="Provider API key" type="password" />;
        }
    },
    endpoint: {
        type: OptionType.COMPONENT,
        default: "",
        hidden: () => !usesEndpoint(),
        component: ({ setValue }) => {
            const { endpoint, provider } = settings.use(["endpoint", "provider"]);

            return <SettingsTextInput title={getEndpointLabel(provider as GrammarFixerProvider)} note="Remote endpoints require HTTPS and no URL credentials. Local endpoints must be loopback only." value={endpoint} setValue={setValue} placeholder={provider === "openai" ? "https://api.openai.com/v1/chat/completions" : "Provider endpoint"} />;
        }
    },
    customAuthKind: {
        type: OptionType.SELECT,
        description: "Custom provider auth mode",
        options: [
            { label: "None", value: "none", default: true },
            { label: "Bearer", value: "bearer" },
            { label: "X-API-Key", value: "apiKey" }
        ],
        hidden: () => !isCustomProvider()
    },
    customApiKey: {
        type: OptionType.COMPONENT,
        default: "",
        hidden: () => !usesCustomApiKey(),
        component: ({ setValue }) => {
            const { customApiKey, customAuthKind } = settings.use(["customApiKey", "customAuthKind"]);

            return <SettingsTextInput title={`Custom Provider API Key (${customAuthKind === "none" ? "Optional" : "Required"})`} note="Masked visually, but stored as plaintext in Vencord settings." value={customApiKey} setValue={setValue} placeholder="Custom provider API key" type="password" />;
        }
    },
    customResponseTextPath: {
        type: OptionType.STRING,
        description: "Dot path to response text for Custom JSON POST (Required)",
        default: "text",
        hidden: () => !isCustomProvider()
    }
});

async function requestGrammarFix(text: string, context?: string, promptKind: GrammarFixerPromptKind = "fix") {
    if (requestInFlight) {
        Toasts.show({ id: Toasts.genId(), message: "GrammarFixer is already running.", type: Toasts.Type.MESSAGE });
        return null;
    }

    requestInFlight = true;
    const currentRequest = ++requestId;
    try {
        const request = buildGrammarFixerRequest(settings.store as GrammarFixerProviderSettings, promptKind, text, context);
        const response = await Native.makeGrammarFixerRequest(request);
        if (currentRequest !== requestId) return null;
        return normalizeGrammarFixerResponse(response);
    } finally {
        requestInFlight = false;
    }
}

function getMessageContent(message: any) {
    return message.content?.trim() ?? "";
}

function GrammarFixerIcon({ width = 20, height = 20, ...props }: Record<string, any>) {
    return <svg {...props} width={width} height={height} viewBox="0 0 24 24"><path fill="currentColor" d="M12.45 16h2.09L9.43 3H7.57L2.46 16h2.09l1.12-3h5.64l1.14 3Zm-6.02-5L8.5 5.48 10.57 11H6.43Zm15.16.59-8.09 8.09L9.83 16l-1.41 1.41 5.09 5.09L23 13l-1.41-1.41Z" /></svg>;
}

const writingStyleOptions = settings.def.writingStyle.options.map(({ label, value }) => ({ label, value: value as GrammarFixerWritingStyle }));

function openDraftReviewModal(channelId: string, draft: string) {
    openGrammarFixerModal(
        channelId,
        draft,
        settings.store.writingStyle as GrammarFixerWritingStyle,
        writingStyleOptions,
        writingStyle => settings.store.writingStyle = writingStyle,
        requestGrammarFix
    );
}

const GrammarFixerChatBarButton: ChatBarButtonFactory = ({ isAnyChat, channel: { id: channelId }, isEmpty }) => {
    const draft = useStateFromStores([DraftStore], () => DraftStore.getDraft(channelId, DraftType.ChannelMessage) ?? "");

    if (IS_WEB || !isAnyChat || isEmpty || !draft.trim()) return null;

    return (
        <ChatBarButton
            tooltip="Fix Grammar"
            onClick={() => openDraftReviewModal(channelId, draft)}
            onContextMenu={event => {
                event.preventDefault();
                openDraftReviewModal(channelId, draft);
            }}
            buttonProps={{
                "aria-haspopup": "dialog"
            }}
        >
            <GrammarFixerIcon />
        </ChatBarButton>
    );
};

const messageContextMenuPatch: NavContextMenuPatchCallback = (children, { message }: { message: any; }) => {
    const content = getMessageContent(message);
    if (!content || IS_WEB) return;

    const group = findGroupChildrenByChildId("copy-text", children);
    if (!group) return;

    group.splice(group.findIndex(c => c?.props?.id === "copy-text") + 1, 0, (
        <Menu.MenuItem
            id="vc-grammar-fixer-suggest-reply"
            label="Suggest Reply"
            icon={GrammarFixerIcon}
            action={() => openReplySuggestionModal(message.channel_id, content, requestGrammarFix)}
        />
    ));
};

export default definePlugin({
    name: "GrammarFixer",
    description: "Private desktop-only grammar fixing scaffold with strict provider boundaries.",
    authors: [Devs.Ven],
    tags: ["Chat", "Utility"],
    settings,
    enabledByDefault: false,

    settingsAboutComponent: () => (
        <Forms.FormText>
            API keys are stored plaintext in Vencord settings. Drafts and messages are sent to your configured provider only after you explicitly click a modal action button. Discord mentions and internal IDs are redacted before sending.
        </Forms.FormText>
    ),

    contextMenus: {
        "message": messageContextMenuPatch
    },

    messagePopoverButton: {
        icon: GrammarFixerIcon,
        render(message: any) {
            const content = getMessageContent(message);
            if (!content || IS_WEB) return null;

            return {
                label: "Suggest reply",
                icon: GrammarFixerIcon,
                message,
                channel: ChannelStore.getChannel(message.channel_id),
                onClick: () => openReplySuggestionModal(message.channel_id, content, requestGrammarFix)
            };
        }
    },

    chatBarButton: {
        icon: GrammarFixerIcon,
        render: GrammarFixerChatBarButton
    }
});
