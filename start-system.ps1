# ==============================================================================
# Smart AI Calling Platform - Single Unified System
# ==============================================================================

$Host.UI.RawUI.WindowTitle = "Smart AI Calling Agent - Single Unified System"

Write-Host @"
==============================================================================
   ____                      _       _        _    ___  ____  _       _           
  / ___| _ __ ___   __ _ _ _| |_    / \      / \  |_ _||  _ \(_) __ _| | ___ _ __ 
  \___ \| '_ ` _ \ / _` | '__| __|  / _ \    / _ \  | | | | | | |/ _` | |/ _ \ '__|
   ___) | | | | | | (_| | |  | |_  / ___ \  / ___ \ | | | |_| | | (_| | |  __/ |   
  |____/|_| |_| |_|\__,_|_|   \__|/_/   \_\/_/   \_|___||____/|_|\__,_|_|\___|_|   
==============================================================================
  [SYSTEM MODE]     Single Unified Autonomous Calling System
  [ACCESS URL]      http://localhost:3000
  [AGENTS]          Priya (Aarogya Dental Care) & Aarti (Tata Banking)
  [VOICE / LLM]     OpenAI Neural Speech + OpenAI LLM + Deepgram STT
  [INTELLIGENCE]    Autonomous Callback Scheduling (2-3 days / custom time)
                    Automated Post-Call Database Summary & Insights Recording
  [VIRTUAL NUMBER]  Decoupled (Ready to dial via Carrier / WebRTC sandbox)
==============================================================================
"@ -ForegroundColor Cyan

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path

# Start the unified application directly via Node.js (which internally handles the core-engine)
Write-Host "[*] Starting Smart AI Calling Agent Unified System on http://localhost:3000..." -ForegroundColor Green
Write-Host ""
Write-Host ">>> Unified Calling System Ready: http://localhost:3000" -ForegroundColor Cyan
Write-Host ">>> Press Ctrl+C to stop the system." -ForegroundColor Gray
Write-Host ""

Set-Location -Path "$scriptDir\callforge-ops"
npm run dev
