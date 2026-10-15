# Leaderboard design

The lobby ranking action is a single cream and peach button with a coral rim, a golden star and an orange cat hugging a trophy. The previous outer container has no decorative frame. Connection and recovery messages retain their own readable cream surfaces.

The ranking dialog uses cream surfaces, a coral pink frame, plum text, a mascot header and an accessible close button. Scores are presented in separate rounded rows with gold, silver and bronze rank badges, avatars or a paw fallback. Server ranks and ties remain unchanged. Empty, loading and retry states share a cream inset panel. The dialog scrolls on short screens and retains keyboard focus restoration and request cancellation. Development-mode labels remain explicit.

## Graphics

Generated with built-in ImageGen. Original: `assets/ui/leaderboard-mascot.png`. Responsive delivery variants: `assets/optimized/ui/leaderboard-mascot-{128,256,384}.webp`. Rebuild with `npm run assets:optimize`.

Final prompt (the approved result-screen concept was supplied as a style reference):

> Production transparent-background illustration asset for Cat Card game's leaderboard. Reference is style only. A single adorable happy orange tabby cat with cream muzzle and tummy, red neckerchief with tiny white paw, hugging a polished golden trophy cup with embossed paw symbol, two tiny gold stars adjacent. Match existing reference's cozy kawaii hand-painted casual mobile game art, warm peach outlines, softly shaded glossy puffy gold material, expressive closed smiling eyes. Front facing, compact centered square composition, whole cat and cup fully visible, slight transparent margin, transparent background. No background panel, no pedestal, no text, no numbers, no UI mockup, no letters, no shadow rectangle. Readable silhouette both as 48px button illustration and 110px dialog header mascot.

## Verification

Production build and 70 unit tests passed. Browser checks cover zero, one and five entries, long names, tied ranks, retry, reopen, request cancellation, focus restoration and overflow on mobile and desktop. Development mode is verified separately without central score traffic.
