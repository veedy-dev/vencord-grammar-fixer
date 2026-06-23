/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { filters, findBulk, proxyLazyWebpack } from "@webpack";
import { DraftType } from "@webpack/common";

const { DraftManager } = proxyLazyWebpack(() => {
    const [, DraftManager] = findBulk(filters.byProps("pushLazy", "popAll"), filters.byProps("clearDraft", "saveDraft"));
    return { DraftManager };
});

export function saveChannelDraft(channelId: string, text: string) {
    DraftManager.saveDraft(channelId, DraftType.ChannelMessage, text);
}

export function joinDraftText(currentDraft: string, addition: string) {
    const current = currentDraft.trimEnd();
    const next = addition.trim();

    if (!current) return next;
    if (!next) return current;
    if (/\s$/.test(currentDraft)) return `${currentDraft}${next}`;

    return `${current}\n${next}`;
}
