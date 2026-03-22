# AxoloDAO — Claude Code Context

## Project Overview

**AxoloDAO** is a microDAO dedicated to conservation and scientific research for *Ambystoma* species (axolotls) in Mexico. This repository documents the conceptual, technical, and governance foundations of the AxoloDAO system.

Primary audience: conservation researchers, Ethereum builders, academic institutions, and community members across Latin America. All documentation is trilingual: English, Spanish (Español), Portuguese (Português).

See [`README.md`](./README.md) for the full project mission and onchain structure.

---

## Repository Structure

```
AxoloDAO/
├── README.md                          ← Project overview & onchain structure
├── CLAUDE.md                          ← This file
├── .gitignore
├── Docs/
│   ├── English/
│   │   ├── Concepts/                  ← Foundational concept docs (numbered)
│   │   │   ├── 1. PublicGoods.md
│   │   │   ├── 2. Ethereum.md
│   │   │   ├── 3. DAOs.md
│   │   │   └── 4. MicroDAOs.md
│   │   ├── Design/                    ← Design & brand guidelines (numbered)
│   │   │   ├── 1. TrustlessPermisionless.md
│   │   │   ├── 2. Online&Onchain.md
│   │   │   └── ManualMarcaAxolodao.md
│   │   └── Content/                   ← (reserved for future content pieces)
│   ├── Español/
│   │   ├── ConceptosClave/
│   │   ├── Lineamientos de Diseño/
│   │   └── Presentaciones/
│   └── Portugues/
│       ├── ConceitosChave/
│       ├── DiretrizesDeProjeto/
│       └── Apresentações/
├── site/                              ← Astro landing site (future)
└── Reviews/                           ← (reserved for peer review notes)
```

---

## Documentation Conventions

### Language & Tone
- **Academic tone**: precise, well-sourced, non-promotional
- Write in the **target language natively** — do not translate word-for-word; adapt phrasing naturally
- Avoid jargon unless explained on first use
- Present tense for current facts; past tense for historical events

### Citations
- Use inline superscript footnotes: `<sup>[1](url)</sup>`
- List all references in a `## References` section at the end of each file
- Preferred sources: academic papers, Ethereum documentation, institutional data, peer-reviewed research

### File Naming
- Concept and Design docs use **numbered prefixes**: `1. PublicGoods.md`, `2. Ethereum.md`, etc.
- Brand/manual docs: no number prefix (`ManualMarcaAxolodao.md`)
- Use spaces in filenames (matches existing convention)

### Cross-References
- Always use **relative markdown links** between files
- Example: `[Online & Onchain](../Design/2. Online%26Onchain.md)`
- Cross-reference the README when mentioning AxoloDAO's structure or members

### Language Parity
- **English is the source language** for all concept and design docs
- Spanish and Portuguese versions must match English structure (same sections, headings, references)
- Translations must go in the corresponding language subfolder with matching filename conventions

---

## Core Terminology Glossary

Keep these terms consistent across all languages:

| English | Español | Português |
|---------|---------|-----------|
| microDAO | microDAO | microDAO |
| public goods | bienes públicos | bens públicos |
| attestation | atestación | atestação |
| smart contract | contrato inteligente | contrato inteligente |
| trustless | sin confianza centralizada | sem confiança centralizada |
| permissionless | sin permiso | sem permissão |
| onchain | onchain | onchain |
| offchain | offchain | offchain |
| ENS | ENS | ENS |
| Safe (treasury) | Safe | Safe |
| EAS | EAS | EAS |
| wallet | billetera / wallet | carteira / wallet |
| staking | staking | staking |
| governance | gobernanza | governança |

---

## Key Concepts (Quick Reference)

- **Public Goods**: Non-rival, non-excludable resources. Ethereum treated as digital public infrastructure.
- **Ethereum**: Three dimensions — decentralized network, ETH asset, smart-contract platform. Post-Merge: 99.95% less energy.
- **DAOs**: Internet-native organizations. AxoloDAO follows small-DAO design principles (7–14 members, modular nodes).
- **MicroDAOs**: Lightweight Ethereum onboarding via ENS (identity) + Safe (treasury) + EAS (attestations).
- **Trustless/Permissionless**: Core Ethereum properties enabling open participation without central authority.
- **Online vs Onchain**: Web2 (service logic) vs Web3 (ownership/verification logic). Hybrid architectures recommended.

---

## Workflow Rules for Claude

1. **Always read existing docs before writing new ones** — check for related content, reuse structure and citation style
2. **Check for placeholder files** — some files exist with only 1 line; treat them as empty and fill with full content
3. **English first** — write or complete the English version before translating to ES/PT
4. **Maintain trilingual parity** — when a doc is updated in EN, flag the ES and PT versions as needing update
5. **Do not invent facts** — all claims about Ethereum metrics, species counts, or institutional data must come from cited sources
6. **Do not add emojis** unless explicitly requested
7. **Brand manual requires Figma reference** — wait for user to share Figma link before writing `ManualMarcaAxolodao.md`

---

## Onchain Structure (Quick Reference)

- `axolodao.eth` — primary admin identity
- `treasury.axolodao.eth` — treasury
- `zenbit.axolodao.eth` — digital infrastructure & system design lead
- `xolotlcalli.axolodao.eth` — conservation & field practice node
- `ndali.axolodao.eth` — community articulation & coordination

---

## Landing Site

- Location: `/site/` directory
- Stack: **Astro** (static, content-first, multilingual)
- Subsites to link: Data System, Germplasm Repository, Onchain Pools (all future/placeholder), Member org social links
- Language prefixes: `/es/`, `/pt/`
