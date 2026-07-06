# Quiz Accuracy Review — Findings Report

Reviewed: all **1,326 questions across 64 quizzes** (production data, drafts included), 2026-07-06.
Method: 56 parallel fact-checking agents (web-verified), then one independent adversarial
verifier per finding instructed to refute it against primary sources. 41 raw findings,
**41 confirmed** (7 with the fix revised by the verifier), 0 rejected.

Apply with `fixes.sql` (same folder) after review — nothing has been changed in any database yet.

| # | Qn ID | Quiz | Type | Problem |
|---|-------|------|------|---------|
| 1 | 1232 | World Cup Geography: Which Continent Is This Team From? Part 2 | wrong_answer | The marked correct answer is Asia (index 3), but Ecuador is in South America (index 0), as the question's own explanation states. |
| 2 | 1237 | World Cup Geography: Which Continent Is This Team From? Part 3 | wrong_answer | The marked correct answer is South America (index 2), but Belgium is in Europe (index 1), as the question's own explanation states. |
| 3 | 31 | African Nations | ambiguous_options | With both Arabic and Swahili as options, the marked answer (Arabic) is not the only defensible one: Swahili is very widely cited as Africa's most widely spoken language with 150-200 million total speakers when second-language use is counted, while Arabic leads only by native speakers (~170 million in Africa). |
| 4 | 1124 | Capitals of South America | ambiguous_options | The question asks for "the capital city of Bolivia" but the options include both Sucre (the constitutional capital, marked correct) and La Paz (the seat of government), which is widely listed as Bolivia's administrative/de facto capital, so a knowledgeable player could defensibly pick either. |
| 5 | 208 | Countries and Borders | ambiguous_options | China and Russia are both commonly counted as bordering 14 countries (Russia up to 16 if Abkhazia and South Ossetia are included), so with both in the options the marked answer 'China' is not the only defensible choice — a fact the question's own fun fact concedes. |
| 6 | 12 | European Geography | ambiguous_options | Russia is offered as an option, and Russia borders 14 countries (far more than Germany's 9), so a knowledgeable player could defensibly pick Russia over the marked answer Germany. |
| 7 | 69 | North America Basics | ambiguous_options | The Rockies do not run along the western coast — they are an inland range — while two other options (the Cascades, and Mexico's Sierra Madre Occidental) actually lie along or much nearer the Pacific coast, making them more defensible answers as worded. |
| 8 | 99 | Oceania Deep Dive | ambiguous_options | Authoritative sources disagree on whether Tuvalu or Nauru has the smaller population, and the options also include Niue (about 1,700 people), which New Zealand officially describes as a country, so more than one option is defensible. |
| 9 | 19 | Oceans & Seas | ambiguous_options | The Dead Sea is technically a hypersaline lake (as the explanation itself states), so a knowledgeable player could defensibly answer Red Sea, the saltiest true sea, which is also among the options. |
| 10 | 22 | Oceans & Seas | ambiguous_options | The Arabian Sea (~3.86 million km²) is larger by area than the marked answer, the South China Sea (~3.5 million km²), so the options contain a second defensible (arguably better) answer. |
| 11 | 272 | World Capitals II | ambiguous_options | The question asks for "the capital city" of South Africa but the options include both Pretoria (administrative capital) and Cape Town (legislative capital), so two options are defensible answers. |
| 12 | 472 | World Capitals II | ambiguous_options | The question asks for "the capital city" of South Africa but the options include both Pretoria (executive capital) and Cape Town (legislative capital), making two answers defensible. |
| 13 | 572 | World Capitals II | ambiguous_options | Duplicate of question 472: it asks for "the capital city" of South Africa while offering both Pretoria (executive capital) and Cape Town (legislative capital) as options, so two answers are defensible. |
| 14 | 41 | Antarctica: The Frozen Continent | outdated | The explanation states the Antarctic Treaty "currently has 56 signatory nations," but the treaty has had 58 parties since 2024. |
| 15 | 1108 | Capitals of Europe | outdated | The fun fact states Riga is the largest city in the Baltic states, but official 2025 statistics from both Latvia and Lithuania show Vilnius has overtaken Riga in population. |
| 16 | 151 | Country Outlines | outdated | The explanation says Japan is 'an archipelago of nearly 7,000 islands', but Japan's official island count was revised to 14,125 in 2023. |
| 17 | 138 | Name That Flag | outdated | The fun fact says the Indian flag must by law be made of khadi, but a 30 December 2021 amendment to the Flag Code of India also permits machine-made and polyester flags. |
| 18 | 20 | Oceans & Seas | outdated | The explanation cites 11,034 meters for the Mariana Trench, an obsolete 1957 estimate; the modern accepted depth of Challenger Deep is about 10,935 meters. |
| 19 | 4 | World Capitals | outdated | The fun fact states Tokyo is the most populous metropolitan area in the world with over 37 million people, but the UN's November 2025 World Urbanization Prospects report now ranks Jakarta first (~42 million), with Dhaka second and Tokyo third (~33 million). |
| 20 | 928 | African Cities | factual_error_explanation | The explanation claims Nairobi is the most populous city in East Africa, but Dar es Salaam is larger. |
| 21 | 92 | East Asia Deep Dive | factual_error_explanation | The explanation states the Taiwan Strait is about 180 km wide at its narrowest point, but the narrowest width is approximately 130 km; 180 km is closer to its average width. |
| 22 | 11 | European Geography | factual_error_explanation | The explanation claims Mont Blanc is the highest mountain in Europe, but under the most widely used continental boundary Mount Elbrus (5,642 m) in the Russian Caucasus is Europe's highest peak. |
| 23 | 107 | North America Deep Dive | factual_error_explanation | The explanation says Hawaii is the only state 'entirely' south of the Tropic of Cancer, but the state's Northwestern Hawaiian Islands (from French Frigate Shoals up to Kure Atoll at about 28.4 degrees N) lie north of the tropic. |
| 24 | 67 | Oceania Overview | factual_error_explanation | The explanation calls Suva the largest city in the South Pacific outside Australia and New Zealand, but Port Moresby is substantially larger and holds that title. |
| 25 | 928 | African Cities | factual_error_funfact | The fun fact says Nairobi is 'surrounded by' Nairobi National Park, but the park only borders the city on its southern side. |
| 26 | 33 | Antarctica: The Frozen Continent | factual_error_funfact | The fun fact claims the station itself must be physically relocated every few years, but the station is never moved — only the geographic South Pole marker is repositioned (annually) as the ice sheet drifts about 10 meters per year. |
| 27 | 13 | European Geography | factual_error_funfact | The fun fact wrongly calls the Channel Tunnel the longest undersea rail tunnel in the world at 50.45 km (Japan's Seikan Tunnel is longer at 53.85 km; the Channel Tunnel only holds the record for longest undersea section, 37.9 km) and says 20 million vehicles use it yearly when the figure of about 20 million refers to passengers. |
| 28 | 14 | European Geography | factual_error_funfact | The fun fact says Finland's roughly 179,000 islands are the second most in Europe, but widely cited counts rank Norway second with about 239,000 islands, putting Finland third. |
| 29 | 162 | Famous World Landmarks | factual_error_funfact | The fun fact says most moai have bodies buried underground with only their heads visible, but only the subset of statues on the Rano Raraku quarry slopes are buried to the shoulders; most of the island's ~900 moai stand or lie fully exposed. |
| 30 | 165 | Famous World Landmarks | factual_error_funfact | The fun fact claims Cambodia's is the only national flag in the world to feature a building, but the flags of Portugal, San Marino, and Spain also depict buildings. |
| 31 | 49 | Middle East Ancient Sites | factual_error_funfact | The fun fact claims the attendants in Ur's Royal Tombs were 'buried alive', but excavator Leonard Woolley theorised they took poison, and modern CT-scan analysis shows they were killed by blunt force trauma to the head before burial — no interpretation supports live burial. |
| 32 | 18 | Oceans & Seas | factual_error_funfact | The fun fact gives the Mariana Trench depth as 11,034 meters, an outdated 1957 Soviet sonar figure that modern surveys have shown to be an overestimate. |
| 33 | 449 | Regional Geography | factual_error_funfact | The fun fact implies Finland and Iceland are only informally counted as Nordic countries, when they are Nordic by the standard definition; it is the term Scandinavia that is sometimes loosely broadened to include them. |
| 34 | 117 | South America Deep Dive | factual_error_funfact | The fun fact flatly calls Ushuaia the southernmost city in the world, but Chile's Puerto Williams lies farther south and is officially recognized as a city by Chile, making the title disputed. |
| 35 | 60 | South East Asia Adventure | factual_error_funfact | The fun fact claims Cambodia is the only country to feature a building on its flag, but the flags of Portugal, San Marino, and Spain also feature buildings; Cambodia's distinction is that the building is the flag's central design element. |
| 36 | 1015 | World Cup Flags Part 3 of 4 | factual_error_funfact | The fun fact says Egypt opened against Belgium in Vancouver, but that match was played at Lumen Field in Seattle; Vancouver hosted New Zealand's Group G matches. |
| 37 | 1217 | World Cup Geography: Which Continent Is This Team From? Part 1 | factual_error_funfact | The fun fact says Canada is the second-largest country "by land area," but Canada is second only by total area; by land area (excluding water) it ranks fourth, behind Russia, China, and the United States. |
| 38 | 1352 | Capitals of Eastern Europe | wording | This question is an exact duplicate of questionId 1318 in the same quiz (identical text, options, correct answer, explanation, and fun fact), so players would be asked the same question twice. |
| 39 | 226 | Countries and Borders | wording | Finland's western neighbor is Sweden, not Norway (Norway borders Finland to the north), and 'Norway to the west' actually describes Sweden — one of the distractor options — making the question misleading. |
| 40 | 104 | North America Deep Dive | wording | The question's premise is false: the largest bay in the world by area is the Bay of Bengal (about 2.17 million km2), not Hudson Bay (about 1.23 million km2); Hudson Bay holds the record for longest shoreline, not area. |
| 41 | 126 | Oceania Overview | wording | The fun fact 'Both animals only appear on Australian currency too' is garbled — 'only' contradicts 'too' and falsely suggests the animals appear nowhere else — and the emu features on the 50-cent coin only as part of the coat of arms. |

---

## 1. Question 1232 — World Cup Geography: Which Continent Is This Team From? Part 2

**Question:** Which continent or world region is this World Cup team from: Ecuador?
**Issue:** `wrong_answer` · reviewer confidence: high · verifier verdict: **CONFIRMED**

**Problem:** The marked correct answer is Asia (index 3), but Ecuador is in South America (index 0), as the question's own explanation states.

**Reviewer evidence:** Ecuador is a country in northwestern South America, straddling the equator on the Pacific coast (CIA World Factbook / Britannica: https://www.britannica.com/place/Ecuador). The explanation field itself says 'Ecuador is located in South America.'

**Verifier evidence:** Independently verified via web search: Wikipedia "Ecuador national football team" (https://en.wikipedia.org/wiki/Ecuador_national_football_team) confirms Ecuador joined FIFA in 1926 and CONMEBOL (the South American confederation) in 1927, and qualified for World Cups via the South American qualifiers; Wikipedia "Ecuador at the FIFA World Cup" (https://en.wikipedia.org/wiki/Ecuador_at_the_FIFA_World_Cup) and FIFA's official team page (https://www.fifa.com/en/tournaments/mens/worldcup/canadamexicousa2026/teams/ecuador/team-news) likewise treat Ecuador as a CONMEBOL/South American team. This matches standard geographic authorities (Britannica/CIA World Factbook: Ecuador is in northwestern South America on the equator) and the question's own explanation text.

**Fix:**
```json
[
  {
    "field": "correct_option",
    "newValue": 0
  }
]
```

## 2. Question 1237 — World Cup Geography: Which Continent Is This Team From? Part 3

**Question:** Which continent or world region is this World Cup team from: Belgium?
**Issue:** `wrong_answer` · reviewer confidence: high · verifier verdict: **CONFIRMED**

**Problem:** The marked correct answer is South America (index 2), but Belgium is in Europe (index 1), as the question's own explanation states.

**Reviewer evidence:** Belgium is a country in Western Europe bordering France, Germany, the Netherlands, and Luxembourg (Britannica: https://www.britannica.com/place/Belgium). The explanation field itself says 'Belgium is located in Europe.'

**Verifier evidence:** Independently verified via web search: Wikipedia "Belgium national football team" (https://en.wikipedia.org/wiki/Belgium_national_football_team) states the team is governed by the Royal Belgian FA, a founding member of UEFA; Wikipedia "UEFA" (https://en.wikipedia.org/wiki/UEFA) confirms UEFA is the European confederation of FIFA; UEFA.com lists Belgium as a member team (https://www.uefa.com/uefanationsleague/teams/13--belgium/). Britannica (cited by reviewer) also places Belgium in Western Europe. Options[1] = "Europe" in the JSON, so newValue 1 is the correct index.

**Fix:**
```json
[
  {
    "field": "correct_option",
    "newValue": 1
  }
]
```

## 3. Question 31 — African Nations

**Question:** What is the most widely spoken language in Africa?
**Issue:** `ambiguous_options` · reviewer confidence: high · verifier verdict: **MODIFIED**

**Problem:** With both Arabic and Swahili as options, the marked answer (Arabic) is not the only defensible one: Swahili is very widely cited as Africa's most widely spoken language with 150-200 million total speakers when second-language use is counted, while Arabic leads only by native speakers (~170 million in Africa).

**Reviewer evidence:** Ethnologue/Wikipedia and multiple language surveys (e.g. https://en.wikipedia.org/wiki/Languages_of_Africa, https://www.berlitz.com/blog/what-are-most-spoken-languages-africa) report Swahili at up to ~200 million total speakers in Africa versus Arabic's ~170 million; sources explicitly split on which is 'most widely spoken' depending on whether L2 speakers are counted.

**Verifier evidence:** Checked independently: (1) https://en.wikipedia.org/wiki/Languages_of_Africa — Arabic ~150M native speakers in Africa, ~213M total (2025); ~17% of Africans speak an Arabic dialect vs ~10% Swahili. (2) https://en.wikipedia.org/wiki/Swahili — total Swahili speakers estimated 60M-200M; native speakers only ~15-20M. (3) https://www.un.org/en/observances/kiswahili-day — UN calls Kiswahili "the most widely spoken language in sub-Saharan Africa" and a lingua franca in 14+ countries. (4) https://theconversation.com/the-story-of-how-swahili-became-africas-most-spoken-language-177259 and https://www.weforum.org/stories/2022/02/swahili-africa-language-history/ — both explicitly title Swahili Africa's most spoken language with ~200M speakers. Sources genuinely split on "most widely spoken" depending on whether L2 speakers count, confirming the ambiguity; Arabic unambiguously leads by native speakers, validating the question rewrite but not the reviewer's claim that Swahili has more total speakers than Arabic.

**Fix:**
```json
[
  {
    "field": "text",
    "newValue": "Which language has the most native speakers in Africa?"
  },
  {
    "field": "explanation",
    "newValue": "Arabic has more native speakers than any other language in Africa, with roughly 150 million, mainly in North African countries. Swahili has far fewer native speakers but is used by well over 100 million people, mostly as a second language across East and Central Africa."
  }
]
```

## 4. Question 1124 — Capitals of South America

**Question:** What is the capital city of Bolivia?
**Issue:** `ambiguous_options` · reviewer confidence: high · verifier verdict: **CONFIRMED**

**Problem:** The question asks for "the capital city of Bolivia" but the options include both Sucre (the constitutional capital, marked correct) and La Paz (the seat of government), which is widely listed as Bolivia's administrative/de facto capital, so a knowledgeable player could defensibly pick either.

**Reviewer evidence:** Bolivia's 2009 constitution names Sucre as the capital, but the executive and legislative branches sit in La Paz, and sources such as the CIA World Factbook and Britannica list both (La Paz as administrative capital, Sucre as constitutional/judicial capital) — https://www.cia.gov/the-world-factbook/countries/bolivia/ and https://www.britannica.com/place/Bolivia. The question's own funFact concedes this: "La Paz is the seat of government."

**Verifier evidence:** Independently verified via web research: (1) CIA World Factbook (2021/2022 archive editions at cia.gov and mirrors such as worldfactbookarchive.org and theodora.com) lists Bolivia's capital as "La Paz (administrative capital); Sucre (constitutional [legislative and judicial] capital)". (2) Britannica's Bolivia entry (britannica.com/place/Bolivia) lists both La Paz (administrative) and Sucre (constitutional/judicial) as capitals. (3) Wikipedia articles on Bolivia, Sucre, and La Paz confirm Sucre is the de jure/constitutional capital under the 2009 constitution and seat of the judiciary, while La Paz hosts the executive, legislative, and electoral branches, the seat of government having moved to La Paz in 1898. These authoritative sources confirm both options are defensible answers to the unqualified question, and that "constitutional capital of Bolivia" unambiguously means Sucre.

**Fix:**
```json
[
  {
    "field": "text",
    "newValue": "What is the constitutional capital of Bolivia?"
  }
]
```

## 5. Question 208 — Countries and Borders

**Question:** Which country has the most land borders with other countries?
**Issue:** `ambiguous_options` · reviewer confidence: high · verifier verdict: **CONFIRMED**

**Problem:** China and Russia are both commonly counted as bordering 14 countries (Russia up to 16 if Abkhazia and South Ossetia are included), so with both in the options the marked answer 'China' is not the only defensible choice — a fact the question's own fun fact concedes.

**Reviewer evidence:** CIA World Factbook land-boundary data lists 14 bordering countries for China and 14 for Russia (16 counting the partially recognized Abkhazia and South Ossetia); reference sites such as WorldAtlas (worldatlas.com, 'Which Country Borders The Most Other Countries?') list China and Russia tied at 14.

**Verifier evidence:** Checked: Wikipedia 'Borders of Russia' (en.wikipedia.org/wiki/Borders_of_Russia) — Russia has land borders with 14 sovereign states, 16 counting Abkhazia and South Ossetia; Wikipedia 'List of countries and territories by number of land borders' — China and Russia tied at 14; CIA World Factbook land-boundaries field (cia.gov/the-world-factbook/.../field/land-boundaries) — 14 bordering countries for both China and Russia; WorldAtlas 'Which Countries Border Russia?' and 'Countries Bordering The Highest Number Of Other Countries' (worldatlas.com) — both report the China/Russia 14-14 tie. Neighbor counts for the fixed options: India 6-7, Brazil 10, Germany 9 — all well below China's 14, so the fixed question has a unique defensible answer.

**Fix:**
```json
[
  {
    "field": "options",
    "newValue": [
      "China",
      "India",
      "Brazil",
      "Germany"
    ]
  }
]
```

## 6. Question 12 — European Geography

**Question:** Which country has the most neighboring countries in Europe?
**Issue:** `ambiguous_options` · reviewer confidence: high · verifier verdict: **CONFIRMED**

**Problem:** Russia is offered as an option, and Russia borders 14 countries (far more than Germany's 9), so a knowledgeable player could defensibly pick Russia over the marked answer Germany.

**Reviewer evidence:** Russia shares land borders with 14 countries (Norway, Finland, Estonia, Latvia, Lithuania, Poland, Belarus, Ukraine, Georgia, Azerbaijan, Kazakhstan, Mongolia, China, North Korea) per https://en.wikipedia.org/wiki/List_of_countries_and_territories_by_number_of_land_borders; Germany borders 9. Even counting only European neighbors, Russia has 8-10, making the question ambiguous as written.

**Verifier evidence:** Checked WorldAtlas "European Countries With the Most Neighbors" (https://www.worldatlas.com/articles/european-countries-bordering-most-other-countries.html), which ranks Russia first in Europe with 14 bordering countries and Germany third with 9; Wikipedia "Borders of Russia" (https://en.wikipedia.org/wiki/Borders_of_Russia) confirming Russia's 14 land neighbors, tied with China for most in the world. Verified border counts for the fixed option set: Germany 9 (Denmark, Poland, Czechia, Austria, Switzerland, France, Luxembourg, Belgium, Netherlands), Italy 6, France 8 within Europe (Belgium, Luxembourg, Germany, Switzerland, Italy, Monaco, Spain, Andorra), Austria 8 (Germany, Czechia, Slovakia, Hungary, Slovenia, Italy, Switzerland, Liechtenstein) — Germany uniquely highest among the proposed options.

**Fix:**
```json
[
  {
    "field": "options",
    "newValue": [
      "Germany",
      "Italy",
      "France",
      "Austria"
    ]
  }
]
```

## 7. Question 69 — North America Basics

**Question:** Which mountain range runs along the western coast of North America?
**Issue:** `ambiguous_options` · reviewer confidence: high · verifier verdict: **CONFIRMED**

**Problem:** The Rockies do not run along the western coast — they are an inland range — while two other options (the Cascades, and Mexico's Sierra Madre Occidental) actually lie along or much nearer the Pacific coast, making them more defensible answers as worded.

**Reviewer evidence:** The Rocky Mountains run through the interior of western North America, hundreds of kilometres from the Pacific; the Cascade Range parallels the Pacific coast from British Columbia to Northern California (Encyclopaedia Britannica entries for Rocky Mountains and Cascade Range). The question's own explanation ('from British Columbia to New Mexico') describes an inland corridor, not a coastline.

**Verifier evidence:** Checked: Britannica "Rocky Mountains" (https://www.britannica.com/place/Rocky-Mountains) — extent "some 3,000 miles (4,800 km)" from northern Alberta/BC to New Mexico; bordered west by Interior Plateau, Coast Mountains, Columbia Plateau, Basin and Range, i.e. inland, distinct from the Pacific Coast Ranges. Wikipedia "Rocky Mountains" (https://en.wikipedia.org/wiki/Rocky_Mountains) — southern terminus near Albuquerque/Santa Fe, NM; distinct from coastal ranges. Britannica "Cascade Range" (https://www.britannica.com/place/Cascade-Range) — extends 700+ miles from Lassen Peak (N. California) to the Fraser River (southern BC), lying 100-150 miles inland from the Pacific. Britannica "Sierra Madre" and Wikipedia "Sierra Madre Occidental" (https://www.britannica.com/place/Sierra-Madre-mountain-system-Mexico, https://en.wikipedia.org/wiki/Sierra_Madre_Occidental) — Sierra Madre Occidental runs parallel to Mexico's Pacific coast for ~1,250 km. These confirm the marked answer contradicts the question wording while two distractors fit it better, and that the proposed fix text is accurate and uniquely selects the Rockies.

**Fix:**
```json
[
  {
    "field": "text",
    "newValue": "Which major mountain range stretches through western North America from British Columbia to New Mexico?"
  }
]
```

## 8. Question 99 — Oceania Deep Dive

**Question:** What is the smallest country in Oceania by population?
**Issue:** `ambiguous_options` · reviewer confidence: medium · verifier verdict: **MODIFIED**

**Problem:** Authoritative sources disagree on whether Tuvalu or Nauru has the smaller population, and the options also include Niue (about 1,700 people), which New Zealand officially describes as a country, so more than one option is defensible.

**Reviewer evidence:** UN/Worldometer figures put Tuvalu (~9,500) below Nauru (~12,000) (https://www.worldometers.info/world-population/tuvalu-population/), while the CIA World Factbook estimates Tuvalu at ~11,700 and Nauru near ~10,000, the opposite ordering (https://www.cia.gov/the-world-factbook/countries/tuvalu/ and https://www.cia.gov/the-world-factbook/countries/nauru/); Niue is a self-governing state in free association with New Zealand.

**Verifier evidence:** CIA World Factbook: Tuvalu 11,733 (2024 est.) (https://www.cia.gov/the-world-factbook/countries/tuvalu/); CIA Factbook 2024: Nauru 9,852 (2023 est.) (https://theodora.com/world_fact_book_2024/nauru/nauru_people.html, mirror of https://www.cia.gov/the-world-factbook/about/archives/2024/countries/nauru/). UN WPP 2024: Tuvalu ~9,600-9,700 (https://www.worldometers.info/world-population/tuvalu-population/, https://www.unfpa.org/data/world-population/TV) vs Nauru 12,884 in 2024 (https://www.macrotrends.net/global-metrics/countries/nru/nauru/population) — the two authorities give opposite orderings. Niue status: state in free association with NZ since 1974, not a UN member but recognized as sovereign by the US in 2023 and party to UN treaties open to states (https://en.wikipedia.org/wiki/Political_status_of_the_Cook_Islands_and_Niue, https://www.everycrsreport.com/reports/IF12994.html). Land areas for the fixed question: Nauru 21 km² (world's smallest island nation, Britannica https://www.britannica.com/place/Nauru), Tuvalu ~26 km², Niue ~260 km², Palau ~459 km² — Nauru unambiguously smallest among the options. Fun-fact check: Switzerland also has no official (de jure) capital; Bern is only the "federal city" (https://www.swissinfo.ch/eng/swiss-oddities/why-switzerland-hasnt-got-a-capital-city/89071876), so the "only country with no official capital" claim was removed.

**Fix:**
```json
[
  {
    "field": "text",
    "newValue": "What is the smallest country in Oceania by land area?"
  },
  {
    "field": "correct_option",
    "newValue": 0
  },
  {
    "field": "explanation",
    "newValue": "Nauru covers just 21 square kilometres, making it the world's smallest island nation."
  },
  {
    "field": "fun_fact",
    "newValue": "Nauru has no official capital city — government offices are based in the Yaren district."
  }
]
```

## 9. Question 19 — Oceans & Seas

**Question:** Which sea is the saltiest in the world?
**Issue:** `ambiguous_options` · reviewer confidence: medium · verifier verdict: **CONFIRMED**

**Problem:** The Dead Sea is technically a hypersaline lake (as the explanation itself states), so a knowledgeable player could defensibly answer Red Sea, the saltiest true sea, which is also among the options.

**Reviewer evidence:** The Dead Sea is classified as a salt lake, and the Red Sea (~4% salinity) is widely cited as the saltiest ocean-connected sea (Britannica: https://www.britannica.com/place/Dead-Sea; NOAA/Britannica on Red Sea salinity).

**Verifier evidence:** Independently verified: (1) Britannica classifies the Dead Sea as a landlocked salt lake (https://www.britannica.com/place/Dead-Sea/Climate-and-hydrology; also https://en.wikipedia.org/wiki/Dead_Sea); (2) NOAA and oceanography texts cite the Red Sea (and Persian Gulf) at ~40 ppt as the saltiest ocean water (https://www.noaa.gov/jetstream/ocean/sea-water; https://rwu.pressbooks.pub/webboceanography/chapter/5-3-salinity-patterns/; https://iere.org/what-is-the-saltiest-sea-on-earth/); (3) Dead Sea salinity ~34%, nearly 10x ocean water (https://www.sciencefocus.com/planet-earth/how-much-salt-is-there-in-the-dead-sea; https://science.howstuffworks.com/environmental/earth/saltiest-body-of-water.htm); (4) saltier but tiny ponds exist (Don Juan Pond ~44%, Gaet'ale ~43%), which the explanation's "saltiest major body of water" qualifier already handles (https://earthobservatory.nasa.gov/images/84955/saltiest-pond-on-earth).

**Fix:**
```json
[
  {
    "field": "text",
    "newValue": "Which of these bodies of water is the saltiest?"
  }
]
```

## 10. Question 22 — Oceans & Seas

**Question:** What is the largest sea in the world?
**Issue:** `ambiguous_options` · reviewer confidence: high · verifier verdict: **CONFIRMED**

**Problem:** The Arabian Sea (~3.86 million km²) is larger by area than the marked answer, the South China Sea (~3.5 million km²), so the options contain a second defensible (arguably better) answer.

**Reviewer evidence:** Wikipedia's List of seas and Britannica give the Arabian Sea an area of about 3,862,000 km² versus about 3,500,000 km² for the South China Sea; Guinness World Records nonetheless names the South China Sea the largest sea under its stricter definition of a sea (https://www.guinnessworldrecords.com/world-records/498324-largest-sea, https://en.wikipedia.org/wiki/List_of_seas_on_Earth).

**Verifier evidence:** Checked: (1) Britannica Arabian Sea entry (https://www.britannica.com/place/Arabian-Sea): area ~1,491,000 sq mi / 3,862,000 km². (2) Britannica South China Sea entry (https://www.britannica.com/place/South-China-Sea): ~1,423,000 sq mi / 3,685,000 km² — smaller than the Arabian Sea even on Britannica's own figures. (3) Guinness World Records 'Largest sea' page (https://www.guinnessworldrecords.com/world-records/498324-largest-sea), fetched directly: names the South China Sea at ~3,500,000 km² under the definition 'partly enclosed by a land mass and connected to an ocean'. (4) Britannica Bering Sea entry (https://www.britannica.com/place/Bering-Sea): ~890,000 sq mi / 2,304,000 km², confirming the replacement option is safely smaller than the South China Sea. (5) General search confirms Wikipedia and multiple reference/trivia sources rank Philippine Sea (~5.5M km²), Coral Sea, and Arabian Sea above the South China Sea by raw area, reinforcing that the original option set was ambiguous while the fixed set is not.

**Fix:**
```json
[
  {
    "field": "options",
    "newValue": [
      "Mediterranean Sea",
      "Caribbean Sea",
      "South China Sea",
      "Bering Sea"
    ]
  },
  {
    "field": "explanation",
    "newValue": "The South China Sea is generally considered the largest true sea in the world, covering approximately 3.5 million square kilometers. Larger bodies of water like the Philippine Sea are usually classed as open regions of the ocean rather than seas partly enclosed by land."
  }
]
```

## 11. Question 272 — World Capitals II

**Question:** What is the capital city of South Africa?
**Issue:** `ambiguous_options` · reviewer confidence: high · verifier verdict: **CONFIRMED**

**Problem:** The question asks for "the capital city" of South Africa but the options include both Pretoria (administrative capital) and Cape Town (legislative capital), so two options are defensible answers.

**Reviewer evidence:** South Africa has three capitals: Pretoria (administrative/executive), Cape Town (legislative, seat of Parliament), and Bloemfontein (judicial) — confirmed by the South African government (https://www.gov.za) and Encyclopaedia Britannica (https://www.britannica.com/place/South-Africa); the question's own funFact states this.

**Verifier evidence:** Independently verified via Council on Foreign Relations, "South Africa's Three Capitals" (https://www.cfr.org/articles/south-africas-three-capitals): Parliament meets in Cape Town (legislative capital), the administration/executive is based in Pretoria (administrative capital), and the judiciary was based in Bloemfontein (judicial capital). Corroborated by multiple geography references surfaced in web search (e.g., https://www.exploresouthafrica.net/geography/capitals.php, https://www.wisemove.co.za/post/what-is-the-capital-of-south-africa), all agreeing Pretoria is the executive/administrative capital and Cape Town the legislative capital. The question's options (batch-45.json, questionId 272) include both Pretoria (option 0, marked correct) and Cape Town (option 2), and its funFact states "South Africa has three capital cities: Pretoria, Cape Town, and Bloemfontein."

**Fix:**
```json
[
  {
    "field": "text",
    "newValue": "What is the administrative capital of South Africa, where the executive branch is based?"
  }
]
```

## 12. Question 472 — World Capitals II

**Question:** What is the capital city of South Africa?
**Issue:** `ambiguous_options` · reviewer confidence: high · verifier verdict: **CONFIRMED**

**Problem:** The question asks for "the capital city" of South Africa but the options include both Pretoria (executive capital) and Cape Town (legislative capital), making two answers defensible.

**Reviewer evidence:** South Africa has three capitals: Pretoria (executive/administrative), Cape Town (legislative, seat of Parliament), and Bloemfontein (judicial) — confirmed by the South African government (gov.za) and Encyclopaedia Britannica (https://www.britannica.com/place/South-Africa); the question's own fun fact states this.

**Verifier evidence:** Checked independently: (1) South African Government provinces page (https://www.gov.za/about-sa/south-africas-provinces) — names Pretoria as administrative capital, Cape Town as legislative capital where Parliament sits, Bloemfontein as judicial capital home to the Supreme Court of Appeal. (2) Britannica South Africa entry (https://www.britannica.com/place/South-Africa) — lists three capitals (executive Pretoria, legislative Cape Town, judicial Bloemfontein); direct fetch was 403 but content confirmed via search snippets and corroborating sources. (3) Wikipedia South Africa (https://en.wikipedia.org/wiki/South_Africa) and Wikipedia Pretoria (https://en.wikipedia.org/wiki/Pretoria) — Pretoria is the executive/administrative capital and seat of the executive branch, consistent with the proposed question wording. The batch JSON confirms options include both Pretoria and Cape Town and the fun fact already states the three-capitals fact.

**Fix:**
```json
[
  {
    "field": "text",
    "newValue": "Which city is South Africa's administrative capital, where the executive branch is based?"
  }
]
```

## 13. Question 572 — World Capitals II

**Question:** What is the capital city of South Africa?
**Issue:** `ambiguous_options` · reviewer confidence: high · verifier verdict: **MODIFIED**

**Problem:** Duplicate of question 472: it asks for "the capital city" of South Africa while offering both Pretoria (executive capital) and Cape Town (legislative capital) as options, so two answers are defensible.

**Reviewer evidence:** South Africa has three capitals: Pretoria (executive/administrative), Cape Town (legislative, seat of Parliament), and Bloemfontein (judicial) — confirmed by the South African government (gov.za) and Encyclopaedia Britannica (https://www.britannica.com/place/South-Africa); the question's own fun fact states this.

**Verifier evidence:** Checked independently: (1) Council on Foreign Relations, "South Africa's Three Capitals" (https://www.cfr.org/articles/south-africas-three-capitals) — Pretoria executive, Cape Town legislative, Bloemfontein judicial. (2) Encyclopaedia Britannica (https://www.britannica.com/place/South-Africa and https://www.britannica.com/place/Cape-Town) — confirms the 1910 Union compromise assigning Parliament to Cape Town, executive to Pretoria, judiciary to Bloemfontein. (3) Direct read of /private/tmp/claude-501/-Users-jm-Webpage-Development/c97eff85-3f67-490d-855a-589a2d4949bb/scratchpad/review-batches/batch-47.json — questionId 472 and 572 are byte-for-byte identical (text, options [Pretoria, Johannesburg, Cape Town, Durban], correctOption 0, explanation, fun fact), confirming the duplication half of the claim that the proposed fix does not address.

**Fix:**
```json
[
  {
    "field": "text",
    "newValue": "Which city is South Africa's legislative capital, where its Parliament sits?"
  },
  {
    "field": "correct_option",
    "newValue": 2
  },
  {
    "field": "explanation",
    "newValue": "Cape Town is South Africa's legislative capital and the seat of its national Parliament."
  }
]
```

## 14. Question 41 — Antarctica: The Frozen Continent

**Question:** What treaty designates Antarctica as a scientific preserve and bans military activity?
**Issue:** `outdated` · reviewer confidence: high · verifier verdict: **CONFIRMED**

**Problem:** The explanation states the Antarctic Treaty "currently has 56 signatory nations," but the treaty has had 58 parties since 2024.

**Reviewer evidence:** The Antarctic Treaty Secretariat lists 58 parties (29 consultative, 29 non-consultative) as of 2024 and this remains current in 2026 — https://www.ats.aq/devAS/Parties?lang=e and https://en.wikipedia.org/wiki/Antarctic_Treaty_System

**Verifier evidence:** Checked independently: (1) Antarctic Treaty Secretariat official parties list, https://www.ats.aq/devAS/Parties?lang=e — downloaded the raw HTML via curl; page text reads "there are now twenty-nine Consultative Parties in all. The other 29 Non-Consultative Parties are invited to attend the Consultative Meetings but do not participate in the decision-making," and the table contains exactly 58 unique country rows (29+29=58). Most recent accessions: Saudi Arabia (2024-05-22) and UAE (2024-12-11), which raised the count from 56 to 58. (2) Wikipedia Antarctic Treaty System article, https://en.wikipedia.org/wiki/Antarctic_Treaty_System — states 58 parties as of April 2026 (29 consultative, 29 non-consultative). (3) MOFA Japan on ATCM 48 (Hiroshima, May 2026), https://www.mofa.go.jp/press/release/pressite_000001_02289.html — consistent with 58 parties and no newer accessions. The "56" figure was accurate only before May 2024.

**Fix:**
```json
[
  {
    "field": "explanation",
    "newValue": "The Antarctic Treaty was signed in 1959 and entered into force in 1961. It bans military activity and currently has 58 party nations."
  }
]
```

## 15. Question 1108 — Capitals of Europe

**Question:** What is the capital city of Latvia?
**Issue:** `outdated` · reviewer confidence: high · verifier verdict: **CONFIRMED**

**Problem:** The fun fact states Riga is the largest city in the Baltic states, but official 2025 statistics from both Latvia and Lithuania show Vilnius has overtaken Riga in population.

**Reviewer evidence:** In January 2025, Lithuania's and Latvia's official statistics agencies confirmed Vilnius reached 607,404-607,667 residents versus Riga's ~591,881-605,273, making Vilnius the largest Baltic city (https://www.govilnius.lt/media-news/vilnius-officially-becomes-the-largest-city-in-the-baltics; https://www.lrt.lt/en/news-in-english/19/1773997/lrt-facts-has-vilnius-really-become-the-biggest-city-in-the-baltic-states).

**Verifier evidence:** Checked: (1) govilnius.lt article dated June 2, 2025 citing Lithuania's State Data Agency (Vilnius 607,667) and Latvia's Central Statistical Bureau (Riga 591,881) — https://www.govilnius.lt/media-news/vilnius-officially-becomes-the-largest-city-in-the-baltics; (2) Latvia's official statistics portal stat.gov.lv press release and Latvian public broadcaster LSM (02.06.2025) confirming Riga at ~591,882 / "population of Vilnius has just outnumbered that of Riga" — https://eng.lsm.lv/article/society/society/02.06.2025-latvias-population-is-1857000-in-2025.a601488/ and https://stat.gov.lv/en/statistics-themes/population/population/press-releases/22900-number-population-latvia-2024; (3) LRT fact-check https://www.lrt.lt/en/news-in-english/19/1773997/ — its "false" conclusion relied on older figures (Vilnius 576,195 vs Riga 605,802); the 2025 comparable-methodology figures now show Vilnius ahead by roughly 16,000 residents.

**Fix:**
```json
[
  {
    "field": "fun_fact",
    "newValue": "Riga was long the largest city in the Baltic states, though fast-growing Vilnius recently overtook it in population."
  }
]
```

## 16. Question 151 — Country Outlines

**Question:** Which country has this outline?
**Issue:** `outdated` · reviewer confidence: high · verifier verdict: **CONFIRMED**

**Problem:** The explanation says Japan is 'an archipelago of nearly 7,000 islands', but Japan's official island count was revised to 14,125 in 2023.

**Reviewer evidence:** In February 2023 the Geospatial Information Authority of Japan recounted Japan's islands using digital maps and raised the official figure from 6,852 to 14,125 (https://www.nippon.com/en/japan-data/h01615/; https://edition.cnn.com/2023/03/02/asia/japan-islands-double-report-intl-hnk).

**Verifier evidence:** Independently checked via WebSearch: (1) Nippon.com Japan Data article "Japan's Islands Double to 14,125 Following New Survey" (https://www.nippon.com/en/japan-data/h01615/) confirms GSI announced 14,125 islands on 2023-02-28, replacing the 1987 Japan Coast Guard figure of 6,852, using the same criterion (coastline of 100 m or more). (2) CNN (https://edition.cnn.com/2023/03/02/asia/japan-islands-double-report-intl-hnk) and ScienceAlert (https://www.sciencealert.com/japan-appears-to-have-thousands-more-islands-than-it-ever-realized) corroborate the recount. (3) Wikipedia "List of islands of Japan" (https://en.wikipedia.org/wiki/List_of_islands_of_Japan) lists 14,125 as the current official count. The proposed replacement text was checked for accuracy: "more than 14,000 islands" matches 14,125, and the four main islands claim is unchanged and correct.

**Fix:**
```json
[
  {
    "field": "explanation",
    "newValue": "Japan is an archipelago of more than 14,000 islands, with four main ones forming its familiar curved chain."
  }
]
```

## 17. Question 138 — Name That Flag

**Question:** Which country's flag is this?
**Issue:** `outdated` · reviewer confidence: high · verifier verdict: **CONFIRMED**

**Problem:** The fun fact says the Indian flag must by law be made of khadi, but a 30 December 2021 amendment to the Flag Code of India also permits machine-made and polyester flags.

**Reviewer evidence:** The Flag Code of India was amended on 30 December 2021 to allow flags of machine-made cotton, polyester, wool and silk in addition to hand-spun khadi (https://en.wikipedia.org/wiki/Flag_Code_of_India; https://www.business-standard.com/amp/article/current-affairs/explained-the-flag-code-of-india-the-amendments-and-the-objections-122072501327_1.html).

**Verifier evidence:** Verified via: (1) Government of India Press Information Bureau releases confirming "The Flag Code of India, 2002 was amended vide Order dated 30.12.2021 and National Flag made of polyester or machine made Flag has been allowed" — https://www.pib.gov.in/PressReleasePage.aspx?PRID=1832937 (Salient Features of Flag Code of India, 2002), https://www.pib.gov.in/PressReleaseIframePage.aspx?PRID=1845884 (Manufacturing of National Flags), https://www.pib.gov.in/PressReleasePage.aspx?PRID=1845264 (FAQs about the Indian National Flag); (2) Wikipedia, Flag Code of India: "Khadi or hand-spun cloth was the only material allowed... but amendment to the Flag Code in year 2021 allowed the use of polyester and other machine-made fabric" — https://en.wikipedia.org/wiki/Flag_Code_of_India; (3) Independent reporting on the amendment's real-world impact on the BIS-certified khadi flag maker KKGSS — https://www.thenewsminute.com/karnataka/india-s-lone-certified-flag-making-unit-indefinite-strike-heres-why-166285 and https://thesouthfirst.com/karnataka/hold-karnataka-lone-khadi-national-flag-manufacturer-suffers-loss-with-centre-prioritising-polyester/

**Fix:**
```json
[
  {
    "field": "fun_fact",
    "newValue": "For decades the flag could legally only be made of khadi — the hand-spun cloth popularised by Mahatma Gandhi — until a 2021 amendment also allowed machine-made and polyester flags."
  }
]
```

## 18. Question 20 — Oceans & Seas

**Question:** What is the deepest ocean on Earth?
**Issue:** `outdated` · reviewer confidence: high · verifier verdict: **CONFIRMED**

**Problem:** The explanation cites 11,034 meters for the Mariana Trench, an obsolete 1957 estimate; the modern accepted depth of Challenger Deep is about 10,935 meters.

**Reviewer evidence:** NOAA and the 2021 pressure-derived survey (van Haren et al., Deep-Sea Research) put Challenger Deep at 10,935 m ±6 m; the 11,034 m figure from the 1957 Vityaz expedition is considered inaccurate (https://oceanservice.noaa.gov/facts/oceandepth.html, https://www.sciencedirect.com/science/article/pii/S0967063721001813).

**Verifier evidence:** Independently verified: (1) https://oceanservice.noaa.gov/facts/oceandepth.html — NOAA states Challenger Deep is "approximately 10,935 meters (35,876 feet) deep"; (2) https://www.sciencedirect.com/science/article/pii/S0967063721001813 — van Haren et al. 2021, revised pressure-derived depth ~10,935 m; (3) Web search corroboration: Bongiovanni et al. 2021 (10,924 ±15 m), van Haren et al. 2017 (10,925 ±12 m), and Wikipedia's Challenger Deep article identifying 11,034 m as the outdated 1957 Vityaz value considered inaccurate.

**Fix:**
```json
[
  {
    "field": "explanation",
    "newValue": "The Pacific Ocean is the deepest ocean, containing the Mariana Trench — the deepest point on Earth at approximately 10,935 meters below sea level."
  }
]
```

## 19. Question 4 — World Capitals

**Question:** What is the capital of Japan?
**Issue:** `outdated` · reviewer confidence: high · verifier verdict: **CONFIRMED**

**Problem:** The fun fact states Tokyo is the most populous metropolitan area in the world with over 37 million people, but the UN's November 2025 World Urbanization Prospects report now ranks Jakarta first (~42 million), with Dhaka second and Tokyo third (~33 million).

**Reviewer evidence:** UN DESA World Urbanization Prospects (Nov 2025) names Jakarta the world's largest city at ~42M, Tokyo third at ~33M — https://www.aljazeera.com/news/2025/11/26/indonesias-jakarta-now-the-worlds-largest-city-tokyo-falls-to-third-un and https://www.nbcnews.com/world/asia/jakarta-worlds-largest-city-tokyo-most-populated-dhaka-new-un-report-rcna245798

**Verifier evidence:** Checked UN WUP 2025 coverage independently: Al Jazeera (https://www.aljazeera.com/news/2025/11/26/indonesias-jakarta-now-the-worlds-largest-city-tokyo-falls-to-third-un) reports Jakarta 41.9M, Dhaka 36.6M, Tokyo 33.4M per UN DESA World Urbanization Prospects 2025, with Jakarta replacing Tokyo at the top. Corroborated by NBC News (https://www.nbcnews.com/world/asia/jakarta-worlds-largest-city-tokyo-most-populated-dhaka-new-un-report-rcna245798) and ArchDaily (https://www.archdaily.com/1036544/jakarta-becomes-the-worlds-most-populous-city-according-to-new-un-data), which confirm Jakarta ~42M first, Tokyo ~33M third under the UN's new Degree of Urbanization methodology. Original question data verified in /private/tmp/claude-501/-Users-jm-Webpage-Development/c97eff85-3f67-490d-855a-589a2d4949bb/scratchpad/review-batches/batch-44.json (questionId 4).

**Fix:**
```json
[
  {
    "field": "fun_fact",
    "newValue": "Tokyo was formerly known as Edo. Its metro area, home to more than 33 million people, ranked as the world's most populous for decades until a 2025 UN report put Jakarta on top."
  }
]
```

## 20. Question 928 — African Cities

**Question:** What is the capital of Kenya?
**Issue:** `factual_error_explanation` · reviewer confidence: high · verifier verdict: **CONFIRMED**

**Problem:** The explanation claims Nairobi is the most populous city in East Africa, but Dar es Salaam is larger.

**Reviewer evidence:** Tanzania's 2022 census recorded Dar es Salaam city at about 5.38 million versus Nairobi's ~4.4 million in Kenya's 2019 census; current estimates put Dar es Salaam at ~5.9M vs Nairobi ~5.6M (https://worldpopulationreview.com/cities/continent/eastern-africa, https://en.wikipedia.org/wiki/Dar_es_Salaam).

**Verifier evidence:** Checked: (1) Tanzania NBS 2022 Population and Housing Census initial results (nbs.go.tz / sensa.nbs.go.tz) — Dar es Salaam is Tanzania's most populated region at 5,383,728 (8.7% of national population). (2) Kenya National Bureau of Statistics 2019 Kenya Population and Housing Census (knbs.or.ke) — Nairobi County ~4.4 million, Kenya's most populous county. (3) World Population Review Eastern Africa cities ranking (worldpopulationreview.com/cities/continent/eastern-africa) and citypopulation.de — current estimates rank Dar es Salaam (~5.9M) above Nairobi (~5.6M) as East Africa's largest city. All sources agree Dar es Salaam exceeds Nairobi, so the original superlative is factually wrong while the softened wording in the proposed fix is supported.

**Fix:**
```json
[
  {
    "field": "explanation",
    "newValue": "Nairobi is the capital and largest city of Kenya, and one of the most populous cities in East Africa."
  }
]
```

## 21. Question 92 — East Asia Deep Dive

**Question:** The island of Taiwan is separated from mainland China by which strait?
**Issue:** `factual_error_explanation` · reviewer confidence: high · verifier verdict: **CONFIRMED**

**Problem:** The explanation states the Taiwan Strait is about 180 km wide at its narrowest point, but the narrowest width is approximately 130 km; 180 km is closer to its average width.

**Reviewer evidence:** Wikipedia and Britannica give the narrowest width as roughly 126-130 km (https://en.wikipedia.org/wiki/Taiwan_Strait, https://www.britannica.com/place/Taiwan-Strait).

**Verifier evidence:** Checked independently: (1) Wikipedia "Taiwan Strait" (https://en.wikipedia.org/wiki/Taiwan_Strait) — lead calls it "a 180-kilometer-wide strait" (typical width) but states "The narrowest part is 126 km (78 mi) wide"; infobox: min width 126 km, max width 410 km. (2) Britannica (https://www.britannica.com/place/Taiwan-Strait) — "100 miles (160 km) wide at its narrowest point" (an outlier vs. modern sources, but still contradicts 180 km). (3) WorldAtlas (https://www.worldatlas.com/straits/taiwan-strait.html) and other sources — ~130 km at narrowest between Pingtan, China and Hsinchu, Taiwan. (4) Independent haversine calculation between Pingtan Island (25.63N, 119.87E) and Taiwan coast near Hsinchu (24.90N, 120.95E) gives ~130-135 km. No source supports 180 km as the narrowest width.

**Fix:**
```json
[
  {
    "field": "explanation",
    "newValue": "The Taiwan Strait is about 130 km wide at its narrowest point."
  }
]
```

## 22. Question 11 — European Geography

**Question:** What is the highest mountain in the Alps?
**Issue:** `factual_error_explanation` · reviewer confidence: medium · verifier verdict: **CONFIRMED**

**Problem:** The explanation claims Mont Blanc is the highest mountain in Europe, but under the most widely used continental boundary Mount Elbrus (5,642 m) in the Russian Caucasus is Europe's highest peak.

**Reviewer evidence:** Mount Elbrus, 5,642 m, is generally regarded as Europe's highest mountain and is the European member of the Seven Summits (https://www.britannica.com/place/Mount-Elbrus); Mont Blanc at 4,808 m is standardly described as the highest peak in the Alps and in Western Europe.

**Verifier evidence:** Checked independently: (1) Wikipedia "Mount Elbrus" — 5,642 m, peaks lie in Europe under the Greater Caucasus watershed boundary; (2) Wikipedia "Seven Summits" — Elbrus is the European summit on both Bass and Messner lists (Messner declared it Europe's true highest in 1983, quickly accepted by the mountaineering community); (3) Wikipedia "Mont Blanc" — described as highest mountain in the Alps and Western Europe, highest in Europe outside the Caucasus; 2015 survey 4,808.7 m; (4) Adventure Alternative blog on the boundary debate — Greater Caucasus watershed is the most widely accepted boundary, placing Elbrus in Europe. Caveat noted: Britannica's Mont Blanc entry still uses the older "highest peak in Europe" framing, so the claim is contested rather than universally false, but the fix removes the contested statement without introducing any error.

**Fix:**
```json
[
  {
    "field": "explanation",
    "newValue": "Mont Blanc is the highest mountain in the Alps and in Western Europe, standing at 4,808 meters (15,774 feet) above sea level."
  }
]
```

## 23. Question 107 — North America Deep Dive

**Question:** What is the only U.S. state that lies south of the Tropic of Cancer?
**Issue:** `factual_error_explanation` · reviewer confidence: medium · verifier verdict: **CONFIRMED**

**Problem:** The explanation says Hawaii is the only state 'entirely' south of the Tropic of Cancer, but the state's Northwestern Hawaiian Islands (from French Frigate Shoals up to Kure Atoll at about 28.4 degrees N) lie north of the tropic.

**Reviewer evidence:** Kure Atoll (28°25'N) and other Northwestern Hawaiian Islands are part of the State of Hawaii and sit well north of the Tropic of Cancer (23°26'N) (https://en.wikipedia.org/wiki/Kure_Atoll); the defensible claim is that Hawaii is the only state with land south of the tropic.

**Verifier evidence:** Independently verified: (1) Kure Atoll at 28°25'N, politically part of the State of Hawaii, managed as a state wildlife sanctuary by Hawaii DLNR/DOFAW (https://en.wikipedia.org/wiki/Kure_Atoll, https://www.papahanaumokuakea.gov/visit/kure.html, https://dlnr.hawaii.gov/dar/files/2014/04/NWHI_Kure_Atoll_AMP.pdf); Midway is the only NWHI excluded from the state. (2) Tropic of Cancer at ~23°26'N (https://en.wikipedia.org/wiki/Tropic_of_Cancer). (3) Main Hawaiian Islands lie between ~19° and 22°N, south of the tropic (https://www.britannica.com/place/Hawaii-state/Climate, https://www.worldatlas.com/maps/united-states/hawaii). (4) No other state has land south of the tropic: southernmost contiguous-U.S. land is Ballast Key, FL at ~24°31'N (https://en.wikipedia.org/wiki/Southernmost_point_buoy).

**Fix:**
```json
[
  {
    "field": "explanation",
    "newValue": "Hawaii is the only state with land south of the Tropic of Cancer, placing its main islands firmly in the tropics."
  }
]
```

## 24. Question 67 — Oceania Overview

**Question:** Which Pacific island nation's capital is Suva?
**Issue:** `factual_error_explanation` · reviewer confidence: high · verifier verdict: **CONFIRMED**

**Problem:** The explanation calls Suva the largest city in the South Pacific outside Australia and New Zealand, but Port Moresby is substantially larger and holds that title.

**Reviewer evidence:** Port Moresby has roughly 383,000–391,000 residents and is described as the largest city in the South Pacific outside of Australia and New Zealand (https://en.wikipedia.org/wiki/Port_Moresby), versus Suva's roughly 93,000 city / 185,000 metro population.

**Verifier evidence:** Checked independently: (1) https://en.wikipedia.org/wiki/Port_Moresby — "Port Moresby had 364,145 inhabitants" (2011 census), "756,754 at the 2024 census", and "is one of the largest cities in the southwestern Pacific (along with Jayapura) outside of Australia and New Zealand." (2) https://en.wikipedia.org/wiki/Suva — "As of the 2017 census, Suva had a population of 93,970" and metro area "185,913"; the article does not claim Suva is the largest city in the South Pacific, only "the largest and most sophisticated city in the Pacific Islands" in a historical-development sense. (3) https://worldpopulationreview.com/cities/papua-new-guinea/port-moresby — 2025 metro estimate ~432,000. Port Moresby exceeds Suva by every measure, refuting the original explanation's superlative.

**Fix:**
```json
[
  {
    "field": "explanation",
    "newValue": "Suva, on the southeast coast of Viti Levu, is the capital of Fiji and one of the largest urban centres among the Pacific island nations."
  }
]
```

## 25. Question 928 — African Cities

**Question:** What is the capital of Kenya?
**Issue:** `factual_error_funfact` · reviewer confidence: medium · verifier verdict: **CONFIRMED**

**Problem:** The fun fact says Nairobi is 'surrounded by' Nairobi National Park, but the park only borders the city on its southern side.

**Reviewer evidence:** Nairobi National Park lies about 7 km south of the city center and adjoins the city only along its northern boundary; the city is not encircled by the park (https://en.wikipedia.org/wiki/Nairobi_National_Park).

**Verifier evidence:** Wikipedia, Nairobi National Park (https://en.wikipedia.org/wiki/Nairobi_National_Park): park "established in 1946 about 7 km (4.3 mi) south of Nairobi"; electric fencing on its northern, eastern, and western boundaries (the side facing the city), southern boundary formed by the Mbagathi River opening to dispersal areas — i.e., the park borders the city, it does not encircle it. Same article confirms lions present and describes the park as "one of Kenya's most successful rhinoceros sanctuaries" ("Kifaru Ark"). Elevation ~1,795 m (5,889 ft) confirmed via multiple sources including Nairobi News (https://nairobinews.co.ke/altitude-of-nairobi/) and kenyatourism.in altitude/geography page; this figure was already in the original text and is retained by the fix. The "cool water" Maasai etymology (from Enkare Nairobi) is the standard attested origin and is unchanged between original and fix.

**Fix:**
```json
[
  {
    "field": "fun_fact",
    "newValue": "Nairobi means \"cool water\" in the Maasai language. The city sits at an elevation of about 1,795 meters above sea level and borders Nairobi National Park, where lions and rhinos roam just outside the city."
  }
]
```

## 26. Question 33 — Antarctica: The Frozen Continent

**Question:** What is the name of the US research station located exactly at the geographic South Pole?
**Issue:** `factual_error_funfact` · reviewer confidence: high · verifier verdict: **CONFIRMED**

**Problem:** The fun fact claims the station itself must be physically relocated every few years, but the station is never moved — only the geographic South Pole marker is repositioned (annually) as the ice sheet drifts about 10 meters per year.

**Reviewer evidence:** The US Antarctic Program and NSF describe an annual New Year's Day ceremony in which a new pole marker is placed because the ice sheet moves roughly 10 m/year; the elevated station building (opened 2008) sits on jackable columns to cope with snow accumulation and has never been periodically relocated (https://www.usap.gov and https://www.nsf.gov/news/special_reports/livingsouthpole/marker.jsp).

**Verifier evidence:** Checked Wikipedia's Amundsen-Scott South Pole Station article (https://en.wikipedia.org/wiki/Amundsen%E2%80%93Scott_South_Pole_Station): station is not relocated; elevated station on jackable columns dedicated Jan 12, 2008. Wikipedia's South Pole article and IFLScience (https://www.iflscience.com/antarctic-scientists-have-just-moved-the-south-pole-literally-82141) and Explorersweb (https://explorersweb.com/a-tradition-since-1959-scientists-move-the-south-pole/) confirm the geographic South Pole marker is repositioned each year on New Year's Day because the ice drifts ~10 m/year toward the Weddell Sea. NSF Office of Polar Programs page (https://www.nsf.gov/geo/opp/support/southp.jsp) corroborates station history: successive stations (1957 original, 1975 dome, 2008 elevated) were new constructions, not periodic relocations of the same building.

**Fix:**
```json
[
  {
    "field": "fun_fact",
    "newValue": "The ice sheet beneath the station drifts toward the ocean at about 10 meters per year, so a new marker pinpointing the exact geographic South Pole is placed every New Year's Day."
  }
]
```

## 27. Question 13 — European Geography

**Question:** What body of water separates England from France?
**Issue:** `factual_error_funfact` · reviewer confidence: high · verifier verdict: **CONFIRMED**

**Problem:** The fun fact wrongly calls the Channel Tunnel the longest undersea rail tunnel in the world at 50.45 km (Japan's Seikan Tunnel is longer at 53.85 km; the Channel Tunnel only holds the record for longest undersea section, 37.9 km) and says 20 million vehicles use it yearly when the figure of about 20 million refers to passengers.

**Reviewer evidence:** Seikan Tunnel is 53.85 km long, exceeding the Channel Tunnel's 50.45 km, while the Channel Tunnel has the longest undersea section of any tunnel at 37.9 km (https://en.wikipedia.org/wiki/Seikan_Tunnel, https://en.wikipedia.org/wiki/Channel_Tunnel). Combined Eurostar and LeShuttle traffic was about 20-21 million passengers per year, not vehicles (https://www.statista.com/statistics/304968/number-of-passengers-travelling-on-the-eurostar-and-le-shuttle-in-the-united-kingdom/).

**Verifier evidence:** Independently verified via web search: Wikipedia's Seikan Tunnel article (https://en.wikipedia.org/wiki/Seikan_Tunnel) and Britannica (https://www.britannica.com/topic/Seikan-Tunnel) confirm Seikan is 53.85 km with a 23.3 km undersea segment, longer overall than the Channel Tunnel, which has the longer undersea section at 37.9 km. Getlink/Eurotunnel (https://www.getlinkgroup.com/en/our-group/eurotunnel/) reports more than 518 million people and about 106 million vehicles since 1994 (about 3.5 million vehicles/year, not 20 million), and Statista (https://www.statista.com/statistics/304968/) shows an average of 20.9 million annual passengers on Eurostar/Le Shuttle 2013-2019, matching the ~20 million passengers figure in the fix.

**Fix:**
```json
[
  {
    "field": "fun_fact",
    "newValue": "The Channel Tunnel (Chunnel), opened in 1994, has the longest undersea section of any tunnel in the world — 37.9 km of its 50.45 km length runs beneath the sea. Around 20 million passengers travel through it every year."
  }
]
```

## 28. Question 14 — European Geography

**Question:** Which European country has the most islands?
**Issue:** `factual_error_funfact` · reviewer confidence: medium · verifier verdict: **CONFIRMED**

**Problem:** The fun fact says Finland's roughly 179,000 islands are the second most in Europe, but widely cited counts rank Norway second with about 239,000 islands, putting Finland third.

**Reviewer evidence:** Standard island counts list Sweden first (267,570), Norway second (239,057), and Finland third (178,947) (https://en.wikipedia.org/wiki/List_of_countries_by_number_of_islands, https://www.statista.com/chart/15364/the-estimated-number-of-islands-by-country/).

**Verifier evidence:** Independently verified via: (1) Wikipedia "List of countries by number of islands" (https://en.wikipedia.org/wiki/List_of_countries_by_number_of_islands) — Sweden 267,570; Norway 239,057 (islands >10 m², per Kartverket); Finland listed at 198,146 in one revision, but either count leaves Finland below Norway. (2) Kartverket (Norwegian Mapping Authority) figure of 239,057 islands + 81,192 islets along Norway's coastline, cited in Geography of Norway (https://en.wikipedia.org/wiki/Geography_of_Norway). (3) National Land Survey of Finland figures: 187,888 lakes (>500 m²) and 178,947 total islands (https://finland.fi/?fact=16769, https://en.wikipedia.org/wiki/List_of_islands_of_Finland). (4) Statista chart (https://www.statista.com/chart/15364/the-estimated-number-of-islands-by-country/) ranks Sweden 1st, Norway 2nd, Finland 3rd. All checked sources agree Finland is third in Europe, not second, and all numeric values in the proposed fix match authoritative figures.

**Fix:**
```json
[
  {
    "field": "fun_fact",
    "newValue": "Finland, often called \"the land of a thousand lakes,\" has approximately 188,000 lakes and 179,000 islands — third most in Europe, behind Sweden and Norway (about 239,000 islands)."
  }
]
```

## 29. Question 162 — Famous World Landmarks

**Question:** Which landmark is shown in this image?
**Issue:** `factual_error_funfact` · reviewer confidence: high · verifier verdict: **CONFIRMED**

**Problem:** The fun fact says most moai have bodies buried underground with only their heads visible, but only the subset of statues on the Rano Raraku quarry slopes are buried to the shoulders; most of the island's ~900 moai stand or lie fully exposed.

**Reviewer evidence:** Wikipedia's Moai and Rano Raraku articles: all moai have full bodies, and the 'buried heads' misconception comes from the statues on Rano Raraku's slopes (a few hundred at most out of ~900), which were buried by sediment; moai erected on ahu platforms are fully visible. https://en.wikipedia.org/wiki/Moai and https://en.wikipedia.org/wiki/Rano_Raraku

**Verifier evidence:** Wikipedia "Moai" (https://en.wikipedia.org/wiki/Moai): "many of the images for the island showing upright moai are of the statues on the slopes of Rano Raraku (many of which are buried to their shoulders), which has led to a popular misconception that they do not have bodies"; 900+ moai total, nearly half still at the Rano Raraku quarry, hundreds set on ahu platforms (fully visible). Wikipedia "Rano Raraku" (https://en.wikipedia.org/wiki/Rano_Raraku): statues outside the quarry are "partially buried to their shoulders in the spoil from the quarry." UCLA Easter Island Statue Project (https://www.eisp.org/): excavations at Rano Raraku revealed full torsos gradually buried by sediment over centuries, with carvings preserved by the burial — confirming the wording of the proposed fix.

**Fix:**
```json
[
  {
    "field": "fun_fact",
    "newValue": "The famous 'heads' on the slopes of the Rano Raraku quarry actually have full bodies — centuries of sediment simply buried them up to their shoulders."
  }
]
```

## 30. Question 165 — Famous World Landmarks

**Question:** Which landmark is shown in this image?
**Issue:** `factual_error_funfact` · reviewer confidence: high · verifier verdict: **CONFIRMED**

**Problem:** The fun fact claims Cambodia's is the only national flag in the world to feature a building, but the flags of Portugal, San Marino, and Spain also depict buildings.

**Reviewer evidence:** Wikipedia (Flag of Cambodia): Cambodia's flag is one of only four state flags to incorporate a depiction of a building, the others being Portugal, San Marino, and Spain. https://en.wikipedia.org/wiki/Flag_of_Cambodia

**Verifier evidence:** Checked Wikipedia "Flag of Cambodia" (https://en.wikipedia.org/wiki/Flag_of_Cambodia) directly via WebFetch: "It is one of only four national flags in the world to feature a building, alongside those of Portugal, San Marino, and Spain." A broader web search (results including koryogroup.com and worldcountryflags.com) corroborated that Portugal, San Marino, and Spain (and by some counts Afghanistan historically) feature buildings on their state flags, e.g., San Marino's three towers and the castles in the Spanish and Portuguese coats of arms. No authoritative source supports the "only" claim as written.

**Fix:**
```json
[
  {
    "field": "fun_fact",
    "newValue": "Cambodia's national flag prominently features Angkor Wat — one of only a handful of flags in the world to depict a building."
  }
]
```

## 31. Question 49 — Middle East Ancient Sites

**Question:** What ancient Sumerian city in southern Iraq is believed to be the biblical birthplace of Abraham?
**Issue:** `factual_error_funfact` · reviewer confidence: high · verifier verdict: **CONFIRMED**

**Problem:** The fun fact claims the attendants in Ur's Royal Tombs were 'buried alive', but excavator Leonard Woolley theorised they took poison, and modern CT-scan analysis shows they were killed by blunt force trauma to the head before burial — no interpretation supports live burial.

**Reviewer evidence:** Penn Museum forensic re-examination (Baadsgaard et al., 'Human sacrifice and intentional corpse preservation in the Royal Cemetery of Ur', Antiquity 2011) found perimortem skull fractures indicating lethal blows before burial; summarised at https://en.wikipedia.org/wiki/Royal_Cemetery_at_Ur.

**Verifier evidence:** Checked independently: (1) Baadsgaard et al. 2011, Antiquity — 'Human sacrifice and intentional corpse preservation in the Royal Cemetery of Ur' (via academia.edu/4512596 and researchgate.net/publication/286004704): CT/forensic analysis found victims died of blunt force trauma to the skull, with heat and mercury used for corpse preservation before ceremonial arrangement — refuting both peaceful poisoning and live burial. (2) Companion piece 'Bludgeoned, Burned, and Beautified: Reevaluating Mortuary Practices in the Royal Cemetery of Ur' (academia.edu/4512613) — same finding. (3) Wikipedia 'Royal Cemetery at Ur' (fetched directly): Woolley excavated 1922-1934 and believed attendants voluntarily drank poison; later evidence showed blunt force trauma indicating forcible killing; attendants included soldiers, musicians, and servant women arranged in neat rows. (4) Multiple secondary sources (Ancient Origins on the Great Death Pit PG1237 with ~74 attendants) corroborate. No source found supporting the original 'buried alive' wording.

**Fix:**
```json
[
  {
    "field": "fun_fact",
    "newValue": "Excavations of Ur's Royal Tombs in the 1920s revealed evidence of mass human sacrifice — dozens of servants and soldiers were buried alongside royalty for the afterlife. Modern CT scans suggest they were killed by blows to the head, not poison as first believed."
  }
]
```

## 32. Question 18 — Oceans & Seas

**Question:** What is the largest ocean in the world?
**Issue:** `factual_error_funfact` · reviewer confidence: high · verifier verdict: **CONFIRMED**

**Problem:** The fun fact gives the Mariana Trench depth as 11,034 meters, an outdated 1957 Soviet sonar figure that modern surveys have shown to be an overestimate.

**Reviewer evidence:** The currently accepted maximum depth of the Challenger Deep is 10,935 m (±6 m), from pressure-corrected submersible measurements published by NOAA (https://repository.library.noaa.gov/view/noaa/33477); Wikipedia's Challenger Deep article notes the 11,034 m Vityaz figure is considered an overestimate (https://en.wikipedia.org/wiki/Challenger_Deep).

**Verifier evidence:** Independently verified via WebSearch: (1) NOAA repository copy of the 2021 peer-reviewed study 'Revised depth of the Challenger Deep from submersible transects' (https://repository.library.noaa.gov/view/noaa/33477; also ScienceDirect https://www.sciencedirect.com/science/article/pii/S0967063721001813) reports deepest observed seafloor depth of 10,935 m (±6 m, 95% CI). (2) NOAA Ocean Service (https://oceanservice.noaa.gov/facts/oceandepth.html) uses ~10,935 m for Challenger Deep. (3) Marine Geodesy paper 'So, How Deep Is the Mariana Trench?' (https://www.tandfonline.com/doi/full/10.1080/01490419.2013.837849) documents the 11,034 m figure as the 1957 Vityaz sounding, taken at the limit of the echosounder's range, with later surveys (Takuyō 1984: 10,924 m; Kaiko 1995: 10,911 m) all shallower. (4) Wikipedia's Challenger Deep article gives 10,935 ± 6 m as maximum known depth and notes the Vityaz figure is considered an overestimate.

**Fix:**
```json
[
  {
    "field": "fun_fact",
    "newValue": "The Pacific Ocean is so large that all of Earth's continents could fit inside it. It contains the Mariana Trench, the deepest known point on Earth at about 10,935 meters deep."
  }
]
```

## 33. Question 449 — Regional Geography

**Question:** Which European region includes Norway, Sweden, and Denmark?
**Issue:** `factual_error_funfact` · reviewer confidence: high · verifier verdict: **CONFIRMED**

**Problem:** The fun fact implies Finland and Iceland are only informally counted as Nordic countries, when they are Nordic by the standard definition; it is the term Scandinavia that is sometimes loosely broadened to include them.

**Reviewer evidence:** The Nordic countries are formally defined as Denmark, Finland, Iceland, Norway, and Sweden (plus associated territories) — see the Nordic Council (norden.org) and Encyclopaedia Britannica's entries on Scandinavia and the Nordic countries, which note that 'Scandinavia' strictly means Denmark, Norway, and Sweden while 'Nordic countries' always includes Finland and Iceland.

**Verifier evidence:** Checked independently: (1) Nordic Council official site, norden.org "Facts about the Nordic countries" — defines the Nordic Region as Denmark, Norway, Sweden, Finland, Iceland plus the Faroe Islands, Greenland, and Åland; in everyday use the Nordic countries are Denmark, Finland, Iceland, Norway, and Sweden. (2) Encyclopaedia Britannica "Nordic countries" (britannica.com/place/Nordic-countries) — "Nordic countries" is used unambiguously for Denmark, Norway, Sweden, Finland, and Iceland; "Scandinavia" ordinarily denotes Denmark, Norway, and Sweden as a subset. (3) Encyclopaedia Britannica "Scandinavia" (britannica.com/place/Scandinavia) — Scandinavia generally denotes Norway, Sweden, and Denmark; some authorities loosely include Finland (geologic/economic grounds) and Iceland/Faroes (linguistic grounds). These confirm Finland and Iceland are formally Nordic, and that it is "Scandinavia" that is sometimes loosely broadened — exactly as the reviewer claimed and as the proposed fix states.

**Fix:**
```json
[
  {
    "field": "fun_fact",
    "newValue": "In everyday usage, Finland and Iceland are sometimes loosely included in Scandinavia, though strictly they belong to the broader group of Nordic countries."
  }
]
```

## 34. Question 117 — South America Deep Dive

**Question:** Which region covers the southern tip of Argentina and Chile?
**Issue:** `factual_error_funfact` · reviewer confidence: medium · verifier verdict: **CONFIRMED**

**Problem:** The fun fact flatly calls Ushuaia the southernmost city in the world, but Chile's Puerto Williams lies farther south and is officially recognized as a city by Chile, making the title disputed.

**Reviewer evidence:** Puerto Williams (54°56'S) is south of Ushuaia (54°48'S) and is identified as the world's southernmost city by Chilean authorities and a Chile–Argentina bilateral agreement; the 'southernmost city' title is disputed among Ushuaia, Puerto Williams, and Punta Arenas — https://en.wikipedia.org/wiki/Southernmost_settlements and https://en.wikipedia.org/wiki/Puerto_Williams

**Verifier evidence:** Checked https://en.wikipedia.org/wiki/Puerto_Williams directly via WebFetch: confirms latitude 54°56'S (south of Ushuaia at 54°48'S), the 2019 INE reclassification of Puerto Williams as a city, and that "Chilean and Argentine media, a bilateral agreement between Chile and Argentina, and the Puerto Williams administration identify it as the southernmost city in the world," with the title disputed among Ushuaia, Puerto Williams, and Punta Arenas. Corroborated by https://en.wikipedia.org/wiki/Southernmost_settlements, https://pedalchile.com/blog/puerto-williams (details the March 29, 2019 INE redefinition), and https://worldpopulationreview.com/world-city-rankings/southernmost-cities-in-the-world. Population of Puerto Williams is roughly 1,600-2,900, consistent with the fix's description of it as "tiny."

**Fix:**
```json
[
  {
    "field": "fun_fact",
    "newValue": "Ushuaia, in Argentine Patagonia, is famous as the 'southernmost city in the world' — though Chile's tiny Puerto Williams lies even farther south."
  }
]
```

## 35. Question 60 — South East Asia Adventure

**Question:** Angkor Wat is located in which country?
**Issue:** `factual_error_funfact` · reviewer confidence: high · verifier verdict: **MODIFIED**

**Problem:** The fun fact claims Cambodia is the only country to feature a building on its flag, but the flags of Portugal, San Marino, and Spain also feature buildings; Cambodia's distinction is that the building is the flag's central design element.

**Reviewer evidence:** Wikipedia's 'Flag of Cambodia' article notes it is one of only four national flags featuring a building, alongside Portugal, San Marino, and Spain — https://en.wikipedia.org/wiki/Flag_of_Cambodia

**Verifier evidence:** Wikipedia "Flag of Cambodia" (https://en.wikipedia.org/wiki/Flag_of_Cambodia), fetched directly, states verbatim: "It is one of only four national flags in the world to feature a building, alongside those of Portugal, San Marino, and Spain." Britannica (https://www.britannica.com/topic/flag-of-Cambodia) describes the flag as featuring "in white, the main building of Angkor Wat" but makes no "only building" uniqueness claim. Secondary sources (koryogroup.com/blog/flags-of-the-world-cambodia-flag, worldcountryflags.com/flag-of-cambodia) count up to six flags with buildings (adding Bolivia and pre-2021 Afghanistan). San Marino's flag centers its coat of arms depicting the three towers (Guaita, Cesta, Montale), which undermines the reviewer's proposed "only flag with a building as its central design element" wording — no authoritative source supports that specific claim.

**Fix:**
```json
[
  {
    "field": "fun_fact",
    "newValue": "Angkor Wat appears at the center of Cambodia's national flag — one of only a handful of national flags to feature a building, alongside Portugal, San Marino, and Spain."
  }
]
```

## 36. Question 1015 — World Cup Flags Part 3 of 4

**Question:** Which 2026 FIFA World Cup country is represented by this flag?
**Issue:** `factual_error_funfact` · reviewer confidence: high · verifier verdict: **CONFIRMED**

**Problem:** The fun fact says Egypt opened against Belgium in Vancouver, but that match was played at Lumen Field in Seattle; Vancouver hosted New Zealand's Group G matches.

**Reviewer evidence:** Belgium 1-1 Egypt was played June 15, 2026 at Lumen Field, Seattle; Vancouver (BC Place) hosted New Zealand vs Egypt and New Zealand vs Belgium — https://en.wikipedia.org/wiki/2026_FIFA_World_Cup_Group_G

**Verifier evidence:** Checked Wikipedia's 2026 FIFA World Cup Group G page (https://en.wikipedia.org/wiki/2026_FIFA_World_Cup_Group_G) directly via fetch: Belgium vs Egypt was June 15, 2026 at Lumen Field, Seattle (1-1), and it was Egypt's first match; BC Place in Vancouver hosted New Zealand vs Egypt (June 21) and New Zealand vs Belgium (June 26). Corroborated by web search results including FIFA's own match page listing "Belgium v Egypt 1-1" (https://www.fifa.com/en/match-centre/match/17/285023/289273/400021478) and coverage noting Group G venues were SoFi Stadium (LA), Lumen Field (Seattle), and BC Place (Vancouver), with Belgium-Egypt in Seattle (ESPN, Sky Sports, Fox Sports search results). Question data read from /private/tmp/claude-501/-Users-jm-Webpage-Development/c97eff85-3f67-490d-855a-589a2d4949bb/scratchpad/review-batches/batch-51.json (questionId 1015).

**Fix:**
```json
[
  {
    "field": "fun_fact",
    "newValue": "Egypt is in Group G and opens against Belgium in Seattle."
  }
]
```

## 37. Question 1217 — World Cup Geography: Which Continent Is This Team From? Part 1

**Question:** Which continent or world region is this World Cup team from: Canada?
**Issue:** `factual_error_funfact` · reviewer confidence: high · verifier verdict: **CONFIRMED**

**Problem:** The fun fact says Canada is the second-largest country "by land area," but Canada is second only by total area; by land area (excluding water) it ranks fourth, behind Russia, China, and the United States.

**Reviewer evidence:** CIA World Factbook / Wikipedia "List of countries and dependencies by area": land area figures are Russia ~16.38M km2, China ~9.33M km2, United States ~9.15M km2, Canada ~9.09M km2; Canada is second (9.98M km2) only when its large freshwater area is included in total area. https://en.wikipedia.org/wiki/List_of_countries_and_dependencies_by_area

**Verifier evidence:** Checked Wikipedia "List of countries and dependencies by area" (https://en.wikipedia.org/wiki/List_of_countries_and_dependencies_by_area), which sources CIA World Factbook figures: land areas Russia 16,376,870 km², China 9,326,410 km², US 9,147,593 km², Canada 9,093,507 km² (4th by land); Canada total area 9,984,670 km² (2nd by total, behind Russia 17,098,246 km²). Corroborated via web search results including Britannica (https://www.britannica.com/place/Canada and its largest-countries list), which state Canada is second in total area after Russia but fourth if land surface only is counted (China 2nd, US 3rd, Canada 4th), due to Canada having the world's largest area of freshwater lakes. Under any water-accounting convention, Canada is never 2nd by land area alone, so the original wording is unambiguously incorrect and the proposed fix is accurate.

**Fix:**
```json
[
  {
    "field": "fun_fact",
    "newValue": "Canada is one of the 2026 host nations and is the second-largest country in the world by total area."
  }
]
```

## 38. Question 1352 — Capitals of Eastern Europe

**Question:** What is the capital city of Moldova?
**Issue:** `wording` · reviewer confidence: high · verifier verdict: **CONFIRMED**

**Problem:** This question is an exact duplicate of questionId 1318 in the same quiz (identical text, options, correct answer, explanation, and fun fact), so players would be asked the same question twice.

**Reviewer evidence:** batch-08.json shows questionId 1318 and questionId 1352, both in 'Capitals of Eastern Europe', with byte-identical text ('What is the capital city of Moldova?'), options, correctOption, explanation, and funFact.

**Verifier evidence:** Direct inspection of /private/tmp/claude-501/-Users-jm-Webpage-Development/c97eff85-3f67-490d-855a-589a2d4949bb/scratchpad/review-batches/batch-08.json confirms 1318 and 1352 are identical in all fields, and that no other question in the quiz covers Serbia. Web verification: Britannica (britannica.com/place/Belgrade) confirms Belgrade is Serbia's capital located at the confluence of the Sava and Danube rivers; Wikipedia (en.wikipedia.org/wiki/Belgrade) and the City of Belgrade official site (beograd.rs/en/discover-belgrade/a2014/History.html) confirm Belgrade is one of Europe's oldest continuously inhabited cities, with the Vinča culture in the Belgrade area dating to the 6th millennium BC, followed by Celtic Singidun and Roman settlement.

**Fix:**
```json
[
  {
    "field": "text",
    "newValue": "What is the capital city of Serbia?"
  },
  {
    "field": "options",
    "newValue": [
      "Novi Sad",
      "Belgrade",
      "Niš",
      "Kragujevac"
    ]
  },
  {
    "field": "correct_option",
    "newValue": 1
  },
  {
    "field": "explanation",
    "newValue": "Belgrade is the capital city of Serbia and lies at the confluence of the Sava and Danube rivers."
  },
  {
    "field": "fun_fact",
    "newValue": "Belgrade is one of Europe’s oldest continuously inhabited cities, with a history stretching back thousands of years."
  }
]
```

## 39. Question 226 — Countries and Borders

**Question:** Which country is bordered by Norway to the west and Russia to the east?
**Issue:** `wording` · reviewer confidence: high · verifier verdict: **CONFIRMED**

**Problem:** Finland's western neighbor is Sweden, not Norway (Norway borders Finland to the north), and 'Norway to the west' actually describes Sweden — one of the distractor options — making the question misleading.

**Reviewer evidence:** Finland shares land borders with Sweden (west), Norway (north), and Russia (east); Sweden is the country bordered by Norway to the west. Source: CIA World Factbook, Finland entry (https://www.cia.gov/the-world-factbook/countries/finland/). The question's own explanation confirms this: 'Finland lies between Sweden and Russia.'

**Verifier evidence:** Checked CIA World Factbook Finland entry (https://www.cia.gov/the-world-factbook/about/archives/2021/countries/finland): Finland's land boundaries are Norway 709 km, Sweden 545 km, Russia 1,309 km, with Norway to the north, Sweden to the northwest/west, and Russia to the east. Britannica's Finland entry (https://www.britannica.com/place/Finland) states Finland is bordered to the north by Norway, to the east by Russia, and to the northwest by Sweden. Sweden's only land neighbors are Norway and Finland (no Russian border), so "Norway to the west and Russia to the east" fits no country, while "Sweden to the west and Russia to the east" correctly and uniquely describes Finland among the options in /private/tmp/claude-501/-Users-jm-Webpage-Development/c97eff85-3f67-490d-855a-589a2d4949bb/scratchpad/review-batches/batch-21.json (questionId 226).

**Fix:**
```json
[
  {
    "field": "text",
    "newValue": "Which country is bordered by Sweden to the west and Russia to the east?"
  }
]
```

## 40. Question 104 — North America Deep Dive

**Question:** What is the largest bay in the world by area, located in Canada?
**Issue:** `wording` · reviewer confidence: high · verifier verdict: **MODIFIED**

**Problem:** The question's premise is false: the largest bay in the world by area is the Bay of Bengal (about 2.17 million km2), not Hudson Bay (about 1.23 million km2); Hudson Bay holds the record for longest shoreline, not area.

**Reviewer evidence:** Guinness World Records lists the Bay of Bengal as the largest bay by area at 2,172,000 km2 (https://www.guinnessworldrecords.com/world-records/66653-largest-bay-by-area); Hudson Bay is 1,230,000 km2 and is widely cited as second-largest by area but largest by shoreline length.

**Verifier evidence:** Checked directly: (1) Guinness World Records "Largest bay by area" (https://www.guinnessworldrecords.com/world-records/66653-largest-bay-by-area) — Bay of Bengal, 2,172,000 km²; Hudson Bay not mentioned. (2) Guinness "Largest bay by shoreline (not including tributaries)" (https://www.guinnessworldrecords.com/world-records/116543-largest-bay-by-shoreline-not-including-tributaries) — Hudson Bay, 12,268 km shoreline, area 1,233,000 km². (3) Guinness "Largest bay by shoreline (including tributaries)" (https://www.guinnessworldrecords.com/world-records/114741-largest-bay-by-shoreline-including-tributaries) — Chesapeake Bay, USA, 18,804 km. Corroborating web results (Wikipedia "Bay", WorldAtlas "Hudson Bay") agree Bay of Bengal is largest by area and Hudson Bay second. Chesapeake Bay's including-tributaries record makes the reviewer's shoreline-based rewrite ambiguous because Chesapeake Bay is an answer option.

**Fix:**
```json
[
  {
    "field": "text",
    "newValue": "What is the largest bay in North America by area?"
  },
  {
    "field": "explanation",
    "newValue": "Hudson Bay covers about 1.23 million km², making it the largest bay in North America and the second-largest in the world by area, after the Bay of Bengal."
  }
]
```

## 41. Question 126 — Oceania Overview

**Question:** Which two animals appear on the Australian coat of arms?
**Issue:** `wording` · reviewer confidence: medium · verifier verdict: **CONFIRMED**

**Problem:** The fun fact 'Both animals only appear on Australian currency too' is garbled — 'only' contradicts 'too' and falsely suggests the animals appear nowhere else — and the emu features on the 50-cent coin only as part of the coat of arms.

**Reviewer evidence:** The standard Australian 50-cent coin bears the full coat of arms (kangaroo and emu), and the $1 coin features a mob of kangaroos (Royal Australian Mint, https://www.ramint.gov.au/).

**Verifier evidence:** Checked independently: (1) Royal Australian Mint pages confirm the $1 coin's reverse is Stuart Devlin's "Mob of Roos" kangaroo design since 1984 (https://www.ramint.gov.au/about-us/whats-new/check-your-change-mob-six-roos and https://www.ramint.gov.au/media-releases/special-1-coin-hops-circulation-2026); (2) Numista (https://en.numista.com/catalogue/pieces904.html) and Museums Victoria (https://collections.museumsvictoria.com.au/items/70208) confirm the standard dodecagonal 50-cent coin carries the full Australian Coat of Arms with kangaroo and emu shield supporters, i.e. the emu appears only as part of the coat of arms and the kangaroo is on the 50c as well; (3) the original garbled wording was verified directly in batch-31.json, questionId 126.

**Fix:**
```json
[
  {
    "field": "fun_fact",
    "newValue": "Both animals also appear on Australian coins — the $1 coin features a mob of kangaroos, and the 50-cent coin carries the full coat of arms with the kangaroo and emu."
  }
]
```
