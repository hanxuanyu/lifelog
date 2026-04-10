package config

import "testing"

func TestNormalizeScheduledTaskCron(t *testing.T) {
	tests := []struct {
		name string
		in   string
		want string
	}{
		{
			name: "convert five-field cron to six-field",
			in:   "0 22 * * *",
			want: "0 0 22 * * *",
		},
		{
			name: "keep six-field cron unchanged",
			in:   "0 0 22 * * *",
			want: "0 0 22 * * *",
		},
		{
			name: "normalize extra spaces",
			in:   "  0   */2   *   *   *   ",
			want: "0 0 */2 * * *",
		},
		{
			name: "leave invalid field count for downstream validation",
			in:   "* * * *",
			want: "* * * *",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := normalizeScheduledTaskCron(tt.in)
			if got != tt.want {
				t.Fatalf("normalizeScheduledTaskCron(%q) = %q, want %q", tt.in, got, tt.want)
			}
		})
	}
}
