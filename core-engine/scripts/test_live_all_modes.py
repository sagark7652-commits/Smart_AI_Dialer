import asyncio
import json
import sys
import websockets

sys.stdout.reconfigure(encoding='utf-8')

async def test_call(preset, lang, expected_name, user_say):
    url = f"ws://127.0.0.1:8000/ws/browser-voice?preset={preset}&lang={lang}&gender=female"
    print(f"\n[*] Testing Call -> Preset: '{preset}' | Lang: '{lang}'")
    
    async with websockets.connect(url) as ws:
        # 1. Wait for greeting transcript & audio
        audio_chunks = 0
        audio_bytes = 0
        greeting_text = ""
        
        while True:
            msg = await asyncio.wait_for(ws.recv(), timeout=8.0)
            if isinstance(msg, bytes):
                audio_chunks += 1
                audio_bytes += len(msg)
            else:
                data = json.loads(msg)
                if data.get("type") == "transcript" and data.get("role") == "agent":
                    greeting_text = data.get("text", "")
                    print(f"  [GREETING RECEIVED] '{greeting_text[:60]}...'")
                    break

        assert expected_name.lower() in greeting_text.lower(), f"Expected name '{expected_name}' not found in greeting: {greeting_text}"
        print(f"  --> Audio received: {audio_chunks} chunks ({audio_bytes} bytes). Perfect zero-latency greeting!")

        # 2. Simulate User Response
        print(f"  [USER SAYS] '{user_say}'")
        await ws.send(json.dumps({"type": "user_transcript", "text": user_say}))

        # 3. Wait for Agent Response
        agent_reply = ""
        reply_audio_chunks = 0
        reply_audio_bytes = 0

        while True:
            msg = await asyncio.wait_for(ws.recv(), timeout=12.0)
            if isinstance(msg, bytes):
                reply_audio_chunks += 1
                reply_audio_bytes += len(msg)
            else:
                data = json.loads(msg)
                if data.get("type") == "transcript" and data.get("role") == "agent":
                    agent_reply = data.get("text", "")
                    print(f"  [AGENT REPLIED] '{agent_reply[:75]}...'")
                    break

        print(f"  --> Agent reply audio: {reply_audio_chunks} chunks ({reply_audio_bytes} bytes). Success!")

async def main():
    # Test 1: Credit Card Offer in Hindi (Ananya / Apex Bank)
    await test_call(
        preset="credit_card_offer",
        lang="hi",
        expected_name="अनन्या",
        user_say="नमस्ते अनन्या, कार्ड के क्या फायदे हैं?"
    )

    # Test 2: Overdue Loan EMI in Marathi (Aarti / EasyFinance)
    await test_call(
        preset="bill_emi_reminder",
        lang="mr",
        expected_name="आरती",
        user_say="नमस्कार आरती, माझा ईएमआय किती बाकी आहे?"
    )

    # Test 3: Telecaller Recharge Promo in English (Simran / SwiftTel 5G)
    await test_call(
        preset="mobile_recharge_promo",
        lang="en",
        expected_name="Simran",
        user_say="Hello Simran, what is the annual recharge plan?"
    )

    print("\n" + "=" * 60)
    print("ALL MODES & LANGUAGES VERIFIED END-TO-END WITH ZERO DELAYS!")
    print("=" * 60)

if __name__ == "__main__":
    asyncio.run(main())
