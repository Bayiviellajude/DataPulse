import { useState } from 'react';
import { Download, FileText, Table } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';

function toCSV(data) {
  if (!data || data.length === 0) return '';
  const keys = Object.keys(data[0]);
  const header = keys.join(',');
  const rows = data.map(row =>
    keys.map(k => {
      const val = row[k] == null ? '' : String(row[k]);
      return val.includes(',') || val.includes('"') || val.includes('\n')
        ? `"${val.replace(/"/g, '""')}"` : val;
    }).join(',')
  );
  return [header, ...rows].join('\n');
}

function toPDF(data, filename) {
  const html = `
    <html><head><style>
      body { font-family: monospace; font-size: 11px; padding: 20px; }
      h2 { margin-bottom: 16px; }
      table { border-collapse: collapse; width: 100%; }
      th, td { border: 1px solid #ccc; padding: 4px 8px; text-align: left; }
      th { background: #f0f0f0; font-weight: bold; }
      tr:nth-child(even) { background: #f9f9f9; }
    </style></head><body>
      <h2>${filename}</h2>
      <table>
        <thead><tr>${data.length ? Object.keys(data[0]).map(k => `<th>${k}</th>`).join('') : ''}</tr></thead>
        <tbody>${data.map(row => `<tr>${Object.values(row).map(v => `<td>${v ?? ''}</td>`).join('')}</tr>`).join('')}</tbody>
      </table>
    </body></html>
  `;
  const win = window.open('', '_blank');
  win.document.write(html);
  win.document.close();
  win.print();
}

export default function ExportButton({ data = [], filename = 'export', label = 'Export' }) {
  const exportCSV = () => {
    const csv = toCSV(data);
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${filename}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button size="sm" variant="outline" className="font-mono text-xs">
          <Download className="w-3.5 h-3.5 mr-1.5" />
          {label}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={exportCSV} className="font-mono text-xs cursor-pointer">
          <Table className="w-3.5 h-3.5 mr-2" /> Export as CSV
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => toPDF(data, filename)} className="font-mono text-xs cursor-pointer">
          <FileText className="w-3.5 h-3.5 mr-2" /> Export as PDF (Print)
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}