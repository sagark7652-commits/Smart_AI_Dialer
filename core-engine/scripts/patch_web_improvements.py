import re

with open("web/index.html", "r", encoding="utf-8") as f:
    content = f.read()

# 1. Update source.onended to eliminate the race condition
target_onended = """        source.onended = () => {
          activeAudioSources = activeAudioSources.filter(s => s !== source);
          if (activeAudioSources.length === 0 && (!audioContext || audioContext.currentTime >= nextAudioPlayTime - 0.1)) {
            if (isIntroPlaying) {
              console.log("[Intro] Intro audio finished playback completely.");
              isIntroPlaying = false;
            }
            if (currentUIState === "SPEAKING") {
              setUIState("LISTENING");
            }
          }
        };"""

repl_onended = """        source.onended = () => {
          activeAudioSources = activeAudioSources.filter(s => s !== source);
          if (activeAudioSources.length === 0) {
            if (isIntroPlaying) {
              console.log("[Intro] Intro audio finished playback completely.");
              isIntroPlaying = false;
            }
            if (currentUIState === "SPEAKING") {
              setUIState("LISTENING");
            }
          }
        };"""

# 2. Add Active Agent Card in HTML right after modeSelect form-group
target_card_pos = """          </select>



        </div>



        <div class="form-group">"""

repl_card_pos = """          </select>

          <div id="activeAgentCard" style="margin-top: 10px; padding: 10px 14px; background: rgba(15, 23, 42, 0.8); border: 1px solid #334155; border-radius: 8px; display: flex; align-items: center; justify-content: space-between;">
            <div style="display: flex; align-items: center; gap: 10px;">
              <div id="agentAvatarIcon" style="font-size: 1.6rem; background: #1e293b; padding: 4px 8px; border-radius: 50%;">📱</div>
              <div>
                <div style="font-weight: 700; color: #f8fafc; font-size: 0.92rem;" id="agentCardName">Simran (SwiftTel 5G)</div>
                <div style="font-size: 0.78rem; color: #94a3b8;" id="agentCardRole">Outbound Telecaller Sales</div>
              </div>
            </div>
            <span style="font-size: 0.75rem; background: #0369a1; color: #e0f2fe; padding: 3px 8px; border-radius: 6px; font-weight: 600;">⚡ Instant Cloned Voice</span>
          </div>

        </div>



        <div class="form-group">"""

# 3. Update onModeChange & switchLanguage & add updateActiveAgentCard
target_functions = """    function onModeChange() {



      if (isCalling) {



        stopCall();



      }



    }



        function switchLanguage(lang) {
      if (langSelect) langSelect.value = lang;
      updateLanguagePills(lang);
      if (speechRecognition) {
        try { speechRecognition.stop(); } catch(e) {}
        if (lang === "mr") speechRecognition.lang = "mr-IN";
        else if (lang === "hi") speechRecognition.lang = "hi-IN";
        else speechRecognition.lang = "en-IN";
        if (isCalling) {
          try { speechRecognition.start(); } catch(e) {}
        }
      }
      if (ws && ws.readyState === WebSocket.OPEN) {
        try { ws.send(JSON.stringify({ type: "set_language", lang: lang })); } catch(e) {}
      }
      console.log("[Language] Switched to:", lang);
    }"""

