---
'ludic-canvas': patch
---

Reject the reserved font name font-atlas-manifest, including case variants, before generating files. This prevents font metrics from being overwritten by the cache manifest. The configuration schema now documents and rejects the same reserved name.
