// GERADO — NÃO EDITE. Feito por scripts/robo-sci.mjs a partir de packages/core/src/sci/integracao e areaCliente/sciReport*.ts.
// Mudou alguma dessas fontes? Rode `node scripts/robo-sci.mjs` e commite este arquivo junto.
Object.defineProperty(exports, Symbol.toStringTag, { value: 'Module' });
//#region packages/core/src/areaCliente/guias.ts
const ROTULO_DA_SITUACAO_DA_GUIA = {
	"a vencer": "A vencer",
	"vence hoje": "Vence hoje",
	vencida: "Vencida"
};

//#endregion
//#region packages/core/src/areaCliente/sciReport.ts
const SCI_AUTH = "https://api-auth.sci.com.br";
const SCI_RELATORIO = "https://api-relatorio.sci.com.br";
const SCI_POR_PAGINA = 200;
const SCI_MARGEM_DO_JWT_MS = 3e5;
const SCI_MESES_NA_AREA = 3;
const objeto$1 = (v) => v && typeof v === "object" && !Array.isArray(v) ? v : null;
const texto$1 = (v) => typeof v === "string" ? v.trim() : typeof v === "number" && Number.isFinite(v) ? String(v) : "";
const numero = (v) => {
	const n = typeof v === "number" ? v : typeof v === "string" && v.trim() ? Number(v) : NaN;
	return Number.isFinite(n) ? n : NaN;
};
const inteiro$1 = (v) => {
	const n = numero(v);
	return Number.isInteger(n) ? n : NaN;
};
const sim = (v) => v === true || v === 1 || v === "1" || v === "true";
const digitos = (v) => texto$1(v).replace(/\D/g, "");
function dataDoSci(v) {
	const m = /^(\d{4})-(\d{2})-(\d{2})(?:[ T].*)?$/.exec(texto$1(v));
	if (!m) return "";
	const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
	if (d.getFullYear() !== Number(m[1]) || d.getMonth() !== Number(m[2]) - 1 || d.getDate() !== Number(m[3])) return "";
	return m[3] + "/" + m[2] + "/" + m[1];
}
function lerLoginDoSci(resposta, agora) {
	const r = objeto$1(resposta);
	const token = texto$1(r?.token);
	if (!token) return null;
	const validade = numero(r?.validade);
	return {
		token,
		expiraEm: agora + (validade > 0 ? validade : 3600) * 1e3
	};
}
function sessaoDoSciVale(s, agora) {
	return !!s && s.expiraEm - agora > 3e5;
}
function sessaoDoSciAindaAceita(s, agora) {
	return !!s && s.expiraEm > agora;
}
function lerEmpresasDoSci(resposta) {
	const lista = objeto$1(resposta)?.empresas;
	if (!Array.isArray(lista)) return [];
	const saida = [];
	for (const x of lista) {
		const e = objeto$1(x);
		const empresaId = inteiro$1(e?.empresaId);
		const cnpj = digitos(e?.numeroDocumento);
		if (Number.isInteger(empresaId) && empresaId > 0 && cnpj) saida.push({
			empresaId,
			nome: texto$1(e?.nome),
			cnpj
		});
	}
	return saida;
}
function empresaDoSciPeloDocumento(empresas, documento) {
	const d = digitos(documento);
	if (d.length !== 14 && d.length !== 11) return null;
	const iguais = [...new Set(empresas.filter((e) => e.cnpj === d).map((e) => e.empresaId))];
	return iguais.length === 1 ? iguais[0] : null;
}
function competenciaDoSci(mes, ano) {
	const m = inteiro$1(mes);
	const a = inteiro$1(ano);
	if (!(a >= 2e3 && a <= 2100) || !(m >= 1 && m <= 13)) return "";
	return a + "-" + String(Math.min(m, 12)).padStart(2, "0");
}
function lerPublicacaoDoSci(x) {
	const p = objeto$1(x);
	if (!p) return null;
	const publicadosId = inteiro$1(p.publicadosId);
	const empresaId = inteiro$1(p.empresaId);
	const competencia = competenciaDoSci(p.mesRef, p.anoRef);
	if (!(publicadosId > 0) || !(empresaId > 0) || !competencia) return null;
	const valor = numero(p.valor);
	const valorPago = numero(p.valorPagamento);
	return {
		publicadosId,
		empresaId,
		competencia,
		tipo: texto$1(p.tipo),
		relatorioId: texto$1(p.relatorioId),
		nomeRelatorio: texto$1(p.nomeRelatorio),
		descricao: texto$1(p.descricao),
		vencimento: dataDoSci(p.dataVencimento),
		valor: Number.isFinite(valor) ? valor : 0,
		individual: sim(p.individual),
		visualizado: sim(p.visualizado),
		vistoEm: dataDoSci(p.dataHoraPrimeiraVisualizacao),
		pagamentoEm: dataDoSci(p.dataPagamento),
		valorPago: Number.isFinite(valorPago) ? valorPago : 0
	};
}
function lerPaginaDePublicados(resposta) {
	const pub = objeto$1(objeto$1(resposta)?.publicados);
	const itens = (Array.isArray(pub?.dados) ? pub.dados : []).map(lerPublicacaoDoSci).filter((p) => !!p);
	const paginaAtual = inteiro$1(pub?.paginaAtual);
	const ultimaPagina = inteiro$1(pub?.ultimaPagina);
	return {
		itens,
		paginaAtual: paginaAtual > 0 ? paginaAtual : 1,
		ultimaPagina: ultimaPagina > 0 ? ultimaPagina : 1
	};
}
const referenciaDoSci = (competencia) => competencia.slice(5, 7) + "/" + competencia.slice(0, 4);
function janelaDoSci(hoje, meses = 3) {
	const comp = (d) => d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0");
	return {
		de: comp(new Date(hoje.getFullYear(), hoje.getMonth() - Math.max(1, meses) + 1, 1)),
		ate: comp(hoje)
	};
}
function consultaDePublicados(p) {
	const q = new URLSearchParams({
		tipoDocumento: "imposto",
		status: "todos",
		empresaId: String(p.empresaId),
		referenciaInicial: referenciaDoSci(p.de),
		referenciaFinal: referenciaDoSci(p.ate),
		individual: "false",
		page: String(p.pagina ?? 1),
		registrosPorPagina: String(200)
	});
	if (p.publicadosId) q.set("publicadosId", String(p.publicadosId));
	return q.toString();
}
const ROTULO_DA_SITUACAO_DO_SCI = {
	...ROTULO_DA_SITUACAO_DA_GUIA,
	"pagamento informado": "Pagamento informado"
};
function urlDoPdfDoSci(resposta) {
	const url = texto$1(objeto$1(resposta)?.urlPdf);
	return /^https:\/\/[^\s]+$/.test(url) ? url : "";
}

