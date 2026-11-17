// Package web holds the embedded frontend built assets.
// The frontend build writes its output to web/dist; it is embedded here.
package web

import (
	"embed"
	"io/fs"
)

//go:embed all:dist
var distFS embed.FS

// StaticFS returns the dist sub-tree of the embedded filesystem, or nil when
// the frontend was not built (web/dist contains only the .gitkeep placeholder
// and no index.html).
func StaticFS() fs.FS {
	sub, err := fs.Sub(distFS, "dist")
	if err != nil {
		return nil
	}

	// If index.html is absent, the frontend has not been built yet.
	if _, err := sub.Open("index.html"); err != nil {
		return nil
	}
	return sub
}
