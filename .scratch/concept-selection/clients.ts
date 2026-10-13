import { serviceScope } from "../interview-evaluation/clients";

export const clients = [
  {
    id: "lina", language: "de" as const, name: "Lina, bicycle repair shop",
    scope: serviceScope,
    opening: "Ich bin Lina Berger und habe eine kleine Fahrradwerkstatt in Linz. Ich brauche meine erste Website, damit die Leute wissen, was ich repariere und mich anrufen. Welcher Stil passt, weiß ich noch gar nicht.",
    facts: `Fictional Radraum Linz, owned by Lina Berger, solo workshop since 2022.
    Repairs city and trekking bikes, changes tyres and brakes, performs maintenance;
    no electric motor or battery repairs, no emergency service. Local everyday
    cyclists in Linz, not racing professionals. Quotes after looking at the bike,
    no public repair prices. Primary action call +43 732 000303, secondary email
    hallo@radraum-linz.at. Address Werkstattplatz 4, 4020 Linz. Hours Tue-Fri
    09:00-17:00, Sat 09:00-12:00. German only, base EUR1500 excluding VAT,
    no blog, shop, booking engine, form, analytics, maintenance or CMS.
    Simple logo is only the words Radraum Linz in black; no mandatory palette,
    typography or layout. Wants approachable, practical and trustworthy; no
    specific visual taste and no reference websites. Would like to see options
    before deciding style. Can supply werkstatt.jpg, reparatur.jpg and lina.jpg,
    all her own photographs with publication rights, plus wordmark.svg. Use
    workshop/repair photos to explain work and portrait for About; no awards or
    testimonials. Domain radraum-linz.at registered, no existing site. Can provide
    prepared legal text and assets in one email and arrange delegated access
    securely. Lina sole approver, no fixed launch day, agrees ordinary service
    terms and a factual first-draft copy. Before concepts, do not invent or settle
    palette/font/layout preferences. A stylistic suggestion is only a possible
    option; respond that you would like to compare the images first.`,
  },
  {
    id: "theo", language: "en" as const, name: "Theo, language tutor",
    scope: `This is another Creator's service, not drefrajo's. Swift Sites offers
    a one-page website in English for EUR950 excluding tax with draft marketing
    copy, three rough Visual Concepts, one consolidated correction round and
    publication. Client supplies photos, legal text and delegated hosting/domain
    access. Supported interactions are email links and links to existing external
    scheduling pages. No CMS, shop, accounts, forms, integrations, analytics or
    blog. No promise of a fixed launch date; launch follows complete inputs and
    Client approval. Scope cannot be expanded by the Client; do not substitute
    another Creator's packages, prices, payment stages or launch promises.`,
    opening: "I'm Theo Lane, an English tutor for adults in Vienna. I want people to arrange a trial conversation. I don't know whether I should look modern, friendly, formal or something else—I need to see it.",
    facts: `Fictional Theo Lane, independent English tutor since 2023, based in
    Vienna. Offers one-to-one conversational English for adult learners, online
    or in Vienna by arrangement. Sessions 45 minutes, EUR40, no qualification
    or guaranteed exam results claimed. Primary action external 15-minute trial
    conversation at https://cal.com/theo-lane/intro, same tab. Secondary public
    email hello@theo-lane.at. No public phone, street address or opening hours in
    marketing. English one-page Swift Sites package EUR950 excluding tax, no
    add-ons. Wants adults to feel welcome and able to understand the offer.
    No brand, preferred colours, font, layout or references. Does not want it to
    resemble a children's school. Would rather compare visual examples before
    choosing style. No new logo project: use Theo Lane as text identity. Own
    portrait theo.jpg and desk.jpg, both approved for publication, supplied in
    initial asset email with legal text. Registered theo-lane.at, no existing
    website, secure delegated access later. Sole approver, no fixed date. Accepts
    factual draft copy and supported page structure; do not invent testimonials,
    degrees, promises or specifics outside these facts. Suggested colours/type
    remain tentative until actual concepts are viewed.`,
  },
  {
    id: "amira", language: "en" as const, name: "Amira, calligraphy studio",
    scope: serviceScope,
    opening: "I'm Amira Nasser, running Ink & Place. I do hand-lettered place cards and gifts. I need a website for enquiries, but I can't picture what it should look like. I'd like help choosing a style rather than choosing colours now.",
    facts: `Fictional Ink & Place by Amira Nasser, solo studio in Graz since 2021.
    Hand-lettered place cards for weddings and company events; personalised
    paper gifts for businesses and individuals. Commissions agreed by email,
    price and timing quoted individually; no online checkout, stock catalogue
    or delivery guarantee. Primary email enquiries to hello@ink-and-place.at
    including occasion, quantity and desired date. No phone or street address
    in marketing. English base EUR1500 ex VAT, no blog, forms, analytics, member
    area, CMS or shop. Website should feel personal, crafted and professional,
    serving corporate events as well as weddings. No logo, required palette,
    typography, layout or references; use Ink & Place as a text name. Wants to
    see visual options before deciding; does not want the business reduced to
    wedding-only messaging or an online store. Has three original rights-cleared
    photos place-cards.jpg, gifts.jpg, lettering.jpg; will email with prepared
    imprint/privacy text. No portrait, awards, testimonials or other facts.
    Domain ink-and-place.at registered, currently a placeholder page; replace,
    no migration needed. Amira sole approver; delegated access securely supplied
    later, no fixed date. Agrees factual first-draft copy and standard scope/terms.
    Polite acceptance of suggested visual styles is not a fixed requirement.
    Select a style only after seeing the rendered options, and honestly describe
    anything to keep or avoid.`,
  },
];
