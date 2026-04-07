package version

// These variables are set at build time via -ldflags
var (
	Version   = "dev"
	CommitHash = "unknown"
)
