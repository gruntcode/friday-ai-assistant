# Changes Made to Friday AI Assistant

## Date: August 15, 2026

### 1. Migrated off retired Groq models

**Changed:** Three of the four models in the dropdown were dead or dying.

| Model | Status | Action |
|-------|--------|--------|
| `llama-3.1-8b-instant` | Retired 2026-08-16 | Replaced |
| `llama-3.2-11b-vision-preview` | **Already removed by Groq** | Dropped |
| `llama-3.3-70b-versatile` | Retired 2026-08-16 | Replaced |
| `openai/gpt-oss-20b` | Active | Kept, now the default |

New lineup is `openai/gpt-oss-20b` (fast, default) and `openai/gpt-oss-120b` (highest
quality). The vision option was dropped rather than substituted because the app has no
image-input code path — it was an option that could never have worked as advertised, and
it had already stopped working entirely.

**Files Modified:** `app.py`, `static/js/script.js`, `templates/index.html`, `README.md`

### 2. Centralized model configuration

The model list previously appeared in five places that could drift apart: the dropdown
markup, the JS default, the `/api/models` endpoint, the request validator, and the
API-key test call. All five now derive from `AVAILABLE_MODELS` / `DEFAULT_MODEL` in
`app.py`. `DEFAULT_MODEL` also honours a `GROQ_MODEL` environment variable.

The API-key validation call previously hardcoded `llama-3.1-8b-instant`, which means
saving an API key would have started failing on 2026-08-16 even for users who never
touched the dropdown.

### 3. Fixed: app crashed on startup without an OpenAI key

`openai.OpenAI(api_key=None)` raises on construction, so the app died at import time
with `OpenAIError: Missing credentials` — immediately after printing a warning implying
the key was optional. The README also described it as TTS-only. Both clients are now
built only when their key is present, so the app runs with just `GROQ_API_KEY`.

### 4. Fixed: dropdown could be left on an unavailable model

`loadModels()` set `modelSelect.value` to a hardcoded default without checking it was in
the server's list. If the two disagreed the dropdown rendered with nothing selected. It
now falls back to the first available model.

### 5. New README banner

Replaced the 200px avatar at the top of the README with a full-width banner. Also fixes
`static/images/friday-banner.png`, which was a 1-byte empty file. Generated from
`static/images/friday-banner.html` via `scripts/render-banner.js`, reusing the app's
palette from `style.css`.

## Date: October 19, 2025

### 1. Model Updates
**Changed:** Replaced DeepSeek model with OpenAI GPT OSS 20B

**Files Modified:**
- `app.py` (lines 195-201 and 302-307)

**Changes:**
- Removed: `deepseek-r1-distill-llama-70b` (DeepSeek R1 Distill Llama 70B)
- Added: `openai/gpt-oss-20b` (OpenAI GPT OSS 20B)

**Available Models:**
1. Llama 3.1 8B Instant
2. OpenAI GPT OSS 20B ⭐ NEW
3. Llama 3.2 11B Vision Preview
4. Llama 3.3 70B Versatile

### 2. Avatar Upgrade
**Changed:** Upgraded Friday's avatar to a modern AI design

**Files Created:**
- `static/images/friday-avatar-modern.svg` - New modern SVG avatar with:
  - Geometric AI face design
  - Glowing cyan/blue color scheme
  - Circuit pattern decorations
  - Neural network node elements
  - Pulse effect outer ring

**Files Modified:**
- `templates/index.html` (lines 93 and 107)
  - Updated avatar references from `friday-avatar.png` to `friday-avatar-modern.svg`

**Design Features:**
- Modern geometric design with glowing effects
- Cyan/blue gradient color scheme matching the app theme
- SVG format for crisp scaling at any size
- Futuristic AI aesthetic with circuit patterns
- Animated glow effects

### Testing
✅ Application is running successfully
✅ New model option appears in dropdown
✅ New avatar displays correctly in the UI

### Next Steps
- Test the new OpenAI GPT OSS 20B model functionality
- Verify avatar displays correctly across different screen sizes
- Consider adding animation to the SVG avatar for enhanced visual appeal
