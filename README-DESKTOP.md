# CleanDrop Windows Desktop App

This adds an Electron desktop window around the existing CleanDrop Next.js interface and local FastAPI/yt-dlp backend. The installer is built on Windows; this source ZIP is not itself a compiled `.exe`.

## One-time prerequisites
- Windows 10/11, 64-bit
- Node.js LTS: https://nodejs.org/en/download (needed to build the installer)
- Python 3.10+ from https://www.python.org/downloads/windows/ (check **Add Python to PATH**, or use the Python launcher `py`)

## Prepare the project
1. Extract the ZIP to a normal folder, e.g. `C:\CleanDrop`.
2. Open that folder in File Explorer, click the address bar, type `cmd`, and press Enter.
3. Run:

```bat
py -3 -m pip install -r media-backend\requirements.txt
npm install
npm run build
npm run dist:win
```

4. When it finishes, open the `release` folder and run `CleanDrop-Setup-1.1.0.exe`. The installer creates a desktop shortcut.
5. Launch CleanDrop from the desktop shortcut. It opens in its own desktop window and starts the local web service and Python backend.

## Important
- The packaged app uses Electron's bundled Node runtime, but the Python backend still requires Python 3 and the `media-backend\requirements.txt` packages installed on the PC. This build does **not** bundle Python into the installer yet.
- Do not close the app while a download is running.
- The project has not been tested against live Instagram/YouTube URLs here. Platform access, availability, and permitted downloads can change; only save media you own or are authorized to download.
- If `npm run build` fails, or the desktop app says the backend cannot start, send the full terminal error.
