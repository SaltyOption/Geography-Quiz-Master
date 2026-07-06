-- Quiz accuracy fixes — generated from the 2026-07-06 multi-agent review.
-- See REPORT.md (same folder) for evidence per change. Review before applying.
-- Apply:  psql "$DATABASE_URL" -f fixes.sql
BEGIN;

-- #1 [wrong_answer] World Cup Geography: Which Continent Is This Team From? Part 2: The marked correct answer is Asia (index 3), but Ecuador is in South America (index 0), as the question's own 
UPDATE questions SET correct_option = 0, updated_at = now() WHERE id = 1232;

-- #2 [wrong_answer] World Cup Geography: Which Continent Is This Team From? Part 3: The marked correct answer is South America (index 2), but Belgium is in Europe (index 1), as the question's ow
UPDATE questions SET correct_option = 1, updated_at = now() WHERE id = 1237;

-- #3 [ambiguous_options] African Nations: With both Arabic and Swahili as options, the marked answer (Arabic) is not the only defensible one: Swahili is
UPDATE questions SET text = 'Which language has the most native speakers in Africa?', explanation = 'Arabic has more native speakers than any other language in Africa, with roughly 150 million, mainly in North African countries. Swahili has far fewer native speakers but is used by well over 100 million people, mostly as a second language across East and Central Africa.', updated_at = now() WHERE id = 31;

-- #4 [ambiguous_options] Capitals of South America: The question asks for "the capital city of Bolivia" but the options include both Sucre (the constitutional cap
UPDATE questions SET text = 'What is the constitutional capital of Bolivia?', updated_at = now() WHERE id = 1124;

-- #5 [ambiguous_options] Countries and Borders: China and Russia are both commonly counted as bordering 14 countries (Russia up to 16 if Abkhazia and South Os
UPDATE questions SET options = ARRAY['China', 'India', 'Brazil', 'Germany'], updated_at = now() WHERE id = 208;

-- #6 [ambiguous_options] European Geography: Russia is offered as an option, and Russia borders 14 countries (far more than Germany's 9), so a knowledgeabl
UPDATE questions SET options = ARRAY['Germany', 'Italy', 'France', 'Austria'], updated_at = now() WHERE id = 12;

-- #7 [ambiguous_options] North America Basics: The Rockies do not run along the western coast — they are an inland range — while two other options (the Casca
UPDATE questions SET text = 'Which major mountain range stretches through western North America from British Columbia to New Mexico?', updated_at = now() WHERE id = 69;

-- #8 [ambiguous_options] Oceania Deep Dive: Authoritative sources disagree on whether Tuvalu or Nauru has the smaller population, and the options also inc
UPDATE questions SET text = 'What is the smallest country in Oceania by land area?', correct_option = 0, explanation = 'Nauru covers just 21 square kilometres, making it the world''s smallest island nation.', fun_fact = 'Nauru has no official capital city — government offices are based in the Yaren district.', updated_at = now() WHERE id = 99;

-- #9 [ambiguous_options] Oceans & Seas: The Dead Sea is technically a hypersaline lake (as the explanation itself states), so a knowledgeable player c
UPDATE questions SET text = 'Which of these bodies of water is the saltiest?', updated_at = now() WHERE id = 19;

-- #10 [ambiguous_options] Oceans & Seas: The Arabian Sea (~3.86 million km²) is larger by area than the marked answer, the South China Sea (~3.5 millio
UPDATE questions SET options = ARRAY['Mediterranean Sea', 'Caribbean Sea', 'South China Sea', 'Bering Sea'], explanation = 'The South China Sea is generally considered the largest true sea in the world, covering approximately 3.5 million square kilometers. Larger bodies of water like the Philippine Sea are usually classed as open regions of the ocean rather than seas partly enclosed by land.', updated_at = now() WHERE id = 22;

-- #11 [ambiguous_options] World Capitals II: The question asks for "the capital city" of South Africa but the options include both Pretoria (administrative
UPDATE questions SET text = 'What is the administrative capital of South Africa, where the executive branch is based?', updated_at = now() WHERE id = 272;

-- #12 [ambiguous_options] World Capitals II: The question asks for "the capital city" of South Africa but the options include both Pretoria (executive capi
UPDATE questions SET text = 'Which city is South Africa''s administrative capital, where the executive branch is based?', updated_at = now() WHERE id = 472;

-- #13 [ambiguous_options] World Capitals II: Duplicate of question 472: it asks for "the capital city" of South Africa while offering both Pretoria (execut
UPDATE questions SET text = 'Which city is South Africa''s legislative capital, where its Parliament sits?', correct_option = 2, explanation = 'Cape Town is South Africa''s legislative capital and the seat of its national Parliament.', updated_at = now() WHERE id = 572;

-- #14 [outdated] Antarctica: The Frozen Continent: The explanation states the Antarctic Treaty "currently has 56 signatory nations," but the treaty has had 58 pa
UPDATE questions SET explanation = 'The Antarctic Treaty was signed in 1959 and entered into force in 1961. It bans military activity and currently has 58 party nations.', updated_at = now() WHERE id = 41;

