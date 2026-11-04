"""Patch web/index.html with regex for getVocalMasterBus."""
import re
from pathlib import Path

html_p = Path("web/index.html")
html_text = html_p.read_text(encoding="utf-8")

new_bus = """function getVocalMasterBus() {
      if (vocalMasterBus && vocalMasterBus.context === audioContext) {
        return vocalMasterBus;
      }
      if (!audioContext) return null;

      // 1. High-pass filter (85Hz): gently cleans ultra-low sub rumble without thinning the voice
      const hp = audioContext.createBiquadFilter();
      hp.type = "highpass";
      hp.frequency.value = 85;

      // 2. Warmth & Body filter (220Hz, +1.8dB): adds silky smooth, velvety human warmth
      const warmth = audioContext.createBiquadFilter();
      warmth.type = "peaking";
      warmth.frequency.value = 220;
      warmth.Q.value = 1.0;
      warmth.gain.value = 1.8;

      // 3. De-Reverb Notch (360Hz, -3.8dB): eliminates boxy room echo
      const deReverb = audioContext.createBiquadFilter();
      deReverb.type = "peaking";
      deReverb.frequency.value = 360;
      deReverb.Q.value = 1.5;
      deReverb.gain.value = -3.8;

      // 4. Smooth Sweet Presence (2700Hz, +2.2dB, wide Q=0.9): smooth upfront clarity without harsh bite
      const presence = audioContext.createBiquadFilter();
      presence.type = "peaking";
      presence.frequency.value = 2700;
      presence.Q.value = 0.9;
      presence.gain.value = 2.2;

      // 5. De-Esser Softener (6800Hz, -2.2dB): softens sharp 's'/'sh' sibilance for buttery smooth listening
      const deEsser = audioContext.createBiquadFilter();
      deEsser.type = "peaking";
      deEsser.frequency.value = 6800;
      deEsser.Q.value = 1.4;
      deEsser.gain.value = -2.2;

      // 6. Air Shelf (10000Hz, +1.2dB): subtle crystal clarity
      const air = audioContext.createBiquadFilter();
      air.type = "highshelf";
      air.frequency.value = 10000;
      air.gain.value = 1.2;

      // 7. Buttery Soft Compressor: wide knee (24dB), gentle ratio (2.8:1) for ultra-smooth fluid dynamics
      const compressor = audioContext.createDynamicsCompressor();
      compressor.threshold.value = -22;
      compressor.knee.value = 24;
      compressor.ratio.value = 2.8;
      compressor.attack.value = 0.012;
      compressor.release.value = 0.18;

      // 8. Clean Master Volume
      const masterGain = audioContext.createGain();
      masterGain.gain.value = 1.25;

      // Connect Smooth Audio DSP chain:
      // hp -> warmth -> deReverb -> presence -> deEsser -> air -> compressor -> masterGain -> destination
      hp.connect(warmth);
      warmth.connect(deReverb);
      deReverb.connect(presence);
      presence.connect(deEsser);
      deEsser.connect(air);
      air.connect(compressor);
      compressor.connect(masterGain);
      masterGain.connect(audioContext.destination);

      vocalMasterBus = hp;
      return vocalMasterBus;
    }"""

pattern = re.compile(r"function getVocalMasterBus\(\)\s*\{.*?return vocalMasterBus;\s*\}", re.DOTALL)
assert pattern.search(html_text), "pattern not found"
html_text = pattern.sub(new_bus, html_text, count=1)
html_p.write_text(html_text, encoding="utf-8")
print("web/index.html regex updated with Silky Smooth Vocal DSP!")
