# Wallet spend receipts

## Done
- `Attachment.walletTransactionId` → DEBIT ledger rows
- Upload many images/files from spend modal (FAB / `/wallet`), max 10 × 25MB
- Flow: create DEBIT → prepare `/api/attachments` (`purpose: wallet`) → `putAttachmentBytes`
- History on `/wallet` + `/expenses` lists receipt links
- Access: wallet owner / tx creator / Admin+Manager

## Notes
- Optional; spend still saves if upload fails (error message shown)
- Receipts are not matter hub documents (no auto `matterId`)
