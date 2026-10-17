import { describe, expect, it } from "vitest";
import { checkBanned, findFakeStats, isHedged, parseBannedFromVoiceMd, validateCaptions, validateScript, type CaptionContext } from "../src/index.ts";
import { codes, rules, validCaptions, validPackage, warnCodes, withBeat } from "./fixtures.ts";

const LEAD = "Põe essas três coisas no papel e o orçamento aguenta até a demolição.";

describe("Portuguese CTA closes", () => {
  it.each([
    ["comment_keyword", "blueprint", `${LEAD} Comenta BLUEPRINT que eu te mando o checklist.`, []],
    ["comment_keyword", "blueprint", `${LEAD} Escreve BLUEPRINT nos comentários.`, []],
    ["comment_keyword", "blueprint", `${LEAD} Até a próxima.`, ["cta.mismatch", "cta.keyword_not_said"]],
    ["dm_keyword", "blueprint", `${LEAD} Me chama no direct com BLUEPRINT.`, []],
    ["dm_keyword", "blueprint", `${LEAD} Manda BLUEPRINT no direct.`, []],
    ["dm_keyword", "blueprint", `${LEAD} Comenta BLUEPRINT.`, ["cta.mismatch"]],
    ["link_in_bio", null, `${LEAD} O checklist tá no link da bio.`, []],
    ["link_in_bio", null, `${LEAD} Até a próxima.`, ["cta.mismatch"]],
    ["book_call", null, `${LEAD} Agenda uma conversa pelo link na bio.`, []],
    ["book_call", null, `${LEAD} Marque sua reunião hoje.`, []],
    ["book_call", null, `${LEAD} A marcação da obra vem depois.`, ["cta.mismatch"]],
    ["follow", null, `${LEAD} Segue pra ver o próximo sobre alvarás.`, []],
    ["follow", null, `${LEAD} Até a próxima.`, ["cta.mismatch"]],
    ["save_share", null, `${LEAD} Salva esse vídeo antes da primeira reunião.`, []],
    ["save_share", null, `${LEAD} Manda pra quem vai reformar.`, []],
  ] as const)("%s / %s", (type, keyword, close, expected) => {
    const pkg = { ...withBeat("close", close), cta: { type, keyword } };
    const r = validateScript(pkg, rules({ requireCaptions: false }));
    expect(codes(r).filter((c) => c.startsWith("cta.") && !c.startsWith("cta.keyword."))).toEqual(expected);
  });

  it("none with a Portuguese ask warns", () => {
    const pkg = { ...withBeat("close", `${LEAD} Comenta aqui o que você achou.`), cta: { type: "none" as const }, captions: undefined };
    expect(warnCodes(validateScript(pkg, rules({ requireCaptions: false })))).toContain("cta.unexpected");
  });
});

describe("Portuguese CTA in the hook", () => {
  const run = (hook: string) => codes(validateScript(withBeat("hook", hook), rules()));
  it.each([
    "Comenta BLUEPRINT se o seu orçamento estourou.",
    "Me segue se o seu orçamento estourou antes da demolição.",
    "Salva esse vídeo se o seu orçamento estourou.",
  ])("%s", (hook) => expect(run(hook)).toContain("hook.cta_in_hook"));

  it("everyday use of comentar is not an ask", () => {
    expect(run("Ninguém comenta isso, mas o orçamento quebra antes da demolição.")).not.toContain("hook.cta_in_hook");
  });
});

describe("Portuguese openers", () => {
  it.each([
    ["Fala galera, o orçamento estoura cedo.", "script.banned_opener"],
    ["Neste vídeo eu mostro por que o orçamento estoura.", "script.banned_opener"],
    ["Você sabia que o orçamento estoura na primeira semana?", "script.banned_opener"],
    ["Comenta PLANO pra receber o checklist.", "script.cta_opener"],
  ] as const)("%s → %s", (text, code) => {
    expect(codes(checkBanned(text, {}))).toContain(code);
  });
  it("a plain claim passes", () => {
    expect(checkBanned("O orçamento estoura antes da demolição.", {}).ok).toBe(true);
  });
});

