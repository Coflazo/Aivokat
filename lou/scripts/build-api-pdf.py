#!/usr/bin/env python3
"""
build-api-pdf.py
Reads API_DOCUMENTATION.md and produces a professional LaTeX PDF at
lou-api-reference.tex / lou-api-reference.pdf.
"""

import re
import subprocess
import sys
import os
from pathlib import Path

# ── Paths ──────────────────────────────────────────────────────────────────────
SCRIPT_DIR   = Path(__file__).resolve().parent
REPO_DIR     = SCRIPT_DIR.parent
MD_PATH      = REPO_DIR / "API_DOCUMENTATION.md"
TEX_PATH     = REPO_DIR / "lou-api-reference.tex"
PDF_PATH     = REPO_DIR / "lou-api-reference.pdf"
PDFLATEX     = "/Library/TeX/texbin/pdflatex"

# ── Helpers ────────────────────────────────────────────────────────────────────

def tex_escape(text: str) -> str:
    """Escape LaTeX special characters in plain text."""
    # Normalize Unicode dashes / special chars first
    text = text.replace("—", "---")   # em dash
    text = text.replace("–", "--")    # en dash
    text = text.replace("’", "'")     # right single quote
    text = text.replace("‘", "`")     # left single quote
    text = text.replace("“", "``")    # left double quote
    text = text.replace("”", "''")    # right double quote
    text = text.replace("…", r"\ldots{}")  # ellipsis
    text = text.replace(" ", "~")     # non-breaking space
    replacements = [
        ("\\", r"\textbackslash{}"),
        ("&",  r"\&"),
        ("%",  r"\%"),
        ("$",  r"\$"),
        ("#",  r"\#"),
        ("_",  r"\_"),
        ("{",  r"\{"),
        ("}",  r"\}"),
        ("~",  r"\textasciitilde{}"),
        ("^",  r"\textasciicircum{}"),
        ("<",  r"\textless{}"),
        (">",  r"\textgreater{}"),
        ("|",  r"\textbar{}"),
    ]
    for old, new in replacements:
        text = text.replace(old, new)
    return text


def sanitize_code(text: str) -> str:
    """Replace non-ASCII characters in code blocks with ASCII equivalents."""
    text = text.replace("—", "--")    # em dash -> --
    text = text.replace("–", "-")     # en dash -> -
    text = text.replace("’", "'")
    text = text.replace("‘", "'")
    text = text.replace("“", '"')
    text = text.replace("”", '"')
    text = text.replace("…", "...")
    text = text.replace(" ", " ")
    # Replace any remaining non-ASCII with ?
    return text.encode("ascii", errors="replace").decode("ascii")


def inline_format(text: str) -> str:
    """
    Apply inline markdown formatting to already-tex-escaped text.
    Handles: **bold**, `inline code`, links [text](url)
    Must be called BEFORE tex_escape so we can detect the markdown markers.
    """
    # We operate on raw (un-escaped) text here, then escape per-segment.
    result = []
    i = 0
    while i < len(text):
        # **bold**
        if text[i:i+2] == "**":
            end = text.find("**", i + 2)
            if end != -1:
                inner = tex_escape(text[i+2:end])
                result.append(r"\textbf{" + inner + "}")
                i = end + 2
                continue
        # `inline code`
        if text[i] == "`":
            end = text.find("`", i + 1)
            if end != -1:
                inner = text[i+1:end]
                # Escape only the chars that break lstinline; use verb instead
                safe = inner.replace("\\", r"\textbackslash{}") \
                            .replace("{", r"\{") \
                            .replace("}", r"\}") \
                            .replace("$", r"\$") \
                            .replace("&", r"\&") \
                            .replace("#", r"\#") \
                            .replace("%", r"\%") \
                            .replace("_", r"\_") \
                            .replace("^", r"\textasciicircum{}") \
                            .replace("~", r"\textasciitilde{}") \
                            .replace("<", r"\textless{}") \
                            .replace(">", r"\textgreater{}") \
                            .replace("|", r"\textbar{}") \
                            .replace("@", r"\MVAt{}")
                result.append(r"\texttt{" + safe + "}")
                i = end + 1
                continue
        # [text](url) — render as hyperlink
        m = re.match(r'\[([^\]]+)\]\(([^)]+)\)', text[i:])
        if m:
            link_text = tex_escape(m.group(1))
            url       = m.group(2)
            result.append(r"\href{" + url + r"}{" + link_text + r"}")
            i += m.end()
            continue
        # plain character — escape
        result.append(tex_escape(text[i]))
        i += 1
    return "".join(result)


