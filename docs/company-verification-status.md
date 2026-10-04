# Company verification status — 5 October 2026

Company rows previously defaulted to PENDING on registration, before any verification request existed. The dashboard and profile therefore incorrectly said that documents were awaiting administrator review.

Both pages now derive their display from the company's stored review outcome and actual verification requests. A company with no request displays “ยังไม่ส่งเอกสาร”. Submitted requests display “รอตรวจสอบเอกสาร”; verified and rejected companies display their respective outcomes. Rejected companies can correct and resubmit documents. Pending and verified profiles disable another submission in the form.

This is a frontend display correction. Existing stored statuses, identity documents, administrator queue queries and authorization rules are unchanged; no data migration or fabricated production verification request is needed.

Validation: production build and lint passed. The isolated browser regression now has 24 checks, including submission with a disposable screenshot attachment, administrator rejection, resubmission and approval, plus confirmation that a company without a request has no review-queue entry. Computer-use checks confirmed the verified profile and disabled submission button. Regression data is disposable and is never seeded into production.

The form's disabled button prevents ordinary duplicate submission; it does not add a new backend concurrency rule. Production identity verification still requires genuine company information and documents.
