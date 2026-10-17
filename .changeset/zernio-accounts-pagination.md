---
"@attentionos/provider-publish-zernio": patch
"@attentionos/studio": patch
---

Zernio checks work again, in doctor and in the setup Keys step: listing accounts no longer sends a page size on its own, which Zernio now rejects ("page and limit must be provided together").
