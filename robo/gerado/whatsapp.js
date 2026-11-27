// GERADO — NÃO EDITE. Feito por scripts/robo-whatsapp.mjs a partir de packages/core/src/robos/whatsappAtendimento.ts e do
// mesmoNumero de packages/core/src/robos/whatsapp.ts. Mudou alguma dessas fontes? Rode `node scripts/robo-whatsapp.mjs` e
// commite este arquivo junto.
Object.defineProperty(exports, Symbol.toStringTag, { value: 'Module' });
//#region packages/core/src/robos/whatsapp.ts
function mesmoNumero(a, b) {
	const sem9 = (n) => {
		const d = n.replace(/\D/g, "");
		return /^55\d{2}9[6-9]\d{7}$/.test(d) ? d.slice(0, 4) + d.slice(5) : d;
	};
	return !!a && !!b && sem9(a) === sem9(b);
}

//#endregion
//#region packages/core/src/robos/whatsappAtendimento.ts
const NUMERO_DO_ESCRITORIO = "553891383638";
const texto = (v) => typeof v === "string" ? v : v == null ? "" : String(v);
function numeroDoWhatsapp(telefone) {
	const d = texto(telefone).replace(/\D/g, "");
	if (d.length === 10 || d.length === 11) return "55" + d;
	if (d.startsWith("55") && (d.length === 12 || d.length === 13)) return d;
	return "";
}
function numeroFormatado(numero) {
	const d = texto(numero).replace(/\D/g, "").replace(/^55(?=\d{10,11}$)/, "");
	if (d.length === 11) return "(" + d.slice(0, 2) + ") " + d.slice(2, 7) + "-" + d.slice(7);
	if (d.length === 10) return "(" + d.slice(0, 2) + ") " + d.slice(2, 6) + "-" + d.slice(6);
	return d;
}
const CHAVES_DESLIGADAS = {
	guias: false,
	boletos: false,
	mandei: false,
	respostas: false,
	autoatendimento: false,
	liberado: false,
	empresaDeTeste: "",
	numerosDeTeste: [],
	atualizadoEm: "",
	atualizadoPor: ""
};
const MAX_NUMEROS_DE_TESTE = 5;
function numerosDeTesteValidos(v) {
	const lista = Array.isArray(v) ? v.map(numeroDoWhatsapp).filter(Boolean) : [];
	return lista.filter((n, i) => lista.findIndex((m) => mesmoNumero(m, n)) === i).slice(0, 5);
}
const CHAVES_DO_WHATSAPP = [
	{
		chave: "guias",
		rotulo: "Guias do Fiscal",
		explica: "No lote do Enviar guias com a via WhatsApp, o robô manda o aviso com o link da Área do Cliente."
	},
	{
		chave: "boletos",
		rotulo: "Boletos de honorários",
		explica: "Depois do e-mail do lote de Boletos, o robô manda o boleto em PDF pelo WhatsApp do cadastro."
	},
	{
		chave: "mandei",
		rotulo: "Mandei",
		explica: "Depois do e-mail do Mandei, o robô manda o link pelo WhatsApp do ticket."
	},
	{
		chave: "respostas",
		rotulo: "Registrar respostas",
		explica: "O que o cliente responde em até 7 dias fica gravado no pedido e aparece em Respostas."
	},
	{
		chave: "autoatendimento",
		rotulo: "Autoatendimento",
		explica: "O cliente que escreve recebe o menu e pede as guias, o boleto ou os documentos do DP."
	},
	{
		chave: "liberado",
		rotulo: "Liberar para clientes",
		explica: "Desligada, tudo vai só para os números de teste (o que iria a um cliente vai ao escritório como TESTE)."
	}
];
const CODIGO_DE_EMPRESA = /^\d{1,8}$/;
function lerChaves(bruto) {
	if (!bruto || typeof bruto !== "object") return { ...CHAVES_DESLIGADAS };
	const d = bruto;
	const empresa = texto(d.empresaDeTeste).trim();
	return {
		guias: d.guias === true,
		boletos: d.boletos === true,
		mandei: d.mandei === true,
		respostas: d.respostas === true,
		autoatendimento: d.autoatendimento === true,
		liberado: d.liberado === true,
		empresaDeTeste: CODIGO_DE_EMPRESA.test(empresa) ? empresa : "",
		numerosDeTeste: numerosDeTesteValidos(d.numerosDeTeste),
		atualizadoEm: texto(d.atualizadoEm),
		atualizadoPor: texto(d.atualizadoPor)
	};
}
function chavesParaGravar(c, quem, agoraIso) {
	const empresa = c.empresaDeTeste.trim();
	if (empresa && !CODIGO_DE_EMPRESA.test(empresa)) throw new Error("A empresa de teste é o código do cliente (só números).");
	const ruins = c.numerosDeTeste.filter((n) => n.trim() && !numeroDoWhatsapp(n));
	if (ruins.length) throw new Error("Número de teste inválido: " + ruins.join(", ") + " (use DDD + número).");
	return {
		guias: c.guias,
		boletos: c.boletos,
		mandei: c.mandei,
		respostas: c.respostas,
		autoatendimento: c.autoatendimento,
		liberado: c.liberado,
		empresaDeTeste: empresa,
		numerosDeTeste: numerosDeTesteValidos(c.numerosDeTeste),
		atualizadoEm: agoraIso,
		atualizadoPor: quem.slice(0, 80)
	};
}
function pedidoParaCliente(d, liberado, teste = []) {
	const para = numeroDoWhatsapp(d.telefone);
	if (!para || !d.texto.trim()) return null;
	if (liberado) return {
		para,
		texto: d.texto,
		teste: false
	};
	if (teste.some((t) => mesmoNumero(t, para))) return {
		para,
		texto: d.texto,
		teste: true
	};
	return {
		para: NUMERO_DO_ESCRITORIO,
		texto: "[TESTE: iria para " + (d.cliente.trim() || "o cliente") + ", " + numeroFormatado(para) + "]\n\n" + d.texto,
		teste: true
	};
}
const MESES = [
	"janeiro",
	"fevereiro",
	"março",
	"abril",
	"maio",
	"junho",
	"julho",
	"agosto",
	"setembro",
	"outubro",
	"novembro",
	"dezembro"
];
function mesPorExtenso(competencia) {
	return /^\d{4}-(0[1-9]|1[0-2])$/.test(competencia) ? MESES[Number(competencia.slice(5)) - 1] + " de " + competencia.slice(0, 4) : "";
}
function rodapeDasMensagens(atende) {
	return atende ? "Para pedir guias, boletos ou documentos, responda MENU. Para falar com a equipe, chame o escritório no WhatsApp " + numeroFormatado(NUMERO_DO_ESCRITORIO) + "." : "Este número só envia avisos e não lê respostas. Qualquer dúvida, fale com o escritório pelo WhatsApp " + numeroFormatado(NUMERO_DO_ESCRITORIO) + ".";
}
function mensagemDasGuias(d, atende) {
	const mes = mesPorExtenso(d.competencia) || "do mês";
	return "Olá, " + (d.cliente.trim() || "cliente") + "! As guias de " + mes + " já estão na sua Área do Cliente" + (d.link ? ": " + d.link : ".") + "\n\n" + rodapeDasMensagens(atende);
}
const reais = (v) => Number.isFinite(v) && v > 0 ? v.toLocaleString("pt-BR", {
	style: "currency",
	currency: "BRL"
}) : "";
const dataBr = (iso) => /^\d{4}-\d{2}-\d{2}/.test(iso) ? iso.slice(8, 10) + "/" + iso.slice(5, 7) + "/" + iso.slice(0, 4) : "";
function mensagemDoBoleto(d, atende) {
	const mes = mesPorExtenso(d.competencia);
	const valor = reais(d.valor);
	const venc = dataBr(d.vencimento);
	return "Olá, " + (d.cliente.trim() || "cliente") + "! Segue o boleto dos honorários contábeis" + (mes ? " de " + mes : "") + (valor ? ", no valor de " + valor : "") + (venc ? ", com vencimento em " + venc : "") + ".\n\nSe o pagamento já foi feito, por favor desconsidere.\n\n" + rodapeDasMensagens(atende);
}
function mensagemDoMandei(d, atende) {
	return "Olá, " + (d.cliente.trim() || "cliente") + "! O escritório precisa de algumas informações" + (d.numero ? " (pedido " + d.numero + ")" : "") + ". Responda e mande os arquivos por este link: " + d.link + "\n\n" + rodapeDasMensagens(atende);
}
const obj = (v) => v && typeof v === "object" ? v : null;
function numeroDoJid(jid) {
	const j = texto(jid);
	if (!j.endsWith("@s.whatsapp.net")) return "";
	return j.split("@")[0].split(":")[0].replace(/\D/g, "");
}
function lerMensagemRecebida(m) {
	const msg = obj(m);
	const key = obj(msg?.key);
	if (!msg || !key || key.fromMe === true) return null;
	const remoto = texto(key.remoteJid);
	if (!remoto || remoto.endsWith("@g.us") || remoto.endsWith("@broadcast") || remoto === "status@broadcast" || remoto.endsWith("@newsletter")) return null;
	const numero = numeroDoJid(remoto) || numeroDoJid(key.remoteJidAlt) || numeroDoJid(key.senderPn);
	if (!numero) return null;
	let c = obj(msg.message);
	for (const casca of [
		"ephemeralMessage",
		"viewOnceMessage",
		"viewOnceMessageV2",
		"documentWithCaptionMessage"
	]) {
		const dentro = obj(obj(c?.[casca])?.message);
		if (dentro) c = dentro;
	}
	if (!c) return null;
	const segundos = Number(typeof msg.messageTimestamp === "object" && msg.messageTimestamp ? msg.messageTimestamp.low : msg.messageTimestamp);
	const em = Number.isFinite(segundos) && segundos > 0 ? (/* @__PURE__ */ new Date(segundos * 1e3)).toISOString() : "";
	const base = {
		id: texto(key.id),
		numero,
		em
	};
	const doc = obj(c.documentMessage);
	if (typeof c.conversation === "string") return {
		...base,
		tipo: "texto",
		texto: c.conversation,
		arquivo: ""
	};
	const ext = obj(c.extendedTextMessage);
	if (ext && typeof ext.text === "string") return {
		...base,
		tipo: "texto",
		texto: ext.text,
		arquivo: ""
	};
	if (doc) {
		const nome = texto(doc.fileName).slice(0, 120);
		const pdf = texto(doc.mimetype) === "application/pdf" || /\.pdf$/i.test(nome);
		return {
			...base,
			tipo: pdf ? "pdf" : "documento",
			texto: texto(doc.caption),
			arquivo: nome
		};
	}
	if (obj(c.imageMessage)) return {
		...base,
		tipo: "imagem",
		texto: texto(obj(c.imageMessage)?.caption),
		arquivo: ""
	};
	if (obj(c.audioMessage)) return {
		...base,
		tipo: "audio",
		texto: "",
		arquivo: ""
	};
	if (obj(c.videoMessage)) return {
		...base,
		tipo: "video",
		texto: texto(obj(c.videoMessage)?.caption),
		arquivo: ""
	};
	if (c.reactionMessage || c.protocolMessage || c.senderKeyDistributionMessage || c.pollUpdateMessage) return null;
	return {
		...base,
		tipo: "outro",
		texto: "",
		arquivo: ""
	};
}
const RESPOSTA_VALE_MS = 6048e5;
const MAX_RESPOSTAS_POR_PEDIDO = 20;
const MAX_LETRAS_DA_RESPOSTA = 1e3;
function respostaParaGravar(r, agoraIso) {
	return {
		em: r.em || agoraIso,
		tipo: r.tipo,
		texto: r.texto.trim().slice(0, MAX_LETRAS_DA_RESPOSTA),
		...r.arquivo ? { arquivo: r.arquivo } : {}
	};
}
function textoDaResposta(r) {
	const t = texto(r.texto).trim();
	const oque = {
		pdf: "mandou um PDF",
		documento: "mandou um arquivo",
		imagem: "mandou uma foto",
		audio: "mandou um áudio",
		video: "mandou um vídeo",
		outro: "mandou uma mensagem"
	};
	if (!r.tipo || r.tipo === "texto") return t;
	return (oque[r.tipo] || "mandou uma mensagem") + (r.arquivo ? " (" + r.arquivo + ")" : "") + (t ? ": " + t : "");
}
function pedidoRespondido(conversas, numero, agora) {
	let achado = null;
	for (const [n, c] of Object.entries(conversas)) {
		if (!c || !mesmoNumero(n, numero) || agora - c.em > 6048e5) continue;
		if (!achado || c.em > achado.em) achado = c;
	}
	return achado ? achado.caminho : null;
}
const CONVERSA_NOVA = {
	etapa: "",
	empresas: [],
	empresa: null,
	menuEm: 0,
	avisoEm: 0,
	aguardando: false,
	invalidas: 0
};
const MAX_NAO_ENTENDI = 2;
const MENU_VALE_MS = 18e5;
const MENU_DE_NOVO_MS = 216e5;
const RESPONDENDO_MS = 864e5;
const AVISO_DE_NOVO_MS = 864e5;
const NOME_DO_ATENDIMENTO = "Autoatendimento Nilma Contabilidade";
const TITULO = "*Autoatendimento Nilma Contabilidade*";
const EMOJI_DO_NUMERO = [
	"0️⃣",
	"1️⃣",
	"2️⃣",
	"3️⃣",
	"4️⃣",
	"5️⃣",
	"6️⃣",
	"7️⃣",
	"8️⃣",
	"9️⃣"
];
const numeroEmEmoji = (n) => EMOJI_DO_NUMERO[n] ?? String(n) + " –";
const OPCOES = [
	{
		acao: "guias",
		rotulo: "Guias do mês"
	},
	{
		acao: "boleto",
		rotulo: "Boleto de honorários"
	},
	{
		acao: "dp",
		rotulo: "Documentos do DP (folha, férias, rescisão)"
	},
	{
		acao: "escritorio",
		rotulo: "Falar com a equipe do escritório"
	}
];
function saudacaoDoAtendimento(agora) {
	const h = (/* @__PURE__ */ new Date(agora - 108e5)).getUTCHours();
	if (h >= 5 && h < 12) return "Bom dia";
	return h >= 12 && h < 18 ? "Boa tarde" : "Boa noite";
}
const SIGLAS = /* @__PURE__ */ new Set([
	"LTDA",
	"ME",
	"EPP",
	"EIRELI",
	"SA",
	"S/A",
	"S.A.",
	"MEI",
	"SS",
	"CIA"
]);
const MIUDAS = /* @__PURE__ */ new Set([
	"e",
	"de",
	"da",
	"do",
	"das",
	"dos"
]);
function nomeDaEmpresa(nome) {
	return nome.trim().split(/\s+/).map((p, i) => {
		if (SIGLAS.has(p.toUpperCase()) || SIGLAS.has(p.replace(/[.,]/g, "").toUpperCase())) return p.toUpperCase();
		const baixa = p.toLowerCase();
		if (i > 0 && MIUDAS.has(baixa)) return baixa;
		return baixa.charAt(0).toUpperCase() + baixa.slice(1);
	}).join(" ");
}
const LEMBRETE = "_A qualquer momento, digite *menu* para voltar aqui._";
const TEXTO_DE_MAIS_ALGUMA = "Precisa de mais alguma coisa? Responda com outro número do menu ou *0* para encerrar.";
const TEXTO_DE_ENCERRAR = "Atendimento encerrado. Obrigado! Quando precisar, é só mandar *menu*. 👋";
const normal = (s) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();
const PEDE_MENU = /^(menu|oi|oie|ola|bom dia|boa tarde|boa noite|inicio|opcoes|ajuda|voltar)$/;
function textoDoMenu(empresa, agora) {
	return [
		TITULO,
		"",
		saudacaoDoAtendimento(agora) + "! Você está no atendimento de *" + nomeDaEmpresa(empresa.nome) + "*.",
		"",
		"Escolha uma opção e responda só com o número:",
		"",
		...OPCOES.map((o, i) => numeroEmEmoji(i + 1) + " " + o.rotulo),
		numeroEmEmoji(0) + " Encerrar",
		"",
		LEMBRETE
	].join("\n");
}
function textoDasEmpresas(empresas, agora) {
	return [
		TITULO,
		"",
		saudacaoDoAtendimento(agora) + "! Este número está no cadastro de mais de uma empresa. Qual delas?",
		"",
		...empresas.map((e, i) => numeroEmEmoji(i + 1) + " " + nomeDaEmpresa(e.nome)),
		"",
		"Responda só com o número."
	].join("\n");
}
const TEXTO_FORA_DO_CADASTRO = [
	TITULO,
	"",
	"Olá! Não achamos este número no cadastro de nenhuma empresa. Fale com a equipe pelo WhatsApp " + numeroFormatado(NUMERO_DO_ESCRITORIO) + "."
].join("\n");
const TEXTO_DO_ESCRITORIO = [
	"Certo! Avisamos a equipe do escritório, que vai te responder assim que possível. Se for urgente, chame direto no WhatsApp " + numeroFormatado(NUMERO_DO_ESCRITORIO) + ".",
	"",
	TEXTO_DE_MAIS_ALGUMA
].join("\n");
const TEXTO_NAO_ENTENDI = "Desculpe, não entendi. 🙂 Responda só com o número de uma das opções:";
const TEXTO_NAO_ENTENDI_EQUIPE = [
	"Desculpe, não consegui entender. Avisamos a equipe do escritório, que vai te responder assim que possível. Se for urgente, chame no WhatsApp " + numeroFormatado(NUMERO_DO_ESCRITORIO) + ".",
	"",
	"Para voltar às opções, digite *menu*."
].join("\n");
function passoDoAtendimento(guardada, recebido, empresas, agora, ultimoEnvioEm = 0) {
	const c = {
		...CONVERSA_NOVA,
		...guardada || {},
		empresas
	};
	const t = normal(recebido);
	const pediuMenu = PEDE_MENU.test(t);
	const n = /^\d{1,2}$/.test(t) ? Number(t) : 0;
	const nada = (conversa = c) => ({
		responder: "",
		acao: null,
		conversa
	});
	if (!empresas.length) {
		if (agora - c.avisoEm < AVISO_DE_NOVO_MS) return nada();
		return {
			responder: TEXTO_FORA_DO_CADASTRO,
			acao: null,
			conversa: {
				...c,
				etapa: "",
				empresa: null,
				avisoEm: agora
			}
		};
	}
	const empresa = (c.empresa ? empresas.find((e) => e.codigo === c.empresa?.codigo) : void 0) || (empresas.length === 1 ? empresas[0] : null);
	const esperando = {
		aguardando: true,
		invalidas: 0
	};
	const abrirMenu = () => empresa ? {
		responder: textoDoMenu(empresa, agora),
		acao: null,
		conversa: {
			...c,
			...esperando,
			etapa: "menu",
			empresa,
			menuEm: agora
		}
	} : {
		responder: textoDasEmpresas(empresas, agora),
		acao: null,
		conversa: {
			...c,
			...esperando,
			etapa: "empresa",
			empresa: null,
			menuEm: agora
		}
	};
	const vale = agora - c.menuEm < MENU_VALE_MS;
	const naoEntendeu = () => {
		const invalidas = (c.invalidas || 0) + 1;
		if (invalidas >= 2 && empresa) return {
			responder: TEXTO_NAO_ENTENDI_EQUIPE,
			acao: {
				tipo: "escritorio",
				empresa
			},
			conversa: {
				...c,
				empresa,
				aguardando: false,
				invalidas: 0,
				menuEm: agora
			}
		};
		return {
			responder: "Desculpe, não entendi. 🙂 Responda só com o número de uma das opções:\n\n" + (empresa ? textoDoMenu(empresa, agora) : textoDasEmpresas(empresas, agora)),
			acao: null,
			conversa: {
				...c,
				aguardando: true,
				invalidas,
				menuEm: agora
			}
		};
	};
	if (pediuMenu) {
		if (empresas.length > 1 && t === "menu") return {
			responder: textoDasEmpresas(empresas, agora),
			acao: null,
			conversa: {
				...c,
				...esperando,
				etapa: "empresa",
				empresa: null,
				menuEm: agora
			}
		};
		return abrirMenu();
	}
	if (n && vale && c.etapa === "empresa") {
		const escolhida = empresas[n - 1];
		if (!escolhida) return naoEntendeu();
		return {
			responder: textoDoMenu(escolhida, agora),
			acao: null,
			conversa: {
				...c,
				...esperando,
				etapa: "menu",
				empresa: escolhida,
				menuEm: agora
			}
		};
	}
	if (t === "0" && c.etapa !== "") return {
		responder: TEXTO_DE_ENCERRAR,
		acao: null,
		conversa: {
			...c,
			etapa: "",
			aguardando: false,
			invalidas: 0,
			menuEm: agora
		}
	};
	if (n && vale && c.etapa === "menu" && empresa) {
		const opcao = OPCOES[n - 1];
		if (!opcao) return naoEntendeu();
		return {
			responder: opcao.acao === "escritorio" ? TEXTO_DO_ESCRITORIO : "",
			acao: {
				tipo: opcao.acao,
				empresa
			},
			conversa: {
				...c,
				etapa: "menu",
				empresa,
				menuEm: agora,
				aguardando: false,
				invalidas: 0
			}
		};
	}
	if (n) return abrirMenu();
	if (c.aguardando && vale && c.etapa !== "") return naoEntendeu();
	if (agora - ultimoEnvioEm < 864e5 || agora - c.menuEm < 216e5) return nada();
	return abrirMenu();
}
const MAX_ARQUIVOS_DO_ATENDIMENTO = 5;
function envioMaisRecente(registros) {
	const com = registros.filter((r) => r.arquivos.length > 0 && /^\d{4}-\d{2}$/.test(r.competencia));
	com.sort((a, b) => b.competencia.localeCompare(a.competencia) || b.enviadoEm.localeCompare(a.enviadoEm));
	return com[0] ? {
		...com[0],
		arquivos: com[0].arquivos.slice(0, 5)
	} : null;
}
const NOMES_DA_ACAO = {
	guias: ["a guia", "as guias"],
	boleto: ["o boleto de honorários", "os boletos de honorários"],
	dp: ["o documento do DP", "os documentos do DP"]
};
function textoDosDocumentos(acao, empresa, achado) {
	const [um, varios] = NOMES_DA_ACAO[acao];
	if (!achado) return "Não achamos " + varios + " de " + nomeDaEmpresa(empresa.nome) + " já enviados pelo escritório. Se precisar, fale com a equipe pelo WhatsApp " + numeroFormatado(NUMERO_DO_ESCRITORIO) + ".\n\nPrecisa de mais alguma coisa? Responda com outro número do menu ou *0* para encerrar.";
	const mes = mesPorExtenso(achado.competencia);
	const qtos = achado.arquivos.length;
	return (qtos === 1 ? "Segue " + um : "Seguem " + varios) + " de " + nomeDaEmpresa(empresa.nome) + (mes ? " (" + mes + ")" : "") + (qtos > 1 ? ", " + qtos + " arquivos" : "") + ".\n\nPrecisa de mais alguma coisa? Responda com outro número do menu ou *0* para encerrar.";
}
const DIAS_DAS_RESPOSTAS = 7;
const ORIGENS_DO_PEDIDO = {
	"lote-fiscal": "Guias do Fiscal",
	boleto: "Boleto de honorários",
	mandei: "Mandei",
	autoatendimento: "Autoatendimento"
};
function respostasDoPedido(bruto) {
	const m = obj(bruto);
	if (!m) return [];
	return Object.entries(m).filter(([k, v]) => /^r\d+$/.test(k) && obj(v)).sort(([a], [b]) => Number(a.slice(1)) - Number(b.slice(1))).map(([, v]) => {
		const x = v;
		const tipo = [
			"texto",
			"pdf",
			"documento",
			"imagem",
			"audio",
			"video",
			"outro"
		].includes(x.tipo) ? x.tipo : "outro";
		return {
			em: texto(x.em),
			tipo,
			texto: texto(x.texto),
			...texto(x.arquivo) ? { arquivo: texto(x.arquivo) } : {}
		};
	});
}
function lerRespostaRecebida(id, bruto) {
	const d = obj(bruto) || {};
	const respostas = respostasDoPedido(d.respostas);
	const origem = texto(d.origem);
	return {
		id,
		empresa: texto(d.empresa) || texto(d.clienteNome) || "Cliente",
		origem: ORIGENS_DO_PEDIDO[origem] || (texto(d.tipo) === "whatsapp" ? "Pedir extratos" : "WhatsApp"),
		numero: d.tipo === "whatsapp-recebida" ? numeroFormatado(d.numero) : "",
		quando: texto(d.respondidoEm),
		pedeEscritorio: d.pedeEscritorio === true,
		teste: d.teste === true,
		respostas,
		ultima: texto(d.ultimaResposta) || (respostas.length ? textoDaResposta(respostas[respostas.length - 1]) : "")
	};
}
function desdeDasRespostas(agora) {
	return (/* @__PURE__ */ new Date(agora.getTime() - 7 * 864e5)).toISOString();
}
function mudancasDasChaves(antes, depois) {
	const estado = (v) => v ? "ligada" : "desligada";
	const lista = CHAVES_DO_WHATSAPP.filter((c) => antes[c.chave] !== depois[c.chave]).map((c) => c.rotulo + ": " + estado(antes[c.chave]) + " → " + estado(depois[c.chave]));
	const nums = (c) => c.numerosDeTeste.map(numeroFormatado).join(", ") || "nenhum";
	if (nums(antes) !== nums(depois)) lista.push("Números de teste a mais: " + nums(antes) + " → " + nums(depois));
	if (antes.empresaDeTeste.trim() !== depois.empresaDeTeste.trim()) lista.push("Empresa de teste: " + (antes.empresaDeTeste.trim() || "nenhuma") + " → " + (depois.empresaDeTeste.trim() || "nenhuma"));
	return lista;
}
const RESPOSTA_MIN_MS = 3e3;
const RESPOSTA_MAX_MS = 8e3;
function esperaParaResponder(ultimo, agora, sorteio) {
	const intervalo = RESPOSTA_MIN_MS + Math.round(5e3 * Math.min(1, Math.max(0, sorteio)));
	return Math.max(0, (ultimo || 0) + intervalo - agora);
}
function linhaComChaves(primeiro) {
	if (typeof primeiro !== "string") return false;
	return /^(Closing session|Opening session|Removing old closed session|Session already closed|Migrating session to|Session error:|V1 session storage migration error)/.test(primeiro);
}

