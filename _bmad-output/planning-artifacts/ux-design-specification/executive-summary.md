# Executive Summary

## Project Vision
PublicInsight AI (Voice of the Mahalla) is a private GovTech situational awareness dashboard that extracts civic signals from noisy Telegram group chats and structures them so a busy, non-technical district governor (*tuman hokimi*) can review what residents are reporting in a matter of seconds. It acts as a passive monitoring dashboard and does not manage issue tracking or resident-facing interactions.

## Target Users
*   **Primary User (Tuman Hokimi):** A non-technical, high-level decision-maker who values quick scanning and evidence validation. Uses a large office monitor (1920x1080) in light mode. Requires immediate clarity on who reported what, where, and when.
    *   *Sender Visibility Policy:* Display the Telegram display name snapshot (e.g., *Али Валиев*) by default so the hokim has enough evidence to identify who wrote the message. If unavailable, fall back to the Telegram username (e.g., `@ali_valiyev`), and default to *Резидент* (Resident) if both are missing.
*   **Secondary User (Authorized Staff):** Monitors the dashboard on behalf of the hokim, prepares summaries, and filters by specific terms or mahallas.
*   **Technical Admin (Operator):** Monitors system health, checks bot connectivity, and reviews pre-filter discard logs.

## Key Design Challenges
*   **Information Density & Layout Complexity:** Presenting 5 independently scrolling lanes and a right-side drawer overlay simultaneously on a single desktop view without creating visual clutter or high cognitive load.
*   **Cross-Cutting Prioritization:** Helping the user understand that the *Ҳокимга тегишли* (Hokim-related) lane is a priority view flag rather than a service category (a message can exist in *Газ* and *Ҳокимга тегишли* simultaneously).
*   **System Status Transparency:** Representing empty states (no reports) and pipeline delays (e.g., "Signals may be delayed" when AI batches lag) in a clear, non-technical manner.
*   **Localization Consistency:** Enforcing clean Uzbek Cyrillic terminology for all primary lanes.
    *   *Lanes:* *Ҳокимга тегишли* (Hokim-related), *Сув* (Water), *Електр* (Electricity), *Газ* (Gas), *Чиқинди* (Waste).
    *   All dashboard copy remains centralized and testable to prevent Latin Uzbek slip-throughs.

## Design Opportunities
*   **Contextual Evidence Mapping:** Providing instant neighborhood context through a right-side drawer that loads related signals (same mahalla + same category + time window) automatically when a card is selected. Clicking a different card instantly refreshes the drawer.
*   **Premium Civic Aesthetics:** Building a modern, light-mode, Telegram-familiar design using clean typography (e.g., Inter or Outfit) and subtle micro-interactions to create a state-of-the-art administrative tool.

---
