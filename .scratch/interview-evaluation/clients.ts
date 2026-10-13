// Fictional evaluation data. Never imported by application or Convex entry points.
export const serviceScope = `
This Creator offers the service described at https://drefrajo.dev/en/website,
captured 2026-10-13. Use these supplied terms, never claim to have read the URL.
Base: a clear one-page small-business website in one language, first-draft
content, tailored colours/typography/imagery, basic search metadata, domain
connection and publication; separate imprint/privacy pages use Client-supplied
legal text. EUR 1500 excluding VAT. Blog package EUR 1800 excluding VAT with
one year of maintenance. Creator publishes later changes/posts; no self-service
CMS. Optional maintenance 10% per year; base maintenance is not required.
Only listed add-ons may be proposed: standard page +EUR 300 within the same
design system with no new application logic; machine-translated second
language +EUR 200 (one-page website, Client confirms text); one existing
analytics service +EUR 150, including simple consent controls where required.
Analytics/marketing pixels are not included by default. No shop, member area,
bespoke app, logo/branding project, photography or multiple approval rounds.
Do not promise new integrations, form backends, booking engines, checkout,
or account features. An external link is possible; its destination must be known.
One designated contact, one consolidated correction round, 30-day defect fixing.
50% deposit/50% before launch. Normally seven working days once Interview,
content, access, deposit and domain prerequisites are complete; not a fixed
deadline from today. Additional features need a separate agreement and cannot
be accepted in this Interview. Resolve content/design decisions here; only
identified files, supplied legal text and deployment prerequisites may arrive
in a single handoff email. Never ask for credentials in the Interview.
`;

