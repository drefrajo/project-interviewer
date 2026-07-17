# Do not expose raw storage URLs

The MVP will keep Convex storage IDs server-side and expose authorized summaries and excerpts rather than raw file URLs or downloads. Convex-generated file URLs are reusable bearer capabilities until the underlying file is deleted, which would outlive Invite Link rotation and undermine the Project Room authorization boundary.
