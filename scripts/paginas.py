#!/usr/bin/env python3
"""paginas.py <archivo.docx>: imprime cuantas paginas tiene al pasarlo a PDF con LibreOffice."""
import os, subprocess, sys, tempfile, re
f = sys.argv[1]
with tempfile.TemporaryDirectory() as t:
    subprocess.run(['soffice', '--headless', '--convert-to', 'pdf', '--outdir', t, f], capture_output=True, check=True)
    pdf = os.path.join(t, os.path.splitext(os.path.basename(f))[0] + '.pdf')
    info = subprocess.run(['pdfinfo', pdf], capture_output=True, text=True).stdout
    print(re.search(r'Pages:\s+(\d+)', info).group(1))
