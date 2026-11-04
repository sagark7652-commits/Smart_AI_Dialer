"""Factory to instantiate the configured TTS provider with Language-Adaptive Voice Routing."""







from typing import AsyncIterator, Optional, Union



from agent.config import get_settings



from agent.tts.base import BaseTTS



from agent.tts.cartesia_tts import CartesiaTTS



from agent.tts.sarvam_tts import SarvamTTS



from agent.tts.openai_tts import OpenAITTS

from agent.tts.elevenlabs_tts import ElevenLabsTTS



from agent.tts.mock_tts import MockTTS











class LanguageAdaptiveTTS(BaseTTS):



    """Dynamic multi-language TTS engine with session voice locking.



    



    Adheres strictly to voice locking rules:



    - English: Female = sol (ChatGPT voice), Male = ember (ChatGPT voice)



    - Hindi: Female = leher (Sarvam AI), Male = neer (Sarvam AI)



    - Voice locking: Gender remains locked for the entire call; mid-call language



      switches change between (leher <-> sol) or (neer <-> ember) smoothly.



    """







    def __init__(



        self,



        gender: str = "female",



        default_lang: str = "hi",



    ) -> None:



        self.gender = gender.lower()



        self.current_language = default_lang.split("-")[0].lower()



        self.settings = get_settings()







        self.en_voice = "sol" if self.gender == "female" else "ember"



        self.hi_voice = "leher" if self.gender == "female" else "neer"



        self.mr_voice = "meera" if self.gender == "female" else "amol"







        if self.settings.cartesia_api_key and getattr(self.settings, "cartesia_voice_id", None):

            self.en_tts = CartesiaTTS(voice_id=self.settings.cartesia_voice_id)

        elif self.settings.elevenlabs_api_key:

            vid = getattr(self.settings, "elevenlabs_voice_id", None) or "cgSgspJ2msm6clMCkdW9"

            self.en_tts = ElevenLabsTTS(voice_id=vid)

        elif self.settings.openai_api_key:

            self.en_tts = OpenAITTS(voice=self.en_voice, gender=self.gender)

        else:

            self.en_tts = MockTTS(gender=self.gender)







        if self.settings.cartesia_api_key and getattr(self.settings, "cartesia_voice_id", None):

            self.hi_tts = CartesiaTTS(voice_id=self.settings.cartesia_voice_id)

            self.mr_tts = CartesiaTTS(voice_id=self.settings.cartesia_voice_id)

        elif self.settings.sarvam_api_key:

            self.hi_tts = SarvamTTS(speaker=self.hi_voice, gender=self.gender)

            self.mr_tts = SarvamTTS(speaker=self.mr_voice, gender=self.gender)

        elif self.settings.cartesia_api_key:

            self.hi_tts = CartesiaTTS()

            self.mr_tts = CartesiaTTS()



        else:



            self.hi_tts = MockTTS(gender=self.gender)



            self.mr_tts = MockTTS(gender=self.gender)







    def set_language(self, language: str) -> None:



        self.current_language = language.split("-")[0].lower()



        if hasattr(self.en_tts, "set_language"):



            self.en_tts.set_language(self.current_language)



        if hasattr(self.hi_tts, "set_language"):



            self.hi_tts.set_language(self.current_language)



        if hasattr(self.mr_tts, "set_language"):



            self.mr_tts.set_language(self.current_language)







    def get_active_voice(self, language: Optional[str] = None) -> str:



        lang = (language or self.current_language).split("-")[0].lower()



        if "en" in lang:



            return self.en_voice



        elif "mr" in lang:



            return self.mr_voice



        return self.hi_voice







    async def generate_audio_stream(



        self,



        text_or_stream: Union[AsyncIterator[str], str],



        language: Optional[str] = None,



    ) -> AsyncIterator[bytes]:



        target_lang = (language or self.current_language).split("-")[0].lower()



        if "en" in target_lang:



            async for chunk in self.en_tts.generate_audio_stream(text_or_stream, language=target_lang):



                yield chunk



        elif "mr" in target_lang:



            async for chunk in self.mr_tts.generate_audio_stream(text_or_stream, language=target_lang):



                yield chunk



        else:



            async for chunk in self.hi_tts.generate_audio_stream(text_or_stream, language=target_lang):



                yield chunk











def get_tts_provider(
    provider_name: Optional[str] = None,
    language: Optional[str] = None,
    gender: str = "female",
    voice: Optional[str] = None,
) -> BaseTTS:
    """Instantiate and return the configured TTS engine."""
    settings = get_settings()
    provider = (provider_name or settings.tts_provider).lower()
    lang = (language or "hi").lower()

    if provider == "openai":
        return OpenAITTS(voice=voice, gender=gender)
    elif provider == "sarvam":
        return SarvamTTS(speaker=voice, gender=gender)
    elif provider == "elevenlabs":
        return ElevenLabsTTS(voice_id=voice or getattr(settings, "elevenlabs_voice_id", None) or "cgSgspJ2msm6clMCkdW9")
    elif provider == "cartesia":
        return CartesiaTTS(voice_id=voice or getattr(settings, "cartesia_voice_id", None) or "a1e4199c-8c88-4608-8491-33da880e63b8")
    elif provider in ("huggingface", "hf"):
        from agent.tts.huggingface_tts import HuggingFaceTTS
        return HuggingFaceTTS(language=lang)
    else:
        # Adaptive multi-language routing by default
        return LanguageAdaptiveTTS(gender=gender, default_lang=lang)



