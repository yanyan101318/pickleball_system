import { useRef, useCallback } from "react";
import { jsPDF } from "jspdf";
import { Printer, Download, X } from "lucide-react";

/**
 * @typedef {object} ReceiptModel
 * @property {string} transactionId
 * @property {string} date
 * @property {string} timeSlot
 * @property {string} courtName
 * @property {number} duration
 * @property {string} playerName
 * @property {string} paymentMethodLabel
 * @property {string} paymentPlanLabel
 * @property {number} totalAmount
 * @property {number} amountPaid
 * @property {number} remainingBalance
 * @property {number|null} [change]
 * @property {string} customerPayStatus
 */

function statusBadgeClass(status) {
  const s = String(status || "").toLowerCase();
  if (s === "paid") return "bg-emerald-500/20 text-emerald-300 border-emerald-500/30";
  if (s === "partial") return "bg-amber-500/20 text-amber-300 border-amber-500/30";
  return "bg-slate-600/30 text-slate-300 border-slate-500/30";
}

/**
 * @param {{ receipt: ReceiptModel, onDismiss?: () => void, className?: string }} props
 */
export default function BookingReceipt({ receipt, onDismiss, className = "" }) {
  const printRef = useRef(null);

  const handlePrint = useCallback(() => {
    const w = window.open("", "_blank", "noopener,noreferrer,width=420,height=720");
    if (!w) return;
    const node = printRef.current;
    if (!node) return;
    w.document.write(
      `<!DOCTYPE html><html><head><meta charset="utf-8"/><title>Receipt ${receipt.transactionId}</title>
      <style>
        body{margin:0;padding:24px;background:#0f172a;color:#e2e8f0;font:14px system-ui,sans-serif;}
        h1{font-size:18px;margin:0 0 4px;color:#fff;}
        .muted{color:#94a3b8;font-size:12px;margin-bottom:20px;}
        table{width:100%;border-collapse:collapse;}
        td{padding:8px 0;border-bottom:1px solid #334155;}
        td:first-child{color:#94a3b8;width:42%;}
        .total{font-weight:700;color:#4ade80;}
      </style></head><body>${node.innerHTML}</body></html>`
    );
    w.document.close();
    w.focus();
    w.print();
    w.close();
  }, [receipt.transactionId]);

  const handlePdf = useCallback(() => {
    const doc = new jsPDF({ unit: "pt", format: "a4" });
    const line = 18;
    let y = 48;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    doc.text("PicklePro — Booking receipt", 48, y);
    y += line * 1.2;
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(120);
    doc.text(`Transaction: ${receipt.transactionId}`, 48, y);
    y += line;
    doc.text(`Date: ${receipt.date} · ${receipt.timeSlot}`, 48, y);
    y += line * 2;
    doc.setTextColor(30);
    const rows = [
      ["Court", receipt.courtName],
      ["Duration", `${receipt.duration} hr`],
      ["Player", receipt.playerName],
      ["Payment", receipt.paymentMethodLabel],
      ["Plan", receipt.paymentPlanLabel],
      ["Total", `₱${receipt.totalAmount.toFixed(2)}`],
      ["Amount paid", `₱${receipt.amountPaid.toFixed(2)}`],
      ["Balance", `₱${receipt.remainingBalance.toFixed(2)}`],
    ];
    if (receipt.change != null && receipt.paymentMethodLabel === "Cash") {
      rows.push(["Change", `₱${receipt.change.toFixed(2)}`]);
    }
    rows.push(["Status", receipt.customerPayStatus]);
    for (const [k, v] of rows) {
      doc.text(`${k}:`, 48, y);
      doc.text(String(v), 200, y);
      y += line;
    }
    doc.save(`booking-receipt-${receipt.transactionId.slice(0, 8)}.pdf`);
  }, [receipt]);

  const r = receipt;

  return (
    <div className={`space-y-4 ${className}`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-white font-semibold text-sm tracking-wide uppercase">Receipt</h3>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={handlePrint}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-600 bg-slate-800/80 px-3 py-2 text-xs font-semibold text-slate-200 hover:border-green-500/50 hover:text-white transition-colors"
          >
            <Printer size={14} /> Print
          </button>
          <button
            type="button"
            onClick={handlePdf}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-600 bg-slate-800/80 px-3 py-2 text-xs font-semibold text-slate-200 hover:border-cyan-500/50 hover:text-white transition-colors"
          >
            <Download size={14} /> PDF
          </button>
          {onDismiss && (
            <button
              type="button"
              onClick={onDismiss}
              className="inline-flex items-center gap-1 rounded-lg p-2 text-slate-500 hover:text-white hover:bg-slate-800 transition-colors"
              aria-label="Close"
            >
              <X size={16} />
            </button>
          )}
        </div>
      </div>

      <div
        ref={printRef}
        className="booking-receipt-print-root rounded-xl border border-slate-700 bg-slate-900/60 p-5 text-left text-sm"
      >
        <h4 className="text-lg font-bold text-white m-0">PicklePro</h4>
        <p className="text-slate-500 text-xs mt-1 mb-4">Court booking receipt</p>
        <p className="text-slate-400 text-xs font-mono break-all mb-4">ID: {r.transactionId}</p>
        <table className="w-full text-sm">
          <tbody className="text-slate-300">
            <tr className="border-b border-slate-700/80">
              <td className="py-2 text-slate-500">Date</td>
              <td className="py-2 text-right text-white">{r.date}</td>
            </tr>
            <tr className="border-b border-slate-700/80">
              <td className="py-2 text-slate-500">Time</td>
              <td className="py-2 text-right text-white">{r.timeSlot}</td>
            </tr>
            <tr className="border-b border-slate-700/80">
              <td className="py-2 text-slate-500">Court</td>
              <td className="py-2 text-right text-white">{r.courtName}</td>
            </tr>
            <tr className="border-b border-slate-700/80">
              <td className="py-2 text-slate-500">Duration</td>
              <td className="py-2 text-right text-white">{r.duration} hr</td>
            </tr>
            <tr className="border-b border-slate-700/80">
              <td className="py-2 text-slate-500">Player</td>
              <td className="py-2 text-right text-white">{r.playerName}</td>
            </tr>
            <tr className="border-b border-slate-700/80">
              <td className="py-2 text-slate-500">Method</td>
              <td className="py-2 text-right text-white">{r.paymentMethodLabel}</td>
            </tr>
            <tr className="border-b border-slate-700/80">
              <td className="py-2 text-slate-500">Plan</td>
              <td className="py-2 text-right text-white">{r.paymentPlanLabel}</td>
            </tr>
            <tr className="border-b border-slate-700/80">
              <td className="py-2 text-slate-500">Total</td>
              <td className="py-2 text-right text-green-400 font-semibold">₱{r.totalAmount.toFixed(2)}</td>
            </tr>
            <tr className="border-b border-slate-700/80">
              <td className="py-2 text-slate-500">Amount paid</td>
              <td className="py-2 text-right text-white">₱{r.amountPaid.toFixed(2)}</td>
            </tr>
            <tr className="border-b border-slate-700/80">
              <td className="py-2 text-slate-500">Balance</td>
              <td className="py-2 text-right text-amber-300">₱{r.remainingBalance.toFixed(2)}</td>
            </tr>
            {r.change != null && r.paymentMethodLabel === "Cash" && (
              <tr className="border-b border-slate-700/80">
                <td className="py-2 text-slate-500">Change</td>
                <td className="py-2 text-right text-emerald-300">₱{r.change.toFixed(2)}</td>
              </tr>
            )}
          </tbody>
        </table>
        <div className="mt-4 flex justify-end">
          <span
            className={`inline-block rounded-full border px-3 py-1 text-[10px] font-bold uppercase tracking-wider ${statusBadgeClass(r.customerPayStatus)}`}
          >
            {r.customerPayStatus}
          </span>
        </div>
      </div>
    </div>
  );
}
