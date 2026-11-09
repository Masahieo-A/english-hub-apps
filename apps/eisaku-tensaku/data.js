/* デモ用の架空データ（すべて書き下ろし。AIは使わない） */
window.DEMO = {
  topic: "夏休みの思い出について、あなたが体験したことと、そのとき感じたことを英語で書きなさい。（50〜70語）",
  wordReq: "50-70",
  // 誤りを4か所含むサンプル英作文（書き下ろし）
  essay:
    "Last summer, I visited my grandmother in the countryside. She live alone in a small house near the river. " +
    "I helped her cooking dinner every night, and we talked about many things. " +
    "I was very interesting in her old stories. " +
    "It was most happiest week of my vacation. I want to go there again next year.",
  // 用意済みの評価結果（指定した順で段階1→2→3と開く）
  result: {
    positive:
      "夏休みの出来事を、時間の流れに沿って分かりやすく書けています。last summer や next year など時を表す語を使って、過去から未来へ話をつなげているのが良いですね。",
    errors: [
      {
        type: "主語と動詞の一致",
        sentence: "She live alone in a small house near the river.",
        hints: [
          "この文の動詞の形を、主語との関係で見直してみましょう。",
          "主語の She は、誰のことを指しているでしょう？ 単数か複数か、そして現在か過去かを考えてみましょう。",
          "主語が三人称単数（he / she / it など）で、現在の事実を述べるとき、一般動詞の語尾はどうなるか思い出しましょう。"
        ],
        term: "三人称単数現在の s",
        masked: "She ____ alone in a small house near the river.",
        answers: ["lives"],
        corrected: "She lives alone in a small house near the river."
      },
      {
        type: "動詞の形（使役・補助的な動詞）",
        sentence: "I helped her cooking dinner every night, and we talked about many things.",
        hints: [
          "help のあとに続く動詞の形に注目してみましょう。",
          "「〜するのを手伝う」というとき、help のあとの動詞は -ing 形で良いでしょうか？",
          "help は〈help + 人 + 動詞の原形〉または〈help + 人 + to + 動詞の原形〉の形をとります。-ing 形は使いません。"
        ],
        term: "help + 目的語 + 原形不定詞",
        masked: "I helped her ____ dinner every night, and we talked about many things.",
        answers: ["cook", "to cook"],
        corrected: "I helped her cook dinner every night, and we talked about many things."
      },
      {
        type: "分詞形容詞の使い分け",
        sentence: "I was very interesting in her old stories.",
        hints: [
          "interesting という形容詞の選び方を見直してみましょう。",
          "「（人が）興味を持った」と「（物事が）おもしろい」では、使う形が違います。この文の主語は人です。",
          "感情を「引き起こす側」は -ing 形、感情を「受ける側（人）」は -ed 形を使います。さらに in ではなく別の前置詞が合うかも確認しましょう。"
        ],
        term: "感情を表す分詞（-ing と -ed）",
        masked: "I was very ____ in her old stories.",
        answers: ["interested"],
        corrected: "I was very interested in her old stories."
      },
      {
        type: "最上級の形",
        sentence: "It was most happiest week of my vacation.",
        hints: [
          "「いちばん〜な」を表す形を、もう一度確認してみましょう。",
          "happy の最上級はすでに -est の形になっています。most を重ねる必要はあるでしょうか？ また、最上級の前に置く語も考えてみましょう。",
          "最上級は〈the + 形容詞-est〉または〈the most + 長い形容詞〉。両方を重ねるのは誤りで、最上級にはふつう the が付きます。"
        ],
        term: "最上級（the + -est）",
        masked: "It was ____ week of my vacation.",
        answers: ["the happiest"],
        corrected: "It was the happiest week of my vacation."
      }
    ]
  },
  // 架空の辞書（いくつかの単語だけ用意）
  jaEn: [
    { q: "感動", pos: "名詞", list: [["impression", "名詞"], ["emotion", "名詞"], ["excitement", "名詞"]] },
    { q: "感動する", pos: "動詞", list: [["be moved", "動詞"], ["be impressed", "動詞"], ["be touched", "動詞"]] },
    { q: "手伝う", pos: "動詞", list: [["help", "動詞"], ["assist", "動詞"], ["give a hand", "動詞"]] },
    { q: "思い出", pos: "名詞", list: [["memory", "名詞"], ["recollection", "名詞"]] },
    { q: "美しい", pos: "形容詞", list: [["beautiful", "形容詞"], ["lovely", "形容詞"], ["gorgeous", "形容詞"]] },
    { q: "たびたび", pos: "副詞", list: [["often", "副詞"], ["frequently", "副詞"], ["again and again", "副詞"]] }
  ],
  enSyn: [
    { q: "happy", list: [["glad", "adj", "feeling pleasure"], ["cheerful", "adj", "noticeably happy and optimistic"], ["delighted", "adj", "very pleased"]] },
    { q: "big", list: [["large", "adj", "of considerable size"], ["huge", "adj", "extremely large"], ["enormous", "adj", "much larger than usual"]] },
    { q: "important", list: [["significant", "adj", "having great meaning"], ["essential", "adj", "absolutely necessary"], ["vital", "adj", "extremely important"]] },
    { q: "interesting", list: [["fascinating", "adj", "holding your attention strongly"], ["engaging", "adj", "pleasant and attractive"]] },
    { q: "help", list: [["assist", "verb", "to give support"], ["support", "verb", "to help someone or something"], ["aid", "verb", "to help, often in need"]] }
  ]
};