def parse_table(lines: list[str]) -> str:
    """Convert a markdown pipe table to a longtable."""
    rows = []
    for line in lines:
        line = line.strip()
        if not line.startswith("|"):
            continue
        # separator row
        if re.match(r"^\|[-| :]+\|$", line):
            continue
        cells = [c.strip() for c in line.strip("|").split("|")]
        rows.append(cells)

    if not rows:
        return ""

    n_cols = max(len(r) for r in rows)
    col_spec = "p{3.5cm}" + " p{3cm}" * (n_cols - 1) if n_cols > 2 else "ll"
    col_spec = "@{}l" + "l" * (n_cols - 1) + "@{}"

    # pick a reasonable column spec based on column count
    widths = {
        1: ["0.9\\textwidth"],
        2: ["0.35\\textwidth", "0.55\\textwidth"],
        3: ["0.22\\textwidth", "0.20\\textwidth", "0.48\\textwidth"],
        4: ["0.20\\textwidth", "0.14\\textwidth", "0.12\\textwidth", "0.44\\textwidth"],
        5: ["0.17\\textwidth", "0.12\\textwidth", "0.10\\textwidth", "0.10\\textwidth", "0.41\\textwidth"],
    }
    w = widths.get(n_cols, ["0.18\\textwidth"] + ["0.15\\textwidth"] * (n_cols - 2) + ["0.37\\textwidth"])
    col_spec = " ".join(f"p{{{wi}}}" for wi in w[:n_cols])

    out = []
    out.append(r"\begin{longtable}{" + col_spec + r"}")
    out.append(r"\toprule")
    # header row
    if rows:
        header_cells = [r"\textbf{" + inline_format(c) + "}" for c in rows[0]]
        out.append(" & ".join(header_cells) + r" \\")
        out.append(r"\midrule")
        out.append(r"\endfirsthead")
        out.append(r"\toprule")
        out.append(" & ".join(header_cells) + r" \\")
        out.append(r"\midrule")
        out.append(r"\endhead")
        out.append(r"\midrule \multicolumn{" + str(n_cols) + r"}{r}{\textit{(continued\ldots)}} \\")
        out.append(r"\endfoot")
        out.append(r"\bottomrule")
        out.append(r"\endlastfoot")
        for row in rows[1:]:
            # pad if short
            while len(row) < n_cols:
                row.append("")
            cells = [inline_format(c) for c in row[:n_cols]]
            out.append(" & ".join(cells) + r" \\")
    out.append(r"\end{longtable}")
    return "\n".join(out)


def code_block(code: str, lang: str) -> str:
    """Wrap code in a listings environment."""
    # listings language map
    lang_map = {
        "bash": "bash",
        "sh":   "bash",
        "json": "json",
        "python": "Python",
        "": "",
    }
    lst_lang = lang_map.get(lang.lower(), "")
    # Sanitize non-ASCII content before handing to pdflatex
    code = sanitize_code(code)
    code = code.replace("\x00", "")  # strip nulls just in case
    if lst_lang:
        env_opts = f"[language={lst_lang}]"
    else:
        env_opts = ""
    return (
        f"\\begin{{lstlisting}}{env_opts}\n"
        + code
        + "\n\\end{lstlisting}"
    )


def blockquote(text: str) -> str:
    return (
        "\\begin{quote}\n"
        "\\color{accentcolor}\\itshape\n"
        + inline_format(text.lstrip("> ").strip())
        + "\n\\end{quote}"
    )

# ── LaTeX Preamble ─────────────────────────────────────────────────────────────

