<!-- STAGING HEADER — STRIP THIS COMMENT BEFORE COMMITTING TO THE PUBLIC REPO
---
title: AxoloDAO — root README (one added section: System and Xovi)
audience: Kira (Protocol Engineer, Zenbit)
date: 2026-09-02
status: draft for review
---
Rationale for the comment wrapper: this file ships to a PUBLIC repository, where a rendered
`audience:` frontmatter block would be both meaningless to readers and an unnecessary disclosure.
The dossier frontmatter is preserved here for the review pass and MUST NOT be committed.
GATE (run before any commit to the public repo; must return nothing):
    grep -n "STAGING HEADER" README.md Site/README.md
The single-view diagram for this artifact sits inside the added "6. System and Xovi" section,
because a diagram bolted above the project title would break the README it belongs to.
-->

# 🧬 AxoloDAO

AxoloDAO is a **[microDAO](./Docs/English/Concepts/4.%20MicroDAOs.md)** — an onchain organization built on ENS identity, Safe treasury, and EAS attestations — dedicated to advancing **[conservation and scientific research for Ambystoma species in Mexico](https://paragraph.com/@zenbit-2/we-are-axolodao)** through public digital infrastructure, collaborative governance, and transparent onchain/offchain coordination. This repository documents the conceptual, technical, and governance foundations of the AxoloDAO system.


## 🌎 1. Why AxoloDAO

AxoloDAO connects conservation actors, researchers, and communities around a shared mission:

- Democratize access to ecological and scientific data.
- Preserve the genetic diversity of native axolotl populations.
- Enable restoration of critical freshwater habitats.
- Build traceability and institutional trust through blockchain infrastructure.


## ⚠️ 2. The Conservation Crisis of the Genus *Ambystoma*

The genus *Ambystoma* encompasses approximately **32 salamander species across North America**, of which
**17 occur in Mexico** and **16 are endemic to the country** — approximately half of the genus (the North
American and endemic counts are approximate and not individually sourced here; the Mexican count matches the
17 species sheets published on this site, source: `Site/src/content/species/`, measured 2026-09-02). Despite
this, Mexico contributes only a small fraction of global scientific publications on *Ambystoma*. The Mexican axolotl (*Ambystoma mexicanum*) alone accounts for a disproportionate share of worldwide research output, consolidating its role as a dominant biomedical model organism.

### Systemic Extinction Pressures

The survival of Mexican *Ambystoma* species is threatened by:

- Habitat degradation and hydrological disruption
- Water pollution and eutrophication
- Invasive species (e.g., tilapia, carp)
- Climate-driven ecosystem instability
- Genetic fragmentation from isolated populations

According to IUCN classifications, at least 9 Mexican endemic species are categorized as Critically Endangered, with additional taxa listed as Endangered — meaning a majority of endemic species face extremely high or very high extinction risk.<sup>[1](https://www.iucnredlist.org/search?query=ambystoma&searchType=species)</sup>

### Global Research Imbalance

While *A. mexicanum* is globally recognized for its regenerative capabilities — regenerating limbs, spinal cord, cardiovascular tissue, and complex neural structures — most research infrastructure and funding is concentrated outside Mexico. This creates structural asymmetry between biological origin and scientific benefit.

AxoloDAO addresses this imbalance by building sovereign, transparent, and collaborative conservation infrastructure rooted in Mexico.


## ⛓️ 3. Our Approach: Digital Public Infrastructure for Conservation

AxoloDAO treats conservation data as a shared public good: non-rival, non-excludable, and globally accessible. Any actor — researchers, communities, institutions, or donors — can access, verify, and build on the same underlying records without depleting them or requiring centralized permission.

Our strategy is designed to correct informational fragmentation and institutional asymmetries that prevent coordinated, evidence-based conservation. We deploy decentralized infrastructure — Ethereum-based primitives, open attestations, transparent treasuries, standardized identifiers, and participatory governance — to interconnect science, communities, and institutions.

Conservation-relevant data — biological, environmental, genetic — must be:

- Recorded
- Verified
- Standardized
- Publicly accessible
- Cryptographically attributable

Through this architecture, daily conservation operations become persistent, searchable records that enable:

- Research centers to demonstrate verifiable standards of care
- Researchers to track longitudinal phenotypes and population dynamics
- Donors to observe measurable environmental impact
- Communities to participate in oversight and governance

### Onchain Integration Layer

AxoloDAO's architecture is built on:

- **Smart contracts** to register specimens, habitats, and research metadata
- **Onchain attestations (EAS)** to validate provenance from accredited actors
- **ENS-based decentralized identities** for institutions and conservation nodes
- **Programmable treasuries (Safe)** for impact-based resource allocation

The ENS identities and the Safe treasury are live today (§5). The specimen registry and the attestation
layer are built and tested, but **nothing is deployed or registered on any chain as of 2026-09-02** — see
§6.

By aligning verifiable data capture with governance and finance, conservation becomes transparent, auditable, and collaborative public infrastructure.

---

## 🎯 4. Strategic Objectives

### A. Axolotl & Environment Data System

A decentralized, interoperable registry integrating:

- Specimen-level biological data (taxonomy, reproductive data, phenotypes)
- Habitat metadata and environmental signals (temperature, pH, dissolved oxygen, GPS coordinates)
- Population-level indicators (demography, eDNA-based metrics, genetic structure)

This system reduces fragmentation by unifying reporting standards and enabling cross-site comparability over time.

---

### B. Onchain Repository of Native Germplasm

Global captive populations of multiple *Ambystoma* species — not only *A. mexicanum* — face varying degrees of genetic bottlenecks, habitat isolation, and population decline. While *A. mexicanum* represents the most internationally studied species, Mexico hosts 16 endemic *Ambystoma* taxa whose wild genetic diversity remains insufficiently documented, digitized, and protected.

AxoloDAO proposes a decentralized, species-wide germplasm repository designed to support **all Mexican *Ambystoma* species**, including critically endangered taxa such as *A. dumerilii*, *A. taylori*, *A. andersoni*, and others.

This biorepository framework includes:

- Ethical genomic and environmental DNA (eDNA) sampling compliant with national and international regulation
- Whole-genome, transcriptomic, and population-level genetic references across endemic species
- Distributed storage infrastructure (e.g., IPFS-based archives and redundant preservation layers)
- Onchain provenance metadata linking specimens, habitats, and research actors
- Participatory governance mechanisms to define access rights, benefit-sharing, and research coordination

By expanding the repository beyond a single model organism, AxoloDAO reinforces biodiversity-level conservation, protects evolutionary lineages, and establishes sovereign digital stewardship over the full spectrum of Mexico's endemic *Ambystoma* heritage.

---

### C. Restoration Through MicroDAOs

Localized restoration initiatives are coordinated through modular microDAOs that follow a six-phase adoption framework — from onchain identity registration and public presentation through treasury management, operational implementation, and onchain funding integration. Each phase adds a composable layer of infrastructure that enables:

- Environmental monitoring through sensor-linked reporting
- Transparent treasury management
- Impact-based funding mechanisms
- Community-level governance participation

This model aligns financial incentives with measurable ecological outcomes and strengthens local custodianship.

## 🔗 5. Onchain Structure

AxoloDAO operates through ENS-based identities and modular organizational nodes. The onchain structure, verified from ENS registries on Ethereum mainnet and OP Mainnet, is organized as follows:

| ENS Domain | Resolved Address | Role |
|---|---|---|
| [axolodao.eth](https://app.ens.domains/axolodao.eth) | resolve via ENS | Primary administrative identity |
| [treasury.axolodao.eth](https://app.ens.domains/treasury.axolodao.eth) | `0xbDF701408aD237faA2d5d3177ae257aF35265dbb` | Safe multisig treasury (OP Mainnet) |
| [zenbit.axolodao.eth](https://app.ens.domains/zenbit.axolodao.eth) | resolve via ENS | Infrastructure and system design node |
| [xolotlcalli.axolodao.eth](https://app.ens.domains/xolotlcalli.axolodao.eth) | resolve via ENS | Conservation and biomuseum node |
| [ndali.axolodao.eth](https://app.ens.domains/ndali.axolodao.eth) | — | Community articulation and coordination node |
| [lups-plantae.axolodao.eth](https://app.ens.domains/lups-plantae.axolodao.eth) | — | Additional participant node |
| [lego-lvsg.axolodao.eth](https://app.ens.domains/lego-lvsg.axolodao.eth) | — | Additional participant node |

The treasury (`treasury.axolodao.eth`) is a Safe multisig on OP Mainnet — 2/3 by internal decision, 2/4
onchain while the fourth signer is retired. Its transaction history is public and can be read directly from
the Safe. Zenbit and the AxoloDAO treasury have both funded parts of Biomuseum Xolotlcalli's operational
infrastructure onchain; the share is not currently published because no measured, sourced figure exists for
it.

## 🧩 6. System and Xovi

Three surfaces carry the same record: a public site that renders it, an application that captures it, and an
onchain layer that will anchor it.

```text
 BioMuseo Xolotlcalli ──► operations workbook ──► Site data:* scripts ──► axolodao.org
   tanks · specimens                                                       (public record)
        │
        └── 24/7 stream ──► Xovi · xovi.axolodao.org ──► operator + verifier queues
                                                                │
                                                                ▼
                                        AxoloDAO System · private Foundry repository
                                        4 frozen EAS schemas · weekly Merkle root
                                        built and tested · nothing deployed · pre-audit
```

**The site is the render source of truth.** Every public **operational** figure on axolodao.org — water
quality, the bitácora and the specimen roster — is generated from the Biomuseo's operations workbook by the
`data:water`, `data:ajolotes` and `data:ops` scripts in `Site/scripts/` and committed as JSON — the
build never reaches a live database. Today that is 1,128 water-quality measurements (source:
`Site/public/data/water-quality/measurements-all.json`, measured 2026-09-02), 1,229 operations-log entries
(source: `Site/public/data/ops/bitacora.json`, measured 2026-09-02) and 11 ejemplares in the current bundle
(source: `Site/src/data/ajolotes/bundle.json`, measured 2026-09-02). The site holds no visitor identity: no
forms, no accounts, no wallet connection. See [`Site/README.md`](./Site/README.md) for the scripts, their
inputs and their outputs.

**Xovi captures observations.** [xovi.axolodao.org](https://xovi.axolodao.org/) is the interaction layer
over the 24/7 stream from the biomuseum: operators record water cycles and readings, viewers submit clips of
axolotl behaviour, and human verifiers confirm them before anything is treated as a fact. Machine-produced
values enter as *proposals*, never as confirmed records. Xovi is pre-launch; no XOVI token has been issued
and no Xovi-specific contract is deployed.

**The AxoloDAO onchain system is a private Foundry repository.** It holds the access manager (ENS-bound
roles), the record registry and its validator, the EAS attestor and a weekly Merkle batcher. It is **built
and tested (45 tests pass, 1 fork test skipped without an RPC; no CI); nothing is deployed or registered on
any chain as of 2026-09-02**; it is Sepolia-deployable, and Base mainnet comes only after an external audit
and ratification of the `SpecimenObserved` / `CareEventLogged` vocabulary by Xolotlcalli. The repository is private and is not linked from here.

**Four canonical EAS schemas were frozen on 2026-07-18:** `TankReading`, `WaterQualitySummary`,
`SpecimenObserved` and `CareEventLogged`. Their UIDs are *chain-independent* — the UID is
`keccak256(schemaString, resolver = address(0), revocable = true)`, and neither a chain id nor a contract
address enters the hash, so one schema has exactly one UID on every chain and independent implementations
converge on it without coordinating. None of the four is registered on any chain as of 2026-09-02.

## 🤝 7. Onchain Members

### Zenbit / [`zenbit.axolodao.eth`](https://app.ens.domains/zenbit.axolodao.eth)
Digital public infrastructure contributor and system design lead.

- [Instagram](https://www.instagram.com/zenbit.eth/)
- [X](https://x.com/zenbitMX)

---

### Xolotlcalli BioMuseum / [`xolotlcalli.axolodao.eth`](https://app.ens.domains/xolotlcalli.axolodao.eth)
Conservation and field-practice node connected to biodiversity operations.

- [Instagram](https://www.instagram.com/xolotlcalli.mx/)
- [Youtube](https://www.youtube.com/@Xolotlcalli)
- [X](https://x.com/Xolotlcalli_mx)

---

### Ndali Networking Center / [`ndali.axolodao.eth`](https://app.ens.domains/ndali.axolodao.eth)
Community articulation and stakeholder coordination node.

- [Instagram](https://www.instagram.com/ndali_centro_de_conexion/)

---

### Additional Onchain Participants

- [`lups-plantae.axolodao.eth`](https://app.ens.domains/lups-plantae.axolodao.eth)
- [`lego-lvsg.axolodao.eth`](https://app.ens.domains/lego-lvsg.axolodao.eth)


## 🏫 8. Offchain Affiliations & Collaborations

### Academic Body of Ecology and Wildlife Diversity (CAEyDF)
Research and scientific collaboration for ecology, biodiversity, and species-conservation frameworks.

- [Instagram](https://www.instagram.com/ecoydiv_faunistica.uaq/)

---

### Ministry of Environment and Natural Resources (SEMARNAT)
Regulatory alignment for protected species and environmental conservation processes in Mexico.

- [Instagram](https://www.instagram.com/semarnat_mexico/)
- [Website](https://www.gob.mx/semarnat)

---

### Secretary of Culture of the State of Querétaro (SECULT)
Public-sector collaboration connecting conservation with cultural and community initiatives.

- [Instagram](https://www.instagram.com/secultqro/)
- [Website](https://queretaro.gob.mx/web/cultura)

---

### São Paulo Institute of Technology and Leadership (INTELI)
Academic collaboration; origin of the student prototypes that seeded the onchain system design. Not a
registration or sign-off gate for any part of the system.

- [Instagram](https://www.instagram.com/inteli_edu/)


## 📚 9. Related Articles & Materials

- [How to onboard startups into Ethereum](https://paragraph.com/@zenbit-2/how-to-onboard-startups-into-ethereum)
- [Zenbit x Axolotarium collaboration](https://paragraph.com/@zenbit-2/zenbit-axolotarium-collaboration)
- [We are AxoloDAO](https://paragraph.com/@zenbit-2/we-are-axolodao)
- [StartupChain — ENS "Best use of ENS", 3rd place, ETHGlobal New York 2025](https://ethglobal.com/showcase/startupchain-0fyf5)
- [AxoloDAO system with INTELI slides](https://www.figma.com/deck/YvgHJYW8NET5hYxjF9XBw5/Proyecto-Sistema-AxoloDAO?node-id=84-15&t=ivsicLqyXdn7cgKO-1)

### 📂 Documentation Structure

This repository includes a `Docs/` directory with language-specific subfolders:

- [`Docs/English/`](./Docs/English/)
- [`Docs/Español/`](./Docs/Español/)
- [`Docs/Portugues/`](./Docs/Portugues/)

Each folder contains conceptual documentation and system descriptions.


## 📬 10. Contact

`hola@axolodao.org`

## References

1. IUCN Red List. (n.d.). *Ambystoma species assessments*. https://www.iucnredlist.org/search?query=ambystoma&searchType=species