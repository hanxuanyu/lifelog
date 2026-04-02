package util

import "testing"

func TestParseTime(t *testing.T) {
	tests := []struct {
		name    string
		input   string
		want    string
		wantErr bool
	}{
		// HH:mm
		{"HH:mm basic", "08:30", "08:30:00", false},
		{"HH:mm midnight", "00:00", "00:00:00", false},
		{"HH:mm end of day", "23:59", "23:59:00", false},

		// HH:mm:ss
		{"HH:mm:ss basic", "08:30:45", "08:30:45", false},
		{"HH:mm:ss midnight", "00:00:00", "00:00:00", false},
		{"HH:mm:ss max", "23:59:59", "23:59:59", false},

		// HHmm
		{"HHmm basic", "0830", "08:30:00", false},
		{"HHmm midnight", "0000", "00:00:00", false},
		{"HHmm afternoon", "1430", "14:30:00", false},

		// HHmmss
		{"HHmmss basic", "083045", "08:30:45", false},
		{"HHmmss midnight", "000000", "00:00:00", false},
		{"HHmmss max", "235959", "23:59:59", false},

		// 带空格
		{"with spaces", "  08:30  ", "08:30:00", false},

		// 错误情况
		{"empty", "", "", true},
		{"invalid format", "8:30", "", true},
		{"hour out of range", "24:00", "", true},
		{"minute out of range", "08:60", "", true},
		{"second out of range", "08:30:60", "", true},
		{"HHmm hour out", "2430", "", true},
		{"HHmmss second out", "083060", "", true},
		{"random text", "hello", "", true},
		{"partial digits", "08a0", "", true},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got, err := ParseTime(tt.input)
			if (err != nil) != tt.wantErr {
				t.Errorf("ParseTime(%q) error = %v, wantErr %v", tt.input, err, tt.wantErr)
				return
			}
			if got != tt.want {
				t.Errorf("ParseTime(%q) = %q, want %q", tt.input, got, tt.want)
			}
		})
	}
}
