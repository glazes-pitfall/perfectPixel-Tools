# External Integrations

**Analysis Date:** 2026-03-02

## APIs & External Services

**None detected** - Perfect Pixel does not integrate with external APIs or cloud services.

## Data Storage

**Databases:**
- None - Project is stateless. No database integration.

**File Storage:**
- Local filesystem only - Files read/written to local disk
  - Input: User-uploaded images via Flask multipart form
  - Output: Processed images returned as base64 or PNG
  - Palette files: Exported as `.act`, `.gpl`, `.pal` formats to disk or as downloads

**Caching:**
- None detected

## Authentication & Identity

**Auth Provider:**
- None - Web app (`web_app.py`) has no authentication layer
  - Flask endpoints at `/api/*` are publicly accessible
  - No API keys or tokens required
  - No user session management

## Monitoring & Observability

**Error Tracking:**
- None detected

**Logs:**
- `web_app.py` prints startup message to console: "Perfect Pixel Web UI running at http://localhost:5010"
- Flask debug mode disabled in production: `app.run(debug=False)`
- No structured logging or log aggregation

## CI/CD & Deployment

**Hosting:**
- Designed for local/on-premise deployment
- Flask development server in `web_app.py` (not suitable for production without WSGI server)
- Suggested platforms: Docker, systemd, or WSGI servers (gunicorn, uWSGI)

**CI Pipeline:**
- None detected - No CI configuration files (.github/workflows, .gitlab-ci.yml, etc.)

## Environment Configuration

**Required env vars:**
- None - Application has no environment variable dependencies

**Secrets location:**
- Not applicable - No external services requiring authentication

## Webhooks & Callbacks

**Incoming:**
- None detected

**Outgoing:**
- None detected

## Integration Points (ComfyUI)

**ComfyUI Custom Node Integration:**
- Location: `integrations/comfyui/PerfectPixelComfy/nodes_perfect_pixel.py`
- Integration type: Custom node plugin for ComfyUI image processing workflows
- Dependencies: PyTorch (`torch`, `torch.nn.functional`), NumPy
- Node category: `image/postprocessing`
- Node name: `PerfectPixelNode` (displays as "Perfect Pixel (Grid Restore)")
- Input: ComfyUI IMAGE tensor format [B,H,W,C] float32 0..1
- Output: ComfyUI IMAGE tensor format [B,H,W,C] float32 0..1
- Backend selection: Auto-detects OpenCV availability, with manual override options
- Parameters exposed: sampling method, export scale, backend selection

**Installation method:**
- Direct pip install: `pip install perfect-pixel[opencv]`
- Or custom node folder copy with manual core file copying

## Palette Format Support

**Input formats:**
- `.act` (Adobe Color Table) - Binary 768-byte or 772-byte format parsed in `web_app.py`
- `.gpl` (GIMP Palette) - Text format parsed in `web_app.py`
- `.pal` (JASC-PAL) - Text format parsed in `web_app.py`
- `.png` - Palette extracted from PNG image pixels in `web_app.py`

**Output formats:**
- `.act` - Binary export via `export_act()` in `web_app.py`
- `.gpl` - Text export via `export_gpl()` in `web_app.py`
- `.pal` - Text export via `export_pal()` in `web_app.py`

**Export endpoints:**
- `POST /api/export-palette` - Download palette in selected format
- `POST /api/parse-palette` - Upload and parse palette file
- `POST /api/generate-palette` - Generate palette from image using quantization

## Image Processing Pipeline

**Web UI Endpoints (in `web_app.py`):**
- `GET /` - Serves `web_ui.html` frontend
- `POST /api/process` - Main pixel art refinement endpoint
  - Input: Image file upload
  - Parameters: sample_method, refine_intensity, fix_square, export_scale
  - Output: JSON with grid dimensions and base64-encoded PNG images
- `POST /api/generate-palette` - Quantize image to palette
  - Algorithms: FASTOCTREE (default), MEDIANCUT, Coverage-Boost (custom)
  - Input: base64 image, color count, algorithm selection
  - Output: JSON palette array
- `POST /api/apply-palette` - Apply palette to image
  - Modes: vector (RGB), perceptual (LAB), swap
  - Input: base64 image, palette JSON
  - Output: JSON with processed image base64

---

*Integration audit: 2026-03-02*
