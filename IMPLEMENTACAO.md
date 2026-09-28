# Vilotti Móveis — notas de implementação

Landing page estática em HTML, CSS e JavaScript vanilla. Abra `index.html` ou sirva a raiz com um servidor estático. Não há instalação, build ou dependências JavaScript.

## Direção e conteúdo

`BRIEF.md` é a fonte oficial. Fotografias e logo originais foram preservadas, inclusive as grafias diferentes `vilotii` e `vilotti`. Escritórios não aparece nesta versão por falta de fotografia correspondente. Não há depoimentos nem comparador antes/depois; o ambiente de jantar ocupa o destaque de projeto previsto no brief.

## Comportamento

- Portfólio sticky com cinco etapas e seleção por botões em desktop com largura acima de 1024px, altura mínima de 700px e movimento permitido. Em telas menores, janelas baixas, movimento reduzido ou sem JavaScript, todas as imagens permanecem disponíveis em sequência/grid.
- Menu mobile até 760px, com Escape, contenção de foco, bloqueio de rolagem e isolamento do conteúdo de fundo. Entre 761 e 1024px, navegação horizontal compacta.
- Processo com progresso ligado à rolagem; foto sticky em telas maiores. Hero com entrada escalonada e zoom lento; reveals de entrada, hover de fotografias e transições discretas.
- WhatsApp: +55 47 99727-1973 com mensagem pré-preenchida. Balão após aproximadamente 5 segundos por 3 segundos, uma vez por visita à página; depois, hover direto ou foco de teclado. Pulso discreto com três ciclos, desativado com movimento reduzido.
- Retorno ao topo disponível após sair da Hero. Âncoras compensam o header fixo.
- Conteúdo essencial visível sem JavaScript; animações respeitam `prefers-reduced-motion`.

## Integrações e publicação

Google Fonts fornece Cormorant Garamond e Manrope com `display=swap`; Georgia e Arial são os fallbacks. O mapa incorporado usa o endereço confirmado, com carregamento tardio e link de rota separado. Fontes e mapa dependem da disponibilidade dos serviços externos.

SEO: título, descrição, idioma, headings, Open Graph textual, favicon original, robots e JSON-LD LocalBusiness com nome, telefone e endereço confirmados. Não foram adicionados dados de avaliação, horário, coordenadas, e-mail ou CNPJ.

## Pendências

- Domínio/URL definitivos: canonical, `og:url`, URL absoluta de `og:image`, `url` e `logo` do JSON-LD e sitemap. Nenhum domínio fictício foi usado e `sitemap.xml` não foi criado.
- URL oficial do Instagram: inserir somente após confirmação. Não há link simulado.
- Fotografia real de escritório para futura inclusão da categoria.
- Avaliações reais ou pares originais de antes/depois, somente se houver intenção de acrescentar essas áreas em uma versão futura.

## Arquivos

- `index.html`
- `assets/css/style.css`
- `assets/js/main.js`
- `robots.txt`
- `IMPLEMENTACAO.md`
- `tests/browser-check.cjs`
- `tests/validation-report.json`

O brief e os assets originais não foram alterados.

## Validação executada

Revisão final em 23/09/2026, no Chrome headless 153: **40 verificações aprovadas**, sem exceções JavaScript nem falhas de carregamento registradas. Relatório completo em `tests/validation-report.json`.