//#endregion
exports.CHAVES_DESLIGADAS = CHAVES_DESLIGADAS;
exports.CHAVES_DO_WHATSAPP = CHAVES_DO_WHATSAPP;
exports.CONVERSA_NOVA = CONVERSA_NOVA;
exports.DIAS_DAS_RESPOSTAS = DIAS_DAS_RESPOSTAS;
exports.MAX_ARQUIVOS_DO_ATENDIMENTO = MAX_ARQUIVOS_DO_ATENDIMENTO;
exports.MAX_NAO_ENTENDI = MAX_NAO_ENTENDI;
exports.MAX_NUMEROS_DE_TESTE = MAX_NUMEROS_DE_TESTE;
exports.MAX_RESPOSTAS_POR_PEDIDO = MAX_RESPOSTAS_POR_PEDIDO;
exports.MENU_DE_NOVO_MS = MENU_DE_NOVO_MS;
exports.MENU_VALE_MS = MENU_VALE_MS;
exports.NOME_DO_ATENDIMENTO = NOME_DO_ATENDIMENTO;
exports.NUMERO_DO_ESCRITORIO = NUMERO_DO_ESCRITORIO;
exports.RESPONDENDO_MS = RESPONDENDO_MS;
exports.RESPOSTA_MAX_MS = RESPOSTA_MAX_MS;
exports.RESPOSTA_MIN_MS = RESPOSTA_MIN_MS;
exports.RESPOSTA_VALE_MS = RESPOSTA_VALE_MS;
exports.TEXTO_DE_ENCERRAR = TEXTO_DE_ENCERRAR;
exports.TEXTO_DE_MAIS_ALGUMA = TEXTO_DE_MAIS_ALGUMA;
exports.TEXTO_DO_ESCRITORIO = TEXTO_DO_ESCRITORIO;
exports.TEXTO_FORA_DO_CADASTRO = TEXTO_FORA_DO_CADASTRO;
exports.TEXTO_NAO_ENTENDI = TEXTO_NAO_ENTENDI;
exports.TEXTO_NAO_ENTENDI_EQUIPE = TEXTO_NAO_ENTENDI_EQUIPE;
exports.chavesParaGravar = chavesParaGravar;
exports.desdeDasRespostas = desdeDasRespostas;
exports.envioMaisRecente = envioMaisRecente;
exports.esperaParaResponder = esperaParaResponder;
exports.lerChaves = lerChaves;
exports.lerMensagemRecebida = lerMensagemRecebida;
exports.lerRespostaRecebida = lerRespostaRecebida;
exports.linhaComChaves = linhaComChaves;
exports.mensagemDasGuias = mensagemDasGuias;
exports.mensagemDoBoleto = mensagemDoBoleto;
exports.mensagemDoMandei = mensagemDoMandei;
exports.mesPorExtenso = mesPorExtenso;
exports.mesmoNumero = mesmoNumero;
exports.mudancasDasChaves = mudancasDasChaves;
exports.nomeDaEmpresa = nomeDaEmpresa;
exports.numeroDoWhatsapp = numeroDoWhatsapp;
exports.numeroFormatado = numeroFormatado;
exports.passoDoAtendimento = passoDoAtendimento;
exports.pedidoParaCliente = pedidoParaCliente;
exports.pedidoRespondido = pedidoRespondido;
exports.respostaParaGravar = respostaParaGravar;
exports.respostasDoPedido = respostasDoPedido;
exports.rodapeDasMensagens = rodapeDasMensagens;
exports.saudacaoDoAtendimento = saudacaoDoAtendimento;
exports.textoDaResposta = textoDaResposta;
exports.textoDasEmpresas = textoDasEmpresas;
exports.textoDoMenu = textoDoMenu;
exports.textoDosDocumentos = textoDosDocumentos;