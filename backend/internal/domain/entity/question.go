package entity

import "slices"

// Question は LLM が生成する4択問題
type Question struct {
	Difficulty    string   `json:"difficulty"`
	QuestionText  string   `json:"question_text"`
	CorrectAnswer string   `json:"correct_answer"`
	Tips          string   `json:"tips"`
	Choices       []string `json:"choices"`
}

// CorrectIndex は正解選択肢のインデックスを返す（見つからない場合は -1）
func (q Question) CorrectIndex() int {
	return slices.Index(q.Choices, q.CorrectAnswer)
}
