import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from agent.tts.audio_cache import get_audio_cache

cache = get_audio_cache()

presets = [
    'credit_card_offer',
    'bill_emi_reminder',
    'clinic_booking',
    'lead_qualification',
    'support_faq',
    'feedback_survey',
    'announcement_ad',
    'mobile_recharge_promo'
]
langs = ['en', 'hi', 'mr']

all_ok = True
for p in presets:
    for l in langs:
        key = f'{p}_greeting'
        aud = cache.get_audio_by_key(key, l)
        txt = cache.get_text_by_key(key, l)
        is_ok = (aud is not None and txt is not None)
        if not is_ok:
            all_ok = False
        bytes_len = len(aud[0]) if aud else 0
        txt_prev = txt[:45] if txt else "None"
        status = "OK" if is_ok else "FAIL"
        print(f"[{status}] {p:22} [{l}]: {bytes_len:7} bytes | {txt_prev}")

print("\n" + ("=" * 50))
if all_ok:
    print("ALL 24 PRESET GREETINGS (8 MODES x 3 LANGUAGES) ARE PRE-CACHED & READY!")
else:
    print("SOME GREETINGS ARE MISSING!")
