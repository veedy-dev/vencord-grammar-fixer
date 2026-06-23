# Vencord Grammar Fixer

Unofficial desktop-only Vencord userplugin for manual AI grammar fixes and reply suggestions. Bring your own AI provider key.

Not affiliated with or endorsed by Vencord. Userplugins require a source/development build of Vencord.

## Features

- Click the chat-bar button to open the review modal before fixing the current draft.
- Choose writing style globally or directly inside the grammar review modal.
- Suggest replies from message popover or message context menu.
- Writing styles: Closest to Original, Clean & Natural, Casual & Friendly, Punchy & Direct, or Formal.
- Fetch available models for Gemini, OpenAI-compatible, and Local providers, or enter a model manually.
- Copy results or insert/replace the current draft manually.
- Stale-draft protection before replacing or appending text.
- Password-masked API key fields in settings.
- Providers: Gemini, OpenAI-compatible, Local loopback, and narrow Custom JSON POST.

## Install

### Easy install on Windows

Clone this repo anywhere, then run the installer with the path to your Vencord checkout:

```powershell
git clone https://github.com/veedy-dev/vencord-grammar-fixer.git
cd vencord-grammar-fixer
powershell -ExecutionPolicy Bypass -File .\install.ps1 -VencordPath "D:\Projects\Vencord"
```

The installer copies the plugin to `src/userplugins/grammarFixer` and runs `corepack pnpm build` for you.

If you only want to copy the files without rebuilding:

```powershell
powershell -ExecutionPolicy Bypass -File .\install.ps1 -VencordPath "D:\Projects\Vencord" -SkipBuild
```

You can also set `VENCORD_DIR` instead of passing `-VencordPath`:

```powershell
$env:VENCORD_DIR = "D:\Projects\Vencord"
powershell -ExecutionPolicy Bypass -File .\install.ps1
```

### Manual install

From your Vencord checkout:

```bash
git clone https://github.com/veedy-dev/vencord-grammar-fixer.git src/userplugins/grammarFixer
corepack pnpm build
```

Or copy this repository's files into:

```text
src/userplugins/grammarFixer
```

Then enable `GrammarFixer` in Vencord settings.

### Update

From your cloned `vencord-grammar-fixer` folder:

```powershell
git pull
powershell -ExecutionPolicy Bypass -File .\install.ps1 -VencordPath "D:\Projects\Vencord"
```

## Settings

- Provider and Writing Style are always shown. Writing Style is saved in Vencord settings and reused for grammar fixes and reply suggestions.
- Model is required. You can type it manually or fetch models for Gemini, OpenAI-compatible, and Local providers.
- Gemini uses the fixed Gemini API endpoint. Provider API Key is required and visually masked, but stored plaintext in Vencord settings. Get a free key from Google AI Studio.
- OpenAI-compatible uses the default OpenAI endpoint when Endpoint is blank. Provider API Key is required for OpenAI and optional for compatible endpoints that allow no auth.
- Local requires a loopback Endpoint and hides Provider API Key.
- Custom requires Endpoint and Custom Response Text Path. Custom Auth Kind controls whether Custom API Key is shown and required. Custom model lists are manual.

Model fetching uses provider-specific GET requests only. Gemini calls the fixed models endpoint, OpenAI-compatible derives a `/models` endpoint from the configured endpoint, Local does the same but only for loopback URLs, and Custom does not support automatic model listing.

## Privacy and safety

- API keys are visually masked in settings, but still stored plaintext in Vencord settings.
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
