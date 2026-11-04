import re

with open('web/index.html', 'r', encoding='utf-8') as f:
    text = f.read()

# 1. Update langSelect default
old_lang = """          <select id="langSelect" onchange="onLangChange()">



            <option value="hi" selected>हिन्दी / Hinglish (Hindi)</option>



            <option value="mr">मराठी (Marathi)</option>



            <option value="en">English (Indian English Only)</option>



          </select>"""

new_lang = """          <select id="langSelect" onchange="onLangChange()">
            <option value="en" selected>English (Indian English / Cloned Voice)</option>
            <option value="hi">हिन्दी / Hinglish (Hindi)</option>
            <option value="mr">मराठी (Marathi)</option>
          </select>"""

if old_lang in text:
    text = text.replace(old_lang, new_lang, 1)
    print("Patched langSelect in web/index.html")
else:
    # Try regex
    lang_pat = r'<select id="langSelect"[^>]*>[\s\S]*?</select>'
    new_select = """<select id="langSelect" onchange="onLangChange()">
            <option value="en" selected>English (Indian English / Cloned Voice)</option>
            <option value="hi">हिन्दी / Hinglish (Hindi)</option>
            <option value="mr">मराठी (Marathi)</option>
          </select>"""
    text, c = re.subn(lang_pat, new_select, text, count=1)
    if c:
        print("Patched langSelect via regex in web/index.html")
    else:
        print("Warning: langSelect not found in web/index.html")

# 2. Add isAgentSpeakingNow helper and tracking variables
helper_marker = "let isCalling = false;"
helper_code = """let lastDispatchedTurnText = "";
    let lastDispatchedTurnTime = 0;
    let agentSpeakingStartTime = 0;
    let currentUIState = "DISCONNECTED";

    function isAgentSpeakingNow() {
      if (useServerAudio) {
        if (activeAudioSources && activeAudioSources.length > 0) return true;
        if (audioContext && nextAudioPlayTime > audioContext.currentTime + 0.05) return true;
        if (currentUIState === "SPEAKING") return true;
        return false;
      }
      return isSpeakingQueue || (window.speechSynthesis && window.speechSynthesis.speaking);
    }

    let isCalling = false;"""

if helper_marker in text and "function isAgentSpeakingNow()" not in text:
    text = text.replace(helper_marker, helper_code, 1)
    print("Added isAgentSpeakingNow and state variables to web/index.html")
else:
    print("Notice: isAgentSpeakingNow already present or marker not found")

# 3. Update setUIState to track currentUIState and agentSpeakingStartTime
old_set_ui = """    function setUIState(state) {



      statusBadge.className = "status-badge status-" + state;"""

new_set_ui = """    function setUIState(state) {
      currentUIState = state;
      if (state === "SPEAKING") {
        if (!agentSpeakingStartTime) agentSpeakingStartTime = Date.now();
      } else if (state === "LISTENING") {
        agentSpeakingStartTime = 0;
      }
      statusBadge.className = "status-badge status-" + state;"""

if old_set_ui in text:
    text = text.replace(old_set_ui, new_set_ui, 1)
    print("Patched setUIState in web/index.html")
else:
    # Try regex
    ui_pat = r'function setUIState\(state\)\s*\{\s*statusBadge\.className'
    new_ui_repl = 'function setUIState(state) {\n      currentUIState = state;\n      if (state === "SPEAKING") {\n        if (!agentSpeakingStartTime) agentSpeakingStartTime = Date.now();\n      } else if (state === "LISTENING") {\n        agentSpeakingStartTime = 0;\n      }\n      statusBadge.className'
    text, c = re.subn(ui_pat, new_ui_repl, text, count=1)
    if c:
        print("Patched setUIState via regex in web/index.html")
    else:
        print("Warning: setUIState not found in web/index.html")

# 4. Update setupMicProcessing to use isAgentSpeakingNow()
old_mic_gate = """        const isAgentSpeaking = isSpeakingQueue || (window.speechSynthesis && window.speechSynthesis.speaking);



        if (isAgentSpeaking) {



          return;



        }"""

new_mic_gate = """        if (isAgentSpeakingNow()) {
          return;
        }"""

if old_mic_gate in text:
    text = text.replace(old_mic_gate, new_mic_gate, 1)
    print("Patched mic gate in web/index.html")
else:
    mic_pat = r'const isAgentSpeaking = isSpeakingQueue \|\| \(window\.speechSynthesis && window\.speechSynthesis\.speaking\);\s*if \(isAgentSpeaking\) \{\s*return;\s*\}'
    text, c = re.subn(mic_pat, new_mic_gate, text, count=1)
    if c:
        print("Patched mic gate via regex in web/index.html")
    else:
        print("Warning: mic gate not found in web/index.html")

# 5. Update isGenuineUserInterruption to remove hello/greeting words
old_interrupt_regex = r'/\b\(ruko\|wait\|stop\|suno\|hold\|ek minute\|ek second\|chup\|kato\|batao\|nahi\|listen\|hello\|हॅलो\|हेलो\|ऐका\|थांबा\|मला\|मुझे\|pause\)\b/i'
new_interrupt_regex = r'/\b(ruko|wait|stop|suno|hold|ek minute|ek second|chup|kato|pause)\b/i'
text, c = re.subn(old_interrupt_regex, new_interrupt_regex, text, count=1)
if c:
    print("Patched isGenuineUserInterruption regex in web/index.html")