//#endregion
//#region packages/core/src/areaCliente/sciReportCliente.ts
function publicadosIdDaResposta(resposta) {
	const lista = resposta && typeof resposta === "object" ? resposta.publicados : null;
	const primeiro = Array.isArray(lista) && lista[0] && typeof lista[0] === "object" ? lista[0].publicadosId : 0;
	const n = Number(primeiro);
	return Number.isInteger(n) && n > 0 ? n : 0;
}
var ErroDoSci = class extends Error {
	status;
	constructor(status, mensagem) {
		super(mensagem);
		this.status = status;
		this.name = "ErroDoSci";
	}
};
const MAX_PAGINAS$2 = 10;
function criarClienteSciReport(deps) {
	const agora = deps.agora ?? (() => Date.now());
	let sessao = null;
	const empresas = /* @__PURE__ */ new Map();
	async function json(r) {
		if (r.status === 204) return null;
		try {
			return await r.json();
		} catch {
			return null;
		}
	}
	const mensagemDe = (corpo) => {
		const m = corpo && typeof corpo === "object" ? corpo.mensagem : "";
		return typeof m === "string" && m.trim() ? m.trim().slice(0, 200) : "";
	};
	async function entrar() {
		if (sessaoDoSciAindaAceita(sessao, agora())) {
			const r = await deps.buscar(SCI_AUTH + "/api/v1/auth/refresh", {
				method: "POST",
				headers: { Authorization: "Bearer " + sessao.token }
			});
			const nova = r.status === 201 || r.status === 200 ? lerLoginDoSci(await json(r), agora()) : null;
			if (nova) return sessao = nova;
		}
		const s = await deps.segredos();
		if (!s.parceiro || !s.cliente) throw new ErroDoSci(0, "faltam os tokens do SCI Report");
		const r = await deps.buscar(SCI_AUTH + "/api/v1/auth/credencial/login", {
			method: "POST",
			headers: { Authorization: "Basic " + btoa(s.parceiro + ":" + s.cliente) }
		});
		const corpo = await json(r);
		const nova = r.status === 201 || r.status === 200 ? lerLoginDoSci(corpo, agora()) : null;
		if (!nova) throw new ErroDoSci(r.status, r.status === 401 ? "a SCI recusou os tokens (o de Parceiro ou o de Cliente)" : "o login na SCI não deu certo (" + r.status + ")");
		return sessao = nova;
	}
	async function chamar(metodo, caminho, montarCorpo) {
		for (let vez = 0; vez < 2; vez++) {
			const s = sessaoDoSciVale(sessao, agora()) ? sessao : await entrar();
			const r = await deps.buscar(SCI_RELATORIO + caminho, {
				method: metodo,
				headers: {
					Authorization: "Bearer " + s.token,
					Accept: "application/json"
				},
				...montarCorpo ? { body: montarCorpo() } : {}
			});
			if (r.status === 401 && vez === 0) {
				sessao = null;
				continue;
			}
			const corpo = await json(r);
			if (r.status >= 200 && r.status < 300) return corpo;
			throw new ErroDoSci(r.status, mensagemDe(corpo) || "o SCI Report respondeu " + r.status);
		}
		throw new ErroDoSci(401, "o SCI Report recusou o login");
	}
	return {
		async empresaPeloDocumento(documento) {
			const d = documento.replace(/\D/g, "");
			if (empresas.has(d)) return empresas.get(d) ?? null;
			if (d.length !== 14 && d.length !== 11) return null;
			const id = empresaDoSciPeloDocumento(lerEmpresasDoSci(await chamar("GET", "/api/v1/empresa/busca/?" + new URLSearchParams({ numeroDocumento: d }).toString())), d);
			empresas.set(d, id);
			return id;
		},
		async publicacoes(empresaId, de, ate, publicadosId) {
			const todas = [];
			for (let pagina = 1; pagina <= MAX_PAGINAS$2; pagina++) {
				const p = lerPaginaDePublicados(await chamar("GET", "/api/v1/publicados/busca?" + consultaDePublicados({
					empresaId,
					de,
					ate,
					pagina,
					publicadosId
				})));
				todas.push(...p.itens.filter((x) => x.empresaId === empresaId));
				if (p.paginaAtual >= p.ultimaPagina) break;
			}
			return todas;
		},
		async urlDoPdf(publicadosId, empresaId) {
			const q = new URLSearchParams({
				publicadoId: String(publicadosId),
				empresaId: String(empresaId)
			});
			const url = urlDoPdfDoSci(await chamar("PUT", "/api/v1/publicados/visualiza?" + q.toString()));
			if (!url) throw new ErroDoSci(0, "o SCI Report não devolveu o PDF");
			return url;
		},
		async publicar(campos, pdf, nomeDoArquivo) {
			const id = publicadosIdDaResposta(await chamar("POST", "/api/v1/publicacao-manual", () => {
				const f = new FormData();
				for (const [k, v] of Object.entries(campos)) f.append(k, v);
				f.append("arquivo", new Blob([new Uint8Array(pdf)], { type: "application/pdf" }), nomeDoArquivo.replace(/[^\w.-]+/g, "_") || "guia.pdf");
				return f;
			}));
			if (!id) throw new ErroDoSci(0, "o SCI Report não devolveu o número da publicação");
			return id;
		}
	};
}

