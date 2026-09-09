# ADR 001: accept a restricted, browser-visible Drive API key

Status: accepted by the project owner on 9 September 2026.

## Decision and scope

Continue the public teaching prototype with GitHub Pages fetching approved public engine GLBs directly from Google Drive using a dedicated standard API key. The user consciously accepts the residual risk of quota abuse in exchange for a simpler system without another server to maintain. A server proxy is deferred, not a prerequisite for further teaching-platform work.

The key is intentionally available to the browser and currently present in tracked public configuration. It is not confidential and must never be reused as a server secret. Do not reproduce the key value in documentation, logs or issues. A GitHub secret-scanning alert records exposure; it is not evidence of account compromise. Do not automatically dismiss alerts or disable scanning.

The key must remain restricted to Google Drive API and the project's GitHub Pages host. It must not be bound to a service account. No OAuth token or service-account credential may be placed in browser configuration. The model files retain their independent public-view permissions. The reused Google Cloud project is `keongeraldo`; other applications may share its API quotas.

## What is accepted and what is not

- A standard API key identifies the Cloud project for usage accounting. By itself it does not authenticate as the owner, authorize deletion/editing, or grant access to private Drive files.
- Public engine files can be copied; this is inherent in public browser viewing.
- A copied key can be used in attempts to consume Drive API quota. Website restrictions reduce misuse but are not strong authentication against a non-browser client that fabricates request headers.
- Throttling could interrupt model viewing and other Drive API workloads in the reused project. Charges depend on applicable billing terms and enabled paid usage, not simply on exposure.
- We do not claim that restrictions, billing configuration or usage were independently audited in the Cloud console. Earlier screenshots show the intended restrictions and a successful browser request verifies delivery, not every security setting.

No paid quota increase, billing change, new authenticated data access or expansion of allowed APIs is authorized by this decision. Changes to any of those conditions require a fresh review of this trade-off.

## Monitoring procedure

Monitoring is a manual operating procedure for now. No automated usage monitor, notification rule or scheduled check has been configured.

Owner: instructor/project owner, with implementation and investigation assistance from the project assistant.

1. At baseline, open Google Cloud Console → APIs & Services → Google Drive API → Metrics / Quotas. Record the actual project limits, available traffic/error metrics, current billing linkage, and key restrictions. Separate this key from other workloads where the console provides a credential filter; otherwise retain the uncertainty.
2. During rollout, inspect before and after classroom sessions and weekly between sessions. Record time window, request volume, error rate, quota utilization, expected attendance and known testing. Record bytes/egress if that metric is exposed; do not infer it from request count alone.
3. Inspect Billing reports if billing is linked. Budget alerts, if configured later, are notifications rather than guaranteed spending caps. Do not attach billing solely for monitoring this free-tier pilot.
4. Keep lightweight observations in `docs/operations/drive-usage-log.md`; never record credential values or student personal data there.

Initial review triggers (project policy, not Google limits): traffic above five times a comparable established baseline without an explanation; sustained 403/429 failures or repeated student loading failures; quota consumption approaching 70% of an applicable limit; any unexplained charge; or changes to key restrictions / service-account binding. A classroom loading burst is not automatically abuse. With no established baseline, investigate unexplained sustained activity rather than labelling it malicious.

These triggers are review thresholds. They are not active alarms and do not enforce rate limits. Establish baseline measurements before assigning numerical request-per-minute thresholds.

## Response if abuse is suspected

1. **Confirm the cause.** Record the time window, affected API and error reason. Check expected class activity, reloads, application retry loops, invalid restrictions, disabled API and other project applications. A 403 alone does not prove abuse.
2. **Contain credible ongoing abuse.** The project owner can revoke/delete the affected key to stop future use of it, accepting temporary loss of model loading. Removing the key from the website or rotating without deleting the previous key does not invalidate copied credentials. Prefer action on this dedicated key over disabling Drive API for the whole reused project. Preserve the source models and other application credentials.
3. **Recover deliberately.** Fix a client loop if that caused the traffic. If necessary, issue a replacement with Drive-only restrictions and recheck deployment. Test normal loading, then verify the old key no longer works. Rotation is not a lasting solution against someone repeatedly obtaining a replacement from the public website.
4. **Escalate architecture when justified.** Repeated abuse, material charges, continued teaching disruption, private-data requirements or inability to distinguish shared-project traffic triggers review of an isolated project, a server with an approved-model allowlist/caching/rate limits, or publishing optimized model assets through another delivery host.
5. **Close the incident.** Record impact, cause or uncertainty, containment time, recovery checks and the decision retained or changed. Resolve the GitHub alert with an accurate reason only after review: intentional public credential versus actual revoked credential. Do not label the pattern a false positive merely because the exposure was accepted.

The assistant must follow the authorization and approval rules in force when incident actions are taken. This runbook does not authorize silent billing changes or deletion of unrelated credentials.

## Review points

Review at the first classroom pilot, before substantial full-engine expansion, after a credible abuse incident, and whenever pricing, quotas, credential permissions or audience change. Continue the existing key unless the owner reports it was rotated/revoked or investigation justifies replacement.

References consulted: [Google key types](https://docs.cloud.google.com/docs/authentication/api-keys), [Google security recommendations](https://docs.cloud.google.com/docs/authentication/api-keys-best-practices), [Drive usage limits](https://developers.google.com/workspace/drive/api/guides/limits). Google recommends server-side handling; this prototype consciously accepts a departure from that recommendation within the narrow public-data scope above.