PREAMBLE = r"""
\documentclass[11pt,a4paper]{article}

%% Encoding & fonts
\usepackage[utf8]{inputenc}
\usepackage[T1]{fontenc}
\usepackage{lmodern}
\usepackage{microtype}

%% Page geometry
\usepackage[
  top=2.5cm, bottom=2.5cm,
  left=2.2cm, right=2.2cm,
  headheight=22pt
]{geometry}

%% Colors
\usepackage[table]{xcolor}
\definecolor{accentcolor}{HTML}{007C79}
\definecolor{codebg}{HTML}{1E1E2E}
\definecolor{codefg}{HTML}{CDD6F4}
\definecolor{codecomment}{HTML}{6C7086}
\definecolor{codekeyword}{HTML}{89B4FA}
\definecolor{codestring}{HTML}{A6E3A1}
\definecolor{lightgray}{HTML}{F5F5F5}
\definecolor{tablerule}{HTML}{007C79}

%% Header / footer
\usepackage{fancyhdr}
\pagestyle{fancy}
\fancyhf{}
\renewcommand{\headrulewidth}{0.5pt}
\renewcommand{\headrule}{\hbox to\headwidth{\color{accentcolor}\leaders\hrule height \headrulewidth\hfill}}
\fancyhead[L]{\small\color{accentcolor}\textbf{Lou API Reference}}
\fancyhead[R]{\small\color{gray}\texttt{louapi.com}}
\fancyfoot[C]{\small\thepage}
\fancypagestyle{plain}{%
  \fancyhf{}
  \renewcommand{\headrulewidth}{0pt}
  \fancyfoot[C]{\small\thepage}
}

%% Section styling
\usepackage{titlesec}
\titleformat{\section}
  {\color{accentcolor}\Large\bfseries}
  {\thesection}{1em}{}[{\color{accentcolor}\titlerule[1pt]}]
\titleformat{\subsection}
  {\color{accentcolor}\large\bfseries}
  {\thesubsection}{1em}{}
\titleformat{\subsubsection}
  {\bfseries\normalsize}
  {}{0em}{}
\titlespacing*{\section}{0pt}{1.5ex plus .3ex minus .2ex}{0.8ex}
\titlespacing*{\subsection}{0pt}{1.2ex plus .2ex minus .1ex}{0.5ex}
\titlespacing*{\subsubsection}{0pt}{0.9ex plus .2ex}{0.3ex}

%% Tables
\usepackage{booktabs}
\usepackage{longtable}
\setlength{\LTpre}{6pt}
\setlength{\LTpost}{6pt}
\renewcommand{\arraystretch}{1.25}

%% Links
\usepackage[
  colorlinks=true,
  linkcolor=accentcolor,
  urlcolor=accentcolor,
  citecolor=accentcolor,
  pdfborder={0 0 0}
]{hyperref}

%% Code listings
\usepackage{listings}
\lstdefinelanguage{json}{
  morestring=[b]",
  stringstyle=\color{codestring},
  literate=
    *{0}{{{\color{codefg}0}}}{1}
     {1}{{{\color{codefg}1}}}{1}
     {2}{{{\color{codefg}2}}}{1}
     {3}{{{\color{codefg}3}}}{1}
     {4}{{{\color{codefg}4}}}{1}
     {5}{{{\color{codefg}5}}}{1}
     {6}{{{\color{codefg}6}}}{1}
     {7}{{{\color{codefg}7}}}{1}
     {8}{{{\color{codefg}8}}}{1}
     {9}{{{\color{codefg}9}}}{1}
     {:}{{{\color{codekeyword}{:}}}}{1}
     {,}{{{\color{codefg}{,}}}}{1}
     {\{}{{{\color{codefg}{\{}}}}{1}
     {\}}{{{\color{codefg}{\}}}}}{1}
     {[}{{{\color{codefg}{[}}}}{1}
     {]}{{{\color{codefg}{]}}}}{1},
}
\lstset{
  backgroundcolor=\color{codebg},
  basicstyle=\ttfamily\small\color{codefg},
  keywordstyle=\color{codekeyword}\bfseries,
  stringstyle=\color{codestring},
  commentstyle=\color{codecomment}\itshape,
  breaklines=true,
  breakatwhitespace=false,
  showstringspaces=false,
  frame=single,
  framerule=0pt,
  rulecolor=\color{codebg},
  xleftmargin=6pt,
  xrightmargin=6pt,
  aboveskip=6pt,
  belowskip=4pt,
  tabsize=2,
  captionpos=b,
  numbers=none,
  keepspaces=true,
  columns=flexible,
}

%% Misc
\usepackage{parskip}
\setlength{\parindent}{0pt}
\setlength{\parskip}{4pt plus 1pt}
\usepackage{graphicx}
\usepackage{enumitem}
\setlist[itemize]{topsep=2pt,itemsep=1pt,parsep=0pt}
\setlist[enumerate]{topsep=2pt,itemsep=1pt,parsep=0pt}

\begin{document}
""".strip()

