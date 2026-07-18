# Use revocable Client Invite Links

The Freelancer will authenticate, but the Client will enter and return to a Project Room through a revocable, unguessable Invite Link without creating an account. This deliberately favors low-friction participation over strong identity verification, so Client Approval is an acknowledgement associated with the link and supplied display name rather than a legal signature.

The current Invite Link remains visible to the authenticated Freelancer on the Project Home until it is rotated or revoked. Convex stores the bearer token encrypted with a key derived from the deployment's `BETTER_AUTH_SECRET`, while capability exchange continues to use the token hash. Rotating or revoking a link removes the previous encrypted token and invalidates existing Client sessions.