//#endregion
//#region packages/core/src/sci/integracao/config.ts
const GUIAS_DO_SCI = [
	{
		chave: "DAS",
		rotulo: "DAS (Simples Nacional)"
	},
	{
		chave: "DARF-PIS",
		rotulo: "DARF do PIS"
	},
	{
		chave: "DARF-COFINS",
		rotulo: "DARF da COFINS"
	},
	{
		chave: "DARF-IRPJ",
		rotulo: "DARF do IRPJ"
	},
	{
		chave: "DARF-CSLL",
		rotulo: "DARF da CSLL"
	},
	{
		chave: "DARF",
		rotulo: "DARF (outros)"
	},
	{
		chave: "DAE-ICMS",
		rotulo: "DAE do ICMS"
	},
	{
		chave: "DAM-ISS",
		rotulo: "DAM do ISS"
	},
	{
		chave: "FGTS",
		rotulo: "FGTS"
	},
	{
		chave: "OUTRA",
		rotulo: "Outras guias"
	}
];
const CONFIG_DO_SCI_DESLIGADA = {
	areaCliente: false,
	publicarGuias: false,
	lerDeVolta: false,
	enviarXmls: false,
	conferirXmls: false,
	rhNet: false,
	empresas: [],
	relatorios: {},
	atualizadoEm: "",
	atualizadoPor: ""
};
const CHAVES = new Set(GUIAS_DO_SCI.map((g) => g.chave));
function codigoDoRelatorio(v) {
	const t = String(v ?? "").trim().toUpperCase();
	if (!/^[0-9A-Z]{1,4}$/.test(t)) return "";
	return t.padStart(4, "0");
}
function configDoSci(doc) {
	const d = doc && typeof doc === "object" && !Array.isArray(doc) ? doc : {};
	const sim = (k) => d[k] === true;
	const empresas = Array.isArray(d.empresas) ? [...new Set(d.empresas.map(Number).filter((n) => Number.isInteger(n) && n > 0))].sort((a, b) => a - b) : [];
	const relatorios = {};
	const r = d.relatorios && typeof d.relatorios === "object" && !Array.isArray(d.relatorios) ? d.relatorios : {};
	for (const [k, v] of Object.entries(r)) {
		const c = codigoDoRelatorio(v);
		if (CHAVES.has(k) && c) relatorios[k] = c;
	}
	return {
		areaCliente: sim("areaCliente"),
		publicarGuias: sim("publicarGuias"),
		lerDeVolta: sim("lerDeVolta") && sim("publicarGuias"),
		enviarXmls: sim("enviarXmls"),
		conferirXmls: sim("conferirXmls"),
		rhNet: sim("rhNet"),
		empresas,
		relatorios,
		atualizadoEm: typeof d.atualizadoEm === "string" ? d.atualizadoEm : "",
		atualizadoPor: typeof d.atualizadoPor === "string" ? d.atualizadoPor : ""
	};
}
function documentoDaConfigDoSci(c, por, agora) {
	const limpa = configDoSci({
		...c,
		atualizadoEm: "",
		atualizadoPor: ""
	});
	return {
		areaCliente: limpa.areaCliente,
		publicarGuias: limpa.publicarGuias,
		lerDeVolta: limpa.lerDeVolta,
		enviarXmls: limpa.enviarXmls,
		conferirXmls: limpa.conferirXmls,
		rhNet: limpa.rhNet,
		empresas: limpa.empresas,
		relatorios: limpa.relatorios,
		atualizadoEm: agora.toISOString(),
		atualizadoPor: por
	};
}
function empresasDoTexto(texto) {
	return [...new Set(String(texto ?? "").split(/[^\d]+/).map(Number).filter((n) => Number.isInteger(n) && n > 0))].sort((a, b) => a - b);
}
const empresaNoSci = (c, codigo) => c.empresas.includes(Number(codigo));
function chaveDaGuiaNoSci(tipo, tributo) {
	const t = String(tipo ?? "").toUpperCase().trim();
	const tr = String(tributo ?? "").toUpperCase().trim();
	if (t === "DAS") return "DAS";
	if (t === "FGTS") return "FGTS";
	if (t === "DARF") return [
		"PIS",
		"COFINS",
		"IRPJ",
		"CSLL"
	].includes(tr) ? "DARF-" + tr : "DARF";
	if (t === "DAE" && tr === "ICMS") return "DAE-ICMS";
	if (t === "DAM" && tr === "ISS") return "DAM-ISS";
	return "OUTRA";
}
function relatorioDaGuia(c, tipo, tributo) {
	const chave = chaveDaGuiaNoSci(tipo, tributo);
	return c.relatorios[chave] || (chave.startsWith("DARF-") ? c.relatorios.DARF : "") || c.relatorios.OUTRA || "";
}

