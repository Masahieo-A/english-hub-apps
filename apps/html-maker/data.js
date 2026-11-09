// 架空の用意済み下書き（書き下ろし英文）
// 役割キーは本物の既定パレット（主語・動詞・目的語・補語・修飾語・接続語）に対応
window.ROLES = {
  subject:   { label: "主語 (S)",   color: "#0b4a8f", bg: "#dbeafe", mark: "solid" },
  verb:      { label: "動詞 (V)",   color: "#a3290a", bg: "#ffe1d6", mark: "double" },
  object:    { label: "目的語 (O)", color: "#5b2a86", bg: "#f0e6fb", mark: "dashed" },
  complement:{ label: "補語 (C)",   color: "#03665c", bg: "#d7f3ef", mark: "dotted" },
  modifier:  { label: "修飾語 (M)", color: "#8a4b00", bg: "#fff0d0", mark: "wavy" },
  connector: { label: "接続語",     color: "#3a3f6b", bg: "#e6e8f7", mark: "solid" }
};

// 各文：id・和訳・チャンク配列（children は樹形図の下位ノード）
window.DRAFT = [
  {
    ja: "クラブに入った生徒たちは、地元の鳥についてのポスターを作った。",
    nodes: [
      { id: "a1", role: "subject", text: "The students who joined the club",
        note: "who 以下が students を説明する関係代名詞節。",
        children: [
          { id: "a1a", role: "subject", text: "The students", note: "文の中心となる名詞。" },
          { id: "a1b", role: "modifier", text: "who joined the club", note: "「クラブに入った」＝生徒を後ろから修飾。" }
        ] },
      { id: "a2", role: "verb", text: "made", note: "過去形。SVO の V。", children: [] },
      { id: "a3", role: "object", text: "a poster", note: "「何を作った？」の答え。", children: [] },
      { id: "a4", role: "modifier", text: "about local birds", note: "poster を説明する前置詞句。", children: [] }
    ]
  },
  {
    ja: "彼女の控えめな答えは、クラスに新しい発想を与えた。",
    nodes: [
      { id: "b1", role: "subject", text: "Her quiet answer", note: "quiet は answer を修飾。", children: [] },
      { id: "b2", role: "verb", text: "gave", note: "give は目的語を2つ取る（SVOO）。", children: [] },
      { id: "b3", role: "object", text: "the class", note: "1つ目の目的語＝「誰に」。", children: [] },
      { id: "b4", role: "object", text: "a new idea", note: "2つ目の目的語＝「何を」。", children: [] }
    ]
  },
  {
    ja: "雨が降ったので、私たちは屋内にいて本を読んだ。",
    nodes: [
      { id: "c1", role: "connector", text: "Because", note: "理由を表す接続詞。", children: [] },
      { id: "c2", role: "modifier", text: "it rained", note: "理由を表す節（M）。", children: [
          { id: "c2a", role: "subject", text: "it", note: "天候を表す it。" },
          { id: "c2b", role: "verb", text: "rained", note: "" }
      ] },
      { id: "c3", role: "subject", text: "we", note: "", children: [] },
      { id: "c4", role: "verb", text: "stayed", note: "SV＋M の動詞。", children: [] },
      { id: "c5", role: "modifier", text: "inside", note: "場所を表す副詞。", children: [] },
      { id: "c6", role: "connector", text: "and", note: "stayed と read をつなぐ。", children: [] },
      { id: "c7", role: "verb", text: "read", note: "過去形（発音は /red/）。", children: [] }
    ]
  }
];
