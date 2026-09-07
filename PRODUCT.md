# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

Python/Django API and administration, React/TypeScript client, PostgreSQL in production. The stack was explicitly selected by the product owner.

## Users

- Developers creating a memorable public professional presence and connecting with recruiters, companies, and peers.
- Recruiters and companies searching an open directory for developers with precise skills, location preferences, and work modes.
- Developers discovering and contacting other developers.
- One platform owner who moderates profiles through a private administrative interface.

## Product Purpose

yoDev is a public professional directory where developers publish customizable presentation-card profiles. It makes talent discovery and peer connection direct, searchable, and shareable without making users conform to a generic résumé layout.

## Positioning

Profiles remain comparable through structured filters while allowing each developer a controlled visual identity through accessible palettes, typography, alignment, and card layouts.

## Operating Context

Visitors browse a public responsive card directory, filter candidates, open a profile in context, and can share its canonical URL. Developers register, publish immediately, manage profile content, contact visibility, and card appearance. The owner reviews or deletes profiles in the administration interface.

## Capabilities and Constraints

- Public browsing does not require an account.
- Developers register and self-manage their profiles.
- Required skills exclude profiles; optional skills only rank compatible profiles higher.
- Default ordering is last name ascending; visitors can switch to relevance.
- The owner profile is pinned first only when it matches active filters.
- Location is optional by progressive granularity: country, region/state, city. Profiles without location do not appear in location-filtered results and users are warned when omitting it.
- Work modes are multi-select: remote, hybrid, and on-site.
- A profile can expose email, LinkedIn, or both. Developers control the choice.
- Profile publication is immediate. A private administrator can mark a profile reviewed, see whether it changed since review, and delete it.
- Cards use a safe, controlled appearance editor: curated palettes, limited font catalog, alignment, and predefined layouts. User-authored CSS is not accepted.
- The product name is yoDev.

## Evidence on Hand

No production content, visual assets, testimonials, customer logos, performance claims, or deployment target have been supplied. Seed data must be clearly local/demo data.

## Product Principles

- Make people discoverable without flattening their identity.
- Explain matching rules instead of hiding them behind opaque ranking.
- Preserve developer control over optional personal and contact data.
- Make peer connection as legitimate a path as hiring.
- Keep public discovery open while maintaining owner moderation controls.

## Brand Commitments

yoDev follows the supplied visual reference: warm white, deep navy lettering, electric blue actions, rounded outlined cards, and bold sans typography. A developer's controlled card palette and typographic choice provide the visual identity; the global interface must not compete with them.

## Accessibility & Inclusion

- Card palettes must meet accessible contrast requirements.
- Every interactive card must work with keyboard focus as well as pointer input.
- Motion must respect reduced-motion preferences.
- Decorative customization cannot obscure structured profile data or filter results.
