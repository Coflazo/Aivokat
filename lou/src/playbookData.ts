export interface SourcePlaybookRow {
  id: string
  clause: string
  why: string
  preferred: string
  fallbacks: string[]
  redLine: string
  escalation: string
  sourceFile: string
}

export const sourcePlaybookRows: SourcePlaybookRow[] = [
  {
    id: 'type_of_nda',
    clause: 'Type of NDA',
    why: 'Determines if our info is protected',
    preferred: 'Bilateral (mutual) NDA',
    fallbacks: [
      'Convert unilateral to bilateral by mirroring obligations',
      'Accept a unilateral NDA only if our organization is the sole disclosing party (i.e., you are the beneficiary)'
    ],
    redLine: 'Unilateral NDA where you are recieving party only',
    escalation: 'Counterparty refuses bilateral and you will share info',
    sourceFile: 'Siemens Sample Documents/Sample NDA Playbook.csv.xlsx'
  },
  {
    id: 'marking_of_confidential_info',
    clause: 'Marking of Confidential Info',
    why: "Controls scope of what's protected and compliance burden",
    preferred: 'Must be marked "Confidential"',
    fallbacks: [
      'Information is confidential if marked OR if its confidential nature would be evident to a reasonable person',
      'All information is deemed confidential, but with a practical mechanism for the disclosing party to designate specific items as non-confidential'
    ],
    redLine: 'Definition that treats all information as confidential with no marking mechanism and no reasonable-person standard',
    escalation: 'Counterparty insists that all information is confidential with no exceptions or marking process',
    sourceFile: 'Siemens Sample Documents/Sample NDA Playbook.csv.xlsx'
  },
  {
    id: 'exceptions_to_confidentiality',
    clause: 'Exceptions to Confidentiality',
    why: 'Protects against liability for info already known or independently created',
    preferred: 'All 4 standard exceptions (public, prior possession, third party, independent development)',
    fallbacks: [
      '3 of 4 exceptions if missing one is low risk',
      'Modified language if all 4 categories conceptually covered'
    ],
    redLine: 'Fewer than 3 exceptions',
    escalation: '"Independently developed" exception is missing and cannot be added',
    sourceFile: 'Siemens Sample Documents/Sample NDA Playbook.csv.xlsx'
  },
  {
    id: 'permitted_recipients',
    clause: 'Permitted Recipients',
    why: 'Enables operational use of info with affiliates, advisors, contractors',
    preferred: 'Need-to-know disclosure to employees, affiliates, agents, advisors, contractors with equivalent NDA',
    fallbacks: [
      'Employees and affiliates with prior notice',
      'Employees and affiliates with prior consent'
    ],
    redLine: 'Limits disclosure exclusively to named individuals or requires consent for sharing with affiliated entities',
    escalation: 'Does not permit sharing with affiliates or advisors under any circumstances',
    sourceFile: 'Siemens Sample Documents/Sample NDA Playbook.csv.xlsx'
  },
  {
    id: 'return_destruction_of_backups',
    clause: 'Return/Destruction of Backups',
    why: 'Prevents technically/legally impossible compliance obligations',
    preferred: 'Return/destroy on request with exemptions for: (a) routine IT backup, (b) copies required to be retained under law',
    fallbacks: [
      'Return/destroy on request with exemptions for copies required to be retained under law only',
      'Return/destroy on request with certification, but with reasonable timeframe (e.g., 60 days) to comply'
    ],
    redLine: 'Immediate destruction of all copies with no exemptions',
    escalation: 'Counterparty insists on destruction of all copies including backups with written certification',
    sourceFile: 'Siemens Sample Documents/Sample NDA Playbook.csv.xlsx'
  },
  {
    id: 'liability_for_correctness',
    clause: 'Liability for Correctness',
    why: 'Prevents inappropriate warranty exposure at NDA stage',
    preferred: '"AS IS" - no warranty, no liability for use/reliance',
    fallbacks: [
      'No warranty',
      'Limited warranty'
    ],
    redLine: 'Full warranty',
    escalation: 'Counterparty insists on accuracy warranties backed by indemnification',
    sourceFile: 'Siemens Sample Documents/Sample NDA Playbook.csv.xlsx'
  },
  {
    id: 'contractual_penalty',
    clause: 'Contractual Penalty',
    why: 'Prevents disproportionate financial exposure for breach',
    preferred: 'No penalty clause',
    fallbacks: [
      'Penalty clause only if: (a) the burden of proof for the breach remains with the disclosing party, (b) the penalty amount is commercially reasonable and proportionate, and (c) the penalty is the sole monetary remedy',
      'Penalty clause with a cap that is proportionate to the value of the engagement, and only for willful or grossly negligent breaches'
    ],
    redLine: 'Uncapped penalty, regarless of fault or penalty that is cumulative with unlimited damages',
    escalation: 'Any contractual penalty clause should be reviewed by senior legal before acceptance',
    sourceFile: 'Siemens Sample Documents/Sample NDA Playbook.csv.xlsx'
  },
  {
    id: 'other_liabilities_indemnification',
    clause: 'Other Liabilities / Indemnification',
    why: 'Controls financial exposure framework',
    preferred: 'No indemnification clause',
    fallbacks: [
      'Reasonable limitation of liability (e.g., exemption for slight negligence) that applies equally to both parties',
      'Indemnification clause limited to direct damages only, with a reasonable cap, and excluding consequential, indirect, special, and punitive damages'
    ],
    redLine: 'One-sided indemnification, any inclusion of punitive or consequential damages, or any indemnity that extends to third-party claims unrelated to the NDA',
    escalation: 'Any indemnification clause or liability provision that goes beyond standard statutory liability',
    sourceFile: 'Siemens Sample Documents/Sample NDA Playbook.csv.xlsx'
  },
  {
    id: 'ip_rights_know_how',
    clause: 'IP Rights / Know-How',
    why: 'Prevents unintended transfer of IP ownership or license grants',
    preferred: 'No license/rights granted or implied',
    fallbacks: [
      'No license granted, with an acknowledgment that any jointly created IP during the NDA period will be addressed in a separate agreement to be negotiated in good faith',
      'No license granted; each party retains ownership of its pre-existing IP; joint inventions to be jointly owned with each party free to exploit independently'
    ],
    redLine: 'Any clause that transfers IP ownership, grants an irrevocable license, or assigns rights to inventions or know-how arising from the information exchange',
    escalation: 'Any IP assignment, license grant, or joint ownership clause',
    sourceFile: 'Siemens Sample Documents/Sample NDA Playbook.csv.xlsx'
  },
  {
    id: 'non_solicitation',
    clause: 'Non-Solicitation',
    why: 'Prevents overbroad employment restrictions',
    preferred: 'No non-solicitation clause in NDA',
    fallbacks: [
      'Limited to: direct solicitation only, involved employees only, NDA term only',
      'Broader clause but no penalty'
    ],
    redLine: 'Any non-solicitation clause that applies to unsolicited applications, covers all employees regardless of involvement, or includes a contractual penalty',
    escalation: 'Any non-solicitation clause with a penalty',
    sourceFile: 'Siemens Sample Documents/Sample NDA Playbook.csv.xlsx'
  },
  {
    id: 'contract_term_confidentiality_period',
    clause: 'Contract Term / Confidentiality Period',
    why: 'Ensures manageable, defined obligations',
    preferred: 'NDA term: 2-3 years. Confidentiality: 5 years from each disclosure, surviving termination',
    fallbacks: [
      'Confidentiality period 3-7 years from disclosure',
      'Confidentiality = NDA term + fixed survival (e.g., 3 years post-termination)'
    ],
    redLine: 'Perpetual/indefinite confidentiality',
    escalation: 'Counterparty insists on perpetual confidentiality or a confidentiality period shorter than 3 years',
    sourceFile: 'Siemens Sample Documents/Sample NDA Playbook.csv.xlsx'
  },
  {
    id: 'choice_of_law',
    clause: 'Choice of Law',
    why: 'Determines interpretation, enforcement, and precedent for future agreements',
    preferred: "Our own jurisdiction's law",
    fallbacks: [
      'Neutral third jurisdiction (well-established, commercially sophisticated)',
      "Counterparty's law if well-established commercial jurisdiction and NDA is balanced"
    ],
    redLine: 'Unpredictable legal system',
    escalation: "Proposed governing law is from a jurisdiction outside of your organization's country of incorporation or primary place of business",
    sourceFile: 'Siemens Sample Documents/Sample NDA Playbook.csv.xlsx'
  },
  {
    id: 'dispute_resolution_language',
    clause: 'Dispute Resolution / Language',
    why: 'Protects confidentiality of proceedings',
    preferred: 'International arbitration (e.g., ICC Rules) with a neutral seat, conducted in English. Explicit carve-out allowing either party to seek injunctive relief from ordinary courts',
    fallbacks: [
      'Arbitration under recognized institutional rules (e.g., LCIA, SIAC, DIS) with a neutral seat',
      'Ordinary courts of a neutral jurisdiction, provided the NDA includes provisions for confidential treatment of proceedings'
    ],
    redLine: "Exclusive jurisdiction of the counterparty's local courts with no arbitration option, especially in cross-border agreements",
    escalation: "Provides for ordinary courts in the counterparty's jurisdiction with no alternative",
    sourceFile: 'Siemens Sample Documents/Sample NDA Playbook.csv.xlsx'
  },
  {
    id: 'signatures_authority',
    clause: 'Signatures / Authority',
    why: 'Ensures NDA is legally binding and enforceable',
    preferred: 'Duly authorized representatives',
    fallbacks: [
      "Electronic signatures via established e-signature platforms where counterparty confirms signatory's authority in writing",
      'Single signatory from the counterparty if they provide evidence of signing authority (e.g., power of attorney, board resolution)'
    ],
    redLine: "Counterparty's signatory authority cannot be verified",
    escalation: "Any doubt about the counterparty's signatory authority",
    sourceFile: 'Siemens Sample Documents/Sample NDA Playbook.csv.xlsx'
  }
]