COVER_PAGE = r"""
\begin{titlepage}
\pagecolor{accentcolor}
\color{white}
\vspace*{3cm}
\begin{center}
  {\Huge\bfseries Lou API Reference}\\[1.2em]
  {\large\itshape The data API layer for legal playbooks}\\[3em]
  \textbf{\large Base URL}\\[0.4em]
  {\large\ttfamily https://louapi.com}\\[3em]
  \rule{6cm}{0.5pt}\\[2em]
  {\normalsize Every approved playbook becomes a versioned, queryable,\\
   auditable API module that any AI tool, contract workflow,\\
   or internal system can consume programmatically.}\\[5cm]
  {\small\color{white!80!accentcolor} louapi.com \quad|\quad April 2026}
\end{center}
\end{titlepage}
\nopagecolor

\tableofcontents
\newpage
"""

FOOTER = r"""
\end{document}
"""

# ── Parser ─────────────────────────────────────────────────────────────────────

def parse_markdown(md: str) -> str:
    """Parse the full markdown document and return LaTeX body."""
    lines = md.splitlines()
    out   = []
    i     = 0

    def flush_paragraph(buf):
        if buf:
            text = " ".join(buf).strip()
            if text:
                out.append(inline_format(text) + "\n")
            buf.clear()

    para_buf: list[str] = []

    while i < len(lines):
        line = lines[i]

        # ── Fenced code block ─────────────────────────────────────────────────
        if line.strip().startswith("```"):
            flush_paragraph(para_buf)
            lang = line.strip().lstrip("`").strip()
            code_lines: list[str] = []
            i += 1
            while i < len(lines) and not lines[i].strip().startswith("```"):
                code_lines.append(lines[i])
                i += 1
            i += 1  # skip closing ```
            code = "\n".join(code_lines)
            out.append(code_block(code, lang))
            continue

        # ── Horizontal rule ───────────────────────────────────────────────────
        if re.match(r"^---+\s*$", line):
            flush_paragraph(para_buf)
            out.append(r"\medskip{\color{accentcolor!30}\hrule}\medskip")
            i += 1
            continue

        # ── Headings ──────────────────────────────────────────────────────────
        m = re.match(r"^(#{1,3})\s+(.*)", line)
        if m:
            flush_paragraph(para_buf)
            level  = len(m.group(1))
            title  = m.group(2).strip()
            # strip trailing anchor like {#foo}
            title  = re.sub(r"\s*\{#[^}]+\}\s*$", "", title)
            # remove markdown links inside heading text
            title  = re.sub(r"\[([^\]]+)\]\([^)]+\)", r"\1", title)
            # number-prefixed section titles like "1. Playbook Management API"
            # → keep as-is, escape normally
            escaped = tex_escape(title)
            cmd_map = {1: "section", 2: "subsection", 3: "subsubsection"}
            cmd = cmd_map.get(level, "subsubsection")
            out.append(f"\\{cmd}{{{escaped}}}")
            i += 1
            continue

        # ── Table (collect all contiguous pipe lines) ─────────────────────────
        if line.strip().startswith("|") and "|" in line[1:]:
            flush_paragraph(para_buf)
            table_lines = []
            while i < len(lines) and (lines[i].strip().startswith("|") or re.match(r"^[-| :]+$", lines[i].strip())):
                table_lines.append(lines[i])
                i += 1
            if table_lines:
                out.append(parse_table(table_lines))
            continue

        # ── Blockquote ────────────────────────────────────────────────────────
        if line.startswith("> ") or line == ">":
            flush_paragraph(para_buf)
            bq_lines = []
            while i < len(lines) and (lines[i].startswith("> ") or lines[i] == ">"):
                bq_lines.append(lines[i].lstrip("> "))
                i += 1
            bq_text = " ".join(bq_lines).strip()
            out.append(blockquote(bq_text))
            continue

        # ── Unordered list ────────────────────────────────────────────────────
        if re.match(r"^[-*+]\s+", line):
            flush_paragraph(para_buf)
            out.append(r"\begin{itemize}")
            while i < len(lines) and re.match(r"^[-*+]\s+", lines[i]):
                item = re.sub(r"^[-*+]\s+", "", lines[i])
                out.append(r"  \item " + inline_format(item))
                i += 1
            out.append(r"\end{itemize}")
            continue

        # ── Ordered list ──────────────────────────────────────────────────────
        if re.match(r"^\d+\.\s+", line):
            flush_paragraph(para_buf)
            out.append(r"\begin{enumerate}")
            while i < len(lines) and re.match(r"^\d+\.\s+", lines[i]):
                item = re.sub(r"^\d+\.\s+", "", lines[i])
                out.append(r"  \item " + inline_format(item))
                i += 1
            out.append(r"\end{enumerate}")
            continue

        # ── Blank line → paragraph break ──────────────────────────────────────
        if line.strip() == "":
            flush_paragraph(para_buf)
            i += 1
            continue

        # ── Normal text ───────────────────────────────────────────────────────
        para_buf.append(line.rstrip())
        i += 1

    flush_paragraph(para_buf)
    return "\n".join(out)