-- #15 [outdated] Capitals of Europe: The fun fact states Riga is the largest city in the Baltic states, but official 2025 statistics from both Latv
UPDATE questions SET fun_fact = 'Riga was long the largest city in the Baltic states, though fast-growing Vilnius recently overtook it in population.', updated_at = now() WHERE id = 1108;

-- #16 [outdated] Country Outlines: The explanation says Japan is 'an archipelago of nearly 7,000 islands', but Japan's official island count was 
UPDATE questions SET explanation = 'Japan is an archipelago of more than 14,000 islands, with four main ones forming its familiar curved chain.', updated_at = now() WHERE id = 151;

-- #17 [outdated] Name That Flag: The fun fact says the Indian flag must by law be made of khadi, but a 30 December 2021 amendment to the Flag C
UPDATE questions SET fun_fact = 'For decades the flag could legally only be made of khadi — the hand-spun cloth popularised by Mahatma Gandhi — until a 2021 amendment also allowed machine-made and polyester flags.', updated_at = now() WHERE id = 138;

-- #18 [outdated] Oceans & Seas: The explanation cites 11,034 meters for the Mariana Trench, an obsolete 1957 estimate; the modern accepted dep
UPDATE questions SET explanation = 'The Pacific Ocean is the deepest ocean, containing the Mariana Trench — the deepest point on Earth at approximately 10,935 meters below sea level.', updated_at = now() WHERE id = 20;

-- #19 [outdated] World Capitals: The fun fact states Tokyo is the most populous metropolitan area in the world with over 37 million people, but
UPDATE questions SET fun_fact = 'Tokyo was formerly known as Edo. Its metro area, home to more than 33 million people, ranked as the world''s most populous for decades until a 2025 UN report put Jakarta on top.', updated_at = now() WHERE id = 4;

-- #20 [factual_error_explanation] African Cities: The explanation claims Nairobi is the most populous city in East Africa, but Dar es Salaam is larger.
UPDATE questions SET explanation = 'Nairobi is the capital and largest city of Kenya, and one of the most populous cities in East Africa.', updated_at = now() WHERE id = 928;

-- #21 [factual_error_explanation] East Asia Deep Dive: The explanation states the Taiwan Strait is about 180 km wide at its narrowest point, but the narrowest width 
UPDATE questions SET explanation = 'The Taiwan Strait is about 130 km wide at its narrowest point.', updated_at = now() WHERE id = 92;

-- #22 [factual_error_explanation] European Geography: The explanation claims Mont Blanc is the highest mountain in Europe, but under the most widely used continenta
UPDATE questions SET explanation = 'Mont Blanc is the highest mountain in the Alps and in Western Europe, standing at 4,808 meters (15,774 feet) above sea level.', updated_at = now() WHERE id = 11;

-- #23 [factual_error_explanation] North America Deep Dive: The explanation says Hawaii is the only state 'entirely' south of the Tropic of Cancer, but the state's Northw
UPDATE questions SET explanation = 'Hawaii is the only state with land south of the Tropic of Cancer, placing its main islands firmly in the tropics.', updated_at = now() WHERE id = 107;

-- #24 [factual_error_explanation] Oceania Overview: The explanation calls Suva the largest city in the South Pacific outside Australia and New Zealand, but Port M
UPDATE questions SET explanation = 'Suva, on the southeast coast of Viti Levu, is the capital of Fiji and one of the largest urban centres among the Pacific island nations.', updated_at = now() WHERE id = 67;

-- #25 [factual_error_funfact] African Cities: The fun fact says Nairobi is 'surrounded by' Nairobi National Park, but the park only borders the city on its 
UPDATE questions SET fun_fact = 'Nairobi means "cool water" in the Maasai language. The city sits at an elevation of about 1,795 meters above sea level and borders Nairobi National Park, where lions and rhinos roam just outside the city.', updated_at = now() WHERE id = 928;

-- #26 [factual_error_funfact] Antarctica: The Frozen Continent: The fun fact claims the station itself must be physically relocated every few years, but the station is never 
UPDATE questions SET fun_fact = 'The ice sheet beneath the station drifts toward the ocean at about 10 meters per year, so a new marker pinpointing the exact geographic South Pole is placed every New Year''s Day.', updated_at = now() WHERE id = 33;

-- #27 [factual_error_funfact] European Geography: The fun fact wrongly calls the Channel Tunnel the longest undersea rail tunnel in the world at 50.45 km (Japan
UPDATE questions SET fun_fact = 'The Channel Tunnel (Chunnel), opened in 1994, has the longest undersea section of any tunnel in the world — 37.9 km of its 50.45 km length runs beneath the sea. Around 20 million passengers travel through it every year.', updated_at = now() WHERE id = 13;

-- #28 [factual_error_funfact] European Geography: The fun fact says Finland's roughly 179,000 islands are the second most in Europe, but widely cited counts ran
UPDATE questions SET fun_fact = 'Finland, often called "the land of a thousand lakes," has approximately 188,000 lakes and 179,000 islands — third most in Europe, behind Sweden and Norway (about 239,000 islands).', updated_at = now() WHERE id = 14;

