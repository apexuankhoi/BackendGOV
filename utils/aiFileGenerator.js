const fs = require('fs');
const path = require('path');
const { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType } = require('docx');
const ExcelJS = require('exceljs');
const { v4: uuidv4 } = require('uuid');

const UPLOADS_DIR = path.join(__dirname, '../uploads/ai_generated');

if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

const generateFileFromJSON = async (jsonData, userContext, taskId) => {
  const fileType = jsonData.fileType || 'docx';
  const fileName = `AI_Generated_${taskId}_${Date.now()}.${fileType}`;
  const filePath = path.join(UPLOADS_DIR, fileName);
  const relativePath = `uploads/ai_generated/${fileName}`;

  if (fileType === 'docx') {
    await generateWordFile(jsonData, userContext, filePath);
  } else if (fileType === 'xlsx') {
    await generateExcelFile(jsonData, filePath);
  } else {
    throw new Error('Unsupported file type');
  }

  return { fileName, filePath: relativePath, fileType };
};

const generateWordFile = async (jsonData, userContext, filePath) => {
  const { agencyName = 'ỦY BAN NHÂN DÂN', title = 'BÁO CÁO', signer = 'CHỦ TỊCH' } = jsonData.documentMeta || {};
  
  const children = [];

  children.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [
        new TextRun({ text: 'CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM\n', bold: true, size: 26 }),
        new TextRun({ text: 'Độc lập - Tự do - Hạnh phúc', bold: true, size: 28 })
      ],
      spacing: { after: 400 }
    })
  );

  children.push(
    new Paragraph({
      alignment: AlignmentType.LEFT,
      children: [
        new TextRun({ text: agencyName.toUpperCase(), bold: true, size: 26 })
      ],
      spacing: { after: 600 }
    })
  );

  children.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [
        new TextRun({ text: title.toUpperCase(), bold: true, size: 32 })
      ],
      spacing: { after: 600 }
    })
  );

  const blocks = jsonData.contentBlocks || [];
  for (const block of blocks) {
    if (block.type === 'heading') {
      children.push(
        new Paragraph({
          text: block.text,
          heading: HeadingLevel.HEADING_2,
          spacing: { before: 300, after: 150 }
        })
      );
    } else {
      children.push(
        new Paragraph({
          children: [new TextRun({ text: block.text, size: 28 })],
          spacing: { after: 200 },
          alignment: AlignmentType.JUSTIFIED
        })
      );
    }
  }

  children.push(
    new Paragraph({
      alignment: AlignmentType.RIGHT,
      children: [
        new TextRun({ text: 'NGƯỜI LẬP/KÝ', bold: true, size: 28 }),
      ],
      spacing: { before: 800, after: 1200 }
    }),
    new Paragraph({
      alignment: AlignmentType.RIGHT,
      children: [
        new TextRun({ text: signer, bold: true, size: 28 })
      ]
    })
  );

  const doc = new Document({
    sections: [{
      properties: {},
      children: children
    }]
  });

  const buffer = await Packer.toBuffer(doc);
  fs.writeFileSync(filePath, buffer);
};

const generateExcelFile = async (jsonData, filePath) => {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Sheet1');

  const { title = 'BẢNG THỐNG KÊ' } = jsonData.documentMeta || {};
  
  sheet.mergeCells('A1:E1');
  const titleCell = sheet.getCell('A1');
  titleCell.value = title.toUpperCase();
  titleCell.font = { name: 'Times New Roman', size: 14, bold: true };
  titleCell.alignment = { horizontal: 'center', vertical: 'middle' };

  sheet.addRow([]);

  const tableData = jsonData.tableData || { headers: ['STT', 'Nội dung'], rows: [] };
  
  const headerRow = sheet.addRow(tableData.headers);
  headerRow.font = { name: 'Times New Roman', bold: true };
  headerRow.eachCell(cell => {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD9D9D9' } };
    cell.border = { top: {style:'thin'}, left: {style:'thin'}, bottom: {style:'thin'}, right: {style:'thin'} };
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
  });

  tableData.rows.forEach(rowArr => {
    const r = sheet.addRow(rowArr);
    r.font = { name: 'Times New Roman' };
    r.eachCell(cell => {
      cell.border = { top: {style:'thin'}, left: {style:'thin'}, bottom: {style:'thin'}, right: {style:'thin'} };
    });
  });

  sheet.columns.forEach(column => {
    column.width = 20;
  });

  await workbook.xlsx.writeFile(filePath);
};

module.exports = { generateFileFromJSON };
