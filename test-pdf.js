const axios = require('axios');
const pdfParse = require('pdf-parse');
const fs = require('fs');

async function testPdf() {
  try {
    // We can't access Cloudinary directly without a URL, let's create a dummy PDF locally.
    const url = "https://res.cloudinary.com/demo/image/upload/fl_attachment/v1/sample.pdf";
    console.log("Downloading PDF...");
    const response = await axios.get(url, { responseType: 'arraybuffer' });
    const buffer = Buffer.from(response.data);
    console.log("Parsing PDF...");
    const data = await pdfParse(buffer);
    console.log("Text length:", data.text.length);
  } catch(e) {
    console.log("Error:", e.message);
  }
}
testPdf();
