import sys

def main():
    with open('web/index.html', 'r', encoding='utf-8') as f:
        text = f.read()

    # Normalize to \n
    text = text.replace('\r\n', '\n')

    # 1. Update playAudioChunk onended to handle isIntroPlaying
    old_onended = """        source.onended = () => {



          activeAudioSources = activeAudioSources.filter(s => s !== source);



        };"""

    new_onended = """        source.onended = () => {
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

    assert old_onended in text, "old_onended not found"
    text = text.replace(old_onended, new_onended)

    # 2. Update clearServerAudioPlayback to reset nextAudioPlayTime to 0
    old_clear = """    function clearServerAudioPlayback() {



      activeAudioSources.forEach(s => {



        try { s.stop(); } catch(e) {}



      });



      activeAudioSources = [];



      if (audioContext) {



        nextAudioPlayTime = audioContext.currentTime;



      }



    }"""

    new_clear = """    function clearServerAudioPlayback() {
      activeAudioSources.forEach(s => {
        try { s.stop(); } catch(e) {}
      });
      activeAudioSources = [];
      nextAudioPlayTime = 0;
    }"""

    assert old_clear in text, "old_clear not found"
    text = text.replace(old_clear, new_clear)

    # 3. Add RMS tracking variables near micStream
    old_mic_vars = """    let micStream = null;



    let speechRecognition = null;"""

    new_mic_vars = """    let micStream = null;
    let speechRecognition = null;
    let currentMicRms = 0;
    let maxRecentMicRms = 0;
    let recentRmsList = [];"""

    assert old_mic_vars in text, "old_mic_vars not found"
    text = text.replace(old_mic_vars, new_mic_vars)

    # 4. Update getUserMedia constraints in startCall and reset call state
    old_gum = """        micStream = await navigator.mediaDevices.getUserMedia({



          audio: {



            channelCount: 1,



            sampleRate: 16000,



            echoCancellation: true,



            noiseSuppression: true,



            autoGainControl: true,



          }



        });"""

    new_gum = """        // Fresh call initialization: reset audio scheduling and timers so no F5 refresh is ever needed
        nextAudioPlayTime = 0;
        activeAudioSources = [];
        accumulatedUserTurn = "";
        lastDispatchedTurnText = "";
        lastDispatchedTurnTime = 0;
        isIntroPlaying = true;
        currentStreamingBubble = null;
        streamedChunksInTurn = [];
        if (turnDebounceTimer) { clearTimeout(turnDebounceTimer); turnDebounceTimer = null; }

        micStream = await navigator.mediaDevices.getUserMedia({
          audio: {
            channelCount: 1,
            sampleRate: { ideal: 16000 },
            echoCancellation: { ideal: true },
            noiseSuppression: { ideal: true },
            autoGainControl: { ideal: true },
            googEchoCancellation: { ideal: true },
            googAutoGainControl: { ideal: true },
            googNoiseSuppression: { ideal: true },
            googHighpassFilter: { ideal: true },
            googTypingNoiseDetection: { ideal: true }
          }
        });"""

    assert old_gum in text, "old_gum not found"
    text = text.replace(old_gum, new_gum)

    # 5. Update setupMicProcessing to compute RMS and filter quiet room noise
    old_mic_proc = """        const inputData = e.inputBuffer.getChannelData(0);



        const pcm16 = new Int16Array(inputData.length);



        for (let i = 0; i < inputData.length; i++) {



          const s = Math.max(-1, Math.min(1, inputData[i]));



          pcm16[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;



        }"""

    new_mic_proc = """        const inputData = e.inputBuffer.getChannelData(0);
        let sumSq = 0;
        for (let i = 0; i < inputData.length; i++) {
          sumSq += inputData[i] * inputData[i];
        }
        currentMicRms = Math.sqrt(sumSq / inputData.length);
        recentRmsList.push(currentMicRms);
        if (recentRmsList.length > 15) recentRmsList.shift();
        maxRecentMicRms = Math.max(...recentRmsList);

        const pcm16 = new Int16Array(inputData.length);
        for (let i = 0; i < inputData.length; i++) {
          const s = Math.max(-1, Math.min(1, inputData[i]));
          pcm16[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
        }"""

    assert old_mic_proc in text, "old_mic_proc not found"
    text = text.replace(old_mic_proc, new_mic_proc)

    # 6. Update setupChromeSpeechRecognition onresult for paragraph tolerance, intro immunity & background noise isolation
    old_onresult = """          const combinedText = (accumulatedUserTurn + " " + currentInterim).trim();
          if (!combinedText) return;

          if (isAgentSpeaking || isIntroPlaying) {
            if (Date.now() - lastDispatchedTurnTime < 2500) return;
            const cleanCur = combinedText.toLowerCase().trim();
            if (cleanCur === lastDispatchedTurnText || lastDispatchedTurnText.includes(cleanCur)) return;
            if (agentSpeakingStartTime && (Date.now() - agentSpeakingStartTime < 800)) return;
            if (!isGenuineUserInterruption(combinedText)) {
              // Ignore acoustic speaker bleed or ambient breath noise while agent is speaking
              return;
            }
            console.log("[BARGE-IN] Genuine user verbal interruption during speech:", combinedText);
            isIntroPlaying = false;
            triggerBargeIn(false);
          }

          liveMicPill.style.display = "inline-flex";
          interimText.innerText = combinedText;

          // FULL THOUGHT & PARAGRAPH TOLERANCE:
          // 1100ms silence debounce allows user to comfortably speak long sentences,
          // complex queries or entire multi-sentence paragraphs without premature cut-off!
          if (turnDebounceTimer) clearTimeout(turnDebounceTimer);
          turnDebounceTimer = setTimeout(() => {
            dispatchFullUserTurn(combinedText);
          }, 1100);"""

    new_onresult = """          const combinedText = (accumulatedUserTurn + " " + currentInterim).trim();
          if (!combinedText) return;

          // 1. INTRO IMMUNITY: The agent must finish giving intro before caller speaks
          // Never let ambient noise or speaker bleed interrupt the intro
          if (isIntroPlaying) {
            if (!isGenuineUserInterruption(combinedText)) {
              return;
            }
            console.log("[BARGE-IN] Genuine user verbal interruption during intro:", combinedText);
            isIntroPlaying = false;
            triggerBargeIn(false);
          } else if (isAgentSpeaking) {
            if (!isGenuineUserInterruption(combinedText)) {
              return;
            }
            console.log("[BARGE-IN] Genuine user verbal interruption during speech:", combinedText);
            triggerBargeIn(false);
          }

          // 2. TARGET VOICE FOCUS / BACKGROUND NOISE REJECTION:
          // Ignore distant ambient room chatter, TV or fan when voice RMS energy is below floor
          if (maxRecentMicRms < 0.007 && combinedText.split(/\\s+/).length < 3) {
            return;
          }
          const noiseWords = ["a", "ha", "h", "uh", "um", "oh", "hm", "mm", "ah", "ho", "he", "the"];
          if (combinedText.length <= 2 || (combinedText.split(/\\s+/).length === 1 && noiseWords.includes(combinedText.toLowerCase()))) {
            return;
          }

          liveMicPill.style.display = "inline-flex";
          interimText.innerText = combinedText;

          // 3. FULL THOUGHT & MULTI-SENTENCE PARAGRAPH TOLERANCE:
          // 1800ms silence debounce ensures users can speak complex queries,
          // multi-sentence explanations, or complete paragraphs with natural thinking pauses!
          if (turnDebounceTimer) clearTimeout(turnDebounceTimer);
          turnDebounceTimer = setTimeout(() => {
            dispatchFullUserTurn(combinedText);
          }, 1800);"""

    assert old_onresult in text, "old_onresult not found"
    text = text.replace(old_onresult, new_onresult)

    # 7. Update handleServerEvent state message to not cancel intro prematurely
    old_state_msg = """      } else if (msg.type === "state") {



        if (msg.state === "LISTENING") { isIntroPlaying = false; }
        setUIState(msg.state);"""

    new_state_msg = """      } else if (msg.type === "state") {
        if (!isIntroPlaying) {
          setUIState(msg.state);
        } else if (msg.state === "SPEAKING") {
          setUIState("SPEAKING");
        }"""

    assert old_state_msg in text, "old_state_msg not found"
    text = text.replace(old_state_msg, new_state_msg)

    # 8. Update stopCall for thorough teardown and zero refresh requirement
    old_stop = """    function stopCall() {



      if (!isCalling && !isHangupPending) return;



      isCalling = false;



      isHangupPending = false;



      triggerBargeIn(true);



      if (speechRecognition) {



        try { speechRecognition.stop(); } catch(e) {}



        speechRecognition = null;



      }



      if (micStream) {



        micStream.getTracks().forEach(t => t.stop());



        micStream = null;



      }



      if (audioContext) {



        try { audioContext.close(); } catch(e) {}



        audioContext = null;



      }



      if (ws) {



        try { ws.close(); } catch(e) {}



        ws = null;



      }



      setUIState("DISCONNECTED");



      startBtn.disabled = false;"""

    new_stop = """    function stopCall() {
      if (!isCalling && !isHangupPending) return;
      isCalling = false;
      isHangupPending = false;
      isIntroPlaying = false;

      // 1. Drain and clear all server audio playback sources and timestamps
      clearServerAudioPlayback();
      nextAudioPlayTime = 0;
      activeAudioSources.forEach(s => {
        try { s.stop(); } catch(e) {}
      });
      activeAudioSources = [];

      // 2. Stop and clear speech synthesis
      if (window.speechSynthesis) {
        try { window.speechSynthesis.cancel(); } catch(e) {}
      }
      isSpeakingQueue = false;
      speechQueue = [];

      // 3. Cleanly detach Chrome speech recognition
      if (speechRecognition) {
        try {
          speechRecognition.onend = null;
          speechRecognition.onerror = null;
          speechRecognition.onresult = null;
          speechRecognition.stop();
        } catch(e) {}
        speechRecognition = null;
      }

      // 4. Release microphone hardware stream
      if (micStream) {
        micStream.getTracks().forEach(t => {
          try { t.stop(); } catch(e) {}
        });
        micStream = null;
      }

      // 5. Close AudioContext
      if (audioContext) {
        try { audioContext.close(); } catch(e) {}
        audioContext = null;
      }

      // 6. Close WebSocket
      if (ws) {
        try {
          ws.onclose = null;
          ws.onerror = null;
          ws.onmessage = null;
          ws.close();
        } catch(e) {}
        ws = null;
      }

      // 7. Reset all turn accumulators and timers
      if (turnDebounceTimer) {
        clearTimeout(turnDebounceTimer);
        turnDebounceTimer = null;
      }
      accumulatedUserTurn = "";
      lastDispatchedTurnText = "";
      lastDispatchedTurnTime = 0;
      agentSpeakingStartTime = 0;
      currentStreamingBubble = null;
      streamedChunksInTurn = [];

      // 8. Restore UI cleanly for next immediate call without page reload
      setUIState("DISCONNECTED");
      startBtn.disabled = false;"""

    assert old_stop in text, "old_stop not found"
    text = text.replace(old_stop, new_stop)

    with open('web/index.html', 'w', encoding='utf-8') as f:
        f.write(text)
    print("SUCCESS: All 8 fixes successfully applied to web/index.html!")

if __name__ == '__main__':
    main()
