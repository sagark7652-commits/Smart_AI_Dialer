from pathlib import Path

path = Path("agent/pipeline.py")
content = path.read_text(encoding="utf-8")
has_crlf = "\r\n" in content
norm = content.replace("\r\n", "\n")

# 1. Update speak_greeting
old_speak_greeting = """    async def speak_greeting(self) -> None:

        \"\"\"Speak agent greeting plus optional recording consent line.\"\"\"

        if not self.session or not self.prompt_manager:

            return



        greeting = self.session.get_greeting()

        lang = self.prompt_manager.config.get("default_language", "hi")"""

new_speak_greeting = """    async def speak_greeting(self) -> None:

        \"\"\"Speak agent greeting with timing guards, rotation, and pickup collision tolerance.\"\"\"

        if not self.session or not self.prompt_manager:

            return

        lang = self.prompt_manager.config.get("default_language", "hi")

        # 1. Media stream readiness & configurable greeting delay
        greeting_delay_sec = float(self.config.get("greeting_delay_ms", 600)) / 1000.0
        pickup_wait_sec = float(self.config.get("pickup_wait_ms", 1200)) / 1000.0

        # For outbound calls, wait briefly for caller's pickup "hello/हाँ"
        if getattr(self, "call_direction", "outbound") == "outbound" and pickup_wait_sec > 0:
            logger.info(f"[{self.call_id}] Waiting up to {pickup_wait_sec*1000:.0f}ms for caller pickup greeting...")
            t_pickup_start = time.time()
            while time.time() - t_pickup_start < pickup_wait_sec:
                if getattr(self, "_latest_partial_transcript", ""):
                    logger.info(f"[{self.call_id}] Caller greeted on pickup: '{self._latest_partial_transcript}'")
                    break
                await asyncio.sleep(0.05)

        if greeting_delay_sec > 0:
            await asyncio.sleep(greeting_delay_sec)

        # 2. Assemble polished rotated greeting via GreetingManager
        try:
            from agent.greeting_manager import get_greeting_manager
            gm = get_greeting_manager()
            call_type = getattr(self, "call_type", None) or self.config.get("mode", "outbound")
            if "sales" in call_type:
                call_type = "outbound"
            elif "reminder" in call_type:
                call_type = "reminder"
            elif "support" in call_type:
                call_type = "support"
            elif "survey" in call_type:
                call_type = "survey"
            elif "inbound" in call_type:
                call_type = "inbound"
            else:
                call_type = "outbound"

            cust_name = getattr(self, "customer_name", None) or self.variables.get("customer_name")
            company_name = self.config.get("company", {}).get("name") if isinstance(self.config.get("company"), dict) else None
            agent_gender = self.config.get("agent_gender", "female")
            ai_disc = self.config.get("ai_disclosure", "on") in ("on", True, "true")

            prepared = gm.build_greeting(
                call_type=call_type,
                language=lang,
                company=company_name,
                agent_name=self.config.get("name", "Priya"),
                name=cust_name,
                agent_gender=agent_gender,
                ai_disclosure=ai_disc,
            )
            greeting = prepared.text
        except Exception as e:
            logger.warning(f"GreetingManager fallback: {e}")
            greeting = self.session.get_greeting()"""

# 2. Update greeting grace period in speak_greeting
old_greeting_exec = """        self._record_transcript("agent", greeting)

        self._set_state(AgentState.SPEAKING)



        try:

            await self._speak_phrase(greeting, language=lang)

            if self.player:

                self.player.wait_until_done(timeout=6.0)

        finally:

            self._set_state(AgentState.LISTENING)

            self._last_user_activity_time = time.time()"""

new_greeting_exec = """        self._record_transcript("agent", greeting)

        self._set_state(AgentState.SPEAKING)
        self._greeting_start_time = time.time()
        self._in_greeting_grace_period = True

        try:

            await self._speak_phrase(greeting, language=lang)

            if self.player:

                self.player.wait_until_done(timeout=6.0)

        finally:
            self._in_greeting_grace_period = False
            self._set_state(AgentState.LISTENING)

            self._last_user_activity_time = time.time()"""

# 3. Update barge-in check
old_barge_in = """                    if not is_backchannel:

                        self.trigger_barge_in(speech_onset_time=self.vad.barge_in_speech_start)"""

new_barge_in = """                    # Check pickup collision grace period
                    is_pickup_hello = False
                    grace_window_sec = float(self.config.get("barge_in_grace_window_ms", 1500)) / 1000.0
                    time_since_greeting = time.time() - getattr(self, "_greeting_start_time", 0.0)
                    in_grace = getattr(self, "_in_greeting_grace_period", False) and (time_since_greeting < grace_window_sec)

                    if in_grace and getattr(self, "_latest_partial_transcript", ""):
                        tokens = [t.lower() for t in self._latest_partial_transcript.strip().split()]
                        if len(tokens) <= 2 and any(t in ["hello", "halo", "हॅलो", "हेलो", "हां", "हाँ", "हो", "haan", "ha"] for t in tokens):
                            is_pickup_hello = True
                            logger.info(f"[{self.call_id}] Ignoring pickup greeting collision in grace window: '{self._latest_partial_transcript}'")

                    if not is_backchannel and not is_pickup_hello:

                        self.trigger_barge_in(speech_onset_time=self.vad.barge_in_speech_start)"""

if old_speak_greeting in norm and old_greeting_exec in norm and old_barge_in in norm:
    norm = norm.replace(old_speak_greeting, new_speak_greeting)
    norm = norm.replace(old_greeting_exec, new_greeting_exec)
    norm = norm.replace(old_barge_in, new_barge_in)
    if has_crlf:
        norm = norm.replace("\n", "\r\n")
    path.write_text(norm, encoding="utf-8")
    print("PIPELINE_GREETING_UPDATED_SUCCESSFULLY")
else:
    print("WARNING: Snippets not found in agent/pipeline.py")
