package model

// CategoryRule 匹配规则（映射 config.yaml）
type CategoryRule struct {
	Type    string `yaml:"type" json:"type"`       // "fixed" 或 "regex"
	Pattern string `yaml:"pattern" json:"pattern"`
}

// Category 大类配置（映射 config.yaml）
type Category struct {
	Name  string         `yaml:"name" json:"name"`
	Rules []CategoryRule `yaml:"rules" json:"rules"`
}