//#endregion
//#region packages/core/src/sci/integracao/integraNet.ts
const INTEGRA_NET = "https://api-integranet.sci.com.br/api";
const INTEGRA_POR_LOTE = 50;
const TIPOS_NO_INTEGRA = [
	"nfe",
	"nfce",
	"cfe",
	"cte",
	"nfse"
];
function chaveDoXml(xml) {
	const m = /Id="(?:NFe|CTe|CFe)(\d{44})"/.exec(xml) || /<(?:\w+:)?ch(?:NFe|CTe|CFe)>(\d{44})</.exec(xml);
	return m ? m[1] : "";
}
function tipoNoIntegra(xml) {
	const chave = chaveDoXml(xml);
	if (chave) return {
		55: "nfe",
		65: "nfce",
		57: "cte",
		67: "cte",
		59: "cfe"
	}[chave.slice(20, 22)] ?? null;
	if (/<(?:\w+:)?(?:NFSe|CompNfse|Nfse|InfNfse|infNFSe)[\s>]/.test(xml) || /<(?:\w+:)?chNFSe>/.test(xml)) return "nfse";
	return null;
}
const ehEventoDoXml = (xml) => /<(?:\w+:)?tpEvento>/.test(xml) || /<(?:\w+:)?infPedReg[\s>]/.test(xml);
function nomeNoIntegra(nome, xml) {
	return (String(nome ?? "").replace(/\.xml$/i, "").normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^\w.-]+/g, "_").replace(/_+/g, "_").replace(/^_|_$/g, "").slice(0, 120) || chaveDoXml(xml) || "documento") + ".xml";
}
function xmlsParaEnviar(arquivos, jaForam = []) {
	const ja = new Set(jaForam);
	const vistos = /* @__PURE__ */ new Set();
	const itens = [];
	let ignorados = 0;
	for (const a of arquivos) {
		const tipo = tipoNoIntegra(a.xml);
		const nome = nomeNoIntegra(a.nome, a.xml);
		const chave = chaveDoXml(a.xml);
		const evento = ehEventoDoXml(a.xml);
		const marca = evento ? nome : chave || nome;
		if (!tipo || vistos.has(nome)) {
			ignorados++;
			continue;
		}
		vistos.add(nome);
		if (ja.has(marca)) continue;
		itens.push({
			nome,
			xml: a.xml,
			tipo,
			chave,
			evento
		});
	}
	const ordem = (x) => TIPOS_NO_INTEGRA.indexOf(x.tipo) * 2 + (x.evento ? 1 : 0);
	itens.sort((a, b) => ordem(a) - ordem(b) || a.nome.localeCompare(b.nome));
	const lotes = [];
	for (const x of itens) {
		const ultimo = lotes[lotes.length - 1];
		if (ultimo && ultimo.tipo === x.tipo && ultimo.itens.length < 50 && ultimo.itens[0].evento === x.evento) ultimo.itens.push(x);
		else lotes.push({
			tipo: x.tipo,
			itens: [x]
		});
	}
	return {
		lotes,
		ignorados
	};
}
const marcaDoEnviado = (x) => x.evento ? x.nome : x.chave || x.nome;
function periodoNoIntegra(competencia) {
	const [a, m] = competencia.split("-").map(Number);
	const ultimo = new Date(a, m, 0).getDate();
	const mm = String(m).padStart(2, "0");
	return {
		dataIni: "01-" + mm + "-" + a,
		dataFim: String(ultimo).padStart(2, "0") + "-" + mm + "-" + a
	};
}
function chavesDasUrls(resposta) {
	const lista = Array.isArray(resposta) ? resposta : [];
	const chaves = /* @__PURE__ */ new Set();
	for (const u of lista) {
		const m = /(\d{44})\.xml(?:[?#]|$)/i.exec(String(u ?? ""));
		if (m) chaves.add(m[1]);
	}
	return [...chaves];
}
function conferirComOSci(chavesDoSieg, chavesDoSci, canceladas = []) {
	const fora = new Set(canceladas);
	const sieg = new Set([...chavesDoSieg].filter((c) => /^\d{44}$/.test(c) && !fora.has(c)));
	const sci = new Set([...chavesDoSci].filter((c) => /^\d{44}$/.test(c)));
	return {
		noSieg: sieg.size,
		noSci: sci.size,
		faltamNoSci: [...sieg].filter((c) => !sci.has(c)).sort(),
		soNoSci: [...sci].filter((c) => !sieg.has(c) && !fora.has(c)).sort()
	};
}
function resumoDoIntegra(p) {
	const c = p.conferencia ?? null;
	return {
		em: p.agora.toISOString(),
		enviadas: p.enviadas,
		falhas: p.falhas,
		erro: String(p.erro ?? "").slice(0, 200),
		conferido: !!c,
		faltamNoSci: c ? c.faltamNoSci.length : 0,
		soNoSci: c ? c.soNoSci.length : 0,
		chavesFaltam: c ? c.faltamNoSci.slice(0, 50) : [],
		chavesSobram: c ? c.soNoSci.slice(0, 50) : []
	};
}
function lerResumoDoIntegra(v) {
	const o = v && typeof v === "object" && !Array.isArray(v) ? v : null;
	if (!o || typeof o.em !== "string") return null;
	const n = (k) => Number.isFinite(Number(o[k])) ? Math.max(0, Math.trunc(Number(o[k]))) : 0;
	const chaves = (k) => Array.isArray(o[k]) ? o[k].map(String).filter((c) => /^\d{44}$/.test(c)).slice(0, 50) : [];
	return {
		em: o.em,
		enviadas: n("enviadas"),
		falhas: n("falhas"),
		erro: typeof o.erro === "string" ? o.erro.slice(0, 200) : "",
		conferido: o.conferido === true,
		faltamNoSci: n("faltamNoSci"),
		soNoSci: n("soNoSci"),
		chavesFaltam: chaves("chavesFaltam"),
		chavesSobram: chaves("chavesSobram")
	};
}
function fraseDoIntegra(r) {
	if (!r) return "";
	const partes = ["SCI: " + r.enviadas + (r.enviadas === 1 ? " enviada" : " enviadas")];
	if (r.falhas) partes.push(r.falhas + (r.falhas === 1 ? " falhou" : " falharam"));
	if (r.conferido) partes.push(r.faltamNoSci ? "faltam " + r.faltamNoSci + " no SCI" : "tudo no SCI");
	if (r.conferido && r.soNoSci) partes.push(r.soNoSci + " só no SCI");
	return partes.join(" · ");
}

//#endregion
//#region packages/core/src/sci/integracao/integraNetCliente.ts
const MAX_PAGINAS$1 = 60;
function criarClienteIntegraNet(deps) {
	async function cabecalhos() {
		const s = await deps.segredos();
		if (!s.parceiro || !s.cliente) throw new ErroDoSci(0, "faltam os tokens da SCI");
		return {
			"Service-Token": s.parceiro,
			Authorization: "Bearer " + s.cliente,
			Accept: "application/json"
		};
	}
	async function json(r) {
		try {
			return await r.json();
		} catch {
			return null;
		}
	}
	const mensagem = (corpo, status) => {
		const o = corpo && typeof corpo === "object" ? corpo : {};
		return ((typeof o.error === "string" ? o.error : typeof o.mensagem === "string" ? o.mensagem : "") || "o Integra NET respondeu " + status).slice(0, 200);
	};
	return {
		async enviar(cnpj, lotes) {
			const doc = String(cnpj ?? "").replace(/\D/g, "");
			const r = {
				enviadas: [],
				falhas: 0,
				erro: "",
				semLicenca: false
			};
			if (doc.length !== 14 && doc.length !== 11) return {
				...r,
				falhas: lotes.reduce((s, l) => s + l.itens.length, 0),
				erro: "a empresa está sem CNPJ"
			};
			const h = await cabecalhos();
			for (let k = 0; k < lotes.length; k++) {
				const lote = lotes[k];
				const resp = await deps.buscar(INTEGRA_NET + "/" + lote.tipo, {
					method: "POST",
					headers: {
						...h,
						"Content-Type": "application/json"
					},
					body: JSON.stringify({
						cnpj: doc,
						nomeArquivo: lote.itens.map((x) => x.nome)
					})
				});
				const corpo = await json(resp);
				if (resp.status === 403) {
					r.semLicenca = true;
					r.erro = mensagem(corpo, 403);
					r.falhas += lotes.slice(k).reduce((s, l) => s + l.itens.length, 0);
					return r;
				}
				if (resp.status === 401) throw new ErroDoSci(401, "o Integra NET recusou os tokens");
				const urls = resp.status === 200 && corpo && typeof corpo === "object" ? corpo : null;
				if (!urls) {
					r.falhas += lote.itens.length;
					r.erro = mensagem(corpo, resp.status);
					continue;
				}
				for (const x of lote.itens) {
					const url = typeof urls[x.nome] === "string" ? urls[x.nome] : "";
					if (!url.startsWith("https://")) {
						r.falhas++;
						r.erro = "o Integra NET não devolveu o endereço de " + x.nome;
						continue;
					}
					try {
						const put = await deps.buscar(url, {
							method: "PUT",
							headers: { "Content-Type": "application/octet-stream" },
							body: new TextEncoder().encode(x.xml)
						});
						if (put.status >= 200 && put.status < 300) r.enviadas.push(marcaDoEnviado(x));
						else {
							r.falhas++;
							r.erro = "o envio de " + x.nome + " voltou " + put.status;
						}
					} catch (e) {
						r.falhas++;
						r.erro = "o envio de " + x.nome + " falhou (" + String(e?.message ?? e).slice(0, 80) + ")";
					}
				}
			}
			return r;
		},
		async chavesDoMes(empresaId, tipo, movimentacao, competencia) {
			const h = await cabecalhos();
			const { dataIni, dataFim } = periodoNoIntegra(competencia);
			const todas = /* @__PURE__ */ new Set();
			let anterior = "";
			for (let page = 1; page <= MAX_PAGINAS$1; page++) {
				const q = new URLSearchParams({
					empresaId: String(empresaId),
					dataIni,
					dataFim,
					page: String(page)
				});
				const resp = await deps.buscar(INTEGRA_NET + "/" + tipo + "/" + movimentacao + "?" + q.toString(), {
					method: "GET",
					headers: h
				});
				if (resp.status === 404) break;
				const corpo = await json(resp);
				if (resp.status === 401) throw new ErroDoSci(401, "o Integra NET recusou os tokens");
				if (resp.status === 403) throw new ErroDoSci(403, mensagem(corpo, 403));
				if (resp.status !== 200) throw new ErroDoSci(resp.status, mensagem(corpo, resp.status));
				const chaves = chavesDasUrls(corpo);
				const assinatura = chaves.join(",");
				if (!chaves.length || assinatura === anterior) break;
				anterior = assinatura;
				chaves.forEach((c) => todas.add(c));
			}
			return [...todas];
		}
	};
}

//#endregion
//#region packages/core/src/sci/integracao/publicar.ts
const MAIOR_PDF_NO_SCI = 20971520;
function dataParaOSci(br) {
	const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(String(br ?? "").trim());
	if (!m) return "";
	const d = new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]));
	return d.getDate() === Number(m[1]) && d.getMonth() === Number(m[2]) - 1 ? m[3] + "-" + m[2] + "-" + m[1] : "";
}
function idDaPublicacao(competencia, descricao) {
	return (competencia.replace("-", "").slice(2) + String(descricao ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6)).slice(0, 10);
}
function erroDaGuiaParaPublicar(g, relatorioId, empresaId, tamanhoDoPdf) {
	if (!relatorioId) return "falta dizer, em Configurações › Integração SCI, o código do relatório desta guia no SCI Report";
	if (!empresaId) return "a empresa não foi achada no SCI Report pelo CNPJ";
	if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(g.competencia)) return "a guia está sem a competência";
	if (!dataParaOSci(g.vencimento)) return "a guia está sem o vencimento";
	if (!(g.valor > 0)) return "a guia está sem o valor";
	if (!(tamanhoDoPdf > 0)) return "a guia está sem o PDF";
	if (tamanhoDoPdf > 20971520) return "o PDF passa de 20 MB";
	return "";
}
function camposDaPublicacao(g, relatorioId, empresaId) {
	return {
		relatorioId,
		mesRef: g.competencia.slice(5, 7),
		anoRef: g.competencia.slice(0, 4),
		todaEmpresa: "false",
		empresaId: String(empresaId),
		dataVencimento: dataParaOSci(g.vencimento),
		valor: (Math.round(g.valor * 100) / 100).toFixed(2),
		id: idDaPublicacao(g.competencia, g.descricao),
		descricao: String(g.descricao ?? "").slice(0, 120)
	};
}
function jaPublicada(lista, g, relatorioId) {
	const valor = Math.round(g.valor * 100);
	return lista.find((p) => p.competencia === g.competencia && p.vencimento === g.vencimento && Math.round(p.valor * 100) === valor && (!relatorioId || !p.relatorioId || p.relatorioId === relatorioId)) ?? null;
}
function situacaoDeVolta(guardadas, daSci) {
	const porId = new Map(daSci.map((p) => [p.publicadosId, p]));
	let mudou = false;
	const publicadas = guardadas.map((g) => {
		const p = porId.get(g.publicadosId);
		if (!p) return g;
		const vistoEm = g.vistoEm || p.vistoEm || (p.visualizado && !g.vistoEm ? "?" : "");
		const pagamentoEm = g.pagamentoEm || p.pagamentoEm;
		if (vistoEm !== g.vistoEm || pagamentoEm !== g.pagamentoEm) mudou = true;
		return {
			...g,
			vistoEm,
			pagamentoEm
		};
	});
	return {
		publicadas,
		mudou,
		terminou: publicadas.length > 0 && publicadas.every((p) => !!p.pagamentoEm)
	};
}
function publicadasDoRegistro(v) {
	if (!Array.isArray(v)) return [];
	return v.flatMap((x) => {
		const o = x && typeof x === "object" ? x : null;
		const id = Number(o?.publicadosId);
		if (!o || !Number.isInteger(id) || id <= 0) return [];
		const t = (k) => typeof o[k] === "string" ? o[k] : "";
		return [{
			publicadosId: id,
			nome: t("nome"),
			vistoEm: t("vistoEm"),
			pagamentoEm: t("pagamentoEm")
		}];
	});
}
function fraseDaPublicacao(p) {
	if (p.pagamentoEm) return "pagamento informado " + p.pagamentoEm.slice(0, 5);
	if (p.vistoEm) return p.vistoEm === "?" ? "vista" : "vista " + p.vistoEm.slice(0, 5);
	return "ainda não vista";
}

