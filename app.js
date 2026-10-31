(() => {
  const $ = id => document.getElementById(id);
  let direction = "en-zh";
  let recognition = null;
  let listening = false;
  let shouldListen = false;
  let lastTranslation = "";
  let autoSpeakEnabled = true;
  let voices = [];
  let selectedVoices = { "zh-TW": "", "en-US": "" };
  let interimTimer = null;
  let restartTimer = null;
  let lastSubmittedText = "";
  let translationId = 0;
  let speechQueue = Promise.resolve();
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

  function setStatus(s) { $("status").textContent = s; }
  function refreshVoices() {
    voices = ("speechSynthesis" in window) ? window.speechSynthesis.getVoices() : [];
    const select = $("voiceSelect");
    if (!select) return;
    const current = select.value;
    select.innerHTML = '<option value="">依語言自動選擇（中文女聲／英文男聲優先）</option>';
    voices.filter(v => /^(zh|en)/i.test(v.lang)).forEach(v => {
      const opt = document.createElement("option");
      opt.value = v.voiceURI;
      opt.textContent = v.name + "（" + v.lang + "）";
      select.appendChild(opt);
    });
    if (current && [...select.options].some(o => o.value === current)) select.value = current;
  }
  if ("speechSynthesis" in window) {
    refreshVoices();
    window.speechSynthesis.onvoiceschanged = refreshVoices;
  }

  function setDirection(next) {
    direction = next;
    $("enToZh").classList.toggle("active", direction === "en-zh");
    $("zhToEn").classList.toggle("active", direction === "zh-en");
    $("sourceLabel").textContent = direction === "en-zh" ? "對方說英文" : "你說中文";
    $("targetLabel").textContent = direction === "en-zh" ? "翻譯成繁體中文" : "翻譯成美式英文";
    if (shouldListen) stopListening();
    setStatus("已切換翻譯方向");
  }
  $("enToZh").addEventListener("click", () => setDirection("en-zh"));
  $("zhToEn").addEventListener("click", () => setDirection("zh-en"));

  function decodeHtml(value) {
    const el = document.createElement("textarea"); el.innerHTML = value; return el.value;
  }
  function targetLang() { return direction === "en-zh" ? "zh-TW" : "en-US"; }
  function sourceLang() { return direction === "en-zh" ? "en-US" : "zh-TW"; }

  async function translate(text, fromSpeech = false) {
    const clean = (text || "").trim();
    if (!clean || clean.length < 2) return;
    if (clean === lastSubmittedText) return;
    lastSubmittedText = clean;
    const myId = ++translationId;
    $("sourceText").textContent = clean;
    $("sourceText").classList.remove("placeholder");
    $("translatedText").textContent = "翻譯中…";
    $("translatedText").classList.remove("placeholder");
    $("speakBtn").disabled = true;
    const pair = direction === "en-zh" ? "en|zh-TW" : "zh-TW|en";
    try {
      const url = "https://api.mymemory.translated.net/get?q=" + encodeURIComponent(clean) + "&langpair=" + encodeURIComponent(pair);
      const response = await fetch(url);
      if (!response.ok) throw new Error("翻譯服務暫時無法連線");
      const data = await response.json();
      const result = data && data.responseData && data.responseData.translatedText;
      if (!result) throw new Error("沒有取得翻譯結果");
      if (myId !== translationId) return;
      lastTranslation = decodeHtml(result);
      $("translatedText").textContent = lastTranslation;
      $("speakBtn").disabled = false;
      setStatus(autoSpeakEnabled ? "翻譯完成，播放語音…" : "翻譯完成");
      if (autoSpeakEnabled) speak(lastTranslation, targetLang());
    } catch (e) {
      if (myId !== translationId) return;
      $("translatedText").textContent = "翻譯暫時失敗：" + e.message + "。請稍後再試。";
      $("translatedText").classList.add("placeholder");
      setStatus("翻譯服務暫不可用；可稍後重試");
    }
  }

  function chooseVoice(lang) {
    refreshVoices();
    const list = voices.filter(v => lang === "zh-TW"
      ? /^zh[-_]tw$/i.test(v.lang) || /zh[-_]hant/i.test(v.lang) || /^zh/i.test(v.lang)
      : /^en[-_]us$/i.test(v.lang) || /^en/i.test(v.lang));
    const female = /female|woman|samantha|ava|jenny|aria|susan|ting[- ]?ting|mei[- ]?jia|sin[- ]?ji/i;
    const male = /male|man|daniel|alex|fred|tom|aaron|guy|david|oliver|lee/i;
    const preferred = lang === "zh-TW" ? female : male;
    return list.find(v => preferred.test(v.name)) || list[0];
  }
  function speak(text, lang) {
    if (!text || !("speechSynthesis" in window)) return;
    const synth = window.speechSynthesis;
    synth.cancel();
    synth.resume();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = lang;
    const voiceURI = selectedVoices[lang];
    const manualVoice = voiceURI ? voices.find(v => v.voiceURI === voiceURI) : null;
    const voice = manualVoice || chooseVoice(lang);
    if (voice) utterance.voice = voice;
    const rateControl = $("rateSelect");
    utterance.rate = rateControl ? Number(rateControl.value || 0.92) : 0.92;
    utterance.pitch = 1;
    utterance.volume = 1;
    utterance.onstart = () => setStatus("正在播放翻譯語音…");
    utterance.onend = () => setStatus(shouldListen ? "持續聆聽中…" : "語音播放完成");
    utterance.onerror = e => setStatus("語音播放受系統限制：" + (e.error || "請點播放翻譯"));
    synth.speak(utterance);
  }

  function submitFinal(text) {
    const clean = text.trim();
    if (!clean) return;
    if (interimTimer) { clearTimeout(interimTimer); interimTimer = null; }
    translate(clean, true);
  }

  function startRecognitionInstance() {
    if (!shouldListen || !SpeechRecognition) return;
    try {
      recognition = new SpeechRecognition();
      recognition.lang = sourceLang();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.maxAlternatives = 1;
      recognition.onstart = () => {
        listening = true;
        $("startBtn").disabled = true;
        $("stopBtn").disabled = false;
        setStatus("持續聆聽中…聽到一段話會盡快翻譯");
      };
      recognition.onresult = event => {
        let finals = [];
        let interim = "";
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const result = event.results[i];
          const phrase = result[0] && result[0].transcript ? result[0].transcript.trim() : "";
          if (!phrase) continue;
          if (result.isFinal) finals.push(phrase);
          else interim += phrase + " ";
        }
        if (finals.length) {
          submitFinal(finals.join(" "));
        } else if (interim.trim()) {
          const partial = interim.trim();
          $("sourceText").textContent = partial + " …";
          $("sourceText").classList.remove("placeholder");
          if (interimTimer) clearTimeout(interimTimer);
          // Translate a settled interim phrase after a short pause, instead of waiting
          // for the browser to declare a long final result. This is best-effort.
          interimTimer = setTimeout(() => {
            interimTimer = null;
            if (shouldListen && partial !== lastSubmittedText) translate(partial, true);
          }, 950);
        }
      };
      recognition.onerror = event => {
        if (event.error === "not-allowed" || event.error === "service-not-allowed") {
          shouldListen = false;
          setStatus("麥克風權限未允許，請到 iPhone 設定開啟麥克風權限");
        } else if (event.error !== "no-speech" && event.error !== "aborted") {
          setStatus("語音辨識中斷：" + event.error + "，正在嘗試恢復…");
        }
      };
      recognition.onend = () => {
        listening = false;
        if (shouldListen) {
          setStatus("收音短暫中斷，正在重新連線…");
          clearTimeout(restartTimer);
          restartTimer = setTimeout(() => startRecognitionInstance(), 450);
        } else {
          $("startBtn").disabled = false;
          $("stopBtn").disabled = true;
          setStatus("口譯已停止");
        }
      };
      recognition.start();
    } catch (e) {
      listening = false;
      if (shouldListen) {
        setStatus("瀏覽器暫時無法持續收音，請再按一次開始口譯");
        shouldListen = false;
        $("startBtn").disabled = false;
        $("stopBtn").disabled = true;
      }
    }
  }
  function startListening() {
    if (!SpeechRecognition) {
      setStatus("此瀏覽器不支援語音辨識；可用文字輸入或鍵盤聽寫");
      alert("目前瀏覽器不支援網頁語音辨識。建議用 iPhone Safari，或使用鍵盤麥克風聽寫。");
      return;
    }
    if (shouldListen) return;
    shouldListen = true;
    lastSubmittedText = "";
    startRecognitionInstance();
  }
  function stopListening() {
    shouldListen = false;
    clearTimeout(restartTimer);
    clearTimeout(interimTimer);
    if (recognition) {
      const old = recognition;
      recognition = null;
      try { old.onend = null; old.stop(); } catch (e) {}
    }
    listening = false;
    $("startBtn").disabled = false;
    $("stopBtn").disabled = true;
    if ("speechSynthesis" in window) window.speechSynthesis.cancel();
    setStatus("已停止口譯");
  }

  $("startBtn").addEventListener("click", startListening);
  $("stopBtn").addEventListener("click", stopListening);
  $("clearBtn").addEventListener("click", () => {
    $("sourceText").textContent = "辨識到的語音會顯示在這裡…";
    $("translatedText").textContent = "翻譯結果會顯示在這裡…";
    $("sourceText").classList.add("placeholder");
    $("translatedText").classList.add("placeholder");
    lastTranslation = "";
    lastSubmittedText = "";
    $("speakBtn").disabled = true;
    if ("speechSynthesis" in window) window.speechSynthesis.cancel();
    setStatus("已清除");
  });
  $("translateBtn").addEventListener("click", () => translate($("manualText").value));
  $("speakBtn").addEventListener("click", () => speak(lastTranslation, targetLang()));

  const autoButton = document.createElement("button");
  autoButton.type = "button";
  autoButton.className = "secondary full";
  autoButton.textContent = "🔁 自動播放：開啟";
  autoButton.setAttribute("aria-pressed", "true");
  autoButton.addEventListener("click", () => {
    autoSpeakEnabled = !autoSpeakEnabled;
    autoButton.textContent = autoSpeakEnabled ? "🔁 自動播放：開啟" : "🔁 自動播放：關閉";
    autoButton.setAttribute("aria-pressed", String(autoSpeakEnabled));
    setStatus(autoSpeakEnabled ? "自動播放已開啟" : "自動播放已關閉");
    if (autoSpeakEnabled) speak("自動播放已開啟。", targetLang());
  });
  $("speakBtn").parentElement.insertAdjacentElement("afterend", autoButton);

  const test = document.createElement("button");
  test.type = "button";
  test.className = "secondary full";
  test.textContent = "🔈 測試耳機語音";
  test.addEventListener("click", () => speak(
    direction === "en-zh" ? "你好，這是中文語音測試。" : "Hello, this is an English audio test.",
    targetLang()
  ));
  $("speakBtn").parentElement.insertAdjacentElement("afterend", test);

  const voiceSelect = $("voiceSelect");
  if (voiceSelect) {
    voiceSelect.addEventListener("change", () => {
      const chosen = voiceSelect.value;
      if (!chosen) {
        selectedVoices = { "zh-TW": "", "en-US": "" };
      } else {
        const voice = voices.find(v => v.voiceURI === chosen);
        if (voice) {
          if (/^zh/i.test(voice.lang)) selectedVoices["zh-TW"] = chosen;
          if (/^en/i.test(voice.lang)) selectedVoices["en-US"] = chosen;
        }
      }
      setStatus("已更新語音選擇；不同語言會分別使用對應聲音");
    });
  }
  const preview = $("previewVoice");
  if (preview) preview.addEventListener("click", () => speak(
    direction === "en-zh" ? "你好，這是中文語音試聽。" : "Hello, this is an English voice preview.",
    targetLang()
  ));

  if (!SpeechRecognition) setStatus("此瀏覽器不支援語音辨識；可使用文字輸入或鍵盤聽寫");
  else setStatus("即時口譯改善版已就緒｜自動播放開啟");
})();