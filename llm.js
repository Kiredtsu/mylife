/* MyLife — IA generativa opcional, rodando NO aparelho (WebLLM + WebGPU).
   Baixa a biblioteca e o modelo uma única vez; depois funciona sem internet. */
(function(){
  const LIB = "https://cdn.jsdelivr.net/npm/@mlc-ai/web-llm@0.2.79/+esm";
  const PREFERRED = ["Qwen2.5-0.5B-Instruct-q4f32_1-MLC", "Qwen2.5-0.5B-Instruct-q4f16_1-MLC"];
  const FLAG = "mylife_llm_enabled";
  let engine = null, loading = null;

  async function load(onProgress){
    if(engine) return engine;
    if(loading) return loading;
    loading = (async ()=>{
      if(!navigator.gpu) throw new Error("Este aparelho/navegador não tem WebGPU (iPhone: iOS 26 ou superior).");
      const webllm = await import(LIB);
      const ids = webllm.prebuiltAppConfig.model_list.map(m => m.model_id);
      const id = PREFERRED.find(p => ids.includes(p)) || ids.find(i => /Qwen2\.5-0\.5B-Instruct/.test(i));
      if(!id) throw new Error("Modelo pequeno não encontrado na lista do WebLLM.");
      engine = await webllm.CreateMLCEngine(id, { initProgressCallback: p => onProgress && onProgress(p) });
      try{ localStorage.setItem(FLAG, "1"); }catch(e){}
      try{ navigator.storage && navigator.storage.persist && navigator.storage.persist(); }catch(e){}
      return engine;
    })();
    try{ return await loading; } finally { loading = null; }
  }

  async function chat(messages, onToken){
    const stream = await engine.chat.completions.create({ messages, stream:true, temperature:0.3, max_tokens:400 });
    let out = "";
    for await (const chunk of stream){
      out += (chunk.choices[0] && chunk.choices[0].delta && chunk.choices[0].delta.content) || "";
      onToken && onToken(out);
    }
    return out;
  }

  window.MyLifeLLM = {
    supported: () => !!navigator.gpu,
    ready: () => !!engine,
    wasEnabled: () => { try{ return localStorage.getItem(FLAG) === "1"; }catch(e){ return false; } },
    load, chat
  };
})();
