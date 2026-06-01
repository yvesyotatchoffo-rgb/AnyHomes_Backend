# TODO

- Temporary fix: frontend now uses local asset copies for prospect profile images under `assets/img/Prospect img/`.
- Long-term improvement: replace this temporary local asset workaround with a real image hosting solution / CDN (Amazon S3, CloudFront, etc.) to serve all platform images from a stable backend/asset domain.
- Ensure frontend image URL resolution is consistent and does not hardcode the frontend host for backend-stored images.
