(() => {
  const $ = id => document.getElementById(id);
  let direction = "en-zh";
  let recognition = null;
  let listening = false;
  let lastTranslation = "";
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

  function setStatus(text){ $("status").textContent = text; }
  function setDirection(next){
    direction = next;
    $("enToZh").classList.toggle("active", direction === "en-zh");
    $("zhToEn").classList.toggle("active", direction === "zh-en");
    $("sourceLabel").textContent = direction === "en-zh" ? "對方說英文" : "你說中文";
    $("targetLabel").textContent = direction === "en-zh" ? "翻譯成繁體中文" : "翻譯成美式英文";
    if(listening) stopListening();
    setStatus("已切換翻譯方向");
  }
  $("enToZh").addEventListener("click",()=>setDirection("en-zh"));
  $("zhToEn").addEventListener("click",()=>setDirection("zh-en"));

  async function translate(text){
    const clean = text.trim();
    if(!clean) return;
    $("sourceText").textContent = clean;
    $("sourceText").classList.remove("placeholder");
    $("translatedText").textContent = "翻譯中…";
    $("translatedText").classList.remove("placeholder");
    $("speakBtn").disabled = true;
    const pair = direction === "en-zh" ? "en|zh-TW" : "zh-TW|en";
    try{
      const url = "https://api.mymemory.translated.net/get?q=" + encodeURIComponent(clean) + "&langpair=" + encodeURIComponent(pair);
      const response = await fetch(url);
      if(!response.ok) throw new Error("翻譯服務暫時無法連線");
      const data = await response.json();
      const result = data && data.responseData && data.responseData.translatedText;
      if(!result) throw new Error("沒有取得翻譯結果");
      lastTranslation = decodeHtml(result);
      $("translatedText").textContent = lastTranslation;
      $("speakBtn").disabled = false;
      setStatus("翻譯完成");
    }catch(error){
      $("translatedText").textContent = "翻譯失敗：" + error.message + "。請檢查網路，或稍後再試。";
      $("translatedText").classList.add("placeholder");
      setStatus("翻譯服務暫不可用");
    }
  }
  function decodeHtml(value){
    const el = document.createElement("textarea");
    el.innerHTML = value;
    return el.value;
  }
  function startListening(){
    if(!SpeechRecognition){
      setStatus("此瀏覽器不支援語音辨識");
      alert("目前瀏覽器不支援網頁語音辨識。請改用最新版 Chrome／Edge，或使用下方文字輸入翻譯。");
      return;
    }
    if(listening) return;
    recognition = new SpeechRecognition();
    recognition.lang = direction === "en-zh" ? "en-US" : "zh-TW";
    recognition.continuous = true;
    recognition.interimResults = true;
    let finalText = "";
    recognition.onstart = () => { listening = true; $("startBtn").disabled = true; $("stopBtn").disabled = false; setStatus("正在收音…"); };
    recognition.onresult = event => {
      let interim = "";
      for(let i=event.resultIndex;i<event.results.length;i++){
        const piece = event.results[i][0].transcript;
        if(event.results[i].isFinal) finalText += piece + " ";
        else interim += piece;
      }
      const display = (finalText + interim).trim();
      $("sourceText").textContent = display || "正在聆聽…";
      $("sourceText").classList.remove("placeholder");
      if(finalText.trim()) {
        const toTranslate = finalText.trim();
        finalText = "";
        translate(toTranslate);
      }
    };
    recognition.onerror = event => {
      setStatus("收音錯誤：" + event.error);
      if(event.error === "not-allowed") alert("請在瀏覽器設定中允許此網站使用麥克風。");
    };
    recognition.onend = () => {
      listening = false; $("startBtn").disabled = false; $("stopBtn").disabled = true;
      if($("status").textContent === "正在收音…") setStatus("收音已停止");
    };
    try{ recognition.start(); }catch(e){ setStatus("無法啟動收音"); }
  }
  function stopListening(){
    if(recognition){ try{recognition.stop();}catch(e){} }
    listening = false;
    $("startBtn").disabled = false;
    $("stopBtn").disabled = true;
  }
  $("startBtn").addEventListener("click",startListening);
  $("stopBtn").addEventListener("click",stopListening);
  $("clearBtn").addEventListener("click",()=>{
    $("sourceText").textContent="辨識到的語音會顯示在這裡…";
    $("translatedText").textContent="翻譯結果會顯示在這裡…";
    $("sourceText").classList.add("placeholder");
    $("translatedText").classList.add("placeholder");
    lastTranslation=""; $("speakBtn").disabled=true; setStatus("已清除");
  });
  $("translateBtn").addEventListener("click",()=>translate($("manualText").value));
  $("speakBtn").addEventListener("click",()=>{
    if(!lastTranslation || !("speechSynthesis" in window)) return;
    speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(lastTranslation);
    utterance.lang = direction === "en-zh" ? "zh-TW" : "en-US";
    speechSynthesis.speak(utterance);
  });
  if(!SpeechRecognition) setStatus("語音辨識需使用支援的瀏覽器；可先輸入文字");
})();