//#endregion
//#region packages/core/src/empresas/cadastro/receita.ts
const so = (v) => String(v ?? "").replace(/\D/g, "");
function cpfValido(cpf) {
	const d = so(cpf);
	if (d.length !== 11 || /^(\d)\1{10}$/.test(d)) return false;
	const dv = (n) => {
		const r = d.slice(0, n).split("").reduce((s, c, i) => s + Number(c) * (n + 1 - i), 0) % 11;
		return r < 2 ? 0 : 11 - r;
	};
	return dv(9) === Number(d[9]) && dv(10) === Number(d[10]);
}

//#endregion
//#region packages/core/src/sci/integracao/rhNet.ts
const RH_NET = "https://api2.rhnetsocial.com.br";
const RH_NET_POR_PAGINA = 100;
const ROTULO_DA_SITUACAO_RH = {
	nao_liberado: "Não liberado",
	liberado: "Liberado",
	aguardando_integracao: "Aguardando a folha",
	integrado: "Na folha",
	recusado: "Recusado"
};
const SITUACOES = new Set(Object.keys(ROTULO_DA_SITUACAO_RH));
const situacaoNoRhNet = (v) => typeof v === "string" && SITUACOES.has(v) ? v : "";
const objeto = (v) => v && typeof v === "object" && !Array.isArray(v) ? v : null;
const texto = (v) => typeof v === "string" ? v.trim() : typeof v === "number" && Number.isFinite(v) ? String(v) : "";
const inteiro = (v) => {
	const n = Number(v);
	return Number.isInteger(n) && n > 0 ? n : 0;
};
function lerPaginaDoRhNet(resposta) {
	const r = objeto(resposta);
	const ret = r?.retorno;
	const itens = (Array.isArray(ret) ? ret : objeto(ret) ? [ret] : []).map(objeto).filter((x) => !!x);
	const p = objeto(r?.paginacao);
	const paginaAtual = inteiro(p?.pagina_atual) || 1;
	return {
		itens,
		paginaAtual,
		ultimaPagina: inteiro(p?.ultima_pagina) || paginaAtual,
		total: inteiro(p?.total) || itens.length
	};
}
function mensagemDoRhNet(resposta, status) {
	const r = objeto(resposta);
	const base = texto(r?.mensagem) || "o RH NET respondeu " + status;
	const erros = objeto(r?.erros) || objeto(r?.errors);
	const detalhe = erros ? Object.entries(erros).map(([k, v]) => k + ": " + (Array.isArray(v) ? v.map(texto).join(", ") : texto(v))).join("; ") : "";
	return (detalhe ? base + " (" + detalhe + ")" : base).slice(0, 300);
}
const CADASTROS_DO_RH = {
	departamentos: {
		caminho: "/api/v1/departamentos",
		id: "departamento_id",
		nome: ["departamento"],
		codigo: "cod_departamento",
		rotulo: "Departamentos"
	},
	funcoes: {
		caminho: "/api/v1/funcoes",
		id: "v_funcao_id",
		nome: ["funcao"],
		codigo: "cbo",
		rotulo: "Funções"
	},
	centrosCusto: {
		caminho: "/api/v1/centros-custo",
		id: "centro_custo_id",
		nome: ["nome", "centro_custo"],
		rotulo: "Centros de custo"
	},
	quadrosHorario: {
		caminho: "/api/v1/quadros-horarios",
		id: "v_quadro_horario_id",
		nome: ["descricao"],
		rotulo: "Quadros de horário"
	},
	sindicatos: {
		caminho: "/api/v1/sindicatos",
		id: "v_sindicato_id",
		nome: ["nome"],
		rotulo: "Sindicatos"
	}
};
function itensDoCadastro(recurso, itens) {
	const c = CADASTROS_DO_RH[recurso];
	const porId = /* @__PURE__ */ new Map();
	for (const x of itens) {
		const id = inteiro(x[c.id]);
		const nome = c.nome.map((k) => texto(x[k])).find(Boolean) || "";
		if (!id || !nome) continue;
		const codigo = c.codigo ? texto(x[c.codigo]) : "";
		porId.set(id, {
			id,
			nome: nome.slice(0, 120),
			...codigo ? { codigo: codigo.slice(0, 20) } : {}
		});
	}
	return [...porId.values()].sort((a, b) => a.nome.localeCompare(b.nome));
}
function resumoDosCadastros(c) {
	return Object.keys(CADASTROS_DO_RH).map((k) => CADASTROS_DO_RH[k].rotulo + " " + c[k].length).join(" · ");
}
function lerCadastrosDoRhNet(v) {
	const o = objeto(v);
	if (!o) return null;
	const lista = (k) => (Array.isArray(o[k]) ? o[k] : []).flatMap((x) => {
		const i = objeto(x);
		const id = inteiro(i?.id);
		const nome = texto(i?.nome);
		return id && nome ? [{
			id,
			nome,
			...texto(i?.codigo) ? { codigo: texto(i?.codigo) } : {}
		}] : [];
	});
	return {
		departamentos: lista("departamentos"),
		funcoes: lista("funcoes"),
		centrosCusto: lista("centrosCusto"),
		quadrosHorario: lista("quadrosHorario"),
		sindicatos: lista("sindicatos")
	};
}
function informacoesDoJwt(jwt) {
	const partes = String(jwt ?? "").split(".");
	if (partes.length < 2) return {};
	try {
		const b64 = partes[1].replace(/-/g, "+").replace(/_/g, "/");
		const bin = atob(b64 + "=".repeat((4 - b64.length % 4) % 4));
		const json = JSON.parse(new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0))));
		return objeto(json) || {};
	} catch {
		return {};
	}
}
const numeroDoJwt = (jwt, chaves) => {
	const o = informacoesDoJwt(jwt);
	for (const k of chaves) {
		const n = inteiro(o[k]);
		if (n) return n;
	}
	return 0;
};
function dadosDoUsuarioNoJwt(jwt) {
	return objeto(objeto(informacoesDoJwt(jwt).usuario)?.dados) || {};
}
function empresaIdDoJwt(jwt) {
	const vinculadas = dadosDoUsuarioNoJwt(jwt).empresasVinculadas;
	if (Array.isArray(vinculadas)) {
		const ids = [...new Set(vinculadas.map(inteiro).filter(Boolean))];
		if (ids.length === 1) return ids[0];
		if (ids.length > 1) return 0;
	}
	return numeroDoJwt(jwt, [
		"empresa_id",
		"empresaId",
		"empresa",
		"emp_id"
	]);
}
const clienteIdDoJwt = (jwt) => inteiro(dadosDoUsuarioNoJwt(jwt).clienteId) || numeroDoJwt(jwt, [
	"cliente_id",
	"clienteId",
	"cliente"
]);
const DIA = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;
function erroDaAdmissao(a) {
	if (!texto(a.nome) || texto(a.nome).length < 3) return "falta o nome completo";
	if (!cpfValido(String(a.cpf ?? "").replace(/\D/g, ""))) return "o CPF não é válido";
	if (!DIA.test(String(a.admissao ?? ""))) return "falta a data de admissão";
	if (a.nascimento && !DIA.test(a.nascimento)) return "a data de nascimento está errada";
	if (a.salario !== void 0 && !(a.salario > 0)) return "o salário tem de ser maior que zero";
	if (a.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(a.email)) return "o e-mail não parece certo";
	return "";
}
function corpoDaAdmissao(empresaId, a) {
	const digitos = (v) => String(v ?? "").replace(/\D/g, "");
	const cel = digitos(a.celular);
	const cpf = digitos(a.cpf).replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, "$1.$2.$3-$4");
	return {
		empresa_id: empresaId,
		tipo_colaborador: "funcionario",
		nome: texto(a.nome).toUpperCase(),
		cpf,
		admissao_data: a.admissao,
		nascimento_data: a.nascimento || null,
		sexo: a.sexo ?? null,
		email: texto(a.email) || null,
		ddd_celular: cel.length >= 10 ? cel.slice(0, 2) : null,
		celular: cel.length >= 10 ? cel.slice(2) : null,
		mae_nome: texto(a.maeNome).toUpperCase() || null,
		pis_numero: digitos(a.pis) || null,
		salario_base: a.salario ?? null,
		v_funcao_id: a.funcaoId ?? null,
		departamento_id: a.departamentoId ?? null,
		centro_custo_id: a.centroCustoId ?? null,
		v_quadro_horario_id: a.quadroHorarioId ?? null,
		v_sindicato_id: a.sindicatoId ?? null,
		prazo_experiencia: a.experienciaDias ?? null,
		observacao: texto(a.observacao).slice(0, 500) || null,
		habilita_acesso_modulo_colaborador: false
	};
}
function admissaoDoRhNet(x) {
	const o = objeto(x);
	const id = inteiro(o?.funcionario_contribuinte_id);
	if (!o || !id) return null;
	return {
		id,
		situacao: situacaoNoRhNet(o.situacao),
		primeiroNome: texto(o.nome).split(/\s+/)[0] || "",
		admissao: texto(o.admissao_data).slice(0, 10)
	};
}
function corpoDaLiberacao(empresaId, ids, situacao, observacao = "") {
	return {
		empresa_id: empresaId,
		situacao,
		funcionario_contribuinte_id: [...new Set(ids.filter((n) => inteiro(n)))],
		...observacao ? { observacao_liberacao: observacao.slice(0, 500) } : {}
	};
}
function erroDoLancamento(l, tipo = "normais") {
	if (!inteiro(l.funcionarioId)) return "falta o funcionário";
	if (!inteiro(l.verbaId)) return "falta a verba";
	if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(l.competencia)) return "a competência está errada";
	if (l.valor === void 0 && l.referencia === void 0) return "falta o valor ou a referência";
	if (tipo === "centros-custos" && !inteiro(l.centroCustoId)) return "falta o centro de custo";
	if (tipo === "intermitentes" && !inteiro(l.contratoIntermitenteId)) return "falta o contrato intermitente";
	return "";
}
function corpoDosLancamentos(empresaId, lancamentos, tipo = "normais") {
	return { dados: lancamentos.map((l) => ({
		empresa_id: empresaId,
		funcionario_contribuinte_id: l.funcionarioId,
		v_verba_id: l.verbaId,
		competencia: l.competencia + "-01",
		valor: l.valor ?? null,
		referencia: l.referencia ?? null,
		...tipo === "centros-custos" ? { centro_custo_id: l.centroCustoId } : {},
		...tipo === "intermitentes" ? { contrato_intermitente_id: l.contratoIntermitenteId } : {}
	})) };
}
function corpoDaLiberacaoDaPlanilha(clienteId, empresaId, competencia, situacao, funcionarioId, observacao = "") {
	return {
		cliente_id: clienteId,
		empresa_id: empresaId,
		competencia: competencia + "-01",
		situacao,
		...funcionarioId ? { funcionario_contribuinte_id: funcionarioId } : {},
		...observacao ? { observacao_liberacao: observacao.slice(0, 250) } : {}
	};
}
const LIBERACAO_DA_PLANILHA = {
	normais: "/api/v1/liberacoes/planilhas-lancamentos-normais",
	intermitentes: "/api/v1/liberacoes/planilhas-lancamentos-intermitentes",
	"centros-custos": "/api/v1/liberacoes/planilhas-lancamentos-centros-custo"
};
const SITUACAO_NA_AREA = {
	integrado: "Na folha",
	nao_liberado: "Aguardando o escritório",
	liberado: "Indo para a folha",
	aguardando_integracao: "Indo para a folha",
	recusado: "Recusado"
};
function cpfMascarado(cpf) {
	const d = String(cpf ?? "").replace(/\D/g, "");
	return d.length === 11 ? "***." + d.slice(3, 6) + "." + d.slice(6, 9) + "-**" : "";
}
function cadastroParaArea(x, funcoes = /* @__PURE__ */ new Map()) {
	const o = objeto(x);
	const id = inteiro(o?.funcionario_contribuinte_id);
	const nome = texto(o?.nome).replace(/\s+/g, " ");
	if (!o || !id || !nome || o.cadastro_ativo === false || o.cadastroAtivo === false || texto(o.desligamento_data)) return null;
	const categoria = inteiro(o.categoria_esocial_id);
	const contribuinte = o.tipo_colaborador === "contribuinte";
	const funcao = funcoes.get(inteiro(o.v_funcao_id)) || "";
	const tipo = contribuinte ? categoria >= 721 && categoria <= 723 ? "Sócio – pró-labore" : "Contribuinte" : funcao || "Funcionário";
	const situacao = situacaoNoRhNet(o.situacao);
	return {
		id: "rh" + id,
		nome: nome.slice(0, 120),
		cpf: cpfMascarado(o.cpf),
		tipo: tipo.slice(0, 60),
		entrada: (texto(o.entrada_data) || texto(o.admissao_data)).slice(0, 10).replace(/^(?!\d{4}-\d{2}-\d{2}$).*$/, ""),
		situacao: situacao ? SITUACAO_NA_AREA[situacao] : ""
	};
}
function cadastrosParaArea(itens, funcoes = /* @__PURE__ */ new Map()) {
	const porId = /* @__PURE__ */ new Map();
	for (const x of itens) {
		const c = cadastroParaArea(x, funcoes);
		if (c) porId.set(c.id, c);
	}
	return [...porId.values()].sort((a, b) => a.nome.localeCompare(b.nome));
}

