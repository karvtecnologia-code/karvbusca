/**
 * FIPE via API pública da Parallelum (v2, gratuita, 1000 consultas/dia sem chave).
 * https://fipe.parallelum.com.br/api/v2
 */
import { contemPalavra } from "./match";
import { dinheiro } from "./parse";
import { normalizar } from "./normalize";

const API = "https://fipe.parallelum.com.br/api/v2";
type Tipo = "cars" | "motorcycles";
interface Item {
  code: string;
  name: string;
}

export interface ResultadoFipe {
  codigo: string;
  valor: number;
  modelo: string;
  ano: string;
  /** true quando o casamento de modelo foi incerto */
  aproximada: boolean;
}

const MARCAS_APELIDO: Record<string, string> = {
  mmc: "mitsubishi",
  vw: "volkswagen",
  volks: "volkswagen",
  gm: "chevrolet",
  chev: "chevrolet",
  mb: "mercedes",
  "m benz": "mercedes",
};

export class Fipe {
  private cache = new Map<string, Promise<unknown>>();
  public consultas = 0;

  private get<T>(caminho: string): Promise<T> {
    if (!this.cache.has(caminho)) {
      this.consultas++;
      this.cache.set(
        caminho,
        fetch(API + caminho).then(async (r) => {
          if (!r.ok) throw new Error(`FIPE HTTP ${r.status} em ${caminho}`);
          return r.json();
        }),
      );
    }
    return this.cache.get(caminho) as Promise<T>;
  }

  private async marca(tipo: Tipo, nome: string): Promise<Item | undefined> {
    let n = normalizar(nome);
    n = MARCAS_APELIDO[n] ?? n;
    const marcas = await this.get<Item[]>(`/${tipo}/brands`);
    // "VW - VolksWagen", "GM - Chevrolet": casa por palavra inteira no nome da marca
    return marcas.find((m) => normalizar(m.name) === n) ?? marcas.find((m) => contemPalavra(m.name, n));
  }

  /** Escolhe o ano: mesmo ano-modelo; prefere o combustível certo. */
  private escolherAno(anos: Item[], anoMod: number, combustivel?: string): Item | undefined {
    const doAno = anos.filter((a) => a.code.startsWith(`${anoMod}-`));
    if (!doAno.length) return undefined;
    const c = normalizar(combustivel);
    const pref = /diesel/.test(c) ? "diesel" : /eletr/.test(c) ? "eletr" : /gasolina|flex|alcool/.test(c) ? "" : null;
    if (pref) return doAno.find((a) => normalizar(a.name).includes(pref)) ?? doAno[0];
    return doAno.find((a) => !/diesel/.test(normalizar(a.name))) ?? doAno[0];
  }

  /** Casa marca/modelo/ano do lote com a tabela FIPE. */
  async buscar(l: {
    tipo?: "carro" | "moto" | null;
    marca?: string | null;
    modelo?: string | null;
    versao?: string | null;
    titulo: string;
    anoMod?: number | null;
    combustivel?: string | null;
  }): Promise<ResultadoFipe | null> {
    if (!l.anoMod) return null;
    const tipo: Tipo = l.tipo === "moto" ? "motorcycles" : "cars";
    const nomeMarca = l.marca ?? l.titulo.split(/[\s/-]+/)[0] ?? "";
    const marca = await this.marca(tipo, nomeMarca);
    if (!marca) return null;

    const texto = [l.modelo, l.versao, l.titulo].filter(Boolean).join(" ");
    const modelos = await this.get<Item[]>(`/${tipo}/brands/${marca.code}/models`);
    const candidatos: { m: Item; nota: number }[] = [];
    for (const m of modelos) {
      const tokens = normalizar(m.name).split(" ").filter((t) => t.length > 1 || /\d/.test(t));
      // o nome-base tem que bater (1º token, ou o 2º quando o 1º é código como "NXR")
      const base = tokens.slice(0, 2).some((t) => !/^\d/.test(t) && t.length >= 2 && contemPalavra(texto, t));
      if (!tokens.length || !base) continue;
      const acertos = tokens.filter((t) => contemPalavra(texto, t)).length;
      candidatos.push({ m, nota: acertos / tokens.length + acertos * 0.01 }); // empate: mais tokens em comum
    }
    candidatos.sort((a, b) => b.nota - a.nota);

    // o melhor nome pode não ter aquele ano; tenta os próximos (no máximo 6 consultas)
    for (const [i, c] of candidatos.slice(0, 6).entries()) {
      const anos = await this.get<Item[]>(`/${tipo}/brands/${marca.code}/models/${c.m.code}/years`);
      const ano = this.escolherAno(anos, l.anoMod, l.combustivel ?? undefined);
      if (!ano) continue;
      const info = await this.get<{ price: string; codeFipe: string; model: string }>(
        `/${tipo}/brands/${marca.code}/models/${c.m.code}/years/${ano.code}`,
      );
      const valor = dinheiro(info.price);
      if (!valor) continue;
      return { codigo: info.codeFipe, valor, modelo: info.model, ano: ano.name, aproximada: i > 0 || c.nota < 0.75 };
    }
    return null;
  }

  /** Valor por código FIPE (correção manual no painel). */
  async porCodigo(codigo: string, anoMod: number, moto = false, combustivel?: string): Promise<ResultadoFipe | null> {
    const tipo: Tipo = moto ? "motorcycles" : "cars";
    const anos = await this.get<Item[]>(`/${tipo}/${codigo}/years`);
    const ano = this.escolherAno(anos, anoMod, combustivel);
    if (!ano) return null;
    const info = await this.get<{ price: string; codeFipe: string; model: string }>(`/${tipo}/${codigo}/years/${ano.code}`);
    const valor = dinheiro(info.price);
    return valor ? { codigo: info.codeFipe, valor, modelo: info.model, ano: ano.name, aproximada: false } : null;
  }
}
