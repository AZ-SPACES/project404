-- A payment request no longer carries a server-written chat message.
--
-- Threads are end-to-end encrypted and the server holds no key, so the card it used to
-- write into the thread ("[payment-request:<id>]" in the ciphertext column) reached
-- readers as a failed decryption rather than a request — which is why nothing ever
-- consumed this API. The client now seals its own card pointing at the request id, the
-- same way Akyede and the existing in-chat payment cards already do.
--
-- message_id stays on the row so a client can record which of its messages carries the
-- card, but it is optional and the server never sets it.
ALTER TABLE payment_requests
    ALTER COLUMN message_id DROP NOT NULL;
