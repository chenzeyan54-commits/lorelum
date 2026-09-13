# Lorelum plugins

Each direct child of this directory is an independently installable Plugin artifact for one host. It contains the host-specific lifecycle integration, context rendering, Skills, and distribution metadata; it is not a shared Engine layer.

`lorelum/` is the current Codex Plugin, published as `lorelum@lorelum` and shown as **Lorelum**. It calls the public `lore` CLI for Pack metadata. It must not import Engine packages, read LocalStore files directly, or reproduce retrieval and ranking behavior.

Do not add placeholder directories for future agents. When another host needs a real integration, define its independent install and trust model first; only then add its artifact here or choose a host-required marketplace layout. A future `learn` capability remains inside the relevant host Plugin unless it later requires independent installation, permissions, trust, audience, or release cadence.
