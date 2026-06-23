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
import { ChannelStore, DraftStore, DraftType, Forms, Menu, Toasts, useStateFromStores } from "@webpack/common";

import { openGrammarFixerModal } from "./GrammarFixerModal";
import { buildGrammarFixerRequest, type GrammarFixerProviderSettings, normalizeGrammarFixerResponse } from "./providers";
import { openReplySuggestionModal } from "./ReplySuggestionModal";
import type { GrammarFixerPromptKind } from "./types";

const Native = VencordNative.pluginHelpers.GrammarFixer as PluginNative<typeof import("./native")>;

let requestId = 0;
let requestInFlight = false;

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
    model: {
        type: OptionType.STRING,
        description: "Model name sent to the provider",
        default: "gemini-1.5-flash"
    },
    apiKey: {
        type: OptionType.STRING,
        description: "Provider API key stored as plaintext in Vencord settings",
        default: ""
    },
    endpoint: {
        type: OptionType.STRING,
        description: "OpenAI-compatible, Local, or Custom endpoint. Remote providers require HTTPS; Local HTTP is loopback-only.",
        default: ""
    },
    customAuthKind: {
        type: OptionType.SELECT,
        description: "Custom provider auth mode",
        options: [
            { label: "None", value: "none", default: true },
            { label: "Bearer", value: "bearer" },
            { label: "X-API-Key", value: "apiKey" }
        ]
    },
    customApiKey: {
        type: OptionType.STRING,
        description: "Custom provider API key stored as plaintext in Vencord settings",
        default: ""
    },
    customResponseTextPath: {
        type: OptionType.STRING,
        description: "Dot path to response text for Custom JSON POST",
        default: "text"
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

function GrammarFixerIcon(props: Record<string, any>) {
    return <svg {...props} viewBox="0 0 24 24"><path fill="currentColor" d="M4 4h16v2H4V4Zm0 4h10v2H4V8Zm0 4h16v2H4v-2Zm0 4h10v2H4v-2Zm13.7-6.3 1.4 1.4-4.6 4.6-2.1-2.1 1.4-1.4.7.7 3.2-3.2Z" /></svg>;
}

const GrammarFixerChatBarButton: ChatBarButtonFactory = ({ isAnyChat, channel: { id: channelId }, isEmpty }) => {
    const draft = useStateFromStores([DraftStore], () => DraftStore.getDraft(channelId, DraftType.ChannelMessage) ?? "");

    if (IS_WEB || !isAnyChat || isEmpty || !draft.trim()) return null;

    return (
        <ChatBarButton
            tooltip="Fix Grammar"
            onClick={() => openGrammarFixerModal(channelId, draft, requestGrammarFix)}
            buttonProps={{ "aria-haspopup": "dialog" }}
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
            API keys are stored plaintext in Vencord settings. Text shown in GrammarFixer modals is sent to your configured provider only after you explicitly click the modal action button. Discord mentions and internal IDs are redacted before sending.
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
