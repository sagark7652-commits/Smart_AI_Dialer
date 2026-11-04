with open('server.py', 'r', encoding='utf-8') as f:
    lines = f.readlines()

for i, line in enumerate(lines):
    if '@app.get("/", response_class=HTMLResponse)' in line:
        lines.insert(i, '@app.get("/favicon.ico", include_in_schema=False)\nasync def favicon():\n    from fastapi import Response\n    return Response(content=b"", media_type="image/x-icon")\n\n')
        break

with open('server.py', 'w', encoding='utf-8') as f:
    f.writelines(lines)
print("1. Added /favicon.ico route to server.py")

# 2. Patch agent/pipeline.py for DTMF spoken prompts in EN, HI, MR
with open('agent/pipeline.py', 'r', encoding='utf-8') as f:
    pipe_text = f.read().replace('\r\n', '\n')

dtmf_target = """        if result.prompt:

            self._record_transcript("agent", result.prompt)

            self._set_state(AgentState.SPEAKING)

            await self._speak_phrase(result.prompt, language=self.current_language)

            self._set_state(AgentState.LISTENING)"""

dtmf_replacement = """        prompt = result.prompt
        if not prompt and result.action:
            lang = (self.current_language or "en").split("-")[0].lower()
            if result.action == "confirm":
                prompt = (
                    "धन्यवाद! आपका 5G रिचार्ज प्लान सफलतापूर्वक कन्फर्म कर दिया गया है। क्या मैं आपको पेमेंट लिंक भेज दूँ?"
                    if lang == "hi"
                    else (
                        "धन्यवाद! तुमचा 5G रिचार्ज प्लॅन यशस्वीरीत्या कन्फर्म करण्यात आला आहे. मी आपल्याला पेमेंट लिंक पाठवू का?"
                        if lang == "mr"
                        else "Thank you! Your 5G recharge plan has been confirmed. Shall I send you the payment link?"
                    )
                )
            elif result.action == "callback":
                prompt = (
                    "जी बिल्कुल! हमने आपका कॉलबैक शेड्यूल कर दिया है। हमारी टीम जल्द ही आपसे संपर्क करेगी। धन्यवाद!"
                    if lang == "hi"
                    else (
                        "हो नक्कीच! आम्ही तुमचा कॉलबॅक शेड्यूल केला आहे. आमची टीम लवकरच आपल्याशी संपर्क करेल. धन्यवाद!"
                        if lang == "mr"
                        else "Certainly! We have scheduled a callback for you. Our team will contact you shortly. Thank you!"
                    )
                )
            elif result.action == "transfer_human":
                prompt = (
                    "मैं आपकी कॉल हमारे सीनियर कस्टमर सपोर्ट एग्जीक्यूटिव को ट्रांसफर कर रही हूँ। कृपया लाइन पर बने रहें।"
                    if lang == "hi"
                    else (
                        "मी आपला कॉल आमच्या वरिष्ठ ग्राहक सेवा प्रतिनिधीकडे ट्रान्सफर करत आहे. कृपया लाईनवर रहा."
                        if lang == "mr"
                        else "Connecting your call to our senior customer support executive. Please stay on the line."
                    )
                )

        if prompt:
            self._record_transcript("agent", prompt)
            self._set_state(AgentState.SPEAKING)
            await self._speak_phrase(prompt, language=self.current_language)
            self._set_state(AgentState.LISTENING)"""

assert dtmf_target in pipe_text, "dtmf_target not found in pipeline.py"
pipe_text = pipe_text.replace(dtmf_target, dtmf_replacement)

with open('agent/pipeline.py', 'w', encoding='utf-8') as f:
    f.write(pipe_text)
print("2. Added DTMF voice responses to agent/pipeline.py")

# 3. Patch web/index.html for DTMF audio tone, sendTextMessage UI bubble, and voiceSelect guard
with open('web/index.html', 'r', encoding='utf-8') as f:
    web_text = f.read().replace('\r\n', '\n')

old_voice_guard = """    function onVoiceAgentChange() {



      console.log("Voice persona selected:", voiceSelect.value);



    }"""

new_voice_guard = """    function onVoiceAgentChange() {
      if (typeof voiceSelect !== "undefined" && voiceSelect) {
        console.log("Voice persona selected:", voiceSelect.value);
      }
    }"""

assert old_voice_guard in web_text, "old_voice_guard not found in index.html"
web_text = web_text.replace(old_voice_guard, new_voice_guard)

old_send_msg = """    function sendTextMessage() {



      const text = textInput.value.trim();



      if (!text || !ws || ws.readyState !== WebSocket.OPEN) return;



      textInput.value = "";



      // Immediately stop agent talking if user types a new turn



      triggerBargeIn(true);



      ws.send(JSON.stringify({ type: "user_transcript", text: text }));



    }"""

