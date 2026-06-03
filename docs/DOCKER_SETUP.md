# Docker Setup (Windows) — Purplle Challenge

## Problem

```text
Error response from daemon: Docker Desktop is unable to start
```

**Root cause on your machine:** WSL (Windows Subsystem for Linux) is **not installed**. Docker Desktop uses WSL2 by default.

---

## Fix (one-time, ~15 min)

### Step 1 — Install WSL2 (Admin PowerShell)

1. Start Menu → type **PowerShell** → **Run as administrator**
2. Run:

```powershell
wsl --install
```

3. **Restart PC** when prompted (required)

### Step 2 — After restart

1. Open **Docker Desktop** from Start Menu
2. Wait until tray icon says **Docker Desktop is running** (green)
3. Git Bash:

```bash
docker version
```

You must see both **Client** and **Server** without errors.

### Step 3 — Run this project

```bash
cd "/c/Users/palpu/OneDrive/Desktop/purple challenge 2"
docker compose up --build -d
docker compose ps
curl http://localhost:8000/health
node assertions.mjs
```

- API: http://localhost:8000  
- Dashboard: http://localhost:3000  

---

## If `wsl --install` fails

1. **Windows Update** — install all pending updates  
2. Enable features (Admin PowerShell):

```powershell
dism.exe /online /enable-feature /featurename:Microsoft-Windows-Subsystem-Linux /all /norestart
dism.exe /online /enable-feature /featurename:VirtualMachinePlatform /all /norestart
```

Restart → run `wsl --install` again.

3. BIOS: enable **Intel VT-x** or **AMD-V** (virtualization)

---

## Alternative: Hyper-V backend (Windows Pro only)

Docker Desktop → **Settings** → General → turn **off** “Use the WSL 2 based engine” → enable Hyper-V → Apply & Restart.

(Still recommend WSL2 — simpler on Windows 11.)

---

## Useful commands

```bash
docker compose logs -f api      # API logs
docker compose logs -f mongo    # Mongo logs
docker compose down             # stop all
docker compose up --build -d    # rebuild & start
```
