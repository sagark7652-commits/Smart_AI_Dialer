"""Fix syntax and enhance DTMF in web/index.html."""
import re
import subprocess
from pathlib import Path

html = Path("web/index.html").read_text(encoding="utf-8")
before_script = html[:html.index("<script>") + len("<script>")]
after_script = html[html.index("</script>"):]

clean_js = Path("temp_check.js").read_text(encoding="utf-8")

dtmf_helper = """    function playDTMFTone(digit) {
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

pattern = re.compile(r"function sendDTMF\(digit\)\s*\{.*?ws\.send\(.*?\);\s*\}", re.DOTALL)
if pattern.search(clean_js):
    clean_js = pattern.sub(dtmf_helper, clean_js, count=1)
    print("DTMF helper replaced cleanly")
else:
    print("DTMF pattern not found")

Path("temp_check.js").write_text(clean_js, encoding="utf-8")

res = subprocess.run(["node", "--check", "temp_check.js"], capture_output=True, text=True)
if res.returncode == 0:
    print("Node.js check passed: 0 syntax errors!")
    full_html = before_script + "\n" + clean_js + "\n" + after_script
    Path("web/index.html").write_text(full_html, encoding="utf-8")
    print("web/index.html successfully updated and validated!")
else:
    print("Syntax error in temp_check.js:", res.stderr)