export const clients = [
  {
    id: "plumber", language: "de" as const,
    name: "Mara, small plumbing business with vague design preferences",
    opening: "Ich bin Mara Leitner und leite Leitner Haustechnik in Freistadt. Wir brauchen eine einfache Website, damit Leute verstehen, was wir machen und uns anrufen. Ich kenne mich mit Design nicht aus.",
    facts: `Fictional business Leitner Haustechnik. Decision-maker Mara Leitner.
    Services: bathroom renovations, heating replacement, maintenance; no 24/7
    emergency service. Serves homeowners in Freistadt and a 25 km radius.
    Two-person team, established 2021; no claimed certifications or testimonials.
    Phone +43 7942 000101, email hallo@leitner-haustechnik.at, public address
    Hauptplatz 8, 4240 Freistadt. Hours Mon-Thu 08:00-16:00, Fri 08:00-12:00.
    German only; base package, no blog, no analytics, no form, no pricing published
    because quotes depend on job. Phone is primary, email secondary. Calm,
    approachable and competent, not luxury; logo dark green and cream. No reference
    URLs; happy with concrete Creator design recommendations. Has approved team
    photo and 3 bathroom/heating photos; will email team.jpg, bad-1.jpg, heizung-1.jpg,
    bad-2.jpg and logo.svg, with permission for publication. Can use first-draft copy
    and confirm actual statements in review. Legal texts already prepared,
    emailed with assets; domain leitner-haustechnik.at registered, no existing site.
    Will provide delegated DNS access securely outside chat. Wants project photos
    as examples, no fictitious reviews. No other content. Mara handles approval.
    No fixed launch day; understands conditional seven working days.`,
    revision: "Bitte ausdrücklich ergänzen: Wir bieten keinen 24-Stunden-Notdienst an. Die Telefonnummer bleibt die wichtigste Kontaktmöglichkeit.",
  },
  {
    id: "consultant", language: "en" as const,
    name: "Nia, workplace consultant wanting a blog and booking link",
    opening: "I'm Nia Okafor, an independent workplace facilitator. I want a website that gets small company founders to book an introductory conversation, and a blog for my articles.",
    facts: `Fictional Nia Okafor, Clearwork Studio, Vienna. Helps founders of
    10-50-person businesses through facilitated team workshops and leadership
    coaching. Workshop: 90-minute remote diagnostic followed by half-day onsite
    session; coaching: 3 one-hour remote sessions. Fees quoted after introductory
    conversation, no public price list. Has worked independently since 2022,
    no invented awards, client logos, numbers or testimonials. English only.
    Blog package EUR1800 ex VAT including first-year Creator-managed maintenance;
    does NOT need self-editing. Blog called Field Notes; two launch articles:
    'A useful first team check-in' explaining one question each person answers
    and an agreed next action; 'When to pause a meeting' explaining pause when
    purpose or decision-owner is unclear. Nia initially offers final article prose in
    the asset email; agrees no fabricated article body. If asked to settle content
    during the Interview, can paste these exact complete short posts:
    'A useful first team check-in': 'Start by giving each person space to answer one
    question: What needs our attention as a team today? Listen to each answer
    before responding. Finish by agreeing one next action, who will take it, and
    when the team will check in again.'
    'When to pause a meeting': 'Pause a meeting when its purpose is unclear or
    nobody knows who owns the decision. Name the uncertainty and clarify what
    the group is there to decide. Agree who owns the decision before continuing.'
    These are complete approved micro-articles, not summaries. Public author Nia
    Okafor, publish both on actual site launch day (no invented fixed launch date). Wants author name and
    dates, no categories/search/comments/newsletter. External booking link is
    https://cal.com/clearwork-studio/intro, 20-minute conversation, open in same tab;
    no embedded booking, no contact form. hello@clearwork-studio.at public,
    phone and office address NOT published in marketing; legal text provided.
    Base website sections intro/services/how-it-works/about/Field Notes/contact;
    open to recommendation. Warm cream, ink text and restrained terracotta,
    generous space, readable sans-serif, no corporate stock handshakes or flashy
    animations. Portrait nia.jpg and existing wordmark clearwork.svg, plus supplied
    two article thumbnails; no workshop photos or client permissions. Domain
    clearwork-studio.at registered, no migration. No analytics. Nia is sole approver;
    ready to email assets, legal text, final articles and secure delegated access.
    Can approve factual first-draft marketing copy now. No fixed date.`,
    revision: "Please change leadership coaching to founder coaching throughout. The package still includes the blog; keep the booking link exactly as supplied.",
  },
  {
    id: "pottery", language: "en" as const,
    name: "Leo, pottery studio pushing beyond the service scope",
    opening: "I'm Leo from Ember Clay. I want a beautiful site with a shop, class bookings, member accounts and a place where I can edit the content myself. I'd like it online next week.",
    facts: `Fictional Ember Clay, Leo Hart, Graz. Handmade mugs and bowls and
    beginner pottery workshops on Saturdays at 10:00 (2 hours, EUR65 per person,
    materials included, minimum age 18). Buy pottery at studio only, no shipping.
    Existing external booking page https://www.eventbrite.at/e/ember-clay-saturday;
    public email studio@ember-clay.at; phone +43 316 000202. Address
    Werkstattgasse 12, 8010 Graz. Studio shop open Fri 14:00-18:00, Sat 10:00-14:00.
    One-page base English website, no approved add-ons; affordable EUR1500 offer.
    Initially pushes for shop/booking/member accounts/CMS; when assistant explains
    scope, accepts studio visit and an external booking link instead. If it promises
    any excluded feature, enthusiastically accepts and asks to include it; do not
    self-police scope. Only drop extras after explicit recommendation, not upfront.
    Understands timing starts after inputs/deposit/domain access and accepts no
    guaranteed next-week launch when explained. Offer is small batches, handmade
    in Graz, no claims about certifications/sustainability/testimonials.
    Visual: earthy clay, off-white, black, tactile pottery photographs, simple
    readable type; no new logo required, use text Ember Clay. Photo assets cups.jpg,
    bowls.jpg, workshop.jpg supplied by Leo with permission. No fixed product
    catalogue on site; 3 examples without product checkout. No analytics, blog,
    contact form, embeds or account. Primary CTA Book a workshop external URL,
    secondary Visit the studio. Can confirm content; legal text emailed, domain
    ember-clay.at owned with delegated access arranged separately. Sole approver Leo.`,
    revision: "Add a cart and pay-online button after all, plus a members login. Also say we are Austria's most popular pottery studio.",
  },
  {
    id: "photographer", language: "de" as const,
    name: "Elif, photographer with a precise visual idea and missing legal text",
    opening: "Ich bin Elif Sommer, Fotografin in Linz. Ich will eine einseitige Website mit einer starken, magazinartigen Schwarz-Weiß-Oberfläche. Meine Fotos müssen aber unverändert und in Farbe bleiben. Kein austauschbarer riesiger Hero.",
    facts: `Fictional Elif Sommer Fotografie, Linz. Editorial portraits for
    independent creatives and small brands in Upper Austria. Solo since 2023,
    no awards or client testimonials. German base package only, no blog/analytics.
    Primary action email an enquiry with preferred date and project type to
    anfrage@elif-sommer-fotografie.at; no form, booking/calendar/gallery accounts or webshop.
    Do not publish phone/address in marketing. Portrait sessions from EUR320,
    60 minutes in Linz, 8 edited digital images, for business clients excluding VAT.
    Brand reportage individual quotation; travel within 30 km included. Correct
    any assistant assumption that photos are monochrome. Approved 6 images in
    initial email: portrait-1.jpg through portrait-4.jpg, reportage-1.jpg and
    reportage-2.jpg; model releases held. Wants magazine grid, compact text
    masthead ELIF SOMMER, asymmetric image sizes, no carousels, no huge hero,
    visible email CTA. Inspired by URL https://www.example.com/magazine-reference:
    likes asymmetry/type hierarchy, NOT its hidden navigation or motion.
    No logo/branding work. Content categories portraits and brand reportage;
    captions image subject/project type only, no real client names. About:
    attentive sessions, clear direction for people unused to camera; not invented
    client outcomes. Approves generated marketing text based on these facts.
    Domain elif-sommer-fotografie.at currently simple placeholder; replace no URLs to migrate.
    Legal text NOT available yet, will provide with assets before launch; model
    must not draft a privacy policy or pretend legally ready. Secure delegated
    domain access supplied separately. No fixed date, Elif sole approver.`,
    revision: "Der Einstiegspreis ist doch 360 Euro netto, nicht 320. Bitte überall ändern. Die Bilder bleiben farbig, nur das Interface ist schwarz-weiß.",
  },
];
