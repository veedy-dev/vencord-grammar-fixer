/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { copyWithToast } from "@utils/discord";
import { Button, ConfirmModal, DraftStore, DraftType, Modal, openModal, TextArea, Toasts, useState } from "@webpack/common";

import { joinDraftText, saveChannelDraft } from "./draft";
import type { GrammarFixerPromptKind } from "./types";

interface ReplySuggestionModalProps {
    modalProps: any;
    channelId: string;
    messageText: string;
    initialDraft: string;
    requestGrammarFix(text: string, context?: string, promptKind?: GrammarFixerPromptKind): Promise<string | null>;
}

function appendReplyToDraft(channelId: string, replyText: string, onClose: () => void) {
    const currentDraft = DraftStore.getDraft(channelId, DraftType.ChannelMessage) ?? "";
    const joinedDraft = joinDraftText(currentDraft, replyText);

    saveChannelDraft(channelId, joinedDraft);
    Toasts.show({ id: Toasts.genId(), message: "Reply inserted into draft.", type: Toasts.Type.SUCCESS });
    onClose();
}

function showAppendConfirmation(channelId: string, replyText: string, onClose: () => void) {
    openModal(props => (
        <ConfirmModal
            {...props}
            title="Append to changed draft?"
            subtitle="Your draft changed after opening GrammarFixer. Append the suggested reply to the current draft?"
            confirmText="Append Reply"
            cancelText="Keep Current Draft"
            variant="primary"
            onConfirm={() => appendReplyToDraft(channelId, replyText, onClose)}
        />
    ));
}

export function openReplySuggestionModal(channelId: string, messageText: string, requestGrammarFix: ReplySuggestionModalProps["requestGrammarFix"]) {
    const initialDraft = DraftStore.getDraft(channelId, DraftType.ChannelMessage) ?? "";

    openModal(modalProps => (
        <ReplySuggestionModal
            modalProps={modalProps}
            channelId={channelId}
            messageText={messageText}
            initialDraft={initialDraft}
            requestGrammarFix={requestGrammarFix}
        />
    ));
}

function ReplySuggestionModal({ modalProps, channelId, messageText, initialDraft, requestGrammarFix }: ReplySuggestionModalProps) {
    const [resultText, setResultText] = useState("");
    const [isLoading, setIsLoading] = useState(false);

    async function suggestReply() {
        if (isLoading || !messageText.trim()) return;

        setIsLoading(true);
        try {
            const draftContext = initialDraft.trim() || undefined;
            const suggestion = await requestGrammarFix(messageText, draftContext, "reply");
            if (suggestion) setResultText(suggestion);
        } catch (error) {
            Toasts.show({ id: Toasts.genId(), message: error instanceof Error ? error.message : "GrammarFixer failed", type: Toasts.Type.FAILURE });
        } finally {
            setIsLoading(false);
        }
    }

    function insertReply() {
        if (!resultText) return;

        const currentDraft = DraftStore.getDraft(channelId, DraftType.ChannelMessage) ?? "";
        if (currentDraft === initialDraft) {
            appendReplyToDraft(channelId, resultText, modalProps.onClose);
            return;
        }

        showAppendConfirmation(channelId, resultText, modalProps.onClose);
    }

    return (
        <Modal
            {...modalProps}
            title="Suggest Reply"
            subtitle="Review the message and draft context before sending them to your configured provider. IDs and mentions are redacted before the request. Nothing is sent automatically."
            actions={[
                {
                    text: "Cancel",
                    variant: "secondary",
                    onClick: modalProps.onClose
                },
                {
                    text: isLoading ? "Suggesting..." : "Suggest Reply",
                    variant: "primary",
                    onClick: suggestReply,
                    disabled: isLoading || !messageText.trim()
                }
            ]}
        >
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <section>
                    <div style={{ marginBottom: 8, fontWeight: 600 }}>Message to reply to</div>
                    <TextArea value={messageText} onChange={() => void 0} autosize disabled />
                </section>

                <section>
                    <div style={{ marginBottom: 8, fontWeight: 600 }}>Current draft context</div>
                    <TextArea value={initialDraft} onChange={() => void 0} placeholder="No draft context will be sent." autosize disabled />
                </section>

                <section>
                    <div style={{ marginBottom: 8, fontWeight: 600 }}>Suggested reply</div>
                    <TextArea value={resultText} onChange={setResultText} placeholder="Click Suggest Reply to generate a result." autosize />
                </section>

                <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                    <Button disabled={!resultText} onClick={() => copyWithToast(resultText, "Reply suggestion copied.")}>Copy</Button>
                    <Button disabled={!resultText} onClick={insertReply}>Insert into Draft</Button>
                </div>
            </div>
        </Modal>
    );
}