describe("Portuguese voice.md headings", () => {
  const VOICE = `# Perfil de voz

## Como eu falo
- "tipo assim" aparece muito, pode manter.

## Aberturas proibidas
- "Então, é o seguinte"

## Palavras proibidas
- "casa dos sonhos"
- sinergia / alinhar

## Nunca diga
- "revolucionário"

## Não comece com
- "Olha só"
`;
  const parsed = parseBannedFromVoiceMd(VOICE);
  it("reads openers", () => expect(parsed.openers).toEqual(["Então, é o seguinte", "Olha só"]));
  it("reads phrases", () => expect(parsed.phrases).toEqual(["casa dos sonhos", "sinergia", "alinhar", "revolucionário"]));
  it("ignores other sections", () => expect(parsed.phrases).not.toContain("tipo assim"));
});

describe("Portuguese hedges", () => {
  it.each([
    ["Segundo a Examplebrand Research, os custos subiram 27%", true],
    ["Segundo Examplebrand, os custos subiram 27%", true],
    ["Segundo dados do instituto, os custos subiram 27%", true],
    ["De acordo com o relatório, os custos subiram 27%", true],
    ["A pesquisa mostrou que os custos subiram 27%", true],
    ["Em um estudo recente, os custos subiram 27%", true],
    ["O segundo passo é cortar 27% dos custos", false],
    ["Os custos subiram 27%", false],
  ] as const)("%s → %s", (text, expected) => expect(isHedged(text)).toBe(expected));
});

describe("Portuguese fake stats", () => {
  it.each([
    ["A gente só usa 10% do nosso cérebro", "ten-percent-brain-pt"],
    ["A atenção média dura 8 segundos", "eight-second-attention-pt"],
    ["93% da comunicação é não verbal", "mehrabian-93-pt"],
    ["Leva 21 dias pra formar um hábito", "habit-21-days-pt"],
    ["A pessoa precisa ver seu anúncio sete vezes antes de comprar", "rule-of-seven-pt"],
    ["Beba 8 copos de água por dia", "glasses-of-water-pt"],
    ["9 em cada 10 empresas fecham no primeiro ano", "small-business-failure-pt"],
  ])("%s", (text, id) => expect(findFakeStats(text).map((f) => f.id)).toContain(id));
  it("leaves real claims alone", () => {
    expect(findFakeStats("Acompanhamos 42 obras no ano passado")).toEqual([]);
  });
});

describe("Portuguese captions", () => {
  const ctx: CaptionContext = { ctaType: "comment_keyword", keyword: "blueprint", bannedPhrases: [] };
  type Caps = ReturnType<typeof validCaptions>;
  const cases: [string, (c: Caps) => unknown, Partial<CaptionContext>, string[]][] = [
    ["TikTok me chama no direct", (c) => ({ ...c, tiktok: { ...c.tiktok, caption: "Três coisas pra pôr no papel. Me chama no direct com BLUEPRINT." } }), {}, []],
    ["TikTok manda no direct", (c) => ({ ...c, tiktok: { ...c.tiktok, caption: "Três coisas pra pôr no papel. Manda BLUEPRINT no direct." } }), {}, []],
    ["YouTube link na bio", (c) => ({ ...c, youtube: { ...c.youtube, description: "Três coisas pra pôr no papel. Link na bio." } }), {}, []],
    ["TikTok asks to comment the keyword", (c) => ({ ...c, tiktok: { ...c.tiktok, caption: "Comenta BLUEPRINT pra receber o checklist." } }), {}, ["captions.offplatform_cta", "captions.comment_keyword_off_instagram"]],
    ["LinkedIn asks to comment the keyword", (c) => ({ ...c, linkedin: { ...c.linkedin, text: "Comente BLUEPRINT aqui embaixo." } }), {}, ["captions.comment_keyword_off_instagram"]],
    ["link in bio cta, Portuguese line", (c) => ({ ...c, instagram: { ...c.instagram, caption: "O orçamento estoura cedo. Link na minha bio." }, tiktok: { ...c.tiktok, caption: "Checklist no link da bio." } }), { ctaType: "link_in_bio", keyword: null }, []],
  ];
  it.each(cases)("%s", (_name, mutate, over, expected) => {
    expect(codes(validateCaptions(mutate(validCaptions()), { ...ctx, ...over }))).toEqual(expected);
  });
});

describe("English behaviour is unchanged", () => {
  it("the valid fixture still passes", () => {
    expect(validateScript(validPackage(), rules()).errors).toEqual([]);
  });
});