# ── Main ───────────────────────────────────────────────────────────────────────

def main():
    print(f"[build-api-pdf] Reading {MD_PATH} ...")
    md_text = MD_PATH.read_text(encoding="utf-8")

    # Split off the H1 title (first line) — we handle it in the cover page
    lines = md_text.splitlines()
    # Keep the body starting after the title line
    body_md = "\n".join(lines[1:])   # skip "# Lou API Reference"

    print("[build-api-pdf] Parsing markdown ...")
    body_latex = parse_markdown(body_md)

    full_doc = PREAMBLE + "\n" + COVER_PAGE + "\n" + body_latex + "\n" + FOOTER

    print(f"[build-api-pdf] Writing {TEX_PATH} ...")
    TEX_PATH.write_text(full_doc, encoding="utf-8")

    # ── Compile twice ─────────────────────────────────────────────────────────
    compile_dir = str(REPO_DIR)
    tex_filename = TEX_PATH.name

    for run in (1, 2):
        print(f"[build-api-pdf] pdflatex run {run}/2 ...")
        result = subprocess.run(
            [
                PDFLATEX,
                "-interaction=nonstopmode",
                "-halt-on-error",
                "-output-directory", compile_dir,
                str(TEX_PATH),
            ],
            cwd=compile_dir,
            capture_output=True,
            text=True,
            encoding="latin-1",
        )
        if result.returncode != 0:
            # Print last 60 lines of log for diagnosis
            log_lines = result.stdout.splitlines()
            print(f"[build-api-pdf] ERROR on run {run}. Last log lines:")
            for l in log_lines[-60:]:
                print("  ", l)
            sys.exit(1)

    # ── Verify PDF ────────────────────────────────────────────────────────────
    if not PDF_PATH.exists():
        print(f"[build-api-pdf] FAILED: PDF not found at {PDF_PATH}")
        sys.exit(1)

    size_kb = PDF_PATH.stat().st_size // 1024
    print(f"[build-api-pdf] SUCCESS: {PDF_PATH} ({size_kb} KB)")

    # ── Clean up auxiliary files ───────────────────────────────────────────────
    stem = TEX_PATH.stem
    for ext in (".aux", ".log", ".toc", ".out", ".snm", ".nav", ".fls", ".fdb_latexmk", ".synctex.gz"):
        aux = REPO_DIR / (stem + ext)
        if aux.exists():
            aux.unlink()
            print(f"[build-api-pdf] Cleaned {aux.name}")

    print("[build-api-pdf] Done.")


if __name__ == "__main__":
    main()