//#endregion
//#region packages/core/src/sci/integracao/rhNetCliente.ts
const MAX_PAGINAS = 30;
function criarClienteRhNet(deps) {
	const agora = deps.agora ?? (() => Date.now());
	let sessao = null;
	let ids = null;
	async function json(r) {
		if (r.status === 204) return null;
		try {
			return await r.json();
		} catch {
			return null;
		}
	}
	async function entrar() {
		if (sessaoDoSciAindaAceita(sessao, agora())) {
			const r = await deps.buscar(SCI_AUTH + "/api/v1/auth/refresh", {
				method: "POST",
				headers: { Authorization: "Bearer " + sessao.token }
			});
			const nova = r.status === 201 || r.status === 200 ? lerLoginDoSci(await json(r), agora()) : null;
			if (nova) return sessao = nova;
		}
		const t = await deps.tokens();
		if (!t.parceiro || !t.empresa) throw new ErroDoSci(0, "faltam os tokens do RH NET desta empresa");
		const r = await deps.buscar(SCI_AUTH + "/api/v1/auth/credencial/login", {
			method: "POST",
			headers: { Authorization: "Basic " + btoa(t.parceiro + ":" + t.empresa) }
		});
		const nova = r.status === 201 || r.status === 200 ? lerLoginDoSci(await json(r), agora()) : null;
		if (!nova) throw new ErroDoSci(r.status, r.status === 401 ? "a SCI recusou os tokens (o de Parceiro ou o da empresa)" : "o login na SCI não deu certo (" + r.status + ")");
		ids = {
			empresaId: t.empresaId || empresaIdDoJwt(nova.token),
			clienteId: t.clienteId || clienteIdDoJwt(nova.token)
		};
		return sessao = nova;
	}
	async function chamar(metodo, caminho, corpo) {
		for (let vez = 0; vez < 2; vez++) {
			const s = sessaoDoSciVale(sessao, agora()) ? sessao : await entrar();
			const r = await deps.buscar(RH_NET + caminho, {
				method: metodo,
				headers: {
					Authorization: "Bearer " + s.token,
					Accept: "application/json",
					...corpo ? { "Content-Type": "application/json" } : {}
				},
				...corpo ? { body: JSON.stringify(corpo) } : {}
			});
			if (r.status === 401 && vez === 0) {
				sessao = null;
				continue;
			}
			const resposta = await json(r);
			if (r.status >= 200 && r.status < 300) return resposta;
			throw new ErroDoSci(r.status, r.status === 403 ? "o RH NET não está liberado para esta empresa (ou o token não é de um usuário dela)" : mensagemDoRhNet(resposta, r.status));
		}
		throw new ErroDoSci(401, "o RH NET recusou o login");
	}
	async function identificacao() {
		if (!ids || !sessaoDoSciVale(sessao, agora())) await entrar();
		if (!ids?.empresaId) throw new ErroDoSci(0, "o número da empresa no RH NET não veio no token: informe-o na configuração do robô");
		return ids;
	}
	async function listar(caminho, filtros = {}) {
		const { empresaId } = await identificacao();
		const itens = [];
		for (let page = 1; page <= MAX_PAGINAS; page++) {
			const q = new URLSearchParams({
				empresa_id: String(empresaId),
				page: String(page),
				per_page: String(100),
				...filtros
			});
			const p = lerPaginaDoRhNet(await chamar("GET", caminho + "?" + q.toString()));
			itens.push(...p.itens);
			if (!p.itens.length || p.paginaAtual >= p.ultimaPagina) break;
		}
		return itens;
	}
	return {
		identificacao,
		async cadastros() {
			const c = {};
			for (const k of Object.keys(CADASTROS_DO_RH)) c[k] = itensDoCadastro(k, await listar(CADASTROS_DO_RH[k].caminho));
			return c;
		},
		async admissoes(situacao) {
			return (await listar("/api/v1/admissoes", situacao ? { situacao } : {})).map(admissaoDoRhNet).filter((a) => !!a);
		},
		async cadastrosParaArea() {
			const funcoes = new Map(itensDoCadastro("funcoes", await listar(CADASTROS_DO_RH.funcoes.caminho)).map((f) => [f.id, f.nome]));
			return cadastrosParaArea(await listar("/api/v1/admissoes"), funcoes);
		},
		async criarAdmissao(a) {
			const erro = erroDaAdmissao(a);
			if (erro) throw new ErroDoSci(0, erro);
			const { empresaId } = await identificacao();
			const resposta = await chamar("POST", "/api/v1/admissoes", corpoDaAdmissao(empresaId, a));
			const criada = admissaoDoRhNet(resposta?.retorno);
			if (!criada) throw new ErroDoSci(0, "o RH NET não devolveu o número do funcionário");
			return criada;
		},
		async liberarAdmissoes(lista, situacao, observacao) {
			const { empresaId } = await identificacao();
			if (!lista.length) return;
			await chamar("POST", "/api/v1/liberacoes/admissoes", corpoDaLiberacao(empresaId, lista, situacao, observacao));
		},
		async criarLancamentos(lancamentos, tipo = "normais") {
			const erro = lancamentos.map((l) => erroDoLancamento(l, tipo)).find(Boolean);
			if (erro) throw new ErroDoSci(0, erro);
			if (!lancamentos.length) return 0;
			const { empresaId } = await identificacao();
			await chamar("POST", "/api/v1/planilhas-lancamentos/" + tipo, corpoDosLancamentos(empresaId, lancamentos, tipo));
			return lancamentos.length;
		},
		async liberarLancamentos(competencia, situacao, tipo = "normais", funcionarioId) {
			const { empresaId, clienteId } = await identificacao();
			if (!clienteId) throw new ErroDoSci(0, "o número da contabilidade na SCI não veio no token: informe-o na configuração do robô");
			await chamar("POST", LIBERACAO_DA_PLANILHA[tipo], corpoDaLiberacaoDaPlanilha(clienteId, empresaId, competencia, situacao, funcionarioId));
		}
	};
}

