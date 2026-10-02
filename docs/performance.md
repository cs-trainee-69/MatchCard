# CatCard performance improvements

Measured on 2026-10-01 using the production build, local preview server, and headless Chromium at 393 × 852 CSS pixels with device pixel ratio 3. Browser cache was disabled and randomness fixed. The same script played through Round 6 before and after the changes.

## Results

| Measurement | Before | After |
| --- | --- | --- |
| Image response bodies during the scenario | 21,649,261 bytes | 1,501,030 bytes |
| Image bytes saved | — | 93.1% |
| Boards with all front images loaded at the arrival sample | 3 of 6 | 6 of 6 |
| Card ref registrations during ten 100 ms clock updates, four-card Board | 80 | 0 |
| Frame interval p95, idle twenty-card Board | 16.7 ms | 16.8 ms |
| Frame intervals above 33.4 ms in that sample | 0 | 0 |

Raw results: [before](performance-before.json), [after](performance-after.json).

The evidence shows smaller downloads and less repeated React work. It does not demonstrate higher FPS on physical phones. The frame sample is short and taken on an idle Board; it does not profile every animated effect. Navigation-to-network-idle times were 3,531 ms before and 675 ms after, but these single local samples are not a reliable estimate of real-world load time.

## Changes

- Preserve all original PNGs. Deliver separate WebP card variants at widths 256, 384, 512, and 768 pixels, with proportional heights and alpha transparency.
- Use picture sources and measure the actual card width on layout changes. Allow 7% extra resolution for the Match animation. Browser selection considers screen density and can reuse a previously loaded larger image in later Rounds.
- Compress the background without reducing its original resolution. Deliver optimized HUD, sound-button, and density-dependent event panels.
- Prepare Cat Character images with two concurrent low-priority workers during the opening flow, and decode them ahead of subsequent Rounds. Prepare the celebration image and event panels too.
- Fall back to original card artwork if a WebP request fails or the browser cannot use WebP. Failed speculative preloads do not block gameplay.
- Give the memoized Board only the state it displays. Memoize individual cards and keep their ref callbacks stable. Clock-only state updates preserve the Board props.
- Skip Match discovery when the Board has not changed.
- Animate Golden Timer progress using a scale transform instead of changing layout width.

Gameplay durations, scoring, pause/resume behavior, and the main visual effects remain the same. Blur and glow effects were retained because this measurement did not establish them as a bottleneck.

## Verification

The regression test exercises a real App Game Session: HUD time advances, card refs remain attached across clock updates, and selecting a card still reveals it. Browser tests check delivered image resolution at 3× density before and after rotation, plus recovery when optimized image requests fail. Existing tests cover all Board sizes, Golden Card outcomes, pause/resume, scoring, replay, sound preference, and High Score persistence.

Final checks passed: TypeScript validation, production build, 52 unit/integration tests, and 31 browser tests.

Visual comparison of cat-1, cat-8, and the card back at the first Board's display resolution showed similar outlines, colors, and transparency. Composited-image PSNR was approximately 42.5–45 dB; this is supporting information rather than a guarantee of perceptual quality for every asset.

## Reproducing the measurements

1. Run `pnpm build`.
2. Set `PORT` in `.env` if needed, then run `pnpm preview --host 127.0.0.1`.
3. In another terminal, run `pnpm perf:measure docs/performance-after.json`.

The measurement needs the project's Playwright Chromium installation. Set `PERF_URL` to target a different preview address. Set `PERF_SCREENSHOT` to an output PNG path to capture the final Board.

Run `pnpm test` and `pnpm e2e` for regression checks. Run `pnpm assets:optimize` to regenerate delivery images; this requires Python and Pillow with WebP support. Image generation is not needed for normal builds because the generated assets are included in the repository.

## Remaining limits

- Test on a physical midrange phone and a slower network before treating smoothness and loading as complete. Speculative preloading improves readiness but does not gate the game clock on every image completing, so very slow connections can still expose a late image.
- The background's original resolution is 941 × 1672. A display needing more source pixels will require a higher-resolution original to improve its sharpness.
- Original and older source art is still copied to the build by the existing public-assets setup. Download savings refer to assets requested by the game, not the total deployment-directory size.

## Gameplay recheck on 2026-10-01

The production build was measured again with the same viewport, density, deterministic randomness, and disabled browser cache. The script now additionally samples a twenty-card Board during one Mismatch followed by nine Matches, allowing 800 ms after each Match for its animation. One pair remains hidden to keep the sample on that Board. This covers flips, Mismatch feedback, Match effects, and score updates; it does not sample Golden Timer or end-of-session warning animations.

| Measurement | Normal CPU | CPU slowed 4× via Chromium |
| --- | --- | --- |
| Idle frame interval p95 | 16.8 ms | 16.8 ms |
| Gameplay frame interval p95 | 16.7 ms | 16.8 ms |
| Gameplay frame samples | 645 | 586 |
| Gameplay intervals above 33.4 ms | 0 | 3 (0.51%) |
| Longest gameplay interval | 16.8 ms | 50.0 ms |
| Boards with all front images loaded at arrival | 6 of 6 | 6 of 6 |
| Image response bodies before the gameplay sample | 1,501,030 bytes | 1,501,030 bytes |
| Browser/request errors | 0 | 0 |

Raw results: [normal CPU](performance-recheck.json), [4× CPU slowdown](performance-recheck-cpu4.json).

These single runs support keeping the current game implementation while collecting a physical-phone profile before another optimization pass. No gameplay or visual code was changed in this recheck. Frame intervals come from `requestAnimationFrame`; they are a scheduling signal, not proof that every frame was presented by a device's display. Chromium CPU throttling does not emulate phone GPU speed, thermal throttling, or a slow mobile network. The occasional delayed frames under throttling do not identify a specific bottleneck.

Recheck validation passed: 59 unit/integration tests, TypeScript validation, production build, 36 browser tests against that production preview, and script syntax validation.

To reproduce, run the existing measurement command against a production preview. Set `PERF_CPU_SLOWDOWN=4` for the throttled scenario (defaults to 1). The output retains the original idle `frames` field and adds `activeFrames` and `cpuSlowdown`. Do not run other browser tests concurrently with the measurement.