repl_functions = """    function updateActiveAgentCard(p) {
      if (!p) return;
      const cardName = document.getElementById("agentCardName");
      const cardRole = document.getElementById("agentCardRole");
      const cardAvatar = document.getElementById("agentAvatarIcon");
      if (cardName) cardName.innerText = `${p.name} (${p.company})`;
      if (cardRole) cardRole.innerText = p.role;
      if (cardAvatar) {
        if (p.name === "Ananya") cardAvatar.innerText = "💳";
        else if (p.name === "Aarti") cardAvatar.innerText = "💰";
        else if (p.name === "Priya") cardAvatar.innerText = "🦷";
        else if (p.name === "Kavita") cardAvatar.innerText = "🎯";
        else if (p.name === "Pooja") cardAvatar.innerText = "🛠️";
        else if (p.name === "Sneha") cardAvatar.innerText = "⭐";
        else if (p.name === "Neha") cardAvatar.innerText = "📢";
        else cardAvatar.innerText = "📱";
      }
    }

    function onModeChange() {
      if (isCalling) {
        stopCall();
      }
      const val = modeSelect.value;
      try { localStorage.setItem("selectedMode", val); } catch(e) {}
      const p = PRESETS[val] || PRESETS.mobile_recharge_promo;
      updateActiveAgentCard(p);
    }

    function switchLanguage(lang) {
      if (langSelect) langSelect.value = lang;
      updateLanguagePills(lang);
      try { localStorage.setItem("selectedLang", lang); } catch(e) {}
      if (speechRecognition) {
        try {
          speechRecognition.onend = null;
          speechRecognition.onerror = null;
          speechRecognition.onresult = null;
          speechRecognition.abort();
        } catch(e) {}
        speechRecognition = null;
      }
      if (isCalling) {
        setTimeout(() => {
          if (isCalling) {
            setupChromeSpeechRecognition();
          }
        }, 80);
      }
      if (ws && ws.readyState === WebSocket.OPEN) {
        try { ws.send(JSON.stringify({ type: "set_language", lang: lang })); } catch(e) {}
      }
      console.log("[Language] Switched to:", lang);
    }"""

# 4. In startCall, add intro timeout safeguard
target_start_intro = """          setUIState("SPEAKING");
          isIntroPlaying = true;"""

repl_start_intro = """          setUIState("SPEAKING");
          isIntroPlaying = true;
          // Safeguard: Ensure isIntroPlaying never stays stuck if audio finishes before callback
          setTimeout(() => {
            if (isCalling && isIntroPlaying) {
              console.log("[Intro] Safeguard timeout: resetting isIntroPlaying");
              isIntroPlaying = false;
              if (currentUIState === "SPEAKING" && (!activeAudioSources || activeAudioSources.length === 0)) {
                setUIState("LISTENING");
              }
            }
          }, 6000);"""

# Normalize function
def normalize(s):
    return "\n".join(line.rstrip() for line in s.splitlines())

norm_content = normalize(content)

changes = 0
if normalize(target_onended) in norm_content:
    norm_content = norm_content.replace(normalize(target_onended), normalize(repl_onended), 1)
    changes += 1
    print("Replaced source.onended")
else:
    print("Could not find target_onended")

if normalize(target_card_pos) in norm_content:
    norm_content = norm_content.replace(normalize(target_card_pos), normalize(repl_card_pos), 1)
    changes += 1
    print("Added Active Agent Card")
else:
    print("Could not find target_card_pos")

if normalize(target_functions) in norm_content:
    norm_content = norm_content.replace(normalize(target_functions), normalize(repl_functions), 1)
    changes += 1
    print("Replaced functions")
else:
    print("Could not find target_functions")

if normalize(target_start_intro) in norm_content:
    norm_content = norm_content.replace(normalize(target_start_intro), normalize(repl_start_intro), 1)
    changes += 1
    print("Added intro timeout safeguard")
else:
    print("Could not find target_start_intro")

# 5. On window load: restore mode and language
target_window_load = """      // Initial welcome message in transcript box"""
repl_window_load = """      // Restore user preferences
      try {
        const savedMode = localStorage.getItem("selectedMode");
        if (savedMode && PRESETS[savedMode]) {
          modeSelect.value = savedMode;
        }
        const savedLang = localStorage.getItem("selectedLang");
        if (savedLang) {
          switchLanguage(savedLang);
        }
      } catch(e) {}
      const initPreset = PRESETS[modeSelect.value] || PRESETS.mobile_recharge_promo;
      updateActiveAgentCard(initPreset);

      // Initial welcome message in transcript box"""

if normalize(target_window_load) in norm_content:
    norm_content = norm_content.replace(normalize(target_window_load), normalize(repl_window_load), 1)
    changes += 1
    print("Added localStorage restore on load")
else:
    print("Could not find target_window_load")

with open("web/index.html", "w", encoding="utf-8") as f:
    f.write(norm_content)

print(f"Finished patching web/index.html, total changes={changes}")
