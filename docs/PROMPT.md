# LLMプロンプト設計

## システムプロンプト

```
あなたは熟練のシニアエンジニアであり、若手エンジニアのコードレビューを行うメンターです。
提供されたGitHubのコードスニペットを解析し、プログラミングスキルを試す4択問題を生成してください。
出力は必ず指定されたJSONスキーマに従い、余計なテキストは一切含めないでください。
```

## ユーザープロンプト（テンプレート）

````
以下のコードスニペットと要件に基づいて、プログラミングクイズを生成してください。

【要件】
- 問題の難易度: {Difficulty} （Easy / Normal / Hard のいずれか）
  - Easy: 変数名、使用ライブラリ、基本的な構文に関する問題
  - Normal: 関数の戻り値、ループの挙動、スコープに関する問題
  - Hard: 潜在的なバグ、パフォーマンスの懸念、非推奨な書き方に関する問題
- 選択肢は必ず4つ作成し、1つだけが正解となるようにしてください。
- 「tips」には、コードの改善案や最新の書き方などの技術的なアドバイスを含めてください。

【コードスニペット】
言語: {language}
```{language}
{code_snippet}
````

````

## 期待するJSONスキーマ

LLM API の Structured Outputs 機能でこのスキーマを強制する。

```json
{
  "type": "object",
  "properties": {
    "difficulty": {
      "type": "string",
      "enum": ["Easy", "Normal", "Hard"]
    },
    "question_text": {
      "type": "string"
    },
    "choices": {
      "type": "array",
      "items": { "type": "string" },
      "minItems": 4,
      "maxItems": 4
    },
    "correct_answer": {
      "type": "string",
      "description": "正解の選択肢テキストそのもの（インデックスではなく文字列）"
    },
    "tips": {
      "type": "string"
    }
  },
  "required": ["difficulty", "question_text", "choices", "correct_answer", "tips"]
}
````

## Go側の対応構造体

```go
type Question struct {
    Difficulty    string   `json:"difficulty"`
    QuestionText  string   `json:"question_text"`
    Choices       []string `json:"choices"`
    CorrectAnswer string   `json:"correct_answer"`
    Tips          string   `json:"tips"`
}

// 正解インデックスの導出
func (q *Question) CorrectIndex() int {
    return slices.Index(q.Choices, q.CorrectAnswer)
}
```

## 設計メモ

- `correct_answer` をインデックスではなく文字列で持たせる理由: LLMがインデックスと選択肢の整合をミスするケースがあるため
- 難易度の検証はLLMに委ねない。出題順序（Easy→Easy→Normal→Hard）をサーバー側で固定する
- LLMへのリクエストはGoroutineで並行実行し、全問生成が完了してから試合開始する