else:
    print("Warning: interrupt regex not found in web/index.html")

# 6. Update dispatchFullUserTurn
old_dispatch = """    function dispatchFullUserTurn(textOverride) {



      const fullText = (textOverride || accumulatedUserTurn).trim();



      if (!fullText || !ws || ws.readyState !== WebSocket.OPEN) return;



      accumulatedUserTurn = "";"""

new_dispatch = """    function dispatchFullUserTurn(textOverride) {
      const fullText = (textOverride || accumulatedUserTurn).trim();
      if (!fullText || !ws || ws.readyState !== WebSocket.OPEN) return;
      accumulatedUserTurn = "";
      lastDispatchedTurnText = fullText.toLowerCase();
      lastDispatchedTurnTime = Date.now();"""

if old_dispatch in text:
    text = text.replace(old_dispatch, new_dispatch, 1)
    print("Patched dispatchFullUserTurn in web/index.html")
else:
    disp_pat = r'function dispatchFullUserTurn\(textOverride\)\s*\{\s*const fullText = \(textOverride \|\| accumulatedUserTurn\)\.trim\(\);\s*if \(!fullText \|\| !ws \|\| ws\.readyState !== WebSocket\.OPEN\) return;\s*accumulatedUserTurn = "";'
    new_disp_repl = 'function dispatchFullUserTurn(textOverride) {\n      const fullText = (textOverride || accumulatedUserTurn).trim();\n      if (!fullText || !ws || ws.readyState !== WebSocket.OPEN) return;\n      accumulatedUserTurn = "";\n      lastDispatchedTurnText = fullText.toLowerCase();\n      lastDispatchedTurnTime = Date.now();'
    text, c = re.subn(disp_pat, new_disp_repl, text, count=1)
    if c:
        print("Patched dispatchFullUserTurn via regex in web/index.html")
    else:
        print("Warning: dispatchFullUserTurn not found in web/index.html")

# 7. Update setupChromeSpeechRecognition
sr_pat = r'speechRecognition\.onresult = \(event\) => \{[\s\S]*?speechRecognition\.onerror = \(e\) => \{[\s\S]*?\};'
new_sr = """speechRecognition.onresult = (event) => {
          if (!isCalling || !ws || ws.readyState !== WebSocket.OPEN) return;
          const isAgentSpeaking = isAgentSpeakingNow();

          let currentInterim = "";
          for (let i = event.resultIndex; i < event.results.length; ++i) {
            const piece = event.results[i][0].transcript.trim();
            if (event.results[i].isFinal) {
              if (piece) {
                if (!isAgentSpeaking || isGenuineUserInterruption(piece)) {
                  accumulatedUserTurn += (accumulatedUserTurn ? " " : "") + piece;
                }
              }
            } else {
              currentInterim += event.results[i][0].transcript;
            }
          }

          const combinedText = (accumulatedUserTurn + " " + currentInterim).trim();
          if (!combinedText) return;

          if (isAgentSpeaking) {
            // Guard 1: Do not interrupt with tail of user's own turn within 2.5s
            if (Date.now() - lastDispatchedTurnTime < 2500) {
              return;
            }
            // Guard 2: Do not interrupt if text matches what was just dispatched
            const cleanCur = combinedText.toLowerCase().trim();
            if (cleanCur === lastDispatchedTurnText || lastDispatchedTurnText.includes(cleanCur)) {
              return;
            }
            // Guard 3: Only interrupt if agent has been speaking for at least 800ms
            if (agentSpeakingStartTime && (Date.now() - agentSpeakingStartTime < 800)) {
              return;
            }
            // Guard 4: Must be a genuine interrupt word/phrase
            if (!isGenuineUserInterruption(combinedText)) {
              return;
            }
            console.log("[BARGE-IN] Genuine user verbal interruption detected:", combinedText);
            triggerBargeIn(false);
          }

          liveMicPill.style.display = "inline-flex";
          interimText.innerText = combinedText;

          if (turnDebounceTimer) clearTimeout(turnDebounceTimer);
          turnDebounceTimer = setTimeout(() => {
            dispatchFullUserTurn(combinedText);
          }, 600);
        };

        speechRecognition.onerror = (e) => {
          console.warn("Speech recognition warning:", e.error);
          if (e.error === "not-allowed" || e.error === "service-not-allowed") {
            addMessage("system", "⚠️ Microphone permission denied! Please allow microphone access in your browser address bar.");
          }
        };"""

text, c = re.subn(sr_pat, new_sr, text, count=1)
if c:
    print("Patched setupChromeSpeechRecognition onresult & onerror in web/index.html")
else:
    print("Warning: setupChromeSpeechRecognition onresult pattern not found")

with open('web/index.html', 'w', encoding='utf-8') as f:
    f.write(text)

print("web/index.html patch completed.")
