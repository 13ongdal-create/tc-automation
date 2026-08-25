const XLSX = require('./node_modules/xlsx');
const path = require('path');

const filePath = path.join(__dirname, '..', 'TopMall_서비스_업무정책서.xlsx');
const wb = XLSX.readFile(filePath);

console.log('=== 시트 목록 ===');
wb.SheetNames.forEach(n => console.log('  -', n));

wb.SheetNames.forEach(sheetName => {
  const ws = wb.Sheets[sheetName];
  const data = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
  console.log(`\n\n========== [${sheetName}] ==========`);
  data.slice(0, 120).forEach((row, i) => {
    const line = row.map(c => String(c).substring(0, 80)).join(' | ');
    if (line.replace(/\|/g,'').trim()) {
      console.log(`R${i+1}: ${line}`);
    }
  });
});
