# Google OAuth credential security

A Google OAuth client secret was previously committed to this public repository. The current source must not contain that secret.

Required remediation:

1. Revoke or rotate the exposed OAuth client secret in Google Cloud.
2. Store the replacement only in the deployment environment (`GOOGLE_CLIENT_SECRET` or the existing `AUTH_GOOGLE_SECRET`).
3. Redeploy Flowdesk after the environment variable is updated.
4. Do not copy the replacement secret into issues, docs, commits, screenshots, or chat logs.

Removing the secret from the latest Git revision does not erase it from repository history, which is why rotation is required.
