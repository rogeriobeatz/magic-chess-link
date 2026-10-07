# AGENTS
- Game state lives as JSON in the games table and syncs via realtime; rules engine is pure client code in src/lib/chess.ts so it stays testable.
- Players are anonymous; identity is a per-game token in localStorage (no accounts).
