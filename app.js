(() => {
  const $ = id => document.getElementById(id);
  let direction = "en-zh", recognition = null, listening = false, lastTranslation = "";
  let autoSpeakEnabled = false;
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  let voices = [];

  function refreshVoices() {
    voices = ("speechSynthesis" in window) ? window.speechSynthesis.getVoices() : [];
  }
  if ("speechSynthesis" in window) {
    refreshVoices();
    window.speechSynthesis.onvoiceschanged = refreshVoices;
  }
  function setStatus(s) { $("status").textContent = s; }

  function setDirection(next) {
    direction = next;
    $("enToZh").classList.toggle("active", direction === "en-zh");
    $("zhToEn").classList.toggle("active", direction === "zh-en");
    $("sourceLabel").textContent = direction === "en-zh" ? "對方說英文" : "你說中文";
    $("targetLabel").textContent = direction === "en-zh" ? "翻譯成繁體中文" : "翻譯成美式英文";
    if (listening) stopListening();
    setStatus("已切換翻譯方向");
  }
  $("enToZh").addEventListener("click", () => setDirection("en-zh"));
  $("zhToEn").addEventListener("click", () => setDirection("zh-en"));

  function decodeHtml(value) {
    const el = document.createElement("textarea"); el.innerHTML = value; return el.value;
  }
  async function translate(text) {
    const clean = text.trim(); if (!clean) return;
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
      lastTranslation = decodeHtml(result);
      $("translatedText").textContent = lastTranslation;
      $("speakBtn").disabled = false;
      setStatus(autoSpeakEnabled ? "翻譯完成，準備播放語音…" : "翻譯完成，請按播放翻譯");
      if (autoSpeakEnabled) {
        // Attempt automatic playback after each completed translation.
        // iOS Chrome may require a fresh user tap for some speech playback sessions.
        window.setTimeout(() => speak(lastTranslation, direction === "en-zh" ? "zh-TW" : "en-US"), 150);
      }
    } catch (e) {
      $("translatedText").textContent = "翻譯失敗：" + e.message + "。請檢查網路，或稍後再試。";
      $("translatedText").classList.add("placeholder");
      setStatus("翻譯服務暫不可用");
    }
  }

  function selectVoice(lang) {
    refreshVoices();
    if (lang === "zh-TW") {
      return voices.find(v => /^zh[-_]tw$/i.test(v.lang)) ||
        voices.find(v => /zh[-_]hant/i.test(v.lang)) || voices.find(v => /^zh/i.test(v.lang));
    }
    return voices.find(v => /^en[-_]us$/i.test(v.lang)) || voices.find(v => /^en/i.test(v.lang));
  }

  function speak(text, lang) {
    if (!text) { setStatus("目前沒有可播放的翻譯文字"); return; }
    if (!("speechSynthesis" in window) || !("SpeechSynthesisUtterance" in window)) {
      setStatus("此瀏覽器不支援語音播放");
      alert("此瀏覽器不支援語音播放。請更新 iOS，並使用 Safari 再試。");
      return;
    }
    const synth = window.speechSynthesis;
    synth.cancel();
    synth.resume();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = lang;
    utterance.rate = 0.92;
    utterance.pitch = 1;
    utterance.volume = 1;
    const voice = selectVoice(lang);
    if (voice) utterance.voice = voice;
    utterance.onstart = () => setStatus("正在播放語音…");
    utterance.onend = () => setStatus("語音播放完成");
    utterance.onerror = e => setStatus("語音播放失敗：" + (e.error || "未知錯誤"));
    try {
      synth.speak(utterance);
      if (synth.paused) synth.resume();
    } catch (e) {
      setStatus("無法啟動語音播放");
      alert("無法啟動語音播放，請重新整理網頁後再試。");
    }
  }

  function startListening() {
    if (!SpeechRecognition) {
      setStatus("此瀏覽器不支援語音辨識");
      alert("目前瀏覽器不支援網頁語音辨識。請使用下方文字輸入，或使用 iPhone 鍵盤麥克風聽寫。");
      return;
    }
    if (listening) return;
    recognition = new SpeechRecognition();
    recognition.lang = direction === "en-zh" ? "en-US" : "zh-TW";
    recognition.continuous = true;
    recognition.interimResults = true;
    let finalText = "";
    recognition.onstart = () => {
      listening = true; $("startBtn").disabled = true; $("stopBtn").disabled = false; setStatus("正在收音…");
    };
    recognition.onresult = event => {
      let interim = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const piece = event.results[i][0].transcript;
        if (event.results[i].isFinal) finalText += piece + " ";
        else interim += piece;
      }
      const display = (finalText + interim).trim();
      $("sourceText").textContent = display || "正在聆聽…";
      $("sourceText").classList.remove("placeholder");
      if (finalText.trim()) { const t = finalText.trim(); finalText = ""; translate(t); }
    };
    recognition.onerror = event => {
      setStatus("收音錯誤：" + event.error);
      if (event.error === "not-allowed") alert("請允許網站使用麥克風。");
    };
    recognition.onend = () => {
      listening = false; $("startBtn").disabled = false; $("stopBtn").disabled = true;
      if ($("status").textContent === "正在收音…") setStatus("收音已停止");
    };
    try { recognition.start(); } catch (e) { setStatus("無法啟動收音"); }
  }
  function stopListening() {
    if (recognition) { try { recognition.stop(); } catch (e) {} }
    listening = false; $("startBtn").disabled = false; $("stopBtn").disabled = true;
  }

  $("startBtn").addEventListener("click", startListening);
  $("stopBtn").addEventListener("click", stopListening);
  $("clearBtn").addEventListener("click", () => {
    $("sourceText").textContent = "辨識到的語音會顯示在這裡…";
    $("translatedText").textContent = "翻譯結果會顯示在這裡…";
    $("sourceText").classList.add("placeholder"); $("translatedText").classList.add("placeholder");
    lastTranslation = ""; $("speakBtn").disabled = true; setStatus("已清除");
  });
  $("translateBtn").addEventListener("click", () => translate($("manualText").value));
  $("speakBtn").addEventListener("click", () => speak(lastTranslation, direction === "en-zh" ? "zh-TW" : "en-US"));

  const autoButton = document.createElement("button");
  autoButton.type = "button";
  autoButton.className = "secondary full";
  autoButton.textContent = "🔁 自動播放：關閉";
  autoButton.setAttribute("aria-pressed", "false");
  autoButton.addEventListener("click", () => {
    autoSpeakEnabled = !autoSpeakEnabled;
    autoButton.textContent = autoSpeakEnabled ? "🔁 自動播放：開啟" : "🔁 自動播放：關閉";
    autoButton.setAttribute("aria-pressed", String(autoSpeakEnabled));
    setStatus(autoSpeakEnabled ? "自動播放已開啟" : "自動播放已關閉");
    if (autoSpeakEnabled) {
      // A short spoken test is initiated directly by this tap to unlock audio where supported.
      speak(direction === "en-zh" ? "自動播放已開啟。" : "Automatic playback is on.",
            direction === "en-zh" ? "zh-TW" : "en-US");
    }
  });
  $("speakBtn").parentElement.insertAdjacentElement("afterend", autoButton);

  const test = document.createElement("button");
  test.type = "button"; test.className = "secondary full"; test.textContent = "🔈 測試耳機語音";
  test.addEventListener("click", () => speak(
    direction === "en-zh" ? "你好，這是中文語音測試。" : "Hello, this is an English audio test.",
    direction === "en-zh" ? "zh-TW" : "en-US"
  ));
  $("speakBtn").parentElement.insertAdjacentElement("afterend", test);
  if (!SpeechRecognition) setStatus("語音辨識需使用支援的瀏覽器；可先輸入文字");
})();