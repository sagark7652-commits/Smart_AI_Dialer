import asyncio
import json
import time
import websockets
import sys

sys.stdout.reconfigure(encoding='utf-8')

async def test_dtmf_and_text():
    uri = "ws://127.0.0.1:8000/ws/browser-voice?preset=mobile_recharge_promo&lang=hi&gender=female"
    print("\nConnecting to websocket for DTMF & Text test...")
    async with websockets.connect(uri) as ws:
        # Wait for initial greeting
        t0 = time.time()
        while time.time() - t0 < 2.0:
            try:
                raw = await asyncio.wait_for(ws.recv(), timeout=0.5)
            except asyncio.TimeoutError:
                break

        # 1. Test DTMF Key 1 (Confirm)
        print("\n--- Testing DTMF Key 1 (Confirm Plan) ---")
        await ws.send(json.dumps({"type": "dtmf", "digit": "1"}))
        dtmf_reply = ""
        t_dtmf = time.time()
        while time.time() - t_dtmf < 5.0:
            try:
                raw = await asyncio.wait_for(ws.recv(), timeout=2.0)
                data = json.loads(raw)
                if data.get("type") == "sentence_chunk":
                    dtmf_reply += " " + data.get("text", "")
                elif data.get("type") == "transcript" and data.get("role") == "agent":
                    break
            except asyncio.TimeoutError:
                break
        print(f"DTMF 1 Spoken Response: {dtmf_reply.strip()}")
        assert "कन्फर्म" in dtmf_reply or "धन्यवाद" in dtmf_reply, f"Unexpected DTMF response: {dtmf_reply}"

        # 2. Test Text Input ("Can you tell me the price?")
        print("\n--- Testing Text Input Message ---")
        await ws.send(json.dumps({"type": "user_transcript", "text": "इस प्लान की कीमत कितनी है?"}))
        text_reply = ""
        t_text = time.time()
        while time.time() - t_text < 5.0:
            try:
                raw = await asyncio.wait_for(ws.recv(), timeout=2.0)
                data = json.loads(raw)
                if data.get("type") == "sentence_chunk":
                    text_reply += " " + data.get("text", "")
                elif data.get("type") == "transcript" and data.get("role") == "agent":
                    break
            except asyncio.TimeoutError:
                break
        print(f"Text Input Spoken Response: {text_reply.strip()}")
        assert "1999" in text_reply or "रुपये" in text_reply, f"Unexpected Text response: {text_reply}"

    print("\nDTMF KEYPAD & TEXT INPUT BOTH WORKING 100% PERFECTLY!")

if __name__ == "__main__":
    asyncio.run(test_dtmf_and_text())
