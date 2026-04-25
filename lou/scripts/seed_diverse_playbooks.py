"""Seed Lou with 4 diverse published playbooks for a rich Mega Brain demo."""
from __future__ import annotations
import hashlib
import json
import sys
import os
from datetime import datetime
from pathlib import Path

# Allow importing backend modules directly
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from sqlmodel import Session, select
from backend.core.database import engine
from backend.core.schema import (
    MegaBrainEntry,
    Playbook,
    PlaybookClause,
    PlaybookCommit,
    PlaybookStatus,
)
from backend.services.embedder import embed_text
from backend.services.vector_store import upsert_mega_brain_clause

PLAYBOOKS = [
    {
        "playbook_id": "ip-licensing-playbook",
        "name": "IP Licensing Playbook",
        "description": "Standard positions for intellectual property licensing and technology transfer agreements.",
        "owner": "Peter",
        "source_filename": "ip-licensing-playbook.xlsx",
        "clauses": [
            {
                "clause_number": "1",
                "clause_id": "license-scope",
                "clause_name": "License Scope and Grant",
                "why_it_matters": "Defines exactly what IP is being licensed, to whom, and under what conditions. Vague scope creates enforcement gaps.",
                "preferred_position": "Non-exclusive, non-transferable, non-sublicensable license limited to the field of use specified in Schedule A. Any use outside this field requires prior written consent.",
                "fallback_1": "Non-exclusive license with sublicensing permitted to wholly-owned subsidiaries only, subject to flow-down obligations.",
                "fallback_2": "Non-exclusive license with sublicensing permitted to named affiliates with prior written approval.",
                "red_line": "Exclusive license that restricts licensor's ability to continue using its own IP.",
                "escalation_trigger": "Any request for exclusivity, broad field-of-use, or sublicensing to third parties.",
            },
            {
                "clause_number": "2",
                "clause_id": "ip-ownership",
                "clause_name": "Ownership of IP and Improvements",
                "why_it_matters": "Any IP or improvements created during the engagement must remain with the licensor unless explicitly agreed otherwise.",
                "preferred_position": "All improvements, modifications, and derivative works of Licensed IP remain the exclusive property of Licensor. Licensee grants licensor a royalty-free license to any severable Licensee improvements.",
                "fallback_1": "Improvements that are inseparable from Licensed IP vest in Licensor; standalone Licensee improvements vest in Licensee, with cross-license.",
                "fallback_2": "Joint ownership of improvements with mutual non-exclusive license, subject to joint commercialization committee.",
                "red_line": "Any arrangement that vests ownership of core Licensed IP or foundational patents in the Licensee.",
                "escalation_trigger": "Licensee requests ownership or co-ownership of any improvements to Licensed IP.",
            },
            {
                "clause_number": "3",
                "clause_id": "royalties-payment",
                "clause_name": "Royalties and Payment Terms",
                "why_it_matters": "Defines the commercial consideration for the license. Ambiguous payment terms lead to disputes.",
                "preferred_position": "Running royalty of [X]% on Net Sales, payable quarterly within 30 days of period end, with minimum annual royalty floor of EUR [Y].",
                "fallback_1": "Running royalty payable semi-annually with 45-day payment window; minimum floor negotiable.",
                "fallback_2": "Lump-sum upfront license fee in lieu of running royalties, subject to audit rights.",
                "red_line": "Royalty-free perpetual license or deferred payment beyond 90 days without security.",
                "escalation_trigger": "Licensee requests royalty-free terms, payment deferrals exceeding 90 days, or no minimum floor.",
            },
            {
                "clause_number": "4",
                "clause_id": "audit-rights",
                "clause_name": "Audit and Record-Keeping",
                "why_it_matters": "Without audit rights, royalty compliance is unenforceable. Records must be kept for verification.",
                "preferred_position": "Licensee shall maintain complete and accurate records for 5 years. Licensor may audit once per calendar year on 30 days' notice. Underpayments > 5% trigger cost recovery.",
                "fallback_1": "Audit once per 2 years; cost recovery threshold at 8% underpayment.",
                "fallback_2": "Audit rights via agreed third-party auditor; results shared under confidentiality.",
                "red_line": "No audit rights, or audit frequency limited to once every 3+ years.",
                "escalation_trigger": "Licensee refuses audit rights or requests limitation to 3+ year intervals.",
            },
            {
                "clause_number": "5",
                "clause_id": "confidentiality-ip",
                "clause_name": "Confidentiality of Licensed Technology",
                "why_it_matters": "Licensed technology is a trade secret. Without confidentiality, the IP loses legal protection.",
                "preferred_position": "Licensee shall treat Licensed IP as strictly confidential, disclose only on need-to-know basis, and maintain security measures equivalent to those protecting its own most sensitive IP, but no less than reasonable care.",
                "fallback_1": "Reasonable care standard acceptable if backed by documented security procedures.",
                "fallback_2": "Confidentiality obligation limited to 7 years post-termination for specific technical information.",
                "red_line": "Confidentiality limited to 3 years or less, or 'reasonable care' without any defined security baseline.",
                "escalation_trigger": "Licensee requests confidentiality period shorter than 7 years or no security standard baseline.",
            },
            {
                "clause_number": "6",
                "clause_id": "term-termination-ip",
                "clause_name": "License Term and Termination",
                "why_it_matters": "The duration and exit conditions define the entire commercial relationship. Termination triggers must be clear and balanced.",
                "preferred_position": "Initial term of 3 years, auto-renewing for 1-year periods unless terminated with 6 months' notice. Immediate termination for material breach (30-day cure), insolvency, or challenge to Licensed IP validity.",
                "fallback_1": "5-year initial term with 90-day termination notice; 60-day cure period for material breach.",
                "fallback_2": "Fixed term only (no auto-renewal) with defined extension process.",
                "red_line": "Perpetual irrevocable license, or no right to terminate for IP validity challenge.",
                "escalation_trigger": "Any request for perpetual license, removal of IP challenge termination right, or cure periods > 60 days.",
            },
            {
                "clause_number": "7",
                "clause_id": "representations-warranties",
                "clause_name": "Representations and Warranties",
                "why_it_matters": "Licensor needs to be honest about what it knows and doesn't know about the IP. Over-warranting creates liability.",
                "preferred_position": "Licensor warrants: (a) it has authority to grant license; (b) to its knowledge, Licensed IP does not infringe third-party rights. All other warranties disclaimed to fullest extent permitted by law.",
                "fallback_1": "Warranty of authority plus IP non-infringement warranty limited to actual knowledge.",
                "fallback_2": "Authority warranty only; IP non-infringement subject to 'as-is' disclaimer.",
                "red_line": "Absolute warranty of non-infringement or fitness for a specific purpose.",
                "escalation_trigger": "Licensee requests any warranty beyond authority and knowledge-qualified non-infringement.",
            },
            {
                "clause_number": "8",
                "clause_id": "governing-law-ip",
                "clause_name": "Governing Law and Dispute Resolution",
                "why_it_matters": "Dispute resolution forum and law determines enforcement options and legal predictability.",
                "preferred_position": "Governed by German law. Disputes submitted to ICC arbitration in Munich. Language: English. Three-arbitrator panel for disputes > EUR 500k.",
                "fallback_1": "German law with litigation in Munich courts (LG München I).",
                "fallback_2": "English law with ICC arbitration in London if Licensee is a UK entity.",
                "red_line": "Governing law of a jurisdiction with no established IP enforcement framework, or binding arbitration removed.",
                "escalation_trigger": "Jurisdiction outside EU/UK/US requested, or arbitration clause entirely rejected.",
            },
        ],
    },
    {
        "playbook_id": "supplier-confidentiality-playbook",
        "name": "Supplier Confidentiality Playbook",
        "description": "NDA positions for supplier and manufacturing partner confidentiality agreements.",
        "owner": "Peter",
        "source_filename": "supplier-confidentiality-playbook.xlsx",
        "clauses": [
            {
                "clause_number": "1",
                "clause_id": "supply-chain-confidentiality",
                "clause_name": "Supply Chain and Manufacturing Confidentiality",
                "why_it_matters": "Technical specifications, process know-how, and supplier data shared during manufacturing partnerships are commercially critical trade secrets.",
                "preferred_position": "All technical specifications, manufacturing process parameters, tooling designs, quality standards, and supplier data shared by Disclosing Party are Confidential Information subject to strict non-disclosure. Receiving Party may only use information for the specific manufacturing engagement.",
                "fallback_1": "Confidential Information limited to documents marked 'Confidential'; oral disclosures confirmed in writing within 10 days.",
                "fallback_2": "Broad definition of Confidential Information but with carve-out for information independently developed by Receiving Party with documented evidence.",
                "red_line": "Confidential Information definition that excludes technical specifications or manufacturing processes.",
                "escalation_trigger": "Supplier requests exclusion of technical specifications from confidentiality scope.",
            },
            {
                "clause_number": "2",
                "clause_id": "technical-specs-protection",
                "clause_name": "Protection of Technical Specifications",
                "why_it_matters": "Technical drawings, tolerances, and material specifications represent core IP. Misuse could enable competitor production.",
                "preferred_position": "Technical Specifications may only be used for the agreed manufacturing scope. No reverse engineering, no benchmarking, no sharing with competing manufacturers. Physical copies must be stored in secure facilities and destroyed upon request.",
                "fallback_1": "Technical Specifications may not be reverse engineered or used for competing products; no destruction requirement if electronic copies are securely deleted.",
                "fallback_2": "Use restriction to manufacturing scope only; physical security measures subject to supplier's existing ISO 27001 certification.",
                "red_line": "No restriction on using technical specifications for Receiving Party's own product development.",
                "escalation_trigger": "Supplier claims right to use technical specifications for internal product development or benchmarking.",
            },
            {
                "clause_number": "3",
                "clause_id": "subcontractor-disclosure",
                "clause_name": "Subcontractor and Third-Party Disclosure",
                "why_it_matters": "Suppliers frequently use sub-tier suppliers. Confidential information passed downstream must remain controlled.",
                "preferred_position": "Disclosure to subcontractors only with prior written approval and binding back-to-back NDA with equivalent protections. Supplier remains jointly liable for subcontractor breaches.",
                "fallback_1": "Disclosure to approved subcontractors (listed in Schedule) with back-to-back NDA obligations; joint liability retained.",
                "fallback_2": "Disclosure to subcontractors without pre-approval if subcontractors execute NDA with equivalent terms; supplier notifies within 5 business days.",
                "red_line": "Supplier may freely share with subcontractors without notice, approval, or back-to-back NDA.",
                "escalation_trigger": "Supplier rejects joint liability for subcontractor breaches or refuses back-to-back NDA requirement.",
            },
            {
                "clause_number": "4",
                "clause_id": "quality-pricing-info",
                "clause_name": "Quality Data and Pricing Confidentiality",
                "why_it_matters": "Defect rates, pricing, and quality metrics reveal competitive advantage and commercial strategies.",
                "preferred_position": "Pricing, cost breakdowns, defect rate data, and quality audit results are Confidential Information. Not to be disclosed to any third party including competing customers of Supplier.",
                "fallback_1": "Pricing and quality data confidential; defect rates may be disclosed in aggregated, anonymized form to regulators.",
                "fallback_2": "Pricing confidential; quality data may be shared with Supplier's parent company under existing group NDA.",
                "red_line": "Pricing or quality data sharable with third parties or competititors of Disclosing Party.",
                "escalation_trigger": "Supplier requests right to share pricing or quality benchmarks with its other customers or affiliates.",
            },
            {
                "clause_number": "5",
                "clause_id": "audit-rights-supplier",
                "clause_name": "Audit Rights for Compliance",
                "why_it_matters": "Compliance with confidentiality and data security obligations must be verifiable, especially in regulated supply chains.",
                "preferred_position": "Disclosing Party may audit Receiving Party's information security and confidentiality compliance annually, with 2 weeks' notice. Audit conducted by Disclosing Party or agreed third-party auditor.",
                "fallback_1": "Annual audit right by agreed third-party auditor only; results confidential to both parties.",
                "fallback_2": "Audit triggered only by specific, documented breach suspicion; scope limited to relevant systems.",
                "red_line": "No audit rights whatsoever.",
                "escalation_trigger": "Supplier rejects all audit rights or limits audits to self-certification only.",
            },
            {
                "clause_number": "6",
                "clause_id": "return-destruction-supplier",
                "clause_name": "Return and Destruction of Technical Information",
                "why_it_matters": "Technical information must be recoverable or provably destroyed at contract end to prevent ongoing IP risk.",
                "preferred_position": "Within 30 days of engagement end or on request: return all physical materials and certify destruction of electronic copies. Supplier may retain one archival copy under ongoing confidentiality obligations.",
                "fallback_1": "Return or destruction within 60 days; archival copy permitted under ongoing NDA.",
                "fallback_2": "Destruction certification acceptable without return; 90-day window.",
                "red_line": "No return/destruction obligation, or indefinite retention permitted.",
                "escalation_trigger": "Supplier refuses destruction obligation or claims right to retain technical information indefinitely post-contract.",
            },
            {
                "clause_number": "7",
                "clause_id": "term-supplier-nda",
                "clause_name": "NDA Term and Survival",
                "why_it_matters": "Manufacturing NDAs must survive contract end to protect long-lived trade secrets.",
                "preferred_position": "NDA effective for duration of supply relationship plus 5 years. Confidentiality obligations for trade secrets survive indefinitely.",
                "fallback_1": "NDA survives relationship end by 3 years; trade secret obligations for 7 years.",
                "fallback_2": "2-year survival acceptable only if technical specifications exclude core manufacturing processes.",
                "red_line": "Confidentiality obligations expire at contract end with no survival.",
                "escalation_trigger": "Supplier requests confidentiality obligations to expire at or shortly after contract end.",
            },
            {
                "clause_number": "8",
                "clause_id": "governing-law-supplier",
                "clause_name": "Governing Law",
                "why_it_matters": "Manufacturing disputes often involve technical evidence and multiple jurisdictions. Clear governing law is essential.",
                "preferred_position": "Governed by German law. Disputes before LG München I. Summary injunction available in any jurisdiction for imminent disclosure risk.",
                "fallback_1": "EU member state law of Disclosing Party's registered office; injunction carve-out.",
                "fallback_2": "Neutral arbitration (ICC or DIS) if parties are from different EU member states.",
                "red_line": "Governing law of a jurisdiction without meaningful trade secret protection (e.g., offshore low-regulation jurisdictions).",
                "escalation_trigger": "Supplier insists on governing law of jurisdiction outside EU or major common law countries.",
            },
        ],
    },
    {
        "playbook_id": "data-processing-agreement-playbook",
        "name": "Data Processing Agreement Playbook",
        "description": "GDPR-compliant data processing agreement positions for controller-processor relationships.",
        "owner": "Suzanne",
        "source_filename": "data-processing-agreement-playbook.xlsx",
        "clauses": [
            {
                "clause_number": "1",
                "clause_id": "processing-purposes",
                "clause_name": "Processing Purposes and Legal Basis",
                "why_it_matters": "GDPR Article 28 requires processing to be defined by documented controller instructions. Undefined purposes create compliance exposure.",
                "preferred_position": "Processor shall process Personal Data solely on documented instructions from Controller for purposes listed in Annex 1. Processing for any other purpose is prohibited without prior written consent from Controller.",
                "fallback_1": "Processing purposes defined in main service agreement incorporated by reference; modification requires signed amendment.",
                "fallback_2": "Processor may use anonymized data for service improvement with explicit consent recorded in DPA amendment.",
                "red_line": "Processor claims independent right to determine processing purposes or use data for own commercial benefit.",
                "escalation_trigger": "Processor requests ability to process data for undisclosed or broad 'service improvement' purposes.",
            },
            {
                "clause_number": "2",
                "clause_id": "data-subject-rights",
                "clause_name": "Data Subject Rights Assistance",
                "why_it_matters": "Controller must be able to fulfill DSARs, erasure requests, and portability requests within GDPR timelines.",
                "preferred_position": "Processor shall assist Controller in responding to data subject requests within 5 business days. Erasure capability must be technically implemented within 30 days of contract signature.",
                "fallback_1": "Processor provides best-efforts assistance within 10 business days; erasure within 60 days of contract date.",
                "fallback_2": "Processor responds to requests via defined API/portal; timelines per agreed SLA.",
                "red_line": "Processor cannot technically fulfill erasure or access requests, or timelines exceed GDPR 30-day response window.",
                "escalation_trigger": "Processor cannot implement erasure capability or response timelines exceed regulatory requirements.",
            },
            {
                "clause_number": "3",
                "clause_id": "sub-processor-approval",
                "clause_name": "Sub-processor Approval and Notification",
                "why_it_matters": "GDPR Article 28(4) makes controller responsible for sub-processor compliance. Unauthorized sub-processors create direct liability.",
                "preferred_position": "No new sub-processors without prior specific written consent from Controller. Processor must provide 30 days' advance notice. Controller has 14 days to object; unresolved objections give Controller termination right.",
                "fallback_1": "General authorization for sub-processors listed in Annex 2; 14-day notice for changes; objection and termination right retained.",
                "fallback_2": "Annual review of sub-processor list; material changes require 30-day notice.",
                "red_line": "General authorization for any sub-processor without notice or ability to object.",
                "escalation_trigger": "Processor insists on blanket sub-processor authorization without notice or objection right.",
            },
            {
                "clause_number": "4",
                "clause_id": "data-breach-notification",
                "clause_name": "Data Breach Notification",
                "why_it_matters": "GDPR requires 72-hour supervisory authority notification. Processor must notify before this clock runs out.",
                "preferred_position": "Processor shall notify Controller of any Personal Data Breach without undue delay and in any event within 24 hours of becoming aware. Notification must include all information required under Article 33(3) GDPR.",
                "fallback_1": "Notification within 48 hours with preliminary details; full Article 33(3) details within 72 hours.",
                "fallback_2": "Notification within 72 hours; Controller accepts responsibility for supervisory authority reporting timeline.",
                "red_line": "Notification timeline exceeding 72 hours, or no notification obligation.",
                "escalation_trigger": "Processor requests 72+ hour notification window or seeks to limit notification to confirmed breaches only.",
            },
            {
                "clause_number": "5",
                "clause_id": "security-measures",
                "clause_name": "Technical and Organisational Security Measures",
                "why_it_matters": "GDPR Article 32 requires appropriate technical and organisational measures. Vague security provisions are unenforceable.",
                "preferred_position": "Processor shall implement measures specified in Annex 2, including: AES-256 encryption at rest and in transit, SOC 2 Type II certification, ISO 27001 certification, penetration testing annually, access control with MFA.",
                "fallback_1": "ISO 27001 or SOC 2 Type II certification as alternative; encryption and MFA mandatory.",
                "fallback_2": "Documented security policy equivalent to ISO 27001 framework; encryption mandatory.",
                "red_line": "No defined security measures, or security measures below industry baseline (e.g., no encryption of sensitive data).",
                "escalation_trigger": "Processor cannot demonstrate ISO 27001/SOC 2 compliance or refuses mandatory encryption.",
            },
            {
                "clause_number": "6",
                "clause_id": "data-retention-deletion",
                "clause_name": "Data Retention and Deletion",
                "why_it_matters": "GDPR storage limitation principle requires data to be deleted when no longer needed. Clear deletion timelines are essential.",
                "preferred_position": "Processor shall delete or return all Personal Data within 30 days of contract termination, at Controller's choice. Deletion must be certified in writing. Backup copies deleted within 90 days.",
                "fallback_1": "Deletion within 60 days of termination; backup deletion within 120 days; written certification required.",
                "fallback_2": "Controller may choose return or deletion; processor may retain anonymized aggregate data with controller consent.",
                "red_line": "Processor retains Personal Data beyond contract term or asserts independent right to retain data.",
                "escalation_trigger": "Processor requests extended retention beyond 90 days post-termination without documented legal basis.",
            },
            {
                "clause_number": "7",
                "clause_id": "international-transfers",
                "clause_name": "International Data Transfers",
                "why_it_matters": "GDPR Chapter V prohibits transfers to third countries without adequate safeguards. Unapproved transfers create immediate regulatory risk.",
                "preferred_position": "No transfer of Personal Data outside EEA without Controller's prior written consent and appropriate safeguard (EU SCCs, adequacy decision, or BCRs). Controller has right to terminate immediately for unauthorized transfers.",
                "fallback_1": "Transfers to approved third countries (EU Commission adequacy list) without prior consent; other transfers require SCCs.",
                "fallback_2": "SCCs sufficient for all non-EEA transfers without prior consent; data transfer impact assessment shared with Controller.",
                "red_line": "Transfers to third countries without any safeguard, or processor refuses to identify transfer destinations.",
                "escalation_trigger": "Processor transfers data to high-risk jurisdictions, refuses to identify transfer destinations, or rejects SCC requirement.",
            },
            {
                "clause_number": "8",
                "clause_id": "audit-rights-dpa",
                "clause_name": "Audit Rights and Inspections",
                "why_it_matters": "Controller accountability under GDPR requires ability to verify processor compliance. Audit rights are non-negotiable.",
                "preferred_position": "Controller may audit Processor's data processing activities once per year on 30 days' notice, or immediately following a Breach. Processor to provide all necessary information and access.",
                "fallback_1": "Annual audit via third-party auditor; processor shares current certifications (ISO 27001/SOC 2) as alternative.",
                "fallback_2": "Audit right triggered by: (a) breach, (b) regulatory investigation, or (c) material change in processing. Alternative: accepted questionnaire.",
                "red_line": "No audit rights, or audit rights limited to self-certification questionnaire only.",
                "escalation_trigger": "Processor refuses all on-site audit rights or regulatory inspection cooperation.",
            },
            {
                "clause_number": "9",
                "clause_id": "liability-dpa",
                "clause_name": "Liability and Indemnification",
                "why_it_matters": "GDPR Article 82 allocates liability between controller and processor. Clear indemnification prevents joint-and-several exposure.",
                "preferred_position": "Processor indemnifies Controller for fines and damages caused by Processor's breach of DPA or GDPR. Each party's liability capped at total fees paid in preceding 12 months, with exceptions for data breach and intentional misconduct.",
                "fallback_1": "Mutual indemnification for own GDPR breaches; cap at 12-month fees; no cap exceptions for regulatory fines.",
                "fallback_2": "Liability cap at 200% of annual contract value; separate cap of EUR 1M for regulatory fines.",
                "red_line": "Processor disclaims all liability for data breaches or limits liability to token amounts below realistic GDPR fine exposure.",
                "escalation_trigger": "Processor seeks liability cap below EUR 500k or disclaims liability for regulatory fines resulting from its processing.",
            },
        ],
    },
    {
        "playbook_id": "joint-development-playbook",
        "name": "Joint Development Agreement Playbook",
        "description": "Negotiation positions for joint R&D and co-development agreements.",
        "owner": "Peter",
        "source_filename": "joint-development-playbook.xlsx",
        "clauses": [
            {
                "clause_number": "1",
                "clause_id": "project-scope-jda",
                "clause_name": "Project Scope and Work Programme",
                "why_it_matters": "Vague project scope in JDAs leads to disputes over who owns what and who delivered what. Tight scoping is essential.",
                "preferred_position": "Project scope, milestones, and deliverables defined in signed Work Programme (Schedule A). Scope changes require written amendment signed by both Technical Leads and Legal. No implied obligations beyond written scope.",
                "fallback_1": "Work Programme defined in initial contract; milestone changes permitted by Technical Lead sign-off; scope changes require legal review.",
                "fallback_2": "Agile-style work programme with quarterly scope reviews documented in writing.",
                "red_line": "Open-ended project scope with no defined deliverables or milestones.",
                "escalation_trigger": "Partner requests open-ended scope, undefined deliverables, or unilateral scope changes.",
            },
            {
                "clause_number": "2",
                "clause_id": "joint-ip-ownership",
                "clause_name": "Joint IP Ownership and Registration",
                "why_it_matters": "Joint IP ownership creates veto rights. Without clear rules, either party can block commercialization.",
                "preferred_position": "Jointly developed IP is jointly owned in equal shares. Each party may independently exploit Joint IP without accounting to the other, but may not license to third parties without written consent of the other. Patent filing decisions require joint agreement.",
                "fallback_1": "Joint ownership with mutual license; third-party licensing by majority vote of IP Committee.",
                "fallback_2": "Joint ownership with revenue-sharing formula for third-party licensing; formula defined in Schedule B.",
                "red_line": "Joint IP vested entirely in one party, or one party given unilateral right to license to competitors.",
                "escalation_trigger": "Partner requests sole ownership of jointly developed IP or unilateral licensing rights.",
            },
            {
                "clause_number": "3",
                "clause_id": "background-ip",
                "clause_name": "Background IP and Pre-Existing Know-How",
                "why_it_matters": "Pre-existing IP brought into the project must be clearly ring-fenced to prevent contamination claims.",
                "preferred_position": "Each party retains exclusive ownership of its Background IP listed in Schedule C. License to use Background IP is limited to project purposes only. No implied license beyond project scope. Background IP list is exhaustive; disputes resolved by IP Committee.",
                "fallback_1": "Background IP schedules acknowledged as non-exhaustive; late additions within 30 days of project start accepted.",
                "fallback_2": "Background IP includes both listed IP and reasonably identifiable pre-existing know-how; dispute resolution via expert determination.",
                "red_line": "Background IP undefined or subject to contamination by project work, or no schedule of Background IP.",
                "escalation_trigger": "Partner rejects Background IP schedule or asserts right to background-IP-derived improvements as joint IP.",
            },
            {
                "clause_number": "4",
                "clause_id": "publication-rights",
                "clause_name": "Publication and Academic Disclosure Rights",
                "why_it_matters": "JDAs often involve academic or research partners who have publication obligations. Uncontrolled publication destroys patent rights.",
                "preferred_position": "No publication of project results without prior written consent from all parties and minimum 60-day patent filing review period. Publications must not disclose trade secrets. Academic partner's publication right acknowledged but conditioned on this process.",
                "fallback_1": "60-day review period reduced to 45 days if no patent application in progress. Academic partner may publish delayed abstract.",
                "fallback_2": "90-day review period; parties agree joint publication strategy at project outset.",
                "red_line": "Unrestricted academic publication right with no review period or trade secret protection.",
                "escalation_trigger": "Partner insists on unconditional right to publish, with no review period for patent filing.",
            },
            {
                "clause_number": "5",
                "clause_id": "cost-sharing",
                "clause_name": "Cost Sharing and Budget Control",
                "why_it_matters": "Cost overruns and undisclosed expenses create financial and IP ownership disputes in JDAs.",
                "preferred_position": "Project budget defined in Schedule D. Each party's contribution ratio determines IP ownership weighting for any cost-split assets. Overruns > 15% require joint committee approval. Unilateral expenditure beyond budget waives contribution credit.",
                "fallback_1": "Budget overrun threshold at 20%; committee approval required. Parties maintain own contribution records.",
                "fallback_2": "Fixed-contribution model per Schedule D; overruns absorbed by initiating party without IP ownership effect.",
                "red_line": "No defined budget, or unilateral expenditure counted toward IP ownership without consent.",
                "escalation_trigger": "Partner requests unilateral authority to incur costs that increase their IP ownership claim.",
            },
            {
                "clause_number": "6",
                "clause_id": "exclusivity-jda",
                "clause_name": "Exclusivity and Non-Compete",
                "why_it_matters": "JDA exclusivity prevents parallel development that undermines the partnership's value. But broad non-competes restrict legitimate business.",
                "preferred_position": "During project term: each party shall not engage a third party to develop Competing Technology (defined in Schedule E). Post-term non-compete: 18 months in Field of Use only. Exclusivity survives termination for 12 months.",
                "fallback_1": "Non-compete limited to project Field of Use; 12-month post-term period.",
                "fallback_2": "No non-compete obligation; exclusivity limited to duration of project term only.",
                "red_line": "No exclusivity at all during active joint development, allowing parallel development with competitors.",
                "escalation_trigger": "Partner refuses any exclusivity during active project term or requests broad carve-outs covering their core business.",
            },
            {
                "clause_number": "7",
                "clause_id": "termination-jda",
                "clause_name": "Termination and IP Consequences",
                "why_it_matters": "JDA termination must clearly allocate IP rights to avoid orphaned technology or IP held hostage.",
                "preferred_position": "On termination: (a) jointly developed IP becomes jointly owned per Section 2; (b) Background IP reverts to original owner; (c) each party receives license to continue use of Joint IP in its own field; (d) ongoing projects wound down per transition plan.",
                "fallback_1": "IP consequences as above; breaching party loses right to commercialize Joint IP for 24 months.",
                "fallback_2": "IP allocation negotiated within 60 days of termination notice; interim license to each party pending resolution.",
                "red_line": "Terminating party forfeits all IP rights, including Background IP brought to the project.",
                "escalation_trigger": "Partner seeks to use termination as mechanism to capture full Joint IP ownership.",
            },
            {
                "clause_number": "8",
                "clause_id": "dispute-resolution-jda",
                "clause_name": "Dispute Resolution",
                "why_it_matters": "JDA disputes often involve complex technical and IP valuation questions. Right dispute resolution mechanism is critical.",
                "preferred_position": "Technical disputes: IP Committee, then expert determination (technical arbitrator). Commercial disputes: Executive escalation (30 days), then ICC arbitration in Munich. Urgent IP injunctions available in any court of competent jurisdiction.",
                "fallback_1": "Two-tier: mediation (30 days) then ICC arbitration; expert determination for technical questions.",
                "fallback_2": "Binding expert determination for technical disputes; litigation in Munich for commercial disputes.",
                "red_line": "Sole arbitration clause that eliminates court access for urgent IP injunctions.",
                "escalation_trigger": "Partner rejects emergency court access for IP injunctions, or insists on arbitration for all disputes including urgent IP matters.",
            },
        ],
    },
]


