package entity

import (
	"errors"
	"slices"
)

// NumChoices は4択問題の選択肢数
const NumChoices = 4

// Question は LLM が生成する4択問題
type Question struct {
	Difficulty    string   `json:"difficulty"`
	QuestionText  string   `json:"question_text"`
	CorrectAnswer string   `json:"correct_answer"`
	Tips          string   `json:"tips"`
	Choices       []string `json:"choices"`
}

// Validate は Question の整合性を検証する
func (q Question) Validate() error {
	if len(q.Choices) != NumChoices {
		return errors.New("question must have exactly 4 choices")
	}
	if slices.Index(q.Choices, q.CorrectAnswer) == -1 {
		return errors.New("correct_answer must be one of the choices")
	}
	return nil
}

// CorrectIndex は正解選択肢のインデックスを返す（見つからない場合は -1）
func (q Question) CorrectIndex() int {
	return slices.Index(q.Choices, q.CorrectAnswer)
}
