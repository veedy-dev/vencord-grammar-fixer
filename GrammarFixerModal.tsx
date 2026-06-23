/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { copyWithToast } from "@utils/discord";
import { Button, ConfirmModal, DraftStore, DraftType, Modal, openModal, TextArea, Toasts, useState } from "@webpack/common";

import { saveChannelDraft } from "./draft";
import type { GrammarFixerPromptKind } from "./types";

interface GrammarFixerModalProps {
    modalProps: any;
    channelId: string;
    initialDraft: string;
    requestGrammarFix(text: string, context?: string, promptKind?: GrammarFixerPromptKind): Promise<string | null>;
}

function showReplaceConfirmation(channelId: string, replacement: string, onClose: () => void) {
    openModal(props => (
        <ConfirmModal
            {...props}
            title="Replace changed draft?"
            subtitle="Your draft changed after opening GrammarFixer. Replace the current draft with the fixed result?"
            confirmText="Replace Draft"
            cancelText="Keep Current Draft"
            variant="primary"
            onConfirm={() => {
                saveChannelDraft(channelId, replacement);
                Toasts.show({ id: Toasts.genId(), message: "Draft replaced.", type: Toasts.Type.SUCCESS });
                onClose();
            }}
        />
    ));
}

export function openGrammarFixerModal(channelId: string, initialDraft: string, requestGrammarFix: GrammarFixerModalProps["requestGrammarFix"]) {
    openModal(modalProps => (
        <GrammarFixerModal
            modalProps={modalProps}
            channelId={channelId}
            initialDraft={initialDraft}
            requestGrammarFix={requestGrammarFix}
        />
    ));
}

function GrammarFixerModal({ modalProps, channelId, initialDraft, requestGrammarFix }: GrammarFixerModalProps) {
    const [sourceText, setSourceText] = useState(initialDraft);
    const [resultText, setResultText] = useState("");
    const [isLoading, setIsLoading] = useState(false);

    async function fixGrammar() {
        if (isLoading || !sourceText.trim()) return;

        setIsLoading(true);
        try {
            const fixed = await requestGrammarFix(sourceText, undefined, "fix");
            if (fixed) setResultText(fixed);
        } catch (error) {
            Toasts.show({ id: Toasts.genId(), message: error instanceof Error ? error.message : "GrammarFixer failed", type: Toasts.Type.FAILURE });
        } finally {
            setIsLoading(false);
        }
    }

    function replaceDraft() {
        if (!resultText) return;

        const currentDraft = DraftStore.getDraft(channelId, DraftType.ChannelMessage) ?? "";
        if (currentDraft === initialDraft) {
            saveChannelDraft(channelId, resultText);
            Toasts.show({ id: Toasts.genId(), message: "Draft replaced.", type: Toasts.Type.SUCCESS });
            modalProps.onClose();
            return;
        }

        showReplaceConfirmation(channelId, resultText, modalProps.onClose);
    }

    return (
        <Modal
            {...modalProps}
            title="Fix Grammar"
            subtitle="Review the draft before sending it to your configured provider. IDs and mentions are redacted before the request. Nothing is sent automatically."
            actions={[
                {
                    text: "Cancel",
                    variant: "secondary",
                    onClick: modalProps.onClose
                },
                {
                    text: isLoading ? "Fixing..." : "Fix Grammar",
                    variant: "primary",
                    onClick: fixGrammar,
                    disabled: isLoading || !sourceText.trim()
                }
            ]}
        >
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <section>
                    <div style={{ marginBottom: 8, fontWeight: 600 }}>Draft to fix</div>
                    <TextArea value={sourceText} onChange={setSourceText} autosize disabled={isLoading} />
                </section>

                <section>
                    <div style={{ marginBottom: 8, fontWeight: 600 }}>Result</div>
                    <TextArea value={resultText} onChange={setResultText} placeholder="Click Fix Grammar to generate a result." autosize />
                </section>

                <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                    <Button disabled={!resultText} onClick={() => copyWithToast(resultText, "GrammarFixer result copied.")}>Copy</Button>
                    <Button disabled={!resultText} onClick={replaceDraft}>Replace Draft</Button>
                </div>
            </div>
        </Modal>
    );
}
