/**
 * Builds a minimal but valid .docx fixture for the import tests.
 * Run with: npm run fixtures:gen
 *
 * A .docx is a ZIP of XML files. We create just enough of the OOXML envelope
 * for `mammoth` to parse: [Content_Types].xml, _rels/.rels, word/document.xml.
 * No external word processor needed.
 */
import { writeFile, mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import JSZip from 'jszip';

const DOCUMENT_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    <w:p>
      <w:pPr><w:pStyle w:val="Heading1"/></w:pPr>
      <w:r><w:t>Quarterly Report</w:t></w:r>
    </w:p>
    <w:p>
      <w:r><w:t xml:space="preserve">This is a paragraph with </w:t></w:r>
      <w:r><w:rPr><w:b/></w:rPr><w:t>bold</w:t></w:r>
      <w:r><w:t xml:space="preserve"> and </w:t></w:r>
      <w:r><w:rPr><w:i/></w:rPr><w:t>italic</w:t></w:r>
      <w:r><w:t xml:space="preserve"> text.</w:t></w:r>
    </w:p>
    <w:p>
      <w:pPr><w:numPr><w:ilvl w:val="0"/><w:numId w:val="1"/></w:numPr></w:pPr>
      <w:r><w:t>First bullet</w:t></w:r>
    </w:p>
    <w:p>
      <w:pPr><w:numPr><w:ilvl w:val="0"/><w:numId w:val="1"/></w:numPr></w:pPr>
      <w:r><w:t>Second bullet</w:t></w:r>
    </w:p>
  </w:body>
</w:document>`;

const CONTENT_TYPES_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml"
            ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>`;

const ROOT_RELS_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1"
                Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument"
                Target="word/document.xml"/>
</Relationships>`;

async function main() {
  const zip = new JSZip();
  zip.file('[Content_Types].xml', CONTENT_TYPES_XML);
  zip.folder('_rels')!.file('.rels', ROOT_RELS_XML);
  zip.folder('word')!.file('document.xml', DOCUMENT_XML);

  const out = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
  const dir = resolve(process.cwd(), 'tests/fixtures');
  await mkdir(dir, { recursive: true });
  const path = resolve(dir, 'sample.docx');
  await writeFile(path, out);
  console.log(`Wrote ${path} (${out.byteLength} bytes)`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
