import re

with open("agent/pipeline.py", "r", encoding="utf-8") as f:
    content = f.read()

pattern = r'''(\s+# Lookup zero-latency audio cache first for instant greeting\s+from agent\.tts\.audio_cache import get_audio_cache\s+cache = get_audio_cache\(\)\s+)(preset_key = [^\n]+\s+company_str = [^\n]+\s+cached_tuple = None\s+cached_text = None\s+# 1\. Try mobile recharge promo[^\n]+\s+if [^\n]+:\s+cached_tuple = [^\n]+\s+cached_text = [^\n]+\s+# 2\. Try clinic / default greeting\s+if not cached_tuple:\s+cached_tuple = [^\n]+\s+cached_text = [^\n]+\s+if cached_tuple and cached_text:\s+greeting = cached_text\s+logger\.info\([^\n]+\))'''

replacement = r'''\1preset_key = self.config.get("preset_key") or self.config.get("mode_name")
        if not preset_key:
            agent_id = str(self.config.get("agent_id", "")).lower()
            company_str = str(self.config.get("company", {}).get("name", "") if isinstance(self.config.get("company"), dict) else self.config.get("company", "")).lower()
            if "credit_card" in agent_id or "hdfc" in agent_id or "apex" in company_str:
                preset_key = "credit_card_offer"
            elif "emi" in agent_id or "finance" in agent_id or "easyfinance" in company_str:
                preset_key = "bill_emi_reminder"
            elif "recharge" in agent_id or "promo" in agent_id or "swift" in company_str:
                preset_key = "mobile_recharge_promo"
            elif "dental" in agent_id or "aarogya" in agent_id or "clinic" in agent_id:
                preset_key = "clinic_booking"
            elif "lead" in agent_id or "techsolutions" in company_str:
                preset_key = "lead_qualification"
            elif "support" in agent_id or "caredesk" in company_str:
                preset_key = "support_faq"
            elif "survey" in agent_id or "insights" in company_str:
                preset_key = "feedback_survey"
            elif "sale" in agent_id or "bharat" in company_str:
                preset_key = "announcement_ad"
            else:
                preset_key = "mobile_recharge_promo"
        preset_key = str(preset_key).lower().replace("agent_", "")

        cache_key = f"{preset_key}_greeting"
        cached_tuple = cache.get_audio_by_key(cache_key, lang)
        cached_text = cache.get_text_by_key(cache_key, lang)

        if not cached_tuple and preset_key in ("clinic_booking", "appointment_booking"):
            cached_tuple = cache.get_audio_by_key("greeting", lang)
            cached_text = cache.get_text_by_key("greeting", lang)
        elif not cached_tuple and preset_key == "mobile_recharge_promo":
            cached_tuple = cache.get_audio_by_key("mobile_recharge_promo_greeting", lang)
            cached_text = cache.get_text_by_key("mobile_recharge_promo_greeting", lang)

        if cached_tuple and cached_text:
            greeting = cached_text
            logger.info(f"[{self.call_id}] Instant zero-latency Cartesia greeting for preset '{preset_key}', lang '{lang}': {greeting[:45]}...")'''

new_content, count = re.subn(pattern, replacement, content, count=1)
if count == 1:
    with open("agent/pipeline.py", "w", encoding="utf-8") as f:
        f.write(new_content)
    print("Successfully patched agent/pipeline.py")
else:
    print(f"Failed to match pattern, count={count}")