- Sintaxe de `main.js` e do script de testes validada com `node --check`.
- Caminhos locais, IDs, âncoras, seis CTAs de WhatsApp e JSON-LD revisados. Nenhuma referência local inexistente, ID duplicado ou link `#` simulado.
- Sem overflow horizontal em 320×740, 360×800, 390×844, 480×900, 600×900, 768×1024, 1024×900, 1280×800, 1440×1000, 1920×1080 e 1440×640.
- Cinco etapas do portfólio sticky verificadas, inclusive seleção por controles; fallback estático com movimento reduzido e sem JavaScript.
- Header, retorno ao topo, compensação das âncoras, painel mobile, isolamento do fundo, contenção de foco e Escape verificados.
- Balão de WhatsApp verificado na abertura após aproximadamente 5 segundos e ocultação posterior. O código limita a apresentação automática a uma vez por visita.
- Grade de Ambientes conferida em 390, 768 e 1440px, sem linhas implícitas extras.
- Revisão de referências CSS/JS: 467 regras CSS inspecionadas após o Ajuste 01, sem classes referenciadas inexistentes no estado aplicável; nenhum código morto identificado na revisão manual.
- Capturas de desktop, tablet e mobile inspecionadas para tipografia, fotos, recortes, menu e composição das seções. Fontes e mapa carregaram no navegador de teste.

Os testes usam apenas recursos nativos do Node e o protocolo de depuração do Chrome; não acrescentam bibliotecas à landing page. Exigem uma prévia local em `http://localhost:4173` e uma instância temporária do Chrome headless com depuração em `9223`. Executar com `node --experimental-websocket tests/browser-check.cjs` em Node 20. As capturas são gravadas no diretório temporário indicado pelo relatório.

Ainda cabe validar em aparelhos físicos e em Safari/Firefox, especialmente rolagem sticky, viewport móvel e abertura do WhatsApp instalado. Esses ambientes não foram testados. A página não foi publicada.

## Ajuste 01 — viewport fit

Escopo restrito a proporções, espaçamentos e altura útil. HTML, textos, cores, famílias tipográficas, ordem das seções, efeitos e assets não foram alterados.

- `assets/css/style.css`: dimensões desktop calculadas a partir de `100svh` e da altura real do header. Paddings, gaps, tamanhos tipográficos e galerias respondem à altura disponível. Retratos e fotografia do processo mantêm proporção e conteúdo integral. Nos layouts empilhados, permanece a rolagem natural. O CTA não utiliza mais overflow oculto no contêiner de conteúdo.
- `assets/js/main.js`: sincronização de `--header-height` com o header medido por `ResizeObserver`, sem ciclo de redimensionamento; âncoras, menu e painel sticky usam a mesma medida.
- `tests/viewport-fit.cjs`: medição de todas as seções e do rodapé, incluindo altura do painel sticky, limites do conteúdo, clipping e overflow horizontal; capturas antes/depois em 1366×768 e 390×844.
- `tests/viewport-fit-report.json`: resultados antes/depois nas sete resoluções solicitadas.
- `tests/validation-report.json`: regressão dos 40 testes existentes, todos aprovados após o ajuste.

Resoluções verificadas: 1920×1080, 1440×900, 1366×768, 1024×768, 768×1024, 390×844 e 375×667. Nenhum corte de texto ou CTA, overflow horizontal ou exceção JavaScript detectado. Inspeção visual comparativa das capturas executada. Não existe etapa de build: o projeto continua estático, sem `package.json` ou compilação; a sintaxe JavaScript foi validada com `node --check`.

Nas três resoluções desktop, todas as seções visíveis cabem na área útil. Exemplo em 1366×768, com header de 97px:

| Seção | Altura antes | Altura depois |
| --- | ---: | ---: |
| Hero | 840px | 768px (inclui a área sob o header) |
| Ambientes | 1161px | 671px |
| Processo | 1145px | 671px |
| Sobre | 956px | 671px |
| Detalhes | 1138px | 671px |
| Destaque de projeto | 963px | 671px |

O portfólio conserva o percurso de `390svh` necessário ao storytelling; apenas o painel sticky ocupa a altura útil. Com movimento reduzido ou sem JavaScript, a sequência completa de projetos continua maior que uma tela. Em tablet/mobile, portfólio, ambientes, processo e, conforme a largura/altura, Hero, Sobre, Detalhes, destaque de projeto e localização mantêm altura natural superior à viewport para preservar legibilidade e fotografias. Não foram criadas rolagens internas nas seções.
