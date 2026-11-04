"""Patch web/index.html with Studio Vocal De-Reverb and Proximity Presence Equalizer."""
from pathlib import Path

p = Path("web/index.html")
text = p.read_text(encoding="utf-8")

# 1. Update AudioContext sample rate from 16000 to 24000 (native Cartesia 24kHz)
old_ac = "audioContext = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 16000 });"
new_ac = "audioContext = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 24000 });"

# 2. Add Studio Vocal Master Bus
old_player = """    function playServerAudioChunk(b64Data, sampleRate) {

      if (!audioContext || !useServerAudio) return;"""

new_player = """    let vocalMasterBus = null;

    function getVocalMasterBus() {
      if (vocalMasterBus && vocalMasterBus.context === audioContext) {
        return vocalMasterBus;
      }
      if (!audioContext) return null;

      // 1. High-pass filter: eliminates room rumble and hollow low-end boom
      const hp = audioContext.createBiquadFilter();
      hp.type = "highpass";
      hp.frequency.value = 110;

      // 2. De-Reverb Notch: cuts 340Hz room reflection resonance (kills hollow echo)
      const deReverb = audioContext.createBiquadFilter();
      deReverb.type = "peaking";
      deReverb.frequency.value = 340;
      deReverb.Q.value = 1.6;
      deReverb.gain.value = -4.5;

      // 3. Proximity Presence Boost: 3200Hz intimate close-mic boost (removes distant feeling)
      const presence = audioContext.createBiquadFilter();
      presence.type = "peaking";
      presence.frequency.value = 3200;
      presence.Q.value = 1.2;
      presence.gain.value = 4.0;

      // 4. Air & Clarity Shelf: 7500Hz natural breath transparency
      const air = audioContext.createBiquadFilter();
      air.type = "highshelf";
      air.frequency.value = 7500;
      air.gain.value = 2.5;

      // 5. Studio Vocal Dynamics Compressor: pulls voice upfront, levels out volume
      const compressor = audioContext.createDynamicsCompressor();
      compressor.threshold.value = -20;
      compressor.knee.value = 10;
      compressor.ratio.value = 3.5;
      compressor.attack.value = 0.003;
      compressor.release.value = 0.12;

      // 6. Master Gain
      const masterGain = audioContext.createGain();
      masterGain.gain.value = 1.35;

      // Connect DSP chain
      hp.connect(deReverb);
      deReverb.connect(presence);
      presence.connect(air);
      air.connect(compressor);
      compressor.connect(masterGain);
      masterGain.connect(audioContext.destination);

      vocalMasterBus = hp;
      return vocalMasterBus;
    }

    function playServerAudioChunk(b64Data, sampleRate) {

      if (!audioContext || !useServerAudio) return;"""

# 3. Connect source to vocalMasterBus instead of direct destination
old_conn = "source.connect(audioContext.destination);"
new_conn = """const bus = getVocalMasterBus();
        if (bus) {
          source.connect(bus);
        } else {
          source.connect(audioContext.destination);
        }"""

text_norm = text.replace("\r\n", "\n")
old_ac_norm = old_ac.replace("\r\n", "\n")
new_ac_norm = new_ac.replace("\r\n", "\n")
old_player_norm = old_player.replace("\r\n", "\n")
new_player_norm = new_player.replace("\r\n", "\n")
old_conn_norm = old_conn.replace("\r\n", "\n")
new_conn_norm = new_conn.replace("\r\n", "\n")

if old_ac_norm in text_norm:
    text_norm = text_norm.replace(old_ac_norm, new_ac_norm, 1)
    print("AudioContext sample rate updated to 24000Hz")

if old_player_norm in text_norm:
    text_norm = text_norm.replace(old_player_norm, new_player_norm, 1)
    print("getVocalMasterBus DSP added")

if old_conn_norm in text_norm:
    text_norm = text_norm.replace(old_conn_norm, new_conn_norm, 1)
    print("source.connect updated to route through studio DSP bus")

p.write_text(text_norm.replace("\n", "\r\n"), encoding="utf-8")
print("web/index.html Studio De-Reverb and Vocal Presence patch complete!")
