# AGENTS
- Game state lives as JSON in the games table and syncs via realtime; rules engine is pure client code in src/lib/chess.ts so it stays testable.
- Players are anonymous; identity is a per-game token in localStorage (no accounts).
- Gameplay uses a transparent interactive Three.js canvas over the arena artwork, with scoped semantic visual tokens; this preserves the reference composition without flattening the board into an image.