new_send_msg = """    function sendTextMessage() {
      const text = textInput.value.trim();
      if (!text || !ws || ws.readyState !== WebSocket.OPEN) return;
      textInput.value = "";
      triggerBargeIn(true);
      addMessage("user", text);
      setUIState("THINKING");
      ws.send(JSON.stringify({ type: "user_transcript", text: text }));
    }"""

assert old_send_msg in web_text, "old_send_msg not found in index.html"
web_text = web_text.replace(old_send_msg, new_send_msg)

old_dtmf = """        function playDTMFTone(digit) {
      if (!audioContext) return;
      const dtmfFreqs = {
        '1': [697, 1209], '2': [697, 1336], '3': [697, 1477],
        '4': [770, 1209], '5': [770, 1336], '6': [770, 1477],
        '7': [852, 1209], '8': [852, 1336], '9': [852, 1477],
        '*': [941, 1209], '0': [941, 1336], '#': [941, 1477]
      };
      const freqs = dtmfFreqs[digit];
      if (!freqs) return;
      try {
        const osc1 = audioContext.createOscillator();
        const osc2 = audioContext.createOscillator();
        const gain = audioContext.createGain();
        osc1.frequency.value = freqs[0];
        osc2.frequency.value = freqs[1];
        gain.gain.value = 0.08;
        osc1.connect(gain);
        osc2.connect(gain);
        gain.connect(audioContext.destination);
        const now = audioContext.currentTime;
        osc1.start(now);
        osc2.start(now);
        osc1.stop(now + 0.12);
        osc2.stop(now + 0.12);
      } catch(e) {}
    }

    function sendDTMF(digit) {
      if (!isCalling || !ws || ws.readyState !== WebSocket.OPEN) {
        const notice = document.createElement("div");
        notice.style.textAlign = "center";
        notice.style.padding = "6px 12px";
        notice.style.margin = "6px auto";
        notice.style.borderRadius = "6px";
        notice.style.background = "rgba(14, 165, 233, 0.12)";
        notice.style.color = "#7dd3fc";
        notice.style.fontSize = "0.8rem";
        notice.style.border = "1px solid rgba(14, 165, 233, 0.25)";
        notice.style.maxWidth = "85%";
        notice.innerText = `🔢 DTMF Key [${digit}]: Pehle 'Connect Voice' dabakar call connect karein.`;
        transcriptBox.appendChild(notice);
        transcriptBox.scrollTop = transcriptBox.scrollHeight;
        return;
      }
      playDTMFTone(digit);
      ws.send(JSON.stringify({ type: "dtmf", digit: digit }));
    }"""

new_dtmf = """    function playDTMFTone(digit) {
      const dtmfFreqs = {
        '1': [697, 1209], '2': [697, 1336], '3': [697, 1477],
        '4': [770, 1209], '5': [770, 1336], '6': [770, 1477],
        '7': [852, 1209], '8': [852, 1336], '9': [852, 1477],
        '*': [941, 1209], '0': [941, 1336], '#': [941, 1477]
      };
      const freqs = dtmfFreqs[digit];
      if (!freqs) return;
      try {
        const ctx = audioContext || new (window.AudioContext || window.webkitAudioContext)();
        if (ctx.state === 'suspended') { ctx.resume(); }
        const osc1 = ctx.createOscillator();
        const osc2 = ctx.createOscillator();
        const gain = ctx.createGain();
        osc1.frequency.value = freqs[0];
        osc2.frequency.value = freqs[1];
        gain.gain.value = 0.08;
        osc1.connect(gain);
        osc2.connect(gain);
        gain.connect(ctx.destination);
        const now = ctx.currentTime;
        osc1.start(now);
        osc2.start(now);
        osc1.stop(now + 0.12);
        osc2.stop(now + 0.12);
      } catch(e) {}
    }

    function sendDTMF(digit) {
      playDTMFTone(digit);
      if (!isCalling || !ws || ws.readyState !== WebSocket.OPEN) {
        addMessage("system", `🔢 Keypad [${digit}]: Call chalu hone ke baad dialpad buttons se plan confirm, callback, ya operator transfer kar sakte hain. Pehle 'Connect Voice' dabayein!`);
        return;
      }
      const label = digit === '1' ? '1 (Confirm Plan)' : (digit === '2' ? '2 (Schedule Callback)' : '9 (Transfer to Operator)');
      addMessage("user", `🔢 Keypad Pressed: [${label}]`);
      triggerBargeIn(true);
      setUIState("THINKING");
      ws.send(JSON.stringify({ type: "dtmf", digit: digit }));
    }"""

assert old_dtmf in web_text, "old_dtmf not found in index.html"
web_text = web_text.replace(old_dtmf, new_dtmf)

with open('web/index.html', 'w', encoding='utf-8') as f:
    f.write(web_text)
print("3. Fixed web/index.html DTMF, text sending, and voiceSelect guard!")