-- #29 [factual_error_funfact] Famous World Landmarks: The fun fact says most moai have bodies buried underground with only their heads visible, but only the subset 
UPDATE questions SET fun_fact = 'The famous ''heads'' on the slopes of the Rano Raraku quarry actually have full bodies — centuries of sediment simply buried them up to their shoulders.', updated_at = now() WHERE id = 162;

-- #30 [factual_error_funfact] Famous World Landmarks: The fun fact claims Cambodia's is the only national flag in the world to feature a building, but the flags of 
UPDATE questions SET fun_fact = 'Cambodia''s national flag prominently features Angkor Wat — one of only a handful of flags in the world to depict a building.', updated_at = now() WHERE id = 165;

-- #31 [factual_error_funfact] Middle East Ancient Sites: The fun fact claims the attendants in Ur's Royal Tombs were 'buried alive', but excavator Leonard Woolley theo
UPDATE questions SET fun_fact = 'Excavations of Ur''s Royal Tombs in the 1920s revealed evidence of mass human sacrifice — dozens of servants and soldiers were buried alongside royalty for the afterlife. Modern CT scans suggest they were killed by blows to the head, not poison as first believed.', updated_at = now() WHERE id = 49;

-- #32 [factual_error_funfact] Oceans & Seas: The fun fact gives the Mariana Trench depth as 11,034 meters, an outdated 1957 Soviet sonar figure that modern
UPDATE questions SET fun_fact = 'The Pacific Ocean is so large that all of Earth''s continents could fit inside it. It contains the Mariana Trench, the deepest known point on Earth at about 10,935 meters deep.', updated_at = now() WHERE id = 18;

-- #33 [factual_error_funfact] Regional Geography: The fun fact implies Finland and Iceland are only informally counted as Nordic countries, when they are Nordic
UPDATE questions SET fun_fact = 'In everyday usage, Finland and Iceland are sometimes loosely included in Scandinavia, though strictly they belong to the broader group of Nordic countries.', updated_at = now() WHERE id = 449;

-- #34 [factual_error_funfact] South America Deep Dive: The fun fact flatly calls Ushuaia the southernmost city in the world, but Chile's Puerto Williams lies farther
UPDATE questions SET fun_fact = 'Ushuaia, in Argentine Patagonia, is famous as the ''southernmost city in the world'' — though Chile''s tiny Puerto Williams lies even farther south.', updated_at = now() WHERE id = 117;

-- #35 [factual_error_funfact] South East Asia Adventure: The fun fact claims Cambodia is the only country to feature a building on its flag, but the flags of Portugal,
UPDATE questions SET fun_fact = 'Angkor Wat appears at the center of Cambodia''s national flag — one of only a handful of national flags to feature a building, alongside Portugal, San Marino, and Spain.', updated_at = now() WHERE id = 60;

-- #36 [factual_error_funfact] World Cup Flags Part 3 of 4: The fun fact says Egypt opened against Belgium in Vancouver, but that match was played at Lumen Field in Seatt
UPDATE questions SET fun_fact = 'Egypt is in Group G and opens against Belgium in Seattle.', updated_at = now() WHERE id = 1015;

-- #37 [factual_error_funfact] World Cup Geography: Which Continent Is This Team From? Part 1: The fun fact says Canada is the second-largest country "by land area," but Canada is second only by total area
UPDATE questions SET fun_fact = 'Canada is one of the 2026 host nations and is the second-largest country in the world by total area.', updated_at = now() WHERE id = 1217;

-- #38 [wording] Capitals of Eastern Europe: This question is an exact duplicate of questionId 1318 in the same quiz (identical text, options, correct answ
UPDATE questions SET text = 'What is the capital city of Serbia?', options = ARRAY['Novi Sad', 'Belgrade', 'Niš', 'Kragujevac'], correct_option = 1, explanation = 'Belgrade is the capital city of Serbia and lies at the confluence of the Sava and Danube rivers.', fun_fact = 'Belgrade is one of Europe’s oldest continuously inhabited cities, with a history stretching back thousands of years.', updated_at = now() WHERE id = 1352;

-- #39 [wording] Countries and Borders: Finland's western neighbor is Sweden, not Norway (Norway borders Finland to the north), and 'Norway to the wes
UPDATE questions SET text = 'Which country is bordered by Sweden to the west and Russia to the east?', updated_at = now() WHERE id = 226;

-- #40 [wording] North America Deep Dive: The question's premise is false: the largest bay in the world by area is the Bay of Bengal (about 2.17 million
UPDATE questions SET text = 'What is the largest bay in North America by area?', explanation = 'Hudson Bay covers about 1.23 million km², making it the largest bay in North America and the second-largest in the world by area, after the Bay of Bengal.', updated_at = now() WHERE id = 104;

-- #41 [wording] Oceania Overview: The fun fact 'Both animals only appear on Australian currency too' is garbled — 'only' contradicts 'too' and f
UPDATE questions SET fun_fact = 'Both animals also appear on Australian coins — the $1 coin features a mob of kangaroos, and the 50-cent coin carries the full coat of arms with the kangaroo and emu.', updated_at = now() WHERE id = 126;

COMMIT;