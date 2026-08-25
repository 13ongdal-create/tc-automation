const XLSX = require('./node_modules/xlsx');
const wb = XLSX.readFile('../TopMall_서비스_업무정책서.xlsx');

const targetSheets = ['회원·인증','주문·결제','취소·환불·반품','포인트·쿠폰'];

wb.SheetNames.forEach(s => {
  const ws = wb.Sheets[s];
  const d = XLSX.utils.sheet_to_json(ws, {header:1, defval:''});
  console.log('\n\n===', s, '===');
  d.slice(0, 100).forEach((r, i) => {
    const l = r.map(c => String(c).substring(0, 120)).join(' | ');
    if (l.replace(/\|/g,'').trim()) console.log('R'+(i+1)+': '+l);
  });
});