//#endregion
exports.CADASTROS_DO_RH = CADASTROS_DO_RH;
exports.CONFIG_DO_SCI_DESLIGADA = CONFIG_DO_SCI_DESLIGADA;
exports.ErroDoSci = ErroDoSci;
exports.GUIAS_DO_SCI = GUIAS_DO_SCI;
exports.INTEGRA_NET = INTEGRA_NET;
exports.INTEGRA_POR_LOTE = INTEGRA_POR_LOTE;
exports.LIBERACAO_DA_PLANILHA = LIBERACAO_DA_PLANILHA;
exports.MAIOR_PDF_NO_SCI = MAIOR_PDF_NO_SCI;
exports.RH_NET = RH_NET;
exports.RH_NET_POR_PAGINA = RH_NET_POR_PAGINA;
exports.ROTULO_DA_SITUACAO_RH = ROTULO_DA_SITUACAO_RH;
exports.SITUACAO_NA_AREA = SITUACAO_NA_AREA;
exports.TIPOS_NO_INTEGRA = TIPOS_NO_INTEGRA;
exports.admissaoDoRhNet = admissaoDoRhNet;
exports.cadastroParaArea = cadastroParaArea;
exports.cadastrosParaArea = cadastrosParaArea;
exports.camposDaPublicacao = camposDaPublicacao;
exports.chaveDaGuiaNoSci = chaveDaGuiaNoSci;
exports.chaveDoXml = chaveDoXml;
exports.chavesDasUrls = chavesDasUrls;
exports.clienteIdDoJwt = clienteIdDoJwt;
exports.codigoDoRelatorio = codigoDoRelatorio;
exports.conferirComOSci = conferirComOSci;
exports.configDoSci = configDoSci;
exports.corpoDaAdmissao = corpoDaAdmissao;
exports.corpoDaLiberacao = corpoDaLiberacao;
exports.corpoDaLiberacaoDaPlanilha = corpoDaLiberacaoDaPlanilha;
exports.corpoDosLancamentos = corpoDosLancamentos;
exports.cpfMascarado = cpfMascarado;
exports.criarClienteIntegraNet = criarClienteIntegraNet;
exports.criarClienteRhNet = criarClienteRhNet;
exports.criarClienteSciReport = criarClienteSciReport;
exports.dataParaOSci = dataParaOSci;
exports.documentoDaConfigDoSci = documentoDaConfigDoSci;
exports.ehEventoDoXml = ehEventoDoXml;
exports.empresaIdDoJwt = empresaIdDoJwt;
exports.empresaNoSci = empresaNoSci;
exports.empresasDoTexto = empresasDoTexto;
exports.erroDaAdmissao = erroDaAdmissao;
exports.erroDaGuiaParaPublicar = erroDaGuiaParaPublicar;
exports.erroDoLancamento = erroDoLancamento;
exports.fraseDaPublicacao = fraseDaPublicacao;
exports.fraseDoIntegra = fraseDoIntegra;
exports.idDaPublicacao = idDaPublicacao;
exports.informacoesDoJwt = informacoesDoJwt;
exports.itensDoCadastro = itensDoCadastro;
exports.jaPublicada = jaPublicada;
exports.janelaDoSci = janelaDoSci;
exports.lerCadastrosDoRhNet = lerCadastrosDoRhNet;
exports.lerPaginaDoRhNet = lerPaginaDoRhNet;
exports.lerResumoDoIntegra = lerResumoDoIntegra;
exports.marcaDoEnviado = marcaDoEnviado;
exports.mensagemDoRhNet = mensagemDoRhNet;
exports.nomeNoIntegra = nomeNoIntegra;
exports.periodoNoIntegra = periodoNoIntegra;
exports.publicadasDoRegistro = publicadasDoRegistro;
exports.relatorioDaGuia = relatorioDaGuia;
exports.resumoDoIntegra = resumoDoIntegra;
exports.resumoDosCadastros = resumoDosCadastros;
exports.situacaoDeVolta = situacaoDeVolta;
exports.situacaoNoRhNet = situacaoNoRhNet;
exports.tipoNoIntegra = tipoNoIntegra;
exports.xmlsParaEnviar = xmlsParaEnviar;