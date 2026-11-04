import asyncio
import json
import time
import websockets
import sys

sys.stdout.reconfigure(encoding='utf-8')

async def test_call(lang, description):
    print(f"\n==================================================")
    print(f"  Test: {description} (Language: {lang.upper()})")
    print(f"==================================================")
    uri = f"ws://127.0.0.1:8000/ws/browser-voice?preset=mobile_recharge_promo&lang={lang}&gender=female"
    async with websockets.connect(uri) as ws:
        t0 = time.time()
        first_audio_ms = None
        first_text_ms = None
        audio_chunk_count = 0
        total_audio_bytes = 0

        # Wait for greeting
        while time.time() - t0 < 3.0:
            try:
                raw = await asyncio.wait_for(ws.recv(), timeout=1.0)
                elapsed = (time.time() - t0) * 1000
                data = json.loads(raw)
                if data.get("type") == "sentence_chunk" and first_text_ms is None:
                    first_text_ms = elapsed
                    sample = data.get("text", "")[:45]
                    print(f"[{lang.upper()}] Text greeting: {elapsed:.1f}ms -> '{sample}...'")
                elif data.get("type") == "audio":
                    audio_chunk_count += 1
                    total_audio_bytes += len(data.get("data", ""))
                    if first_audio_ms is None:
                        first_audio_ms = elapsed
                        print(f"[{lang.upper()}] First audio chunk: {elapsed:.1f}ms")
            except asyncio.TimeoutError:
                break

        print(f"[{lang.upper()}] Greeting Summary: {audio_chunk_count} chunks received ({total_audio_bytes} b64 bytes).")
        assert first_audio_ms is not None and first_audio_ms < 1000, f"Greeting audio too slow: {first_audio_ms}ms"
        assert first_text_ms is not None and first_text_ms < 1000, f"Greeting text too slow: {first_text_ms}ms"

        # Now test a complete long user paragraph
        if lang == "hi":
            paragraph = "नमस्ते सिमरन जी! मेरा 1.5GB वाला प्लान कल समाप्त हो रहा है, और मुझे पूरे 1 साल यानी 365 दिन वाला 5G प्लान चाहिए जिसमें डेली 2.5GB डेटा मिले और डिज़्नी हॉटस्टार का फ्री सब्सक्रिप्शन भी हो। कृपया इसके बारे में पूरी जानकारी दीजिए।"
        elif lang == "mr":
            paragraph = "नमस्कार सिमरन! माझा १.५ जीबी प्लॅन संपत आला आहे, आणि मला पूर्ण ३६५ दिवसांचा ५जी प्लॅन हवा आहे ज्यामध्ये रोज २.५ जीबी डेटा आणि हॉटस्टार मिळेल. कृपया याची माहिती द्या."
        else:
            paragraph = "Hello Simran! My recharge is expiring tomorrow and I need an annual 365 days 5G plan with 2.5GB daily data and Disney Hotstar included. Could you please give me all the offer details?"

        print(f"[{lang.upper()}] Sending FULL PARAGRAPH turn: '{paragraph[:60]}...'")
        t_user = time.time()
        await ws.send(json.dumps({"type": "user_transcript", "text": paragraph}))

        llm_reply = ""
        first_reply_audio = None
        while time.time() - t_user < 15.0:
            try:
                raw = await asyncio.wait_for(ws.recv(), timeout=8.0)
                elapsed = (time.time() - t_user) * 1000
                data = json.loads(raw)
                if data.get("type") == "sentence_chunk":
                    llm_reply += " " + data.get("text", "")
                elif data.get("type") == "audio" and first_reply_audio is None:
                    first_reply_audio = elapsed
                    print(f"[{lang.upper()}] First response audio: {elapsed:.1f}ms")
                elif data.get("type") == "transcript" and data.get("role") == "agent":
                    lat = data.get("latency", {})
                    print(f"[{lang.upper()}] Full turn done! Metrics: TTFT={lat.get('llm_ttft_ms', 'N/A')}ms, Total={lat.get('total_ms', 'N/A')}ms")
                    break
            except asyncio.TimeoutError:
                break

        print(f"[{lang.upper()}] Agent Answer: {llm_reply.strip()}")
        assert len(llm_reply.strip()) > 10, "Agent did not generate an answer!"

async def run():
    print("Testing back-to-back sequential calls without refresh across EN, HI, MR:")
    for lang in ["en", "hi", "mr"]:
        await test_call(lang, f"Consecutive Call ({lang.upper()})")
    print("\n=======================================================")
    print("ALL CONSECUTIVE CALLS PASSED WITH 0 ERRORS ACROSS EN, HI, MR!")
    print("=======================================================")

if __name__ == "__main__":
    asyncio.run(run())
