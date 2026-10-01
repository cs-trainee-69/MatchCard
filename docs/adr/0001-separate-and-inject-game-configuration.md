# Separate and inject game configuration

Gameplay rules and tuning values will live in a typed, immutable `GameConfig` that is resolved and validated by a factory, then injected as a snapshot when a Game Session starts. This keeps the state machine testable and allows future difficulty or event profiles without making the domain depend on global defaults or permitting rules to change during an active Game Session.

Cat Character identifiers remain domain-safe while labels and images stay in an exhaustive presentation mapping. UI copy may format values from the active resolved config, but audio settings, storage keys, animation-only delays, assets, and CSS tokens remain outside `GameConfig` because they have different owners and lifecycles.
