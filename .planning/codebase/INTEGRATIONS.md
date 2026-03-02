# External Integrations

**Analysis Date:** 2026-03-02

## APIs & External Services

**None detected** - PerfectPixel is a self-contained image processing tool with no external API dependencies.

## Data Storage

**Databases:**
- Not applicable - No database integration detected

**File Storage:**
- Local filesystem only
  - Image uploads stored in-memory (`np.frombuffer` in `web_app.py`)
  - No persistent storage of processed images
  - No database backend

**Caching:**
- None - All requests are stateless

## Authentication & Identity

**Auth Provider:**
- Not applicable - No authentication layer
- Web UI is public and accessible on `http://localhost:5010`
- No user authentication, credentials, or API keys required
- No protected endpoints

## Monitoring & Observability

**Error Tracking:**
- None detected

**Logs:**
- `print()` statements only (noted in CLAUDE.md as known limitation)
  - Server startup message: `"Perfect Pixel Web UI running at http://localhost:5010"`
  - Debug output in core algorithm (when `debug=True` flag used)
  - No logging framework configured

**No third-party observability services** (Sentry, DataDog, etc.)

## CI/CD & Deployment

**Hosting:**
- Self-hosted only
- Flask development/production server on local machine
- No cloud integration detected

**CI Pipeline:**
- Not detected - No GitHub Actions, Jenkins, or other CI/CD configuration found

**Deployment:**
- Manual: Run `python3 web_app.py`
- PyPI distribution via setuptools for library use

## Environment Configuration

**No environment variables used** - All configuration hardcoded in source code.

**No external secrets management:**
- No `.env` file
- No credential files
- No secret management services

## Webhooks & Callbacks

**Incoming:**
- None - Web UI does not accept webhooks

**Outgoing:**
- None - No external webhooks triggered

## Network Communication

**Inbound:**
- Flask HTTP server listens on `0.0.0.0:5010`
- Accepts POST requests for image processing:
  - `/api/process` - Core grid detection + refinement
  - `/api/generate-palette` - Color quantization
  - `/api/apply-palette` - Palette remapping
  - `/api/parse-palette` - Palette file parsing (upload)
  - `/api/export-palette` - Palette file export (download)
- Serves static HTML UI: `/` → `web_ui.html`

**Outbound:**
- None - No outbound network calls

## Data Exchange Format

**Web API:**
- Base64-encoded image data in JSON/form-data payloads
- All image binary data exchanged as base64 strings
- Palette data in JSON format: `[[r, g, b], [r, g, b], ...]`

**Palette File Formats (Parse & Export):**
- GIMP Palette (`.gpl`) - Text format with JASC-PAL header
- JASC-PAL (`.pal`) - Text format for Paint Shop Pro
- Adobe Color Table (`.act`) - Binary format (768-byte standard or 772-byte extended)
- PNG extraction - Auto-detects unique colors from image pixels

## Frontend

**Web UI (`web_ui.html`):**
- Single self-contained HTML file (no build step)
- Inline CSS and JavaScript (no external CDN dependencies)
- Browser-based storage: `localStorage` only (for saved palettes)
- No backend session state

## ComfyUI Integration

**External System:**
- ComfyUI node system (workflow automation tool)
- Located at: `integrations/comfyui/PerfectPixelComfy/`
- Integration approach: Custom node wrapper around core library
- Converts ComfyUI tensor format (`[B,H,W,C]` float32 0..1) ↔ NumPy uint8 RGB
- Backend selection: User-selectable "Auto" / "OpenCV Backend" / "Lightweight Backend"

**No API communication with ComfyUI server** - Operates as embedded node

## Third-Party Libraries Used

**Image Processing:**
- OpenCV (C++ backend, optional)
- NumPy (pure Python array operations)
- Pillow (Python Imaging Library)

**Web Framework:**
- Flask

**ComfyUI Integration:**
- PyTorch (for tensor handling only in integration layer)

---

*Integration audit: 2026-03-02*
