# Phase 9 — Prompt Template

> Copy-paste ini ke Claude Code, isi bagian yang kosong.

---

## Task

<!-- Satu kalimat: apa yang harus dicapai -->

## Context

<!-- Kenapa ini penting? Problem apa yang diselesaikan? -->

## Current State

<!-- Apa yang sudah ada sekarang? Link ke file/component terkait -->

## Requirements

### Must Have
<!-- Bullet list: fitur wajib ada -->

### Nice to Have
<!-- Bullet list: fitur opsional -->

### Out of Scope
<!-- Bullet list: apa yang TIDAK dikerjakan -->

## Success Criteria

<!-- Bagaimana gw tau ini selesai? Contoh: -->
- [ ] Test X pass
- [ ] UI menampilkan Y
- [ ] Contract emit event Z

## Technical Notes

<!-- Edge cases, constraint, dependency yang perlu diingat -->

## Files to Touch

<!-- List file yang kemungkinan perlu diubah -->

---

# Prompt Preferences (untuk gw)

## Format yang gw suka:

1. **Satu task per prompt** — jangan gabung 5 task jadi 1
2. **Success criteria yang testable** — bukan "make it better" tapi "user bisa click X dan melihat Y"
3. **Contoh output** — kalau minta UI, kasih ASCII mockup atau reference
4. **Scope yang jelas** — "ini doang, jangan ubah yang lain"
5. **File yang harus diubah** — kalau udah tau, sebutin langsung

## Format yang bikin gw lambat:

1. Prompt 2000 kata tanpa struktur
2. "Fix everything" tanpa spesifik
3. Requirement yang kontradiktif
4. Mintanya A tapi expectnya B

## Contoh Prompt Bagus:

```
Fix the reveal flow in AuctionDetail.tsx.

Problem: handleReveal() is a dead end — decrypts then shows error.

Fix:
1. Try cofheClient.decryptForTx() instead of decryptForView()
2. If available, call writeContract revealWinner with signatures
3. If not available, show toast directing to RevealCenter

Files: frontend/src/pages/AuctionDetail.tsx

Success: Click "Reveal Winner" → tx submitted → winner shown on-chain
```

## Contoh Prompt Buruk:

```
The reveal flow is broken and also the UI is ugly and the contract 
has issues and we need to fix everything before launch. Also add 
dark mode and make it faster.
```
