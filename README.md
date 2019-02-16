# advanced-music-search

Purpose: advanced searching, previewing, and playlists for an existing music collection/library.

Supported search operators:

- `key:value` Matches if key contains value. Supported keys: `title`, `artist`, `albumartist`, `album`. e.g. `artist:lunceford`
- `before/after:year`, e.g. `after:2015`
- negation, e.g. `-album:live`, will exlude albums containing "live"
- `>/<` for BPM and year, e.g. `bpm>200` or `year<2010`
- words will be matched against title, artist, albumartist, album

How to use: launch app, drag music folder into window to load metadata

## Roadmap

- [X] Key feature: search like Gmail, e.g. artist:"Tamar Korn" -artist:"Gordon Webster" before:2014
- [X] SHA1 hash of audio streams identifies tracks (stays the same even if metadata changed)
- [ ] Customizable views (columns)
- [ ] Playlists
- [X] Playback with scrubbing