def slugify(name: str) -> str:
    import re
    return re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")


def seed() -> None:
    now = datetime.utcnow()

    for pb_data in PLAYBOOKS:
        pid = pb_data["playbook_id"]

        with Session(engine) as session:
            existing = session.exec(select(Playbook).where(Playbook.playbook_id == pid)).first()
            if existing:
                print(f"  ✓ {pid} already exists — skipping")
                continue

            playbook = Playbook(
                playbook_id=pid,
                name=pb_data["name"],
                description=pb_data["description"],
                owner=pb_data["owner"],
                status=PlaybookStatus.PUBLISHED,
                version=1,
                source_filename=pb_data["source_filename"],
                created_at=now,
                updated_at=now,
                published_at=now,
            )
            session.add(playbook)

            for c in pb_data["clauses"]:
                session.add(PlaybookClause(
                    playbook_id=pid,
                    clause_id=c["clause_id"],
                    clause_number=c["clause_number"],
                    clause_name=c["clause_name"],
                    why_it_matters=c.get("why_it_matters", ""),
                    preferred_position=c.get("preferred_position", ""),
                    fallback_1=c.get("fallback_1"),
                    fallback_2=c.get("fallback_2"),
                    red_line=c.get("red_line"),
                    escalation_trigger=c.get("escalation_trigger"),
                    created_at=now,
                    updated_at=now,
                ))

            # Create commit record
            commit_hash = hashlib.sha1(f"{pid}:1:Seed:{now.isoformat()}".encode()).hexdigest()[:12]
            session.add(PlaybookCommit(
                playbook_id=pid,
                version=1,
                commit_hash=commit_hash,
                comment=f"Initial publication of {pb_data['name']}.",
                committed_by=pb_data["owner"],
                committed_at=now,
                diff_json=json.dumps({"status": {"old": "draft", "new": "published"}, "clauses_published": len(pb_data["clauses"])}),
            ))

            session.commit()
            print(f"  ✓ Created {pid} with {len(pb_data['clauses'])} clauses")

        # Now publish to mega brain (index embeddings)
        with Session(engine) as session:
            playbook = session.exec(select(Playbook).where(Playbook.playbook_id == pid)).first()
            clauses = session.exec(select(PlaybookClause).where(PlaybookClause.playbook_id == pid)).all()

            # Clear existing entries
            for entry in session.exec(select(MegaBrainEntry).where(MegaBrainEntry.playbook_id == pid)).all():
                session.delete(entry)

            for clause in clauses:
                try:
                    vector_id = upsert_mega_brain_clause(playbook, clause)
                    session.add(MegaBrainEntry(
                        playbook_id=pid,
                        playbook_version=1,
                        topic=clause.clause_name,
                        vector_id=vector_id,
                        metadata_json=json.dumps({
                            "clause_id": clause.clause_id,
                            "clause_name": clause.clause_name,
                            "status": "clean",
                        }),
                    ))
                except Exception as e:
                    print(f"    ⚠ Embedding failed for {clause.clause_id}: {e}")

            session.commit()
            print(f"  ✓ Indexed {pid} into mega brain")


if __name__ == "__main__":
    print("Seeding diverse playbooks into Lou...")
    seed()
    print("Done.")
