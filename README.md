<div align="center">

<img src="https://raw.githubusercontent.com/primer/octicons/main/icons/law-24.svg" width="52">

# The Living Playbook

**Siemens AG Challenge &nbsp;·&nbsp; Munich Hacking Legal 2026**

A playbook engine that converts static contract negotiation documents into a structured, AI-ready knowledge system. Upload a Word or Excel playbook, query it in plain language, and let lawyers approve every update before it goes live.

[![](https://img.shields.io/badge/Challenge-Siemens_AG-009999?style=flat-square)](https://github.com/Liquid-Legal-Institute/munich-hacking-legal-2026/tree/main/challenges/siemens)
[![](https://img.shields.io/badge/Event-Munich_Hacking_Legal_2026-00646E?style=flat-square)](https://github.com/Liquid-Legal-Institute/munich-hacking-legal-2026)
[![](https://img.shields.io/badge/AI-OpenAI-41AAAA?style=flat-square)](#quick-start)
[![](https://img.shields.io/badge/Python-3.10+-50BED7?style=flat-square)](#requirements)
[![](https://img.shields.io/badge/License-MIT-879BAA?style=flat-square)](LICENSE)

</div>

---

## Table of contents

- [The problem](#the-problem)
- [What we built](#what-we-built)
- [Features](#features)
- [Requirements](#requirements)
- [Quick start](#quick-start)
- [Usage examples](#usage-examples)
- [Architecture](#architecture)
- [Design principles](#design-principles)
- [Network setup](#network-setup)
- [Event schedule](#event-schedule)
- [Team](#team)
- [License](#license)

---

## <img src="https://raw.githubusercontent.com/primer/octicons/main/icons/file-24.svg" width="20"> The problem

A contract playbook is essentially a decision guide for negotiations. It tells your team what your preferred position is ("we always cap liability at contract value"), what you can concede ("we can accept up to 2x if the customer pushes"), and what you will never agree to ("no unlimited liability, ever"). It covers every clause that matters - liability, payment terms, warranties, confidentiality - and usually includes the reasoning behind each rule, suggested contract language, and escalation logic like "if the deal exceeds EUR 1M, route to senior legal."

Right now, these playbooks live in Word documents and Excel spreadsheets. That works, until it doesn't. You have to read through pages of text to find the answer to a single question. No AI tool can reason over a Word table the way a human can, so the knowledge stays locked in a format that only humans can interpret. And every time a negotiation surfaces a new insight - a customer who always pushes back on a specific clause, a fallback that consistently holds - that learning disappears instead of feeding back into the playbook. The document goes stale the moment it's published.

---

## <img src="https://raw.githubusercontent.com/primer/octicons/main/icons/rocket-24.svg" width="20"> What we built

[![](https://img.shields.io/badge/Status-Hackathon_Prototype-EC6602?style=flat-square)]()

We built a playbook engine with three layers.

The first layer parses existing Word and Excel playbooks and extracts structured rules - standard positions, fallback positions, red lines, decision logic, and clause-level reasoning - into a clean, machine-readable format. A lawyer can review exactly how the AI has interpreted each clause before anything goes live.

The second layer is a query interface. Lawyers and business users can ask the playbook questions in plain language and get direct, sourced answers. Every answer cites which rule it came from, so users can trace the logic.

The third layer closes the feedback loop. When a negotiation wraps up, the engine can ingest the outcome and propose updates to the playbook - flagging positions that may be outdated or clauses where real-world outcomes diverged from the documented guidance. A lawyer reviews and approves each proposed change before it takes effect. Nothing updates automatically.

The system works for any playbook, not just the NDA sample Siemens provided.

---

## <img src="https://raw.githubusercontent.com/primer/octicons/main/icons/zap-24.svg" width="20"> Features

[![](https://img.shields.io/badge/Playbook_Parsing-009999?style=flat-square)]()
[![](https://img.shields.io/badge/Natural_Language_Query-009999?style=flat-square)]()
[![](https://img.shields.io/badge/Lawyer_Review_Workflow-009999?style=flat-square)]()
[![](https://img.shields.io/badge/Self_Updating-009999?style=flat-square)]()

- **Upload any playbook** - accepts Word (.docx) and Excel (.xlsx) files; no reformatting required
- **Structured extraction** - rules are parsed into standard / fallback / red line categories with source citations
- **Plain language answers** - business users ask questions; the engine answers without legal jargon, with a source reference for each answer
- **Lawyer audit view** - every extracted clause and its AI interpretation is visible and editable before deployment
- **Feedback loop** - negotiation outcomes can be fed back in; the engine proposes specific updates and explains why
- **Human approval gate** - no playbook change goes live without explicit lawyer sign-off
- **Provider-agnostic design** - swap out the LLM backend without rebuilding the system

---

## <img src="https://raw.githubusercontent.com/primer/octicons/main/icons/checklist-24.svg" width="20"> Requirements

- Python 3.10 or higher
- An OpenAI API key (or any compatible LLM endpoint)
- pip (comes with Python)
- Git

---

## <img src="https://raw.githubusercontent.com/primer/octicons/main/icons/terminal-24.svg" width="20"> Quick start

**1. Clone the repository**

```bash
git clone https://github.com/your-org/the-living-playbook.git
cd the-living-playbook
```

**2. Set up a virtual environment**

```bash
python -m venv .venv
source .venv/bin/activate        # macOS / Linux
.venv\Scripts\activate           # Windows
```

**3. Install dependencies**

```bash
pip install -r requirements.txt
```

**4. Configure environment variables**

```bash
cp .env.example .env
```

Open `.env` in any text editor and fill in your values:

```env
OPENAI_API_KEY=your-api-key-here
```

**5. Start the application**

```bash
python app.py
```

The app runs at `http://localhost:8000` by default. Open that URL in your browser.

---

## <img src="https://raw.githubusercontent.com/primer/octicons/main/icons/comment-24.svg" width="20"> Usage examples

**Upload a playbook**

Drag and drop any `.docx` or `.xlsx` playbook file onto the upload screen. The engine parses it and shows you a structured breakdown of every extracted rule within seconds.

**Query the playbook**

```
You:    What is our position on liability caps?
Engine: Standard position: limit liability to the contract value.
        Fallback: up to 2x contract value if customer pushes.
        Red line: unlimited liability is never acceptable.
        Source: Liability section, row 4 of the NDA playbook.
```

**Review AI interpretation**

Before going live, open the "Lawyer Review" tab. Each extracted clause shows the original text alongside the AI's structured interpretation. Accept, edit, or reject each one individually.

**Submit negotiation feedback**

After a deal closes, upload the signed contract. The engine compares it against the playbook, identifies where the outcome diverged, and generates a proposed update with a plain-language explanation. A lawyer approves or dismisses each suggestion.

---

## <img src="https://raw.githubusercontent.com/primer/octicons/main/icons/database-24.svg" width="20"> Architecture

```
Input layer          Processing layer         Output layer
-----------          ----------------         ------------
Word / Excel   -->   Parser & Extractor  -->  Structured Rule Store
                          |                         |
                     LLM (OpenAI)              Query Interface
                          |                         |
                  Feedback Analyzer          Lawyer Review View
                          |
                  Update Proposal Engine
```

The parser reads the raw document and uses the LLM to identify and categorize each clause. Extracted rules are stored as structured JSON. The query interface runs against that structured store, not the raw document, which keeps answers consistent and traceable. The feedback analyzer compares incoming negotiation outcomes against the stored rules and flags divergences for lawyer review.

---

## <img src="https://raw.githubusercontent.com/primer/octicons/main/icons/shield-check-24.svg" width="20"> Design principles

These constraints come directly from Siemens and are non-negotiable.

[![](https://img.shields.io/badge/No_Vendor_Lock--in-1B1534?style=flat-square)]()
[![](https://img.shields.io/badge/No_Black_Boxes-1B1534?style=flat-square)]()
[![](https://img.shields.io/badge/Lawyer_in_Control-1B1534?style=flat-square)]()
[![](https://img.shields.io/badge/Repeatable_Workflow-1B1534?style=flat-square)]()

- The system does not depend on any single AI provider. Swap out OpenAI for any LLM that supports a compatible API.
- Every answer cites its source. Users always know which part of the playbook the system is drawing from.
- No update to the playbook goes live without a lawyer confirming it. The system proposes; humans decide.
- The same workflow that processes an NDA playbook works on any other contract type without code changes.

---

## <img src="https://raw.githubusercontent.com/primer/octicons/main/icons/wifi-24.svg" width="20"> Network setup

Three networks are available on campus during the hackathon. The LRZ network is the fastest and most reliable.

---

### Option 1 - LRZ WLAN (recommended)

[![](https://img.shields.io/badge/Network-mwn--events-009999?style=flat-square)]()
[![](https://img.shields.io/badge/Type-Paid_donated_for_event-41AAAA?style=flat-square)]()

This is a paid network donated specifically for the hackathon, so it tends to be more stable than the public alternatives.

| Field    | Value                                |
|----------|--------------------------------------|
| Network  | `mwn-events`                         |
| Username | `muni-2026425`                       |
| Password | `xuf5thfM`                           |
| Valid    | 22/04/2026 07:00 - 26/04/2026 20:00  |

If you run into connection issues, follow the official guide: [wlan.lrz.de/conferences/howto-en/muni-2026425/xuf5thfM](https://wlan.lrz.de/conferences/howto-en/muni-2026425/xuf5thfM)

---

### Option 2 - BayernWLAN

[![](https://img.shields.io/badge/Network-@BayernWLAN-879BAA?style=flat-square)]()
[![](https://img.shields.io/badge/Type-Free_public-AAAA96?style=flat-square)]()

Free public Wi-Fi across Bavaria, including the TUM campus. No account needed.

1. Go to Wi-Fi settings and connect to `@BayernWLAN`
2. A browser window will open asking you to accept the terms. If it doesn't open automatically, navigate to any website and it will redirect you there
3. This network is unencrypted. Use a VPN for anything sensitive

---

### Option 3 - Eduroam

[![](https://img.shields.io/badge/Network-eduroam-50BED7?style=flat-square)]()
[![](https://img.shields.io/badge/Type-Encrypted_academic-50BED7?style=flat-square)]()

Available if your home university participates in Eduroam. Configure it before arriving - setup during the event is slow. The [geteduroam app](https://www.geteduroam.app/enduser/connecting/) makes this straightforward.

1. Connect to the `eduroam` network
2. Log in with your full institutional email (e.g., `username@youruniversity.edu`) and your institution's password
3. Connection is encrypted

---

## <img src="https://raw.githubusercontent.com/primer/octicons/main/icons/calendar-24.svg" width="20"> Event schedule

[![](https://img.shields.io/badge/Location-TUM_Munich-009999?style=flat-square)]()
[![](https://img.shields.io/badge/Dates-April_24--26_2026-00646E?style=flat-square)]()

---

### <img src="https://raw.githubusercontent.com/primer/octicons/main/icons/sun-24.svg" width="16"> Friday, April 24

| Time | Event |
|------|-------|
| <img src="https://raw.githubusercontent.com/primer/octicons/main/icons/clock-24.svg" width="14"> 19:00 - 22:00 | **Pre-Event** at Vorhoelzer Forum - meet other hackers, start forming teams, short lightning talks on legal tech |

---

### <img src="https://raw.githubusercontent.com/primer/octicons/main/icons/sun-24.svg" width="16"> Saturday, April 25

| Time | Event |
|------|-------|
| <img src="https://raw.githubusercontent.com/primer/octicons/main/icons/clock-24.svg" width="14"> 09:00 - 10:00 | **Arrival, Registration, and Team Finding** - check in, grab a snack, connect with other participants |
| <img src="https://raw.githubusercontent.com/primer/octicons/main/icons/clock-24.svg" width="14"> 10:00 - 10:30 | **Opening Session** *(Vorlesungssaal)* - kick-off from organizers and sponsors |
| <img src="https://raw.githubusercontent.com/primer/octicons/main/icons/clock-24.svg" width="14"> 10:30 - 11:45 | **Challenge Presentations and Team Matching** - sponsors present each challenge with Q&A; submit your 1st, 2nd, and 3rd preference |
| <img src="https://raw.githubusercontent.com/primer/octicons/main/icons/alert-24.svg" width="14"> **11:35** | **Challenge registration deadline** - submit your preferences before this time |
| <img src="https://raw.githubusercontent.com/primer/octicons/main/icons/rocket-24.svg" width="14"> **12:00** | **Hacking starts** |
| <img src="https://raw.githubusercontent.com/primer/octicons/main/icons/clock-24.svg" width="14"> 12:15 | **Tech workshops** - Lovable (R2300) and OpenAI (R2370) |
| <img src="https://raw.githubusercontent.com/primer/octicons/main/icons/clock-24.svg" width="14"> 13:00 | **Lunch** |
| <img src="https://raw.githubusercontent.com/primer/octicons/main/icons/clock-24.svg" width="14"> 14:00 | **Tech workshop** - Google Cloud (R2370) |
| <img src="https://raw.githubusercontent.com/primer/octicons/main/icons/clock-24.svg" width="14"> 15:30 | **Coffee break** |
| <img src="https://raw.githubusercontent.com/primer/octicons/main/icons/clock-24.svg" width="14"> 19:00 | **Dinner** |
| <img src="https://raw.githubusercontent.com/primer/octicons/main/icons/moon-24.svg" width="14"> 23:00 | **Midnight snacks** |

---

### <img src="https://raw.githubusercontent.com/primer/octicons/main/icons/sun-24.svg" width="16"> Sunday, April 26

| Time | Event |
|------|-------|
| <img src="https://raw.githubusercontent.com/primer/octicons/main/icons/clock-24.svg" width="14"> 08:00 - 09:00 | **Breakfast** |
| <img src="https://raw.githubusercontent.com/primer/octicons/main/icons/rocket-24.svg" width="14"> 09:00 - 12:00 | **Hacking continues** |
| <img src="https://raw.githubusercontent.com/primer/octicons/main/icons/alert-24.svg" width="14"> **12:00** | **Submission deadline** - projects must be submitted by this time to be eligible for judging |
| <img src="https://raw.githubusercontent.com/primer/octicons/main/icons/clock-24.svg" width="14"> 12:00 | **Lunch** |
| <img src="https://raw.githubusercontent.com/primer/octicons/main/icons/megaphone-24.svg" width="14"> 13:00 - 14:00 | **Semi-finals** across 4 challenge tracks - jury selects 2 finalists per challenge (Rooms 1-4) |
| <img src="https://raw.githubusercontent.com/primer/octicons/main/icons/megaphone-24.svg" width="14"> **14:00** | **Grand Final** in the Main Lecture Hall - 2 finalists per challenge pitch to the full jury. Special guest: Georg Eisenreich, Bavarian State Minister of Justice |
| <img src="https://raw.githubusercontent.com/primer/octicons/main/icons/trophy-24.svg" width="14"> 15:30 - 16:00 | **Awards ceremony** |
| <img src="https://raw.githubusercontent.com/primer/octicons/main/icons/check-circle-24.svg" width="14"> **16:00** | **End of event** |

---

## <img src="https://raw.githubusercontent.com/primer/octicons/main/icons/people-24.svg" width="20"> Team

[![](https://img.shields.io/badge/Team-Munich_Hacking_Legal_2026-4A2076?style=flat-square)]()

| Name | Role |
|------|------|
| C. Oflazoglu | - |
| M. Becevova | - |
| N. N. Muller | - |
| J. Urgan | - |

Built at [Munich Hacking Legal 2026](https://github.com/Liquid-Legal-Institute/munich-hacking-legal-2026) for the Siemens AG Challenge.

---

## <img src="https://raw.githubusercontent.com/primer/octicons/main/icons/law-24.svg" width="20"> License

MIT License. See [LICENSE](LICENSE) for details.

---

<div align="center">

[![](https://img.shields.io/badge/Siemens_AG_Challenge-009999?style=for-the-badge)](https://github.com/Liquid-Legal-Institute/munich-hacking-legal-2026/tree/main/challenges/siemens)

*Built at Munich Hacking Legal 2026 - April 25-26, TUM Munich*

</div>
