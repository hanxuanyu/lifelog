package model

// Prompt represents a system prompt template.
type Prompt struct {
	Name        string `json:"name" yaml:"name" mapstructure:"name"`
	Content     string `json:"content" yaml:"content" mapstructure:"content"`
	Description string `json:"description" yaml:"description" mapstructure:"description"`
	Builtin     bool   `json:"builtin" yaml:"-" mapstructure:"-"`
}
