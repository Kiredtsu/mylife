/* MyLife — motor local do assistente (100% offline, sem rede).
   Entende perguntas em português sobre os dados do app e executa ações simples. */
(function(){
  const norm = s => String(s||"").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"");
  const has = (q, ...words) => words.some(w => q.includes(w));
  const num = s => { const m = String(s).match(/(\d+(?:[.,]\d{1,2})?)/); return m ? parseFloat(m[1].replace(",",".")) : null; };
  const monthKey = () => new Date().toISOString().slice(0,7);
  const fmtDate = d => String(d||"").slice(0,10).split("-").reverse().join("/");
  const perMonth = { semanal:52/12, mensal:1, trimestral:1/3, anual:1/12 };

  function monthTx(DB){ return DB.tx.filter(t => (t.data||"").startsWith(monthKey())); }
  const sum = (arr, tipo) => arr.filter(t => t.tipo===tipo).reduce((s,t)=>s+(+t.valor||0),0);
  const subsMonthly = DB => DB.subs.filter(s=>s.status==="ativa").reduce((s,x)=>s+(+x.valor||0)*(perMonth[x.freq]||1),0);
  const overdue = DB => DB.tasks.filter(t=>!t.done && t.data && t.data < new Date().toISOString().slice(0,10));

  function summary(DB, h){
    const mt = monthTx(DB), pend = DB.tasks.filter(t=>!t.done);
    return [
      `Saldo atual: ${h.fmt(h.saldoTotal())}`,
      `Este mês: entradas ${h.fmt(sum(mt,"entrada"))}, saídas ${h.fmt(sum(mt,"saida"))}`,
      `Tarefas pendentes: ${pend.length} (atrasadas: ${overdue(DB).length})` + (pend.length ? " — " + pend.slice(0,8).map(t=>t.nome).join("; ") : ""),
      `Cofrinhos: ` + (DB.cofrinhos.map(p=>`${p.nome} ${h.fmt(p.atual)} de ${h.fmt(p.meta)}`).join("; ") || "nenhum"),
      `Assinaturas ativas: ${DB.subs.filter(s=>s.status==="ativa").length}, custo mensal ≈ ${h.fmt(subsMonthly(DB))}`
    ].join("\n");
  }

  const HELP = "Posso responder, offline, sobre:\n• saldo, gastos e receitas do mês\n• gastos por categoria / maior gasto\n• tarefas pendentes e atrasadas\n• cofrinhos, assinaturas, patrimônio\n• contagem regressiva (eventos)\n\nE registrar coisas, por exemplo:\n• \"gastei 12,50 em café\"\n• \"recebi 800 de freelance\"\n• \"nova tarefa: ligar para o banco\"";

  // Retorna { text, handled }. handled=false => nenhuma regra serviu (a IA do aparelho pode tentar).
  function answer(raw, DB, h){
    const q = norm(raw);
    const ok = text => ({ text, handled:true });

    // ---- ações ----
    let m;
    if((m = q.match(/^(?:nova tarefa|adicionar tarefa|criar tarefa|lembrar(?: de| me de)?|tarefa\s*:)\s*[:\-]?\s*(.+)$/))){
      const r = raw.trim().match(/^(?:nova tarefa|adicionar tarefa|criar tarefa|lembrar(?:\s+me)?(?:\s+de)?|tarefa\s*:)\s*[:\-]?\s*(.+)$/i);
      const nome = (r ? r[1] : m[1]).trim();
      h.addTask(nome);
      return ok(`Tarefa adicionada: "${nome}".`);
    }
    if((m = q.match(/^(gastei|paguei|comprei|despesa)\s+(?:r\$|€|\$)?\s*(\d+(?:[.,]\d{1,2})?)\s*(?:€|reais|euros|dolares)?\s*(?:em|no|na|com|de|para)?\s*(.*)$/)) && num(m[2])){
      const desc = (m[3]||"").trim() || "Despesa";
      h.addTx("saida", num(m[2]), desc);
      return ok(`Registrei uma saída de ${h.fmt(num(m[2]))} (${desc}).`);
    }
    if((m = q.match(/^(recebi|ganhei|entrada|receita)\s+(?:r\$|€|\$)?\s*(\d+(?:[.,]\d{1,2})?)\s*(?:€|reais|euros|dolares)?\s*(?:de|do|da|com|em)?\s*(.*)$/)) && num(m[2])){
      const desc = (m[3]||"").trim() || "Receita";
      h.addTx("entrada", num(m[2]), desc);
      return ok(`Registrei uma entrada de ${h.fmt(num(m[2]))} (${desc}).`);
    }

    // ---- consultas ----
    if(has(q,"ajuda","o que voce faz","o que voce sabe","comandos","help")) return ok(HELP);
    if(/^(oi|ola|bom dia|boa tarde|boa noite|e ai)\b/.test(q)) return ok("Olá! Pergunte sobre saldo, tarefas, cofrinhos ou assinaturas. Diga \"ajuda\" para ver tudo o que sei fazer.");

    if(has(q,"categoria")){
      const by = {}; monthTx(DB).filter(t=>t.tipo==="saida").forEach(t=>{ by[t.cat||"Outros"]=(by[t.cat||"Outros"]||0)+(+t.valor||0); });
      const rows = Object.entries(by).sort((a,b)=>b[1]-a[1]);
      return ok(rows.length ? "Gastos do mês por categoria:\n" + rows.map(([c,v])=>`• ${c}: ${h.fmt(v)}`).join("\n") : "Sem gastos registrados neste mês.");
    }
    if(has(q,"maior gasto","maior despesa","gastei mais")){
      const out = monthTx(DB).filter(t=>t.tipo==="saida").sort((a,b)=>b.valor-a.valor)[0];
      return ok(out ? `Seu maior gasto do mês foi ${h.fmt(out.valor)} — ${out.desc||out.cat} (${fmtDate(out.data)}).` : "Sem gastos registrados neste mês.");
    }
    if(has(q,"gast","despesa","saida","saidas")){
      const mt = monthTx(DB);
      return ok(`Neste mês você gastou ${h.fmt(sum(mt,"saida"))} em ${mt.filter(t=>t.tipo==="saida").length} lançamentos.`);
    }
    if(has(q,"receita","recebi","entrada","ganh")){
      return ok(`Neste mês entraram ${h.fmt(sum(monthTx(DB),"entrada"))}.`);
    }
    if(has(q,"patrimonio")){
      const p = DB.patrimonio, liq = h.saldoTotal()+h.cofrinhosTotal()+p.especie+p.investimentos+p.bens-p.dividas;
      return ok(`Patrimônio líquido: ${h.fmt(liq)}\n• Saldo: ${h.fmt(h.saldoTotal())}\n• Cofrinhos: ${h.fmt(h.cofrinhosTotal())}\n• Espécie: ${h.fmt(p.especie)}\n• Investimentos: ${h.fmt(p.investimentos)}\n• Bens: ${h.fmt(p.bens)}\n• Dívidas: -${h.fmt(p.dividas)}`);
    }
    if(has(q,"saldo","quanto tenho","quanto eu tenho","dinheiro")) return ok(`Seu saldo atual é ${h.fmt(h.saldoTotal())}.`);

    if(has(q,"tarefa","pendente","fazer","afazer")){
      const late = has(q,"atrasad","vencid");
      const list = late ? overdue(DB) : DB.tasks.filter(t=>!t.done);
      if(!list.length) return ok(late ? "Nenhuma tarefa atrasada. 👏" : "Você não tem tarefas pendentes. 🎉");
      return ok(`${late?"Tarefas atrasadas":"Tarefas pendentes"} (${list.length}):\n` + list.slice(0,12).map(t=>`• ${t.nome}${t.data?" — "+fmtDate(t.data):""}${t.prio==="alta"?" ⚠":""}`).join("\n"));
    }
    if(has(q,"cofrinho","meta","poupan","guardado")){
      if(!DB.cofrinhos.length) return ok("Você ainda não tem cofrinhos.");
      return ok("Seus cofrinhos:\n" + DB.cofrinhos.map(p=>`• ${p.nome}: ${h.fmt(p.atual)} de ${h.fmt(p.meta)} (${p.meta?Math.min(100,Math.round(p.atual/p.meta*100)):0}%)`).join("\n"));
    }
    if(has(q,"assinatura","mensalidade","recorrente")){
      const act = DB.subs.filter(s=>s.status==="ativa");
      if(!act.length) return ok("Nenhuma assinatura ativa.");
      return ok(`${act.length} assinaturas ativas, custo mensal ≈ ${h.fmt(subsMonthly(DB))}:\n` + act.map(s=>`• ${s.nome}: ${h.fmt(s.valor)} (${s.freq})${s.proxima?" — próx. "+fmtDate(s.proxima):""}`).join("\n"));
    }
    if(has(q,"evento","contagem","falta","quando")){
      const now = Date.now(), up = DB.eventos.map(e=>({e, d:new Date(e.data).getTime()})).filter(x=>x.d>=now).sort((a,b)=>a.d-b.d);
      if(!up.length) return ok("Nenhum evento futuro na contagem regressiva.");
      return ok("Próximos eventos:\n" + up.slice(0,6).map(x=>`• ${x.e.nome}: faltam ${Math.ceil((x.d-now)/864e5)} dia(s) (${fmtDate(x.e.data)})`).join("\n"));
    }
    if(has(q,"resumo","como estou","visao geral","panorama")) return ok(summary(DB,h));

    return { text:"Não entendi essa pergunta. " + HELP, handled:false };
  }

  window.MyLifeEngine = { answer, summary };
})();
