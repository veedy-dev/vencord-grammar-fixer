# Vencord Grammar Fixer

Private desktop-only Vencord userplugin for manual AI grammar fixes and reply suggestions.

## Features

- Fix the current chat draft from a chat-bar button.
- Suggest replies from message popover or message context menu.
- Review text in a modal before any provider request.
- Copy results or insert/replace the current draft manually.
- Stale-draft protection before replacing or appending text.
- Providers: Gemini, OpenAI-compatible, Local loopback, and narrow Custom JSON POST.

## Install

From your Vencord checkout:

```bash
git clone git@github.com:veedy-dev/vencord-grammar-fixer.git src/userplugins/grammarFixer
pnpm build
```

Or copy this repository's files into:

```text
src/userplugins/grammarFixer
```

Then enable `GrammarFixer` in Vencord settings.

## Privacy and safety

- API keys are stored plaintext in Vencord settings.
- Text is sent to the configured provider only after you explicitly click a modal action button.
- Discord mentions, channel/role/user IDs, custom emoji IDs, message links, and standalone snowflake IDs are redacted before provider prompts.
- No auto-send, no auto-reply, no send/edit hooks.
- Local HTTP endpoints are restricted to loopback hosts.
- Remote providers require HTTPS.
- Provider errors are sanitized.

## Verification

Validated in the Vencord checkout with:

```bash
corepack pnpm testTsc
corepack pnpm lint
corepack pnpm build
```

The full `pnpm test` script was also run via equivalent underlying commands because this shell does not expose `pnpm` directly on `PATH` for nested scripts.
