package service

import "testing"

func TestExtractStreamContentPreservesWhitespaceChunks(t *testing.T) {
	cases := []struct {
		name    string
		payload string
		want    string
	}{
		{name: "newline", payload: `{"choices":[{"delta":{"content":"\n"}}]}`, want: "\n"},
		{name: "space", payload: `{"choices":[{"delta":{"content":" "}}]}`, want: " "},
	}

	for _, tc := range cases {
		got, _ := extractStreamContent(tc.payload)
		if got != tc.want {
			t.Fatalf("%s: extractStreamContent() = %q, want %q", tc.name, got, tc.want)
		}
	}
}

func TestExtractMessageContentTrimModes(t *testing.T) {
	content := "  hello\n"

	if got := extractMessageContent(content, false); got != content {
		t.Fatalf("extractMessageContent(trim=false) = %q, want %q", got, content)
	}

	if got := extractMessageContent(content, true); got != "hello" {
		t.Fatalf("extractMessageContent(trim=true) = %q, want %q", got, "hello")
	}
}